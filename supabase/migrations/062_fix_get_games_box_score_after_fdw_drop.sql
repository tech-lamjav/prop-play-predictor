-- ============================================================
-- Hotfix: re-aplica get_games e get_game_box_score apontando pra
-- nba_mart.* depois que 058 dropou o FDW.
-- ============================================================
-- Bug: migrations 060 e 061 (renamed de 031b/032b/042/043) carregavam
-- o conteudo legado que ainda referenciava bigquery.* (FDW). Como
-- elas rodaram DEPOIS de 057 (que ja tinha swapado pra nba_mart) e
-- ANTES de 058 (que dropou o FDW), o resultado final foi:
--   - 057 atualizou get_games / get_game_box_score pra nba_mart  OK
--   - 060/061 sobrescreveram pra bigquery.*                       BUG
--   - 058 dropou bigquery schema                                  fatal
--   - app em prod: "relation bigquery.dim_teams does not exist"
--
-- Esta migration nao faz nada novo - so re-define as duas RPCs com
-- o conteudo correto da 057. Aplicada manualmente via MCP em prod
-- e staging em 19/mai/2026 (~17:00 UTC); registrada aqui pro
-- historico e pra ambientes futuros.
-- ============================================================

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
  SELECT g.game_id, g.game_date, g.game_datetime_brasilia, g.home_team_id, g.home_team_name, g.home_team_abbreviation,
    g.home_team_score::float8, g.visitor_team_id, g.visitor_team_name, g.visitor_team_abbreviation,
    g.visitor_team_score::float8, g.winner_team_id, g.loaded_at, g.home_team_is_b2b_game,
    g.visitor_team_is_b2b_game, g.home_team_is_next_game, g.visitor_team_is_next_game,
    ht.team_last_five_games AS home_team_last_five,
    vt.team_last_five_games AS visitor_team_last_five
  FROM nba_mart.ft_games g
  LEFT JOIN nba_mart.dim_teams ht ON g.home_team_abbreviation = ht.team_abbreviation
  LEFT JOIN nba_mart.dim_teams vt ON g.visitor_team_abbreviation = vt.team_abbreviation
  WHERE (p_game_date IS NULL OR g.game_date = p_game_date)
    AND (p_team_abbreviation IS NULL OR LOWER(g.home_team_abbreviation) = LOWER(p_team_abbreviation)
      OR LOWER(g.visitor_team_abbreviation) = LOWER(p_team_abbreviation))
  ORDER BY g.game_datetime_brasilia ASC NULLS LAST, g.home_team_name ASC;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_games(date, text) TO authenticated, anon;

DROP FUNCTION IF EXISTS public.get_game_box_score(bigint);
CREATE FUNCTION public.get_game_box_score(p_game_id bigint)
RETURNS TABLE (
  player_id bigint, player_name text, home_away text,
  minutes numeric, points numeric, rebounds numeric, assists numeric,
  blocks numeric, steals numeric, threes numeric, turnovers numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.player_id,
    p.player_name,
    MAX(s.home_away) AS home_away,
    MAX(CASE WHEN s.stat_type = 'player_minutes'   THEN s.stat_value END)::numeric AS minutes,
    MAX(CASE WHEN s.stat_type = 'player_points'    THEN s.stat_value END)::numeric AS points,
    MAX(CASE WHEN s.stat_type = 'player_rebounds'  THEN s.stat_value END)::numeric AS rebounds,
    MAX(CASE WHEN s.stat_type = 'player_assists'   THEN s.stat_value END)::numeric AS assists,
    MAX(CASE WHEN s.stat_type = 'player_blocks'    THEN s.stat_value END)::numeric AS blocks,
    MAX(CASE WHEN s.stat_type = 'player_steals'    THEN s.stat_value END)::numeric AS steals,
    MAX(CASE WHEN s.stat_type = 'player_threes'    THEN s.stat_value END)::numeric AS threes,
    MAX(CASE WHEN s.stat_type = 'player_turnovers' THEN s.stat_value END)::numeric AS turnovers
  FROM nba_mart.ft_game_player_stats s
  JOIN nba_mart.dim_players p ON s.player_id = p.player_id
  WHERE s.game_id = p_game_id
    AND s.is_played = 'Jogou'
  GROUP BY s.player_id, p.player_name
  ORDER BY MAX(s.home_away), MAX(CASE WHEN s.stat_type = 'player_minutes' THEN s.stat_value END) DESC NULLS LAST;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_game_box_score(bigint) TO authenticated, anon;
