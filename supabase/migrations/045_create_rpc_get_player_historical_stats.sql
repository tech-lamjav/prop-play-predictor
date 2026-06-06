-- Migration: create_rpc_get_player_historical_stats
-- RPC that unpivots ft_game_player_stats_historical columns into stat_type/stat_value format
-- compatible with the existing GameChart component.
-- Depends on: 044_create_fdw_ft_game_player_stats_historical.sql
--
-- Params:
--   p_player_id — required
--   p_season — optional (NULL = all seasons)
--   p_season_type — optional (NULL = all types: regular, playoffs, playin)
--
-- Output includes season + season_type so the frontend can filter locally.
-- Lines (line_most_recent) are returned as NULL because historical table doesn't have them;
-- frontend falls back to player average rounded to .5 as the chart reference line.

CREATE OR REPLACE FUNCTION public.get_player_historical_stats(
  p_player_id bigint,
  p_season int DEFAULT NULL,
  p_season_type text DEFAULT NULL
)
RETURNS TABLE(
  player_id bigint,
  game_date date,
  game_id bigint,
  stat_type text,
  stat_value double precision,
  line double precision,
  line_most_recent double precision,
  is_b2b_game boolean,
  stat_vs_line text,
  played_against text,
  home_away text,
  is_played text,
  player_team_score integer,
  opponent_score integer,
  game_won boolean,
  season bigint,
  season_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT h.*
    FROM bigquery.ft_game_player_stats_historical h
    WHERE h.player_id = p_player_id
      AND (p_season IS NULL OR h.season = p_season)
      AND (p_season_type IS NULL OR h.season_type = p_season_type)
  ),
  unpivoted AS (
    SELECT b.player_id, b.game_date, b.game_id, 'player_points'::text AS stat_type, b.points::double precision AS stat_value,
      b.home_team_score, b.home_team_id, b.visitor_team_score, b.visitor_team_id, b.winner_team_id, b.team_id,
      b.season, b.season_type
    FROM base b WHERE b.points IS NOT NULL
    UNION ALL
    SELECT b.player_id, b.game_date, b.game_id, 'player_rebounds', b.rebounds::double precision,
      b.home_team_score, b.home_team_id, b.visitor_team_score, b.visitor_team_id, b.winner_team_id, b.team_id,
      b.season, b.season_type
    FROM base b WHERE b.rebounds IS NOT NULL
    UNION ALL
    SELECT b.player_id, b.game_date, b.game_id, 'player_assists', b.assists::double precision,
      b.home_team_score, b.home_team_id, b.visitor_team_score, b.visitor_team_id, b.winner_team_id, b.team_id,
      b.season, b.season_type
    FROM base b WHERE b.assists IS NOT NULL
    UNION ALL
    SELECT b.player_id, b.game_date, b.game_id, 'player_threes', b.threes::double precision,
      b.home_team_score, b.home_team_id, b.visitor_team_score, b.visitor_team_id, b.winner_team_id, b.team_id,
      b.season, b.season_type
    FROM base b WHERE b.threes IS NOT NULL
    UNION ALL
    SELECT b.player_id, b.game_date, b.game_id, 'player_steals', b.steals::double precision,
      b.home_team_score, b.home_team_id, b.visitor_team_score, b.visitor_team_id, b.winner_team_id, b.team_id,
      b.season, b.season_type
    FROM base b WHERE b.steals IS NOT NULL
    UNION ALL
    SELECT b.player_id, b.game_date, b.game_id, 'player_blocks', b.blocks::double precision,
      b.home_team_score, b.home_team_id, b.visitor_team_score, b.visitor_team_id, b.winner_team_id, b.team_id,
      b.season, b.season_type
    FROM base b WHERE b.blocks IS NOT NULL
    UNION ALL
    SELECT b.player_id, b.game_date, b.game_id, 'player_turnovers', b.turnovers::double precision,
      b.home_team_score, b.home_team_id, b.visitor_team_score, b.visitor_team_id, b.winner_team_id, b.team_id,
      b.season, b.season_type
    FROM base b WHERE b.turnovers IS NOT NULL
    UNION ALL
    SELECT b.player_id, b.game_date, b.game_id, 'player_points_rebounds', b.points_rebounds::double precision,
      b.home_team_score, b.home_team_id, b.visitor_team_score, b.visitor_team_id, b.winner_team_id, b.team_id,
      b.season, b.season_type
    FROM base b WHERE b.points_rebounds IS NOT NULL
    UNION ALL
    SELECT b.player_id, b.game_date, b.game_id, 'player_points_assists', b.points_assists::double precision,
      b.home_team_score, b.home_team_id, b.visitor_team_score, b.visitor_team_id, b.winner_team_id, b.team_id,
      b.season, b.season_type
    FROM base b WHERE b.points_assists IS NOT NULL
    UNION ALL
    SELECT b.player_id, b.game_date, b.game_id, 'player_rebounds_assists', b.rebounds_assists::double precision,
      b.home_team_score, b.home_team_id, b.visitor_team_score, b.visitor_team_id, b.winner_team_id, b.team_id,
      b.season, b.season_type
    FROM base b WHERE b.rebounds_assists IS NOT NULL
    UNION ALL
    SELECT b.player_id, b.game_date, b.game_id, 'player_points_rebounds_assists', b.points_rebounds_assists::double precision,
      b.home_team_score, b.home_team_id, b.visitor_team_score, b.visitor_team_id, b.winner_team_id, b.team_id,
      b.season, b.season_type
    FROM base b WHERE b.points_rebounds_assists IS NOT NULL
    UNION ALL
    SELECT b.player_id, b.game_date, b.game_id, 'player_double_double', (CASE WHEN b.double_double THEN 1 ELSE 0 END)::double precision,
      b.home_team_score, b.home_team_id, b.visitor_team_score, b.visitor_team_id, b.winner_team_id, b.team_id,
      b.season, b.season_type
    FROM base b
  )
  SELECT
    u.player_id,
    u.game_date,
    u.game_id,
    u.stat_type,
    u.stat_value,
    NULL::double precision AS line,
    NULL::double precision AS line_most_recent,
    false AS is_b2b_game,
    NULL::text AS stat_vs_line,
    CASE
      WHEN u.team_id = u.home_team_id THEN (
        SELECT COALESCE(t.team_abbreviation, '') FROM bigquery.dim_teams t WHERE t.team_id = u.visitor_team_id LIMIT 1
      )
      ELSE '@' || COALESCE((SELECT t.team_abbreviation FROM bigquery.dim_teams t WHERE t.team_id = u.home_team_id LIMIT 1), '')
    END AS played_against,
    CASE WHEN u.team_id = u.home_team_id THEN 'home' ELSE 'away' END AS home_away,
    'Jogou'::text AS is_played,
    (CASE WHEN u.team_id = u.home_team_id THEN u.home_team_score ELSE u.visitor_team_score END)::integer AS player_team_score,
    (CASE WHEN u.team_id = u.home_team_id THEN u.visitor_team_score ELSE u.home_team_score END)::integer AS opponent_score,
    (u.winner_team_id = u.team_id) AS game_won,
    u.season,
    u.season_type
  FROM unpivoted u
  ORDER BY u.game_date DESC, u.stat_type;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_historical_stats(bigint, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_historical_stats(bigint, int, text) TO anon;
