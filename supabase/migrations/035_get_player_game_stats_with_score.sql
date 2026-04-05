-- =====================
-- get_player_game_stats: add game score + result from ft_games join
-- =====================
DROP FUNCTION IF EXISTS public.get_player_game_stats(bigint, int);
CREATE FUNCTION public.get_player_game_stats(p_player_id bigint, p_limit int DEFAULT 15)
RETURNS TABLE (
  player_id bigint, game_date date, game_id bigint, stat_type text,
  stat_value float8, "line" float8, line_most_recent float8, is_b2b_game boolean,
  stat_vs_line text, played_against text, home_away text, is_played text,
  player_team_score float8, opponent_score float8, game_won boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH last_n_games AS (
    SELECT t.game_id, MAX(t.game_date) as game_date
    FROM bigquery.ft_game_player_stats t
    WHERE t.player_id = p_player_id
    GROUP BY t.game_id
    ORDER BY MAX(t.game_date) DESC
    LIMIT p_limit
  )
  SELECT
    t.player_id,
    t.game_date,
    t.game_id,
    t.stat_type,
    t.stat_value,
    t.line_value as "line",
    t.line_value_most_recent as line_most_recent,
    t.is_b2b_game,
    t.stat_vs_line,
    t.played_against,
    t.home_away,
    t.is_played,
    CASE WHEN t.home_away = 'home' THEN g.home_team_score ELSE g.visitor_team_score END as player_team_score,
    CASE WHEN t.home_away = 'home' THEN g.visitor_team_score ELSE g.home_team_score END as opponent_score,
    CASE
      WHEN t.home_away = 'home' THEN g.home_team_score > g.visitor_team_score
      ELSE g.visitor_team_score > g.home_team_score
    END as game_won
  FROM bigquery.ft_game_player_stats t
  INNER JOIN last_n_games lng ON t.game_id = lng.game_id
  LEFT JOIN bigquery.ft_games g ON t.game_id = g.game_id
  WHERE t.player_id = p_player_id
  ORDER BY t.game_date DESC, t.stat_type;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_player_game_stats(bigint, int) TO authenticated, anon;
