-- Returns box score from the previous game for a team playing B2B.
-- Reuses get_game_box_score() to avoid dim_players JOIN issues,
-- then enriches with rating_stars and plus_minus.
-- Uses UNION ALL instead of OR for FDW pushdown compatibility.

DROP FUNCTION IF EXISTS public.get_b2b_previous_game_box_score(bigint, bigint);

CREATE FUNCTION public.get_b2b_previous_game_box_score(
  p_game_id bigint,
  p_team_id bigint
)
RETURNS TABLE (
  player_id bigint,
  player_name text,
  player_position text,
  rating_stars bigint,
  minutes float8,
  points float8,
  rebounds float8,
  assists float8,
  plus_minus float8,
  previous_game_id bigint,
  previous_game_date date,
  previous_opponent text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_previous_game_id bigint;
  v_previous_game_date date;
  v_previous_opponent text;
  v_current_game_date date;
  v_team_was_home boolean;
  v_team_home_away text;
BEGIN
  -- Step 1: Get current game date
  SELECT g.game_date INTO v_current_game_date
  FROM bigquery.ft_games g WHERE g.game_id = p_game_id LIMIT 1;

  IF v_current_game_date IS NULL THEN RETURN; END IF;

  -- Step 2: Find previous game using UNION ALL (FDW OR pushdown workaround)
  SELECT sub.game_id, sub.game_date, sub.opponent, sub.was_home
  INTO v_previous_game_id, v_previous_game_date, v_previous_opponent, v_team_was_home
  FROM (
    SELECT * FROM (
      (SELECT g.game_id, g.game_date, g.visitor_team_abbreviation AS opponent, true AS was_home
       FROM bigquery.ft_games g
       WHERE g.home_team_id = p_team_id AND g.game_date < v_current_game_date AND g.winner_team_id IS NOT NULL
       ORDER BY g.game_date DESC LIMIT 1)
      UNION ALL
      (SELECT g.game_id, g.game_date, g.home_team_abbreviation AS opponent, false AS was_home
       FROM bigquery.ft_games g
       WHERE g.visitor_team_id = p_team_id AND g.game_date < v_current_game_date AND g.winner_team_id IS NOT NULL
       ORDER BY g.game_date DESC LIMIT 1)
    ) combined ORDER BY game_date DESC LIMIT 1
  ) sub;

  IF v_previous_game_id IS NULL THEN RETURN; END IF;

  v_team_home_away := CASE WHEN v_team_was_home THEN 'Casa' ELSE 'Fora' END;

  -- Step 3: Get box score from existing function, enrich with rating_stars + plus_minus
  RETURN QUERY
  SELECT
    bs.player_id, bs.player_name,
    COALESCE(dp."position", '') AS player_position,
    COALESCE(pr.max_stars, 0) AS rating_stars,
    bs.minutes::float8, bs.points::float8, bs.rebounds::float8, bs.assists::float8,
    MAX(CASE WHEN s.stat_type = 'player_plus_minus' THEN s.stat_value END) AS plus_minus,
    v_previous_game_id, v_previous_game_date, v_previous_opponent
  FROM get_game_box_score(v_previous_game_id) bs
  LEFT JOIN bigquery.dim_players dp ON bs.player_id = dp.player_id
  LEFT JOIN (
    SELECT sp.player_id, MAX(sp.rating_stars) AS max_stars
    FROM bigquery.dim_stat_player sp GROUP BY sp.player_id
  ) pr ON bs.player_id = pr.player_id
  LEFT JOIN bigquery.ft_game_player_stats s
    ON s.player_id = bs.player_id AND s.game_id = v_previous_game_id AND s.stat_type = 'player_plus_minus'
  WHERE bs.home_away = v_team_home_away
  GROUP BY bs.player_id, bs.player_name, dp."position", pr.max_stars, bs.minutes, bs.points, bs.rebounds, bs.assists
  ORDER BY bs.minutes DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_b2b_previous_game_box_score(bigint, bigint) TO authenticated, anon;
