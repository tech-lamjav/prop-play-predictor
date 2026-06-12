-- Migration: create_rpc_get_player_period_stats
-- RPC that unpivots ft_game_player_stats_period columns into stat_type/stat_value format
-- compatible with the existing GameChart / GamePlayerStats interface.
-- Depends on: 037_create_fdw_ft_game_player_stats_period.sql
--
-- Produces stat_types: player_q1_points, player_q1_rebounds, player_q1_assists, player_h1_points

CREATE OR REPLACE FUNCTION public.get_player_period_stats(
  p_player_id bigint,
  p_limit int DEFAULT 100
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
  is_played text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  WITH raw_period AS (
    SELECT p.*
    FROM bigquery.ft_game_player_stats_period p
    WHERE p.player_id = p_player_id
    ORDER BY p.game_date DESC
    LIMIT p_limit
  ),
  unpivoted AS (
    SELECT r.player_id, r.game_date, r.game_id,
      'player_q1_points' AS stat_type, r.q1_points::double precision AS stat_value,
      r.played_against, r.home_away, r.is_b2b_game
    FROM raw_period r
    UNION ALL
    SELECT r.player_id, r.game_date, r.game_id,
      'player_q1_rebounds', r.q1_rebounds::double precision,
      r.played_against, r.home_away, r.is_b2b_game
    FROM raw_period r
    UNION ALL
    SELECT r.player_id, r.game_date, r.game_id,
      'player_q1_assists', r.q1_assists::double precision,
      r.played_against, r.home_away, r.is_b2b_game
    FROM raw_period r
    UNION ALL
    SELECT r.player_id, r.game_date, r.game_id,
      'player_h1_points', r.h1_points::double precision,
      r.played_against, r.home_away, r.is_b2b_game
    FROM raw_period r
  )
  SELECT
    u.player_id,
    u.game_date,
    u.game_id,
    u.stat_type,
    u.stat_value,
    NULL::double precision AS line,
    NULL::double precision AS line_most_recent,
    u.is_b2b_game,
    NULL::text AS stat_vs_line,
    u.played_against,
    u.home_away,
    'Jogou'::text AS is_played
  FROM unpivoted u
  ORDER BY u.game_date DESC, u.stat_type;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_period_stats(bigint, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_period_stats(bigint, int) TO anon;
