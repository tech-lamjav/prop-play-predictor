-- ============================================
-- RPC FUNCTIONS PARA BIGQUERY
-- ============================================
-- NOTA: Esta migration cria as RPC functions vazias/placeholder.
-- As funções reais são criadas/atualizadas pelo setup_bigquery_local.sql
-- porque dependem das foreign tables que são configuradas manualmente.
--
-- Quando você rodar setup_bigquery_local.sql, ele vai substituir essas funções
-- pelas versões corretas que apontam para as foreign tables do BigQuery.
-- ============================================

-- Placeholder functions - serão substituídas pelo setup_bigquery_local.sql

DROP FUNCTION IF EXISTS public.get_all_players();
CREATE FUNCTION public.get_all_players()
RETURNS TABLE (player_id bigint, player_name text, "position" text, team_id bigint,
  team_name text, team_abbreviation text, age bigint, last_game_text text,
  current_status text, rating_stars bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Placeholder: será substituído pelo setup_bigquery_local.sql
  RETURN;
END; $$;

DROP FUNCTION IF EXISTS public.get_player_by_id(bigint);
CREATE FUNCTION public.get_player_by_id(p_player_id bigint)
RETURNS TABLE (player_id bigint, player_name text, "position" text, team_id bigint,
  team_name text, team_abbreviation text, age bigint, last_game_text text, current_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN;
END; $$;

DROP FUNCTION IF EXISTS public.get_player_props(bigint);
CREATE FUNCTION public.get_player_props(p_player_id bigint)
RETURNS TABLE (player_id bigint, team_id bigint, stat_type text, rating_stars bigint,
  is_leader_with_injury boolean, is_available_backup boolean, stat_rank bigint,
  next_available_player_name text, next_player_stats_when_leader_out float8,
  next_player_stats_normal float8, loaded_at timestamp)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN;
END; $$;

DROP FUNCTION IF EXISTS public.get_player_game_stats(bigint, int);
CREATE FUNCTION public.get_player_game_stats(p_player_id bigint, p_limit int DEFAULT 15)
RETURNS TABLE (player_id bigint, game_date date, game_id bigint, stat_type text,
  stat_value float8, "line" float8, is_b2b_game boolean, stat_vs_line text,
  played_against text, home_away text, is_played text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN;
END; $$;

DROP FUNCTION IF EXISTS public.get_team_by_id(bigint);
CREATE FUNCTION public.get_team_by_id(p_team_id bigint)
RETURNS TABLE (team_id bigint, team_name text, team_abbreviation text, conference text,
  team_city text, season bigint, conference_rank float8, wins bigint, losses bigint,
  team_last_five_games text, team_rating_rank bigint, team_offensive_rating_rank bigint,
  team_defensive_rating_rank bigint, next_opponent_id bigint, next_opponent_name text,
  next_opponent_abbreviation text, is_next_game_home boolean, next_opponent_team_last_five_games text,
  next_opponent_conference_rank float8, next_opponent_team_rating_rank bigint,
  next_opponent_team_offensive_rating_rank bigint, next_opponent_team_defensive_rating_rank bigint,
  team_injury_report_time_brasilia text, next_game_injury_report_time_brasilia text, loaded_at timestamp)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN;
END; $$;

DROP FUNCTION IF EXISTS public.get_team_players(bigint);
CREATE FUNCTION public.get_team_players(p_team_id bigint)
RETURNS TABLE (player_id bigint, player_name text, "position" text, team_id bigint,
  age bigint, current_status text, rating_stars bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN;
END; $$;

DROP FUNCTION IF EXISTS public.get_games(date, text);
CREATE FUNCTION public.get_games(p_game_date date DEFAULT NULL, p_team_abbreviation text DEFAULT NULL)
RETURNS TABLE (game_id bigint, game_date date, game_datetime_brasilia timestamp, home_team_id bigint, home_team_name text,
  home_team_abbreviation text, home_team_score float8, visitor_team_id bigint, visitor_team_name text,
  visitor_team_abbreviation text, visitor_team_score float8, winner_team_id bigint, loaded_at timestamp,
  home_team_is_b2b_game boolean, visitor_team_is_b2b_game boolean, home_team_is_next_game boolean,
  visitor_team_is_next_game boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN;
END; $$;

DROP FUNCTION IF EXISTS public.get_player_shooting_zones(bigint);
CREATE FUNCTION public.get_player_shooting_zones(p_player_id bigint)
RETURNS TABLE (player_id bigint, player_name text, corner_3_fga float8, corner_3_fgm float8,
  corner_3_fg_pct float8, left_corner_3_fga float8, left_corner_3_fgm float8, left_corner_3_fg_pct float8,
  right_corner_3_fga float8, right_corner_3_fgm float8, right_corner_3_fg_pct float8,
  above_the_break_3_fga float8, above_the_break_3_fgm float8, above_the_break_3_fg_pct float8,
  restricted_area_fga float8, restricted_area_fgm float8, restricted_area_fg_pct float8,
  in_the_paint_non_ra_fga float8, in_the_paint_non_ra_fgm float8, in_the_paint_non_ra_fg_pct float8,
  mid_range_fga float8, mid_range_fgm float8, mid_range_fg_pct float8, backcourt_fga float8,
  backcourt_fgm float8, backcourt_fg_pct float8, loaded_at timestamp)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN;
END; $$;

DROP FUNCTION IF EXISTS public.get_player_dashboard_bundle(bigint, int);
CREATE FUNCTION public.get_player_dashboard_bundle(p_player_id bigint, p_games_limit int DEFAULT 40)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Placeholder: será substituído pelo setup_bigquery_local.sql
  RETURN NULL;
END; $$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_all_players() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_by_id(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_props(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_game_stats(bigint, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_team_by_id(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_team_players(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_games(date, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_shooting_zones(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_dashboard_bundle(bigint, int) TO authenticated, anon;
