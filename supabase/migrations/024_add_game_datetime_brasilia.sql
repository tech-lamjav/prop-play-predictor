-- ============================================
-- Adiciona game_datetime_brasilia à ft_games e atualiza get_games
-- para ordenar jogos por horário exato (Brasília) em vez de só por dia
-- ============================================

-- 1. Recriar foreign table com o novo campo
DROP FOREIGN TABLE IF EXISTS bigquery.ft_games;
CREATE FOREIGN TABLE bigquery.ft_games (
  game_id bigint, game_date date, home_team_id bigint, home_team_name text,
  home_team_abbreviation text, home_team_score float8, visitor_team_id bigint,
  visitor_team_name text, visitor_team_abbreviation text, visitor_team_score float8,
  winner_team_id bigint, loaded_at timestamp, home_team_is_b2b_game boolean,
  visitor_team_is_b2b_game boolean, home_team_is_next_game boolean,
  visitor_team_is_next_game boolean, game_datetime_brasilia timestamp
) SERVER bigquery_server OPTIONS (table 'ft_games', location 'us-east1');

-- 2. Recriar get_games incluindo game_datetime_brasilia e ordenando por horário
DROP FUNCTION IF EXISTS public.get_games(date, text);
CREATE FUNCTION public.get_games(p_game_date date DEFAULT NULL, p_team_abbreviation text DEFAULT NULL)
RETURNS TABLE (game_id bigint, game_date date, game_datetime_brasilia timestamp, home_team_id bigint, home_team_name text,
  home_team_abbreviation text, home_team_score float8, visitor_team_id bigint, visitor_team_name text,
  visitor_team_abbreviation text, visitor_team_score float8, winner_team_id bigint, loaded_at timestamp,
  home_team_is_b2b_game boolean, visitor_team_is_b2b_game boolean, home_team_is_next_game boolean,
  visitor_team_is_next_game boolean, home_team_last_five text, visitor_team_last_five text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH latest_teams AS (
    SELECT DISTINCT ON (t.team_abbreviation)
      t.team_id, t.team_abbreviation, t.team_last_five_games
    FROM bigquery.dim_teams t
    ORDER BY t.team_abbreviation, t.loaded_at DESC NULLS LAST
  )
  SELECT g.game_id, g.game_date, g.game_datetime_brasilia, g.home_team_id, g.home_team_name, g.home_team_abbreviation,
    g.home_team_score, g.visitor_team_id, g.visitor_team_name, g.visitor_team_abbreviation,
    g.visitor_team_score, g.winner_team_id, g.loaded_at, g.home_team_is_b2b_game,
    g.visitor_team_is_b2b_game, g.home_team_is_next_game, g.visitor_team_is_next_game,
    ht.team_last_five_games as home_team_last_five,
    vt.team_last_five_games as visitor_team_last_five
  FROM bigquery.ft_games g
  LEFT JOIN latest_teams ht ON g.home_team_abbreviation = ht.team_abbreviation
  LEFT JOIN latest_teams vt ON g.visitor_team_abbreviation = vt.team_abbreviation
  WHERE (p_game_date IS NULL OR g.game_date = p_game_date)
    AND (p_team_abbreviation IS NULL OR LOWER(g.home_team_abbreviation) = LOWER(p_team_abbreviation)
      OR LOWER(g.visitor_team_abbreviation) = LOWER(p_team_abbreviation))
  ORDER BY g.game_datetime_brasilia ASC NULLS LAST, g.home_team_name ASC;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_games(date, text) TO authenticated, anon;
