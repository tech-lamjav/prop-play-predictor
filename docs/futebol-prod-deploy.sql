-- ============================================================================
-- Futebol (Value Bet) — DDL da CAMADA DE VALOR (deploy manual em prod)
-- ----------------------------------------------------------------------------
-- NÃO é uma migration automática. Aplicar SOMENTE depois dos pré-requisitos do
-- runbook (docs/futebol-prod-deploy.md §1): extensão `wrappers` + chave do
-- BigQuery no Vault + FDW `bigquery_server` + schemas bq_futebol/futebol + as
-- foreign/native tables base + as outras 15 RPCs (exportar do dev, §3 do runbook).
--
-- Este arquivo contém o que a entrega da CAMADA DE VALOR construiu/alterou:
--   * foreign tables + nativas das premissas Handicap (ah), Ambos marcam (btts)
--     e Dupla chance (dc)
--   * procedure futebol.sync_all() (com ah + btts + dc no array)
--   * RPCs get_futebol_value_board e get_futebol_fixture_value (5 mercados,
--     com prob_justa_fechamento)
--   * cron de sync horário
-- Mercados cobertos: Resultado (1X2), Gols (Over/Under), Handicap asiático,
-- Ambos marcam (BTTS) e Dupla chance (1X / X2).
-- Projeto dev de origem: kpbjuplcwiyrymafhehz.
-- ============================================================================

-- ── Foreign tables (BQ → bq_futebol) — sem colunas ARRAY<STRING> ─────────────
drop foreign table if exists bq_futebol.int_futebol_premissas_ah;
create foreign table bq_futebol.int_futebol_premissas_ah (
  fixture_id bigint, competition text, season bigint, outcome text,
  line_value double precision, side_handicap double precision,
  is_favorito boolean, is_azarao boolean,
  supremacia boolean, tende_golear boolean, adversario_fragil_fora boolean,
  mando_forte boolean, sem_rodizio boolean,
  raramente_perde_por_2 boolean, defesa_fora_solida boolean, favorito_irregular boolean,
  handicap_alto boolean, pts_premissas bigint, penalidades_ah_pts bigint
) server bigquery_server options (table 'int_futebol_premissas_ah', location 'us-east1');

drop foreign table if exists bq_futebol.int_futebol_premissas_btts;
create foreign table bq_futebol.int_futebol_premissas_btts (
  fixture_id bigint, competition text, season bigint, outcome text,
  ambos_marcam boolean, ataque_dos_dois boolean, defesas_vazaveis boolean, historico_btts boolean,
  defesa_forte boolean, ataque_trava boolean, historico_seco boolean,
  pts_premissas bigint, penalidades_btts_pts bigint
) server bigquery_server options (table 'int_futebol_premissas_btts', location 'us-east1');

drop foreign table if exists bq_futebol.int_futebol_premissas_dc;
create foreign table bq_futebol.int_futebol_premissas_dc (
  fixture_id bigint, competition text, season bigint, outcome text,
  lado_coberto_forte boolean, equilibrio_defensivo boolean, adversario_limitado boolean, invicto_recente boolean,
  pts_premissas bigint, penalidades_dc_pts bigint
) server bigquery_server options (table 'int_futebol_premissas_dc', location 'us-east1');

-- ── Tabelas nativas (materializa + popula) ──────────────────────────────────
drop table if exists futebol.int_futebol_premissas_ah;
create table futebol.int_futebol_premissas_ah as select * from bq_futebol.int_futebol_premissas_ah;
drop table if exists futebol.int_futebol_premissas_btts;
create table futebol.int_futebol_premissas_btts as select * from bq_futebol.int_futebol_premissas_btts;
drop table if exists futebol.int_futebol_premissas_dc;
create table futebol.int_futebol_premissas_dc as select * from bq_futebol.int_futebol_premissas_dc;
-- (refrescar também as demais da camada de valor já existentes:)
-- truncate+insert de fact_value_opportunities, int_futebol_premissas_1x2/ou, int_futebol_odds_devig

-- ── Procedure de sync (inclui ah + btts + dc) ───────────────────────────────
-- IMPORTANTE: NÃO usar COMMIT dentro da procedure. O pg_cron roda `CALL` dentro
-- de uma transação e COMMIT dispara "invalid transaction termination" → a sync
-- falha TODA hora e as tabelas nativas ficam stale (parecendo "BQ desatualizado").
-- Rodar tudo numa transação única (também permite CALL via SQL editor/MCP).
-- Atenção a DRIFT de schema: se o Mateus mudar colunas de uma tabela no BQ, o
-- `select *` da foreign quebra ("Unrecognized name: <col>"); realinhar a foreign
-- table (e a nativa) ao schema atual do BQ.
create or replace procedure futebol.sync_all()
 language plpgsql security definer set search_path to ''
as $procedure$
declare
  t text;
  tables text[] := array[
    'dim_leagues','dim_teams','fact_fixtures','fact_fixture_stats',
    'fact_fixture_events','fact_fixture_lineups','fact_fixture_lineups_players',
    'fact_fixture_player_stats','fact_h2h','fact_injuries_snapshot',
    'fact_standings_snapshot','fact_team_season_stats','fact_odds_snapshot',
    'fact_predictions_api',
    'fact_value_opportunities','int_futebol_premissas_1x2','int_futebol_premissas_ou','int_futebol_premissas_ah','int_futebol_premissas_btts','int_futebol_premissas_dc','int_futebol_odds_devig'
  ];
begin
  foreach t in array tables loop
    execute format('truncate table futebol.%I', t);
    execute format('insert into futebol.%I select * from bq_futebol.%I', t, t);
  end loop;
end $procedure$;

-- ── RPC: board (lista de oportunidades, melhor por jogo no front) ────────────
create or replace function public.get_futebol_value_board()
returns table(
  fixture_id bigint, home_team_id bigint, away_team_id bigint,
  home_team_name text, away_team_name text, competition text,
  kickoff_utc timestamp without time zone, status_short text,
  market text, outcome text, line_value double precision,
  edge double precision, best_odd double precision, best_book text,
  avg_odd double precision, n_casas int, janela_usada text,
  prob_justa_fechamento double precision,
  pts_valor int, pts_premissas int, pts_corroboracao int, penalidades int, score int, faixa text,
  evidencias text[]
)
language sql security definer set search_path = '' as $$
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
  from futebol.fact_value_opportunities v
  join futebol.fact_fixtures f on f.fixture_id = v.fixture_id
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  order by v.score desc, v.edge desc;
$$;
grant execute on function public.get_futebol_value_board() to authenticated, anon;

-- ── RPC: detalhe por jogo (todos os mercados, com evidências/avisos/contras) ──
create or replace function public.get_futebol_fixture_value(p_fixture_id bigint)
returns table(market text, outcome text, outcome_order integer, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_valor integer, pts_premissas integer, pts_corroboracao integer, penalidades integer, penalidades_globais_pts integer, penalidades_especificas_pts integer, score integer, faixa text, modelo_api_concorda boolean, linha_sharp_confirma boolean, evidencias text[], avisos text[], contras text[])
language sql security definer set search_path to '' as $function$
  with d as (
    select distinct on (fixture_id, outcome_side, line_value) fixture_id, outcome_side, line_value,
      pen_odd_outlier, pen_poucas_casas, pen_odd_longshot, pen_odd_juice
    from futebol.int_futebol_odds_devig order by fixture_id, outcome_side, line_value
  )
  select v.market, v.outcome,
    (case when v.market = 'match_winner'
          then (case v.outcome when 'Home' then 1 when 'Draw' then 2 else 3 end)
          when v.market = 'goals_over_under'
          then (coalesce(v.line_value,0)*10 + case when v.outcome='Over' then 1 else 2 end)::int
          when v.market = 'asian_handicap'
          then (1000 + (case v.outcome when 'Home' then 0 else 500 end) + (coalesce(v.line_value,0)*10))::int
          when v.market = 'btts'
          then (2000 + case when v.outcome in ('Yes') then 0 else 1 end)
          when v.market = 'double_chance'
          then (3000 + case v.outcome when '1X' then 1 else 2 end)
          else 0 end),
    v.line_value, v.edge, v.best_odd, v.best_book, v.avg_odd, v.n_casas::int, v.janela_usada, v.prob_justa_fechamento,
    v.pts_valor::int, v.pts_premissas::int, v.pts_corroboracao::int, v.penalidades::int,
    v.penalidades_globais_pts::int, v.penalidades_especificas_pts::int, v.score::int, v.faixa,
    v.modelo_api_concorda, v.linha_sharp_confirma,
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
    array_remove(array[
      case when d.pen_odd_outlier then 'Só uma casa paga essa odd — pode ser linha furada' end,
      case when d.pen_poucas_casas then 'Poucas casas cotando esse mercado' end,
      case when d.pen_odd_longshot then 'Odd alta (zebra) — entra com cautela' end,
      case when d.pen_odd_juice and v.market <> 'double_chance' then 'Odd baixa — retorno pequeno pro risco' end,
      case when p.pick_empate then 'Empate é o resultado mais difícil de prever' end,
      case when p.desfalque_proprio then 'Time apostado com desfalque de titular importante' end,
      case when o.linha_extrema then 'Linha extrema — pouco confiável' end,
      case when ah.handicap_alto then 'Handicap alto (2,5+ gols) — raramente confiável' end
    ], null),
    (array_remove(array[
      case when not coalesce(p.forca_mismatch, true) then 'Sem vantagem clara de ataque × defesa' end,
      case when not coalesce(p.mando, true) and v.outcome <> 'Draw' then 'Mando não pesa a favor' end,
      case when not coalesce(p.superioridade_tabela, true) then 'Times equilibrados na tabela' end,
      case when v.outcome='Over' and not coalesce(o.ataque_combinado, true) then 'Os dois não somam tantos gols' end,
      case when v.outcome='Over' and not coalesce(o.ritmo_alto, true) then 'Jogo não costuma ser de ritmo alto' end,
      case when v.outcome='Over' and not coalesce(o.xg_combinado_alto, true) then 'O volume de chances não é tão alto' end,
      case when v.outcome='Under' and not coalesce(o.defesas_firmes, true) then 'As defesas não são tão firmes' end,
      case when v.outcome='Under' and not coalesce(o.clean_sheets_altos, true) then 'Não costumam segurar o placar zerado' end,
      case when v.outcome='Under' and not coalesce(o.xg_baixo_combinado, true) then 'Criam chances demais pra um jogo truncado' end,
      case when ah.is_favorito and not coalesce(ah.supremacia, true) then 'Não é tão superior assim ao adversário' end,
      case when ah.is_favorito and not coalesce(ah.tende_golear, true) then 'Nem sempre vence com boa diferença' end,
      case when ah.is_azarao and not coalesce(ah.raramente_perde_por_2, true) then 'Já levou goleada algumas vezes' end,
      case when ah.is_azarao and not coalesce(ah.defesa_fora_solida, true) then 'Defesa fora não é das mais sólidas' end,
      case when v.outcome='Yes' and not coalesce(bt.ambos_marcam, true) then 'Nem sempre os dois marcam' end,
      case when v.outcome='Yes' and not coalesce(bt.defesas_vazaveis, true) then 'As defesas não são tão vazadas' end,
      case when v.outcome='No' and not coalesce(bt.defesa_forte, true) then 'Nenhuma defesa é tão sólida' end,
      case when v.outcome='No' and not coalesce(bt.ataque_trava, true) then 'Os dois ataques costumam marcar' end,
      case when not coalesce(dc.lado_coberto_forte, true) then 'O lado coberto não é claramente o mais forte' end,
      case when not coalesce(dc.adversario_limitado, true) then 'Adversário não é tão limitado' end
    ], null))[1:3]
  from futebol.fact_value_opportunities v
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  left join d on d.fixture_id = v.fixture_id and d.outcome_side = v.outcome and d.line_value is not distinct from v.line_value
  where v.fixture_id = p_fixture_id
  order by (case v.market when 'match_winner' then 1 when 'goals_over_under' then 2 when 'asian_handicap' then 3 when 'btts' then 4 when 'double_chance' then 5 else 9 end), 3;
$function$;
grant execute on function public.get_futebol_fixture_value(bigint) to authenticated, anon;

-- ── Cron: sync horário ───────────────────────────────────────────────────────
-- select cron.schedule('futebol-sync-daily', '0 * * * *', $$CALL futebol.sync_all()$$);
-- (no dev já existe o job; em prod, criar após o passo 7 do runbook.)
