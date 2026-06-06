-- Migration: create_rpc_get_team_opp_shooting_zones
-- RPC que retorna as zonas defensivas do time (o que ele cede por zona)
-- pra consumo direto pelo frontend (matchup no ShootingZonesCard).
-- Depends on: 048_create_fdw_dim_team_shooting_zone_defense.sql
--
-- Retorno e flat (1 linha) com fg_pct + fga + rank por zona.
-- O frontend mapeia rank -> cor de matchup (verde/amarelo/vermelho)
-- usando a mesma escala que ja existe em NextGamesCard (rank >= 21 = verde).

DROP FUNCTION IF EXISTS public.get_team_opp_shooting_zones(bigint);

CREATE FUNCTION public.get_team_opp_shooting_zones(p_team_id bigint)
RETURNS TABLE(
  team_id           bigint,
  team_name         text,
  team_abbreviation text,

  opp_restricted_area_fg_pct      double precision,
  opp_restricted_area_fga         double precision,
  opp_restricted_area_fg_pct_rank bigint,

  opp_in_the_paint_non_ra_fg_pct      double precision,
  opp_in_the_paint_non_ra_fga         double precision,
  opp_in_the_paint_non_ra_fg_pct_rank bigint,

  opp_mid_range_fg_pct      double precision,
  opp_mid_range_fga         double precision,
  opp_mid_range_fg_pct_rank bigint,

  opp_corner_3_fg_pct      double precision,
  opp_corner_3_fga         double precision,
  opp_corner_3_fg_pct_rank bigint,

  opp_above_the_break_3_fg_pct      double precision,
  opp_above_the_break_3_fga         double precision,
  opp_above_the_break_3_fg_pct_rank bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.team_id, t.team_name, t.team_abbreviation,
    t.opp_restricted_area_fg_pct, t.opp_restricted_area_fga, t.opp_restricted_area_fg_pct_rank,
    t.opp_in_the_paint_non_ra_fg_pct, t.opp_in_the_paint_non_ra_fga, t.opp_in_the_paint_non_ra_fg_pct_rank,
    t.opp_mid_range_fg_pct, t.opp_mid_range_fga, t.opp_mid_range_fg_pct_rank,
    t.opp_corner_3_fg_pct, t.opp_corner_3_fga, t.opp_corner_3_fg_pct_rank,
    t.opp_above_the_break_3_fg_pct, t.opp_above_the_break_3_fga, t.opp_above_the_break_3_fg_pct_rank
  FROM bigquery.dim_team_shooting_zone_defense t
  WHERE t.team_id = p_team_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_opp_shooting_zones(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_opp_shooting_zones(bigint) TO anon;
