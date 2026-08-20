-- ============================================================================
-- 101 · O histórico do produto é point-in-time no apito
-- ============================================================================
-- Passo 1 de 3 do A0 (expurgo do board). Spec: analytics-engineering#80,
-- decisão em `dbt_futebol/docs/adr/0009-o-historico-do-produto-e-point-in-time-no-apito.md`.
-- A ordem de entrega é parte da decisão e NÃO pode ser trocada:
--
--   1. esta migration (RPC)   ← você está aqui
--   2. front lendo a RPC nova
--   3. expurgo no mart, do lado do analytics-engineering
--
-- Expurgar antes de 1 e 2 esvazia o Histórico EM SILÊNCIO: o check_schema_parity
-- passa e as RPCs devolvem 200. É a mesma falha de 07/08 e 10/08 registrada em
-- `contrato-serving-rpcs.md`.
--
-- ----------------------------------------------------------------------------
-- O QUE ESTÁ ERRADO HOJE
-- ----------------------------------------------------------------------------
-- `futebol.fact_value_opportunities` é reconstruída inteira a cada execução e não
-- filtra data: a linha de um jogo encerrado continua sendo reavaliada e reemitida.
-- Medido no PRD em 17/08/2026 pelo Matheus: 121 linhas no board, 2 de jogo futuro,
-- a mais antiga de 19/06. E 97% das versões do `_hist` (14.946 de 15.452)
-- nasceram DEPOIS do apito, em média 668 horas depois.
--
-- Como a aba Histórico e o bloco "registro pós-jogo" leem o board vivo, o app
-- hoje contabiliza acerto e erro de linhas que só existiram depois do jogo, e
-- para as demais mostra a nota recalculada semanas depois, não a publicada.
--
-- ----------------------------------------------------------------------------
-- A REGRA
-- ----------------------------------------------------------------------------
-- O board é a janela do que ainda dá para apostar. O passado é servido pelo
-- `_hist`, na versão que estava VIVA NO APITO:
--
--   dbt_valid_from <= kickoff_utc < dbt_valid_to
--
-- Estrito, sem tolerância. `dbt_valid_to` nulo é a versão ainda aberta, e conta
-- como infinito. Uma linha que nasceu depois do apito não satisfaz a primeira
-- desigualdade e simplesmente não aparece: é exatamente o que se quer.
--
-- Conferido no staging antes de escrever: ZERO chaves com mais de uma versão viva
-- no apito, então o grão de 1 linha por `opportunity_key` sai do próprio dado e
-- não precisa de DISTINCT ON. Se um dia isso mudar, é bug de SCD no dbt, e o
-- lugar de tratar é lá, não aqui, escondendo com desempate arbitrário (foi
-- exatamente esse erro que a 098 teve que consertar).
--
-- ⚠️ Isto NÃO vale para o funil da A7. A ADR 0006 decidiu o oposto de propósito:
-- jogo encerrado CONTINUA no funil, porque é ele que responde quanto rendeu a
-- faixa descartada. Expurgo é só do board.
--
-- ----------------------------------------------------------------------------
-- ⚠️ ANTES DE APLICAR EM PRODUÇÃO
-- ----------------------------------------------------------------------------
-- Os corpos abaixo foram capturados do STAGING (kpbjuplcwiyrymafhehz), que é o
-- único ambiente onde tenho leitura. Diferenças conhecidas: as migrations 097 a
-- 100 estão na develop e NÃO estão em produção. Esta migration presume que elas
-- sobem antes ou junto. Rodar todas na mesma janela.
--
-- Rodar antes, em PRD, e comparar com o staging:
--   select pg_get_functiondef('public.get_futebol_fixture_value(bigint)'::regprocedure);
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RPC NOVA: get_futebol_value_history(p_from, p_to)
-- ----------------------------------------------------------------------------
-- Mesmas colunas de `get_futebol_value_board`, na mesma ordem, de propósito: o
-- front reaproveita `FutebolValueBoardRow` inteiro em vez de ganhar um segundo
-- tipo quase igual. Se um dia o board ganhar coluna, esta função ganha junto ou
-- o front quebra no primeiro campo divergente.
--
-- A janela é por DIA BRT, via `public.futebol_dia_brt` (migration 092), e não por
-- kickoff_utc cru. O front agrupa por dia BRT no stepper; filtrar por UTC aqui
-- faria o jogo das 21h de um dia cair no dia seguinte e sumir da lista.
--
-- As evidências são remontadas das `int_futebol_premissas_*`, que são de estado
-- CORRENTE, não point-in-time. Para um jogo encerrado elas devem ser estáveis
-- (a task [0] tirou o look-ahead das premissas), mas isso é premissa e não
-- verificação minha. O que é garantidamente PIT aqui são os NÚMEROS: score,
-- odd, edge, faixa, penalidades. Registrado como pergunta pro Matheus.
create or replace function public.get_futebol_value_history(
  p_from date,
  p_to   date
)
returns table(
  fixture_id bigint, home_team_id bigint, away_team_id bigint,
  home_team_name text, away_team_name text, competition text,
  kickoff_utc timestamp without time zone, status_short text,
  market text, outcome text, line_value double precision,
  edge double precision, best_odd double precision, best_book text,
  avg_odd double precision, n_casas integer, janela_usada text,
  prob_justa_fechamento double precision,
  pts_valor integer, pts_premissas integer, pts_corroboracao integer,
  penalidades integer, score integer, faixa text,
  evidencias text[], premissas_sem_dado integer
)
language sql
security definer
set search_path to ''
as $function$
  with v as (
    select h.*
    from futebol.fact_value_opportunities_hist h
    join futebol.fact_fixtures fx on fx.fixture_id = h.fixture_id
    where public.futebol_dia_brt(fx.kickoff_utc) between p_from and p_to
      and h.dbt_valid_from <= fx.kickoff_utc
      and (h.dbt_valid_to is null or fx.kickoff_utc < h.dbt_valid_to)
  )
  select v.fixture_id, f.home_team_id, f.away_team_id, f.home_team_name, f.away_team_name,
    f.competition, f.kickoff_utc, f.status_short,
    v.market, v.outcome, v.line_value, v.edge, v.best_odd, v.best_book, v.avg_odd, v.n_casas::int, v.janela_usada, v.prob_justa_fechamento,
    v.pts_valor::int, v.pts_premissas::int, v.pts_corroboracao::int, v.penalidades::int, v.score::int, v.faixa,
    array_remove(array[
      case when p.forca_mismatch then 'Ataque forte contra defesa frágil do adversário' end,
      case when p.superioridade_xg then 'Cria mais chances de gol do que o adversário' end,
      case when p.mando then (case v.outcome when 'Home' then 'Manda bem em casa' when 'Away' then 'Vai bem fora de casa' else 'Mando relevante' end) end,
      case when p.desfalque_adversario then 'Adversário com desfalque de titular importante' end,
      case when p.superioridade_tabela then 'Bem à frente na tabela' end,
      case when p.forma then 'Em boa fase (vitórias recentes)' end,
      case when p.h2h_favoravel then 'Histórico favorável no confronto direto' end
    ], null)
    || array_remove(array[
      case when o.ataque_combinado then 'Os dois somam muitos gols (casa + fora)' end,
      case when o.defesas_vazaveis then 'Defesas frágeis dos dois lados' end,
      case when o.xg_combinado_alto then 'Os dois criam muitas chances de gol' end,
      case when o.ritmo_alto then 'Jogo de ritmo alto (muitas finalizações)' end,
      case when o.ambos_vazam then 'Os dois sofrem gol quase todo jogo' end,
      case when o.historico_over then 'Últimos jogos goleadores' end,
      case when o.linha_subindo then 'Mercado puxando a linha pra cima' end,
      case when o.defesas_firmes then 'Defesas firmes dos dois lados' end,
      case when o.clean_sheets_altos then 'Os dois passam muitos jogos sem sofrer gol' end,
      case when o.xg_baixo_combinado then 'Os dois criam pouca coisa na frente' end,
      case when o.ataques_fracos then 'Ataque fraco (passam em branco com frequência)' end,
      case when o.historico_under then 'Últimos jogos truncados' end,
      case when o.linha_descendo then 'Mercado puxando a linha pra baixo' end
    ], null)
    || array_remove(array[
      case when ah.supremacia then 'Muito superior ao adversário' end,
      case when ah.tende_golear then 'Costuma vencer com boa diferença de gols' end,
      case when ah.adversario_fragil_fora then 'Adversário tem defesa frágil' end,
      case when ah.mando_forte then 'Manda muito bem em casa' end,
      case when ah.sem_rodizio then 'Deve entrar com força máxima' end,
      case when ah.raramente_perde_por_2 then 'Raramente perde por 2 gols ou mais' end,
      case when ah.defesa_fora_solida then 'Defesa sólida jogando fora' end,
      case when ah.favorito_irregular then 'O favorito não costuma golear' end
    ], null)
    || array_remove(array[
      case when bt.ambos_marcam then 'Os dois quase sempre marcam' end,
      case when bt.ataque_dos_dois then 'Os dois ataques vêm produzindo' end,
      case when bt.defesas_vazaveis then 'As duas defesas sofrem gol com frequência' end,
      case when bt.historico_btts then 'Nos últimos jogos, os dois marcaram' end,
      case when bt.defesa_forte then 'Uma das defesas segura bem o placar' end,
      case when bt.ataque_trava then 'Um dos ataques costuma passar em branco' end,
      case when bt.historico_seco then 'Jogos recentes sem os dois marcarem' end
    ], null)
    || array_remove(array[
      case when dc.lado_coberto_forte then 'O lado coberto é claramente o mais forte' end,
      case when dc.equilibrio_defensivo then 'Defesas parelhas — empate é desfecho plausível' end,
      case when dc.adversario_limitado then 'Adversário com campanha fraca' end,
      case when dc.invicto_recente then 'Vem sem perder nos últimos jogos' end
    ], null)
    || array_remove(array[
      case when v.modelo_api_concorda and v.linha_sharp_confirma then 'As principais casas e o modelo da API apontam o mesmo lado'
           when v.modelo_api_concorda then 'Modelo da API concorda com esse lado'
           when v.linha_sharp_confirma then 'As principais casas vêm baixando a odd desse lado' end
    ], null),
    v.premissas_sem_dado::int
  from v
  join futebol.fact_fixtures f on f.fixture_id = v.fixture_id
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  order by f.kickoff_utc desc, v.score desc, v.edge desc;
$function$;

grant execute on function public.get_futebol_value_history(date, date) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. get_futebol_fixture_value: mesma assinatura, só a FONTE muda
-- ----------------------------------------------------------------------------
-- Kickoff no futuro → board, como sempre foi.
-- Kickoff no passado → foto do apito, do `_hist`.
--
-- É *kickoff passado*, e NÃO *jogo terminado*, de propósito. Depois do passo 3 o
-- mart vai expurgar também os status ao vivo, então se o corte fosse "terminado"
-- a tela ficaria vazia durante as ~2h de bola rolando: o board já não teria a
-- linha e o `_hist` ainda não seria consultado.
--
-- A troca é feita por substituição guardada sobre a definição VIVA, e não
-- transcrevendo o corpo (10.354 caracteres, mexido pela 098 e pela 100). Assim a
-- migration não desfaz sem querer o que veio antes dela. Duas âncoras, as duas
-- conferidas por unicidade antes de trocar.
do $do$
declare
  v_def text;
  v_novo text;
  v_ancora_cte  constant text := 'with d as (';
  v_ancora_from constant text := 'from futebol.fact_value_opportunities v';
  -- As 28 colunas de fact_value_opportunities, na ordem ordinal. O _hist é
  -- superconjunto exato (mesmas 28 + as 5 de SCD), conferido no staging, então a
  -- lista serve aos dois lados do union sem cast nenhum.
  v_cols constant text :=
    'fixture_id, market, outcome, line_value, competition, season, edge, pts_valor, '
    || 'pts_premissas, pts_corroboracao, penalidades, score, faixa, best_odd, best_book, '
    || 'avg_odd, n_casas, prob_justa_fechamento, valor_fonte, janela_usada, '
    || 'penalidades_globais_pts, penalidades_especificas_pts, modelo_api_concorda, '
    || 'linha_sharp_confirma, pin_n_outcomes, is_half_line, dbt_loaded_at, premissas_sem_dado';
  v_cte text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_futebol_fixture_value'
    and pg_get_function_identity_arguments(p.oid) = 'p_fixture_id bigint';

  if v_def is null then
    raise exception '101: get_futebol_fixture_value(bigint) não existe. Aplique 097–100 antes.';
  end if;

  -- Idempotência: se já tem a CTE de fonte, a migration já rodou.
  if position('v_src as (' in v_def) > 0 then
    raise notice '101: get_futebol_fixture_value já lê o PIT, nada a fazer.';
    return;
  end if;

  -- Unicidade das duas âncoras. Se a função mudar de forma no futuro, é melhor
  -- esta migration explodir do que trocar o pedaço errado em silêncio.
  if array_length(string_to_array(v_def, v_ancora_cte), 1) - 1 <> 1 then
    raise exception '101: âncora % aparece % vez(es), esperava exatamente 1.',
      v_ancora_cte, array_length(string_to_array(v_def, v_ancora_cte), 1) - 1;
  end if;
  if array_length(string_to_array(v_def, v_ancora_from), 1) - 1 <> 1 then
    raise exception '101: âncora % aparece % vez(es), esperava exatamente 1.',
      v_ancora_from, array_length(string_to_array(v_def, v_ancora_from), 1) - 1;
  end if;

  v_cte :=
    'with v_src as (' || chr(10)
    || '    select ' || v_cols || chr(10)
    || '    from futebol.fact_value_opportunities' || chr(10)
    || '    where fixture_id = p_fixture_id' || chr(10)
    || '      and exists (select 1 from futebol.fact_fixtures fx' || chr(10)
    || '                   where fx.fixture_id = p_fixture_id and fx.kickoff_utc > now())' || chr(10)
    || '    union all' || chr(10)
    || '    select ' || v_cols || chr(10)
    || '    from futebol.fact_value_opportunities_hist h' || chr(10)
    || '    where h.fixture_id = p_fixture_id' || chr(10)
    || '      and exists (select 1 from futebol.fact_fixtures fx' || chr(10)
    || '                   where fx.fixture_id = p_fixture_id' || chr(10)
    || '                     and fx.kickoff_utc <= now()' || chr(10)
    || '                     and h.dbt_valid_from <= fx.kickoff_utc' || chr(10)
    || '                     and (h.dbt_valid_to is null or fx.kickoff_utc < h.dbt_valid_to))' || chr(10)
    || '  ),' || chr(10)
    || '  d as (';

  v_novo := replace(v_def, v_ancora_cte, v_cte);
  v_novo := replace(v_novo, v_ancora_from, 'from v_src v');

  execute v_novo;
  raise notice '101: get_futebol_fixture_value passou a ler o PIT do _hist para kickoff passado.';
end
$do$;

-- O Supabase concede EXECUTE por ALTER DEFAULT PRIVILEGES em função NOVA, e o
-- CREATE OR REPLACE do bloco acima não é nova. Explícito para não depender disso.
grant execute on function public.get_futebol_fixture_value(bigint) to anon, authenticated, service_role;
