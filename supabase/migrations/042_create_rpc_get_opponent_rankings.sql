-- Migration: create_rpc_get_opponent_rankings
-- RPC that returns a subset of defensive rankings from dim_team_opponent_stats.
-- Used by NextGamesCard matchup section.
-- Depends on: 039_create_fdw_dim_team_opponent_stats.sql

CREATE OR REPLACE FUNCTION public.get_opponent_rankings(p_team_id bigint)
RETURNS TABLE(
  team_id bigint, team_name text, team_abbreviation text,
  opp_pts double precision, opp_pts_rank bigint,
  opp_reb double precision, opp_reb_rank bigint,
  opp_ast double precision, opp_ast_rank bigint,
  opp_fg3_pct double precision, opp_fg3_pct_rank bigint,
  opp_stl double precision, opp_stl_rank bigint,
  opp_blk double precision, opp_blk_rank bigint,
  opp_pts_paint double precision, opp_pts_paint_rank bigint,
  def_rating double precision, def_rating_rank bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT t.team_id, t.team_name, t.team_abbreviation,
    t.opp_pts, t.opp_pts_rank, t.opp_reb, t.opp_reb_rank,
    t.opp_ast, t.opp_ast_rank, t.opp_fg3_pct, t.opp_fg3_pct_rank,
    t.opp_stl, t.opp_stl_rank, t.opp_blk, t.opp_blk_rank,
    t.opp_pts_paint, t.opp_pts_paint_rank,
    t.def_rating, t.def_rating_rank
  FROM bigquery.dim_team_opponent_stats t WHERE t.team_id = p_team_id LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_opponent_rankings(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_opponent_rankings(bigint) TO anon;
