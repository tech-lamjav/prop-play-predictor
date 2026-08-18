-- ============================================================================
-- 091 · Futebol — histórico point-in-time do board (ADR 0009)
--   issue: tech-lamjav/prop-play-predictor#257
--   mãe:   tech-lamjav/analytics-engineering#80
--
-- A aba Histórico de /futebol/oportunidades passava a nota RECALCULADA (lia
-- `get_futebol_value_board()`, que não filtra data e reconstrói tudo a cada run).
-- Ela passa a ler daqui: a oportunidade COMO FOI PUBLICADA, na versão do
-- snapshot `futebol.fact_value_opportunities_hist` que estava viva no apito.
--
-- Decisões travadas nesta migração:
--   • Grão = 1 linha por `opportunity_key`. `DISTINCT ON` blinda o grão mesmo
--     se o snapshot algum dia produzir janelas sobrepostas.
--   • PIT estrito, sem tolerância: dbt_valid_from <= kickoff < dbt_valid_to
--     (`dbt_valid_to` nulo = versão aberta). Chave sem versão viva no apito
--     não aparece — não cai para a versão mais próxima.
--   • Só jogo cujo apito JÁ SOOU (`kickoff < now()`): antes do apito não existe
--     "versão viva no apito", e a versão aberta de uma chave que saiu do board
--     apareceria como oportunidade viva. O presente/futuro é do board.
--   • Janela p_from/p_to é em DIA DE BRASÍLIA, não UTC: 21:30 BRT é 00:30 UTC
--     do dia seguinte, horário de metade do calendário brasileiro. Os limites
--     são convertidos UMA vez (sargable), não linha a linha.
--   • O `RETURNS TABLE` espelha **campo a campo** o de `get_futebol_value_board`
--     em PRODUÇÃO, para o front reaproveitar `FutebolValueBoardRow` inteiro.
--     Ficam de fora, como no board, as colunas `janela_deteccao` e
--     `premissas_sem_dado` — existem na tabela, não no contrato.
--   • `get_futebol_value_board` NÃO é tocada (nem assinatura, nem corpo).
--
-- `evidencias` sai das tabelas de premissas CORRENTES (mesmos joins do board):
-- não existe snapshot PIT delas. É best-effort e pode vir vazio em jogo antigo.
--
-- Idempotente de propósito: aplicada por psycopg no dev e no prd (o schema
-- `futebol` é deliberadamente não-migration), e o CI pode reexecutar o arquivo.
-- ============================================================================

-- O dev tinha um rascunho desta RPC com outro `RETURNS TABLE` (espelhava o board
-- do DEV, que declara `premissas_sem_dado` a mais — deriva do dev, o prd não tem).
-- `CREATE OR REPLACE` não muda tipo de retorno; o DROP deixa o arquivo reexecutável.
DROP FUNCTION IF EXISTS public.get_futebol_value_history(date, date);

CREATE OR REPLACE FUNCTION public.get_futebol_value_history(p_from date, p_to date)
 RETURNS TABLE(fixture_id bigint, home_team_id bigint, away_team_id bigint, home_team_name text, away_team_name text, competition text, kickoff_utc timestamp without time zone, status_short text, market text, outcome text, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_valor integer, pts_premissas integer, pts_corroboracao integer, penalidades integer, score integer, faixa text, evidencias text[])
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with pit as (
    select distinct on (h.opportunity_key)
      h.fixture_id, h.market, h.outcome, h.line_value, h.edge,
      h.best_odd, h.best_book, h.avg_odd, h.n_casas, h.janela_usada,
      h.prob_justa_fechamento, h.pts_valor, h.pts_premissas, h.pts_corroboracao,
      h.penalidades, h.score, h.faixa,
      h.modelo_api_concorda, h.linha_sharp_confirma
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
    ], null)
  from pit v
  join futebol.fact_fixtures f on f.fixture_id = v.fixture_id
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  order by v.score desc, v.edge desc;
$function$;

-- Índice: o gargalo da RPC é a JANELA, não o predicado PIT. `fact_fixtures` não
-- tinha índice em `kickoff_utc` (10.5k linhas, 204 na janela de 30 dias) e o
-- planner varria a tabela inteira: a seleção PIT caiu de 85 ms para 6,3 ms
-- (medido no dev, EXPLAIN ANALYZE, com bitmap index scan no lugar do seq scan).
-- Um índice em (dbt_valid_from, dbt_valid_to) do `hist` foi testado e o planner
-- NÃO usa — o hash join varre o `hist` de qualquer jeito; ficou de fora.
-- As duas tabelas são recarregadas por TRUNCATE + COPY (não recriam a tabela),
-- então o índice sobrevive ao sync.
DROP INDEX IF EXISTS futebol.fact_value_opportunities_hist_valid_idx;
CREATE INDEX IF NOT EXISTS fact_fixtures_kickoff_utc_idx
  ON futebol.fact_fixtures (kickoff_utc);

GRANT EXECUTE ON FUNCTION public.get_futebol_value_history(p_from date, p_to date) TO anon, authenticated, service_role;
