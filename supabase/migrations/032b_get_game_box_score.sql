CREATE OR REPLACE FUNCTION get_game_box_score(p_game_id bigint)
RETURNS TABLE (
  player_id bigint,
  player_name text,
  home_away text,
  minutes numeric,
  points numeric,
  rebounds numeric,
  assists numeric,
  blocks numeric,
  steals numeric,
  threes numeric,
  turnovers numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.player_id,
    p.player_name,
    MAX(s.home_away) AS home_away,
    MAX(CASE WHEN s.stat_type = 'player_minutes'   THEN s.stat_value END) AS minutes,
    MAX(CASE WHEN s.stat_type = 'player_points'    THEN s.stat_value END) AS points,
    MAX(CASE WHEN s.stat_type = 'player_rebounds'  THEN s.stat_value END) AS rebounds,
    MAX(CASE WHEN s.stat_type = 'player_assists'   THEN s.stat_value END) AS assists,
    MAX(CASE WHEN s.stat_type = 'player_blocks'    THEN s.stat_value END) AS blocks,
    MAX(CASE WHEN s.stat_type = 'player_steals'    THEN s.stat_value END) AS steals,
    MAX(CASE WHEN s.stat_type = 'player_threes'    THEN s.stat_value END) AS threes,
    MAX(CASE WHEN s.stat_type = 'player_turnovers' THEN s.stat_value END) AS turnovers
  FROM bigquery.ft_game_player_stats s
  JOIN bigquery.dim_players p ON s.player_id = p.player_id
  WHERE s.game_id = p_game_id
    AND s.is_played = 'Jogou'
  GROUP BY s.player_id, p.player_name
  ORDER BY MAX(s.home_away), MAX(CASE WHEN s.stat_type = 'player_minutes' THEN s.stat_value END) DESC NULLS LAST;
END;
$$;
