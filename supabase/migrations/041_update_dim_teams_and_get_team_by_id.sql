-- Migration: update_dim_teams_and_get_team_by_id
-- Recreates dim_teams FDW with 6 new opponent ranking columns (next_opponent_opp_*_rank)
-- added by Mateus in the BigQuery schema. Also recreates get_team_by_id RPC to return them.
--
-- New columns exposed:
--   - next_opponent_opp_pts_rank
--   - next_opponent_opp_reb_rank
--   - next_opponent_opp_ast_rank
--   - next_opponent_opp_fg3_pct_rank
--   - next_opponent_def_rating_rank
--   - next_opponent_opp_pts_paint_rank
--
-- Also adds 3 offensive/defensive/net rating columns (team + opponent) that were already in BigQuery
-- but not exposed in the FDW.

-- Step 1: Recreate FDW
DROP FOREIGN TABLE IF EXISTS bigquery.dim_teams;

CREATE FOREIGN TABLE bigquery.dim_teams (
  team_id                                    bigint,
  team_name                                  text,
  team_abbreviation                          text,
  conference                                 text,
  team_city                                  text,
  season                                     bigint,
  conference_rank                            bigint,
  wins                                       bigint,
  losses                                     bigint,
  team_last_five_games                       text,
  team_offensive_rating                      double precision,
  team_defensive_rating                      double precision,
  team_net_rating                            double precision,
  team_rating_rank                           bigint,
  team_offensive_rating_rank                 bigint,
  team_defensive_rating_rank                 bigint,
  next_opponent_id                           bigint,
  next_opponent_name                         text,
  next_opponent_abbreviation                 text,
  is_next_game_home                          boolean,
  next_opponent_team_last_five_games         text,
  next_opponent_conference_rank              bigint,
  next_opponent_team_offensive_rating        double precision,
  next_opponent_team_defensive_rating        double precision,
  next_opponent_team_net_rating              double precision,
  next_opponent_team_rating_rank             bigint,
  next_opponent_team_offensive_rating_rank   bigint,
  next_opponent_team_defensive_rating_rank   bigint,
  -- New: 6 opponent stat-specific ranking columns
  next_opponent_opp_pts_rank                 bigint,
  next_opponent_opp_reb_rank                 bigint,
  next_opponent_opp_ast_rank                 bigint,
  next_opponent_opp_fg3_pct_rank             bigint,
  next_opponent_def_rating_rank              bigint,
  next_opponent_opp_pts_paint_rank           bigint,
  team_injury_report_time_brasilia           text,
  next_game_injury_report_time_brasilia      text,
  loaded_at                                  timestamp
)
SERVER bigquery_wrapper_server
OPTIONS (table 'dim_teams', location 'us-east1');

-- Step 2: Drop old RPC (return type changed, must DROP first)
DROP FUNCTION IF EXISTS public.get_team_by_id(bigint);

-- Step 3: Recreate get_team_by_id with new columns
CREATE FUNCTION public.get_team_by_id(p_team_id bigint)
RETURNS TABLE(
  team_id bigint, team_name text, team_abbreviation text, conference text, team_city text, season bigint,
  conference_rank bigint, wins bigint, losses bigint, team_last_five_games text,
  team_rating_rank bigint, team_offensive_rating_rank bigint, team_defensive_rating_rank bigint,
  next_opponent_id bigint, next_opponent_name text, next_opponent_abbreviation text, is_next_game_home boolean,
  next_opponent_team_last_five_games text, next_opponent_conference_rank bigint,
  next_opponent_team_rating_rank bigint, next_opponent_team_offensive_rating_rank bigint, next_opponent_team_defensive_rating_rank bigint,
  next_opponent_opp_pts_rank bigint, next_opponent_opp_reb_rank bigint, next_opponent_opp_ast_rank bigint,
  next_opponent_opp_fg3_pct_rank bigint, next_opponent_def_rating_rank bigint, next_opponent_opp_pts_paint_rank bigint,
  team_injury_report_time_brasilia text, next_game_injury_report_time_brasilia text, loaded_at timestamp,
  next_opponent_wins bigint, next_opponent_losses bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  WITH team_data AS MATERIALIZED (
    SELECT t.* FROM bigquery.dim_teams t WHERE t.team_id = p_team_id LIMIT 1
  ),
  opp AS MATERIALIZED (
    SELECT o.wins, o.losses FROM bigquery.dim_teams o
    WHERE o.team_id = (SELECT td.next_opponent_id FROM team_data td) LIMIT 1
  )
  SELECT
    td.team_id, td.team_name, td.team_abbreviation, td.conference, td.team_city, td.season,
    td.conference_rank, td.wins, td.losses, td.team_last_five_games,
    td.team_rating_rank, td.team_offensive_rating_rank, td.team_defensive_rating_rank,
    td.next_opponent_id, td.next_opponent_name, td.next_opponent_abbreviation, td.is_next_game_home,
    td.next_opponent_team_last_five_games, td.next_opponent_conference_rank,
    td.next_opponent_team_rating_rank, td.next_opponent_team_offensive_rating_rank, td.next_opponent_team_defensive_rating_rank,
    td.next_opponent_opp_pts_rank, td.next_opponent_opp_reb_rank, td.next_opponent_opp_ast_rank,
    td.next_opponent_opp_fg3_pct_rank, td.next_opponent_def_rating_rank, td.next_opponent_opp_pts_paint_rank,
    td.team_injury_report_time_brasilia, td.next_game_injury_report_time_brasilia, td.loaded_at,
    o.wins AS next_opponent_wins, o.losses AS next_opponent_losses
  FROM team_data td LEFT JOIN opp o ON true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_by_id(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_by_id(bigint) TO anon;
