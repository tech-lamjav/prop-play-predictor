-- Complete setup for local BigQuery foreign tables
-- Run this in your local Supabase SQL Editor

-- Step 1: Create the bigquery schema
CREATE SCHEMA IF NOT EXISTS bigquery;

-- Step 2: Drop existing foreign tables if they exist
DROP FOREIGN TABLE IF EXISTS bigquery.dim_players CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.dim_prop_player CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.dim_teams CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.ft_game_player_stats CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.ft_games CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.dim_players_shooting_by_zones CASCADE;

-- Step 3: Drop and recreate the server
DROP SERVER IF EXISTS bigquery_server CASCADE;
DROP FOREIGN DATA WRAPPER IF EXISTS bigquery_wrapper CASCADE;

-- Ensure extension and wrapper exist
CREATE EXTENSION IF NOT EXISTS wrappers WITH SCHEMA extensions;

CREATE FOREIGN DATA WRAPPER bigquery_wrapper
  HANDLER big_query_fdw_handler
  VALIDATOR big_query_fdw_validator;

CREATE SERVER bigquery_server
  FOREIGN DATA WRAPPER bigquery_wrapper
  OPTIONS (
    sa_key_id 'b2a29dbe-f9e0-4b1a-8489-87636f09d7bf',
    project_id 'sigma-heuristic-469419-h3',
    dataset_id 'bi',
    location 'us-east1'
  );

-- Step 4: Create foreign tables

-- dim_players table
CREATE FOREIGN TABLE bigquery.dim_players (
  player_id int8,
  player_name text,
  position text,
  team_id int8,
  team_name text,
  team_abbreviation text,
  age int8,
  last_game_text text,
  current_status text
)
SERVER bigquery_server
OPTIONS (
  table 'dim_players',
  location 'us-east1'
);

-- dim_prop_player table
CREATE FOREIGN TABLE bigquery.dim_prop_player (
  player_id int8,
  team_id int8,
  stat_type text,
  rating_stars int8,
  is_leader_with_injury boolean,
  is_available_backup boolean,
  stat_rank int8,
  next_available_player_name text,
  next_player_stats_when_leader_out float8,
  next_player_stats_normal float8,
  loaded_at timestamp
)
SERVER bigquery_server
OPTIONS (
  table 'dim_prop_player',
  location 'us-east1'
);

-- dim_teams table
CREATE FOREIGN TABLE bigquery.dim_teams (
  team_id int8,
  team_name text,
  team_abbreviation text,
  conference text,
  team_city text,
  season int8,
  conference_rank float8,
  wins int8,
  losses int8,
  team_last_five_games text,
  team_rating_rank int8,
  team_offensive_rating_rank int8,
  team_defensive_rating_rank int8,
  next_opponent_id int8,
  next_opponent_name text,
  next_opponent_abbreviation text,
  is_next_game_home boolean,
  next_opponent_team_last_five_games text,
  next_opponent_conference_rank float8,
  next_opponent_team_rating_rank int8,
  next_opponent_team_offensive_rating_rank int8,
  next_opponent_team_defensive_rating_rank int8,
  team_injury_report_time_brasilia text,
  next_game_injury_report_time_brasilia text,
  loaded_at timestamp
)
SERVER bigquery_server
OPTIONS (
  table 'dim_teams',
  location 'us-east1'
);

-- ft_game_player_stats table
CREATE FOREIGN TABLE bigquery.ft_game_player_stats (
  player_id int8,
  game_date date,
  game_id int8,
  stat_type text,
  stat_value float8,
  line float8,
  is_b2b_game boolean,
  stat_vs_line text,
  played_against text,
  home_away text,
  is_played text
)
SERVER bigquery_server
OPTIONS (
  table 'ft_game_player_stats',
  location 'us-east1'
);

-- ft_games table
CREATE FOREIGN TABLE bigquery.ft_games (
  game_id int8,
  game_date date,
  home_team_id int8,
  home_team_name text,
  home_team_abbreviation text,
  home_team_score float8,
  visitor_team_id int8,
  visitor_team_name text,
  visitor_team_abbreviation text,
  visitor_team_score float8,
  winner_team_id int8,
  loaded_at timestamp,
  home_team_is_b2b_game boolean,
  visitor_team_is_b2b_game boolean,
  home_team_is_next_game boolean,
  visitor_team_is_next_game boolean
)
SERVER bigquery_server
OPTIONS (
  table 'ft_games',
  location 'us-east1'
);

-- dim_players_shooting_by_zones table
CREATE FOREIGN TABLE bigquery.dim_players_shooting_by_zones (
  player_id int8,
  player_name text,
  corner_3_fga float8,
  corner_3_fgm float8,
  corner_3_fg_pct float8,
  left_corner_3_fga float8,
  left_corner_3_fgm float8,
  left_corner_3_fg_pct float8,
  right_corner_3_fga float8,
  right_corner_3_fgm float8,
  right_corner_3_fg_pct float8,
  above_the_break_3_fga float8,
  above_the_break_3_fgm float8,
  above_the_break_3_fg_pct float8,
  restricted_area_fga float8,
  restricted_area_fgm float8,
  restricted_area_fg_pct float8,
  in_the_paint_non_ra_fga float8,
  in_the_paint_non_ra_fgm float8,
  in_the_paint_non_ra_fg_pct float8,
  mid_range_fga float8,
  mid_range_fgm float8,
  mid_range_fg_pct float8,
  backcourt_fga float8,
  backcourt_fgm float8,
  backcourt_fg_pct float8,
  loaded_at timestamp
)
SERVER bigquery_server
OPTIONS (
  table 'dim_players_shooting_by_zones',
  location 'us-east1'
);

-- Step 5: Grant permissions
GRANT USAGE ON SCHEMA bigquery TO authenticated, anon;
GRANT SELECT ON ALL TABLES IN SCHEMA bigquery TO authenticated, anon;
