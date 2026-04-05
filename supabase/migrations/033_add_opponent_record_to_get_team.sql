-- Add next_opponent_wins and next_opponent_losses to get_team_by_id
-- Uses CTE to materialize dim_teams first — LATERAL JOIN doesn't work with BigQuery FDW

DROP FUNCTION IF EXISTS public.get_team_by_id(bigint);
CREATE FUNCTION public.get_team_by_id(p_team_id bigint)
RETURNS TABLE (team_id bigint, team_name text, team_abbreviation text, conference text,
  team_city text, season bigint, conference_rank float8, wins bigint, losses bigint,
  team_last_five_games text, team_rating_rank bigint, team_offensive_rating_rank bigint,
  team_defensive_rating_rank bigint, next_opponent_id bigint, next_opponent_name text,
  next_opponent_abbreviation text, is_next_game_home boolean, next_opponent_team_last_five_games text,
  next_opponent_conference_rank float8, next_opponent_team_rating_rank bigint,
  next_opponent_team_offensive_rating_rank bigint, next_opponent_team_defensive_rating_rank bigint,
  team_injury_report_time_brasilia text, next_game_injury_report_time_brasilia text, loaded_at timestamp,
  next_opponent_wins bigint, next_opponent_losses bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH latest_teams AS (
    SELECT DISTINCT ON (d.team_id)
      d.team_id, d.team_name, d.team_abbreviation, d.conference, d.team_city,
      d.season, d.conference_rank, d.wins, d.losses, d.team_last_five_games,
      d.team_rating_rank, d.team_offensive_rating_rank, d.team_defensive_rating_rank,
      d.next_opponent_id, d.next_opponent_name, d.next_opponent_abbreviation,
      d.is_next_game_home, d.next_opponent_team_last_five_games,
      d.next_opponent_conference_rank, d.next_opponent_team_rating_rank,
      d.next_opponent_team_offensive_rating_rank, d.next_opponent_team_defensive_rating_rank,
      d.team_injury_report_time_brasilia, d.next_game_injury_report_time_brasilia, d.loaded_at
    FROM bigquery.dim_teams d
    ORDER BY d.team_id, d.loaded_at DESC NULLS LAST
  )
  SELECT t.team_id, t.team_name, t.team_abbreviation, t.conference, t.team_city,
    t.season, t.conference_rank::float8, t.wins, t.losses, t.team_last_five_games,
    t.team_rating_rank, t.team_offensive_rating_rank, t.team_defensive_rating_rank,
    t.next_opponent_id, t.next_opponent_name, t.next_opponent_abbreviation,
    t.is_next_game_home, t.next_opponent_team_last_five_games,
    t.next_opponent_conference_rank::float8, t.next_opponent_team_rating_rank,
    t.next_opponent_team_offensive_rating_rank, t.next_opponent_team_defensive_rating_rank,
    t.team_injury_report_time_brasilia, t.next_game_injury_report_time_brasilia, t.loaded_at,
    opp.wins AS next_opponent_wins,
    opp.losses AS next_opponent_losses
  FROM latest_teams t
  LEFT JOIN latest_teams opp ON opp.team_id = t.next_opponent_id
  WHERE t.team_id = p_team_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_team_by_id(bigint) TO authenticated, anon;
