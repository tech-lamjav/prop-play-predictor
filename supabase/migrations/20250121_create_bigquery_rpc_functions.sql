-- Create RPC functions in public schema to query bigquery schema tables
-- Following Supabase best practices for FDW security
-- Reference: https://supabase.com/docs/guides/database/extensions/wrappers/overview#security

-- Function to get all players
DROP FUNCTION IF EXISTS public.get_all_players();
CREATE OR REPLACE FUNCTION public.get_all_players()
RETURNS TABLE (
  player_id bigint,
  player_name text,
  "position" text,
  team_id bigint,
  team_name text,
  team_abbreviation text,
  age bigint,
  last_game_text text,
  current_status text,
  rating_stars bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH player_ratings AS (
    SELECT p.player_id, MAX(p.rating_stars) as max_stars
    FROM bigquery.dim_prop_player p
    GROUP BY p.player_id
  )
  SELECT 
    t.player_id,
    t.player_name,
    t."position",
    t.team_id,
    t.team_name,
    t.team_abbreviation,
    t.age,
    t.last_game_text,
    t.current_status,
    COALESCE(pr.max_stars, 0) as rating_stars
  FROM bigquery.dim_players t
  LEFT JOIN player_ratings pr ON t.player_id = pr.player_id
  ORDER BY COALESCE(pr.max_stars, 0) DESC NULLS LAST, t.player_name ASC;
END;
$$;

-- Function to get player by ID
DROP FUNCTION IF EXISTS public.get_player_by_id(bigint);
CREATE OR REPLACE FUNCTION public.get_player_by_id(p_player_id bigint)
RETURNS TABLE (
  player_id bigint,
  player_name text,
  "position" text,
  team_id bigint,
  team_name text,
  team_abbreviation text,
  age bigint,
  last_game_text text,
  current_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.player_id,
    t.player_name,
    t."position",
    t.team_id,
    t.team_name,
    t.team_abbreviation,
    t.age,
    t.last_game_text,
    t.current_status
  FROM bigquery.dim_players t
  WHERE t.player_id = p_player_id
  LIMIT 1;
END;
$$;

-- Function to get player by name
DROP FUNCTION IF EXISTS public.get_player_by_name(text);
CREATE OR REPLACE FUNCTION public.get_player_by_name(p_player_name text)
RETURNS TABLE (
  player_id bigint,
  player_name text,
  "position" text,
  team_id bigint,
  team_name text,
  team_abbreviation text,
  age bigint,
  last_game_text text,
  current_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.player_id,
    t.player_name,
    t."position",
    t.team_id,
    t.team_name,
    t.team_abbreviation,
    t.age,
    t.last_game_text,
    t.current_status
  FROM bigquery.dim_players t
  WHERE t.player_name = p_player_name
  LIMIT 1;
END;
$$;

-- Function to get player props
DROP FUNCTION IF EXISTS public.get_player_props(bigint);
CREATE OR REPLACE FUNCTION public.get_player_props(p_player_id bigint)
RETURNS TABLE (
  player_id bigint,
  team_id bigint,
  stat_type text,
  rating_stars bigint,
  is_leader_with_injury boolean,
  is_available_backup boolean,
  stat_rank bigint,
  next_available_player_name text,
  next_player_stats_when_leader_out float8,
  next_player_stats_normal float8,
  loaded_at timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.player_id,
    t.team_id,
    t.stat_type,
    t.rating_stars,
    t.is_leader_with_injury,
    t.is_available_backup,
    t.stat_rank,
    t.next_available_player_name,
    t.next_player_stats_when_leader_out,
    t.next_player_stats_normal,
    t.loaded_at
  FROM bigquery.dim_prop_player t
  WHERE t.player_id = p_player_id;
END;
$$;

-- Function to get player game stats
DROP FUNCTION IF EXISTS public.get_player_game_stats(bigint, int);
CREATE OR REPLACE FUNCTION public.get_player_game_stats(p_player_id bigint, p_limit int DEFAULT 15)
RETURNS TABLE (
  player_id bigint,
  game_date date,
  game_id bigint,
  stat_type text,
  stat_value float8,
  "line" float8,
  is_b2b_game boolean,
  stat_vs_line text,
  played_against text,
  home_away text,
  is_played text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.player_id,
    t.game_date,
    t.game_id,
    t.stat_type,
    t.stat_value,
    t."line",
    t.is_b2b_game,
    t.stat_vs_line,
    t.played_against,
    t.home_away,
    t.is_played
  FROM bigquery.ft_game_player_stats t
  WHERE t.player_id = p_player_id
  ORDER BY t.game_date DESC
  LIMIT p_limit;
END;
$$;

-- Function to get team by ID
DROP FUNCTION IF EXISTS public.get_team_by_id(bigint);
CREATE OR REPLACE FUNCTION public.get_team_by_id(p_team_id bigint)
RETURNS TABLE (
  team_id bigint,
  team_name text,
  team_abbreviation text,
  conference text,
  team_city text,
  season bigint,
  conference_rank float8,
  wins bigint,
  losses bigint,
  team_last_five_games text,
  team_rating_rank bigint,
  team_offensive_rating_rank bigint,
  team_defensive_rating_rank bigint,
  next_opponent_id bigint,
  next_opponent_name text,
  next_opponent_abbreviation text,
  is_next_game_home boolean,
  next_opponent_team_last_five_games text,
  next_opponent_conference_rank float8,
  next_opponent_team_rating_rank bigint,
  next_opponent_team_offensive_rating_rank bigint,
  next_opponent_team_defensive_rating_rank bigint,
  team_injury_report_time_brasilia text,
  next_game_injury_report_time_brasilia text,
  loaded_at timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.team_id,
    t.team_name,
    t.team_abbreviation,
    t.conference,
    t.team_city,
    t.season,
    t.conference_rank,
    t.wins,
    t.losses,
    t.team_last_five_games,
    t.team_rating_rank,
    t.team_offensive_rating_rank,
    t.team_defensive_rating_rank,
    t.next_opponent_id,
    t.next_opponent_name,
    t.next_opponent_abbreviation,
    t.is_next_game_home,
    t.next_opponent_team_last_five_games,
    t.next_opponent_conference_rank,
    t.next_opponent_team_rating_rank,
    t.next_opponent_team_offensive_rating_rank,
    t.next_opponent_team_defensive_rating_rank,
    t.team_injury_report_time_brasilia,
    t.next_game_injury_report_time_brasilia,
    t.loaded_at
  FROM bigquery.dim_teams t
  WHERE t.team_id = p_team_id
  LIMIT 1;
END;
$$;

-- Grant execute permissions to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.get_all_players() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_by_id(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_by_name(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_props(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_game_stats(bigint, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_team_by_id(bigint) TO authenticated, anon;

