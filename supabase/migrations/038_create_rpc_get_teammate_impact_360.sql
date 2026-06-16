-- Migration: create_rpc_get_teammate_impact_360
-- RPC that returns all teammates for a given trigger player with impact stats
-- Used by the Análise 360 mandala detail view (useTeammateImpact360 hook)
-- Depends on: 037_create_fdw_dim_teammate_impact_360.sql
--
-- Applied to staging (kpbjuplcwiyrymafhehz) and production (lavclmlvvfzkblrstojd)

CREATE OR REPLACE FUNCTION public.get_teammate_impact_360(p_trigger_player_id bigint)
RETURNS TABLE(
  trigger_player_id    bigint,
  trigger_name         text,
  trigger_team_id      bigint,
  trigger_team_abbr    text,
  trigger_status       text,
  teammate_player_id   bigint,
  teammate_name        text,
  teammate_position    text,
  stat_type            text,
  avg_com              double precision,
  avg_sem              double precision,
  stddev_sem           double precision,
  gap                  double precision,
  gap_pct              double precision,
  jogos_com            bigint,
  jogos_sem            bigint,
  teammate_avg_minutes double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
  FROM bigquery.dim_teammate_impact_360 d
  WHERE d.trigger_player_id = p_trigger_player_id
  ORDER BY d.stat_type, d.gap_pct DESC NULLS LAST;
END;
$$;

-- Grant execute to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.get_teammate_impact_360(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_teammate_impact_360(bigint) TO anon;
