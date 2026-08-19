-- ============================================================================
-- 102 · Endurece a RPC de histórico point-in-time
-- ============================================================================
-- Absorve as melhorias do PR #259 do Matheus (`feat/futebol-value-history`),
-- que implementou a mesma entrega em paralelo, sem que nenhum dos dois lados
-- soubesse do outro. A base aqui é a 101 (já na develop); o que muda é o corpo
-- da `get_futebol_value_history`, com quatro coisas que ele fez melhor.
--
-- A assinatura NÃO muda, então `create or replace` basta, sem `drop function`.
--
-- ----------------------------------------------------------------------------
-- 1. GUARDA `kickoff < now()` — é conserto de defeito, não polimento
-- ----------------------------------------------------------------------------
-- A 101 filtra só pela janela de dias. O problema é que o predicado PIT
--
--     dbt_valid_from <= kickoff  AND  (dbt_valid_to is null OR kickoff < dbt_valid_to)
--
-- é satisfeito À TOA por um jogo que ainda não começou: a versão aberta tem
-- `dbt_valid_to` nulo e nasceu antes do kickoff futuro. Medido no dev em
-- 18/08: 7 versões abertas de jogos futuros passam no predicado.
--
-- O efeito seria uma chave que JÁ SAIU do board voltando à tela como
-- oportunidade viva, servida pela função que existe justamente para mostrar o
-- passado. Não disparou até agora por sorte de calendário.
--
-- ----------------------------------------------------------------------------
-- 2. `DISTINCT ON (opportunity_key)` — blindagem, não desempate arbitrário
-- ----------------------------------------------------------------------------
-- A 101 confiou na medição ("zero chaves com mais de uma versão viva no apito")
-- e deixou o grão por conta do dado. Continua verdade, e continua sendo bug de
-- SCD se deixar de ser. Mas a blindagem é barata e o desempate é EXPLÍCITO
-- (`dbt_valid_from desc`, a mais recente das vivas), então não é o desempate
-- arbitrário que a 098 teve que consertar: lá o `DISTINCT ON` não tinha
-- ordenação completa e o Postgres escolhia sozinho.
--
-- ----------------------------------------------------------------------------
-- 3. JANELA BRT SARGÁVEL — a 101 impedia o índice
-- ----------------------------------------------------------------------------
-- A 101 filtra com `public.futebol_dia_brt(fx.kickoff_utc) between p_from and p_to`.
-- Isso chama a função linha a linha e não usa índice nenhum. Aqui os limites do
-- dia são convertidos UMA vez, e a comparação vira `kickoff_utc >= X and < Y`.
--
-- O resultado é o mesmo: a conversão de um dia BRT para o intervalo UTC
-- correspondente é exatamente o que a `futebol_dia_brt` faz ao contrário.
--
-- ----------------------------------------------------------------------------
-- 4. ÍNDICE em `fact_fixtures(kickoff_utc)`
-- ----------------------------------------------------------------------------
-- Não existia, e o planner varria a tabela inteira. Medido pelo Matheus: a
-- seleção PIT de 30 dias cai de 85 ms para 6,3 ms.
--
-- ----------------------------------------------------------------------------
-- ⚠️ DIVERGÊNCIA DELIBERADA COM O #259: `premissas_sem_dado` FICA
-- ----------------------------------------------------------------------------
-- A RPC dele não devolve a coluna, espelhando o board de PRODUÇÃO. Aqui ela
-- fica, e o motivo é que produção é que está atrasada:
--
--   · a 099 (na develop, aguardando deploy) põe `premissas_sem_dado` no board
--   · o `docs/futebol-prod-deploy.sql` já declara o board COM a coluna desde o
--     PR #248, então o espelho do #259 contradiz a própria regra dele de
--     "espelhar o RETURNS TABLE do board"
--   · o deploy é das 097-103 na MESMA janela, então board e histórico nascem
--     em produção com o mesmo contrato, no mesmo instante
--
-- ----------------------------------------------------------------------------
-- ⚠️ DÍVIDA CONHECIDA, herdada e agora com três cópias
-- ----------------------------------------------------------------------------
-- A cascata de `evidencias` abaixo é a TERCEIRA cópia verbatim das mesmas
-- rotulagens (as outras em `get_futebol_value_board` e
-- `get_futebol_fixture_value`). Mercado novo agora mexe em três RPCs. Extrair
-- para um helper exige tocar no board, que estava fora do escopo do A0; fica
-- registrado para quem puder mexer nas três de uma vez.
--
-- As `evidencias` saem das tabelas de premissas CORRENTES, não de um snapshot:
-- não existe versão PIT delas. É best-effort e pode vir vazia em jogo antigo.
-- O que é garantidamente point-in-time aqui são os NÚMEROS.
--
-- ⚠️ EM PRODUÇÃO: aplicar depois da 101, e na mesma janela das 097-103.
-- ============================================================================

-- Índice primeiro: barato, idempotente, e a função abaixo depende dele para o
-- ganho de tempo. `if not exists` porque o shape file também o declara.
create index if not exists fact_fixtures_kickoff_utc_idx
  on futebol.fact_fixtures using btree (kickoff_utc);

-- `drop` antes do `create`, e não `create or replace`, porque a função pode
-- existir com DOIS contratos diferentes dependendo do ambiente, e o Postgres
-- recusa `replace` quando o `RETURNS TABLE` muda:
--
--   · produção e develop: a versão da 101, COM `premissas_sem_dado`
--   · o projeto de DEV:   a versão do PR #259, SEM a coluna (o Matheus aplicou
--     a dele lá em 18/08, por cima da nossa; os dois lados escreveram no mesmo
--     banco de desenvolvimento sem saber)
--
-- Nada depende desta função além do app (é RPC folha), então o drop é seguro.
-- O grant logo abaixo é obrigatório justamente por causa do drop: o
-- `ALTER DEFAULT PRIVILEGES` do Supabase só vale para função nova, e uma
-- recriada não herda o grant da que morreu.
drop function if exists public.get_futebol_value_history(date, date);

create function public.get_futebol_value_history(
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
  with pit as (
    select distinct on (h.opportunity_key)
      h.fixture_id, h.market, h.outcome, h.line_value, h.edge,
      h.best_odd, h.best_book, h.avg_odd, h.n_casas, h.janela_usada,
      h.prob_justa_fechamento, h.pts_valor, h.pts_premissas, h.pts_corroboracao,
      h.penalidades, h.score, h.faixa,
      h.modelo_api_concorda, h.linha_sharp_confirma, h.premissas_sem_dado
    from futebol.fact_value_opportunities_hist h
    join futebol.fact_fixtures fx on fx.fixture_id = h.fixture_id
    where fx.kickoff_utc >= ((p_from::timestamp at time zone 'America/Sao_Paulo') at time zone 'UTC')
      and fx.kickoff_utc <  (((p_to + 1)::timestamp at time zone 'America/Sao_Paulo') at time zone 'UTC')
      and fx.kickoff_utc <  (now() at time zone 'UTC')
      and h.dbt_valid_from <= fx.kickoff_utc
      and (h.dbt_valid_to is null or fx.kickoff_utc < h.dbt_valid_to)
    order by h.opportunity_key, h.dbt_valid_from desc
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
  from pit v
  join futebol.fact_fixtures f on f.fixture_id = v.fixture_id
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  order by f.kickoff_utc desc, v.score desc, v.edge desc;
$function$;

grant execute on function public.get_futebol_value_history(date, date) to anon, authenticated, service_role;
