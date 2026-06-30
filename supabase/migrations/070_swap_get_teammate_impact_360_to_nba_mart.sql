-- ============================================================
-- Cleanup pós-FDW: última RPC órfã apontando pra bigquery.*
-- ============================================================
-- Varredura de pg_proc em 2026-06-15 mostrou que UMA única função public
-- ainda referencia o schema `bigquery` (dropado na migration 058):
-- get_teammate_impact_360. As outras 6 órfãs listadas no comentário da
-- migration 059 (get_opponent_rankings, get_player_passing_season,
-- get_player_period_stats, get_team_opp_shooting_zones, get_team_playtypes,
-- get_player_historical_stats) NÃO existem mais em prod.
--
-- A tabela dim_teammate_impact_360 já vive em nba_mart (criada pela 055 e
-- sincronizada pelo Cloud Run), então é um swap puro de schema —
-- bigquery.dim_teammate_impact_360 -> nba_mart.dim_teammate_impact_360, sem
-- mudança de colunas nem cast (tipos batem 1:1 com o RETURNS).
--
-- A função estava quebrada em prod desde a 058 ("schema bigquery does not
-- exist"); o frontend não a chama hoje (verificado), mas o fix remove a
-- última referência pendente ao FDW.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_teammate_impact_360(bigint);
CREATE FUNCTION public.get_teammate_impact_360(p_trigger_player_id bigint)
RETURNS TABLE (
  trigger_player_id bigint, trigger_name text, trigger_team_id bigint,
  trigger_team_abbr text, trigger_status text, teammate_player_id bigint,
  teammate_name text, teammate_position text, stat_type text,
  avg_com double precision, avg_sem double precision, stddev_sem double precision,
  gap double precision, gap_pct double precision, jogos_com bigint,
  jogos_sem bigint, teammate_avg_minutes double precision
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.trigger_player_id, d.trigger_name,
    d.trigger_team_id, d.trigger_team_abbr, d.trigger_status,
    d.teammate_player_id, d.teammate_name, d.teammate_position,
    d.stat_type,
    d.avg_com, d.avg_sem, d.stddev_sem,
    d.gap, d.gap_pct,
    d.jogos_com, d.jogos_sem,
    d.teammate_avg_minutes
  FROM nba_mart.dim_teammate_impact_360 d
  WHERE d.trigger_player_id = p_trigger_player_id
  ORDER BY d.stat_type, d.gap_pct DESC NULLS LAST;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_teammate_impact_360(bigint) TO authenticated, anon;
