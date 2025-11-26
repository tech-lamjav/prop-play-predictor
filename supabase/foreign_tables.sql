-- Drop existing foreign tables if they exist (using the new names)
DROP FOREIGN TABLE IF EXISTS bigquery.dim_players CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.dim_prop_player CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.dim_teams CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.ft_game_player_stats CASCADE;

-- Also drop the old ones just in case
DROP FOREIGN TABLE IF EXISTS bigquery.player_stats CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.betting_lines CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.team_lineups CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.game_schedule CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.dim_player_stat_line_perf CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.ft_player_stat_over_line CASCADE;

-- Recreate server with correct location (User provided this previously)
DROP SERVER IF EXISTS bigquery_server CASCADE;

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

-- Create foreign tables for your actual BigQuery tables

-- 1. dim_players table
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

-- 2. dim_prop_player table
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

-- 3. dim_teams table
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

-- 4. ft_game_player_stats table
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

-- Grant permissions
GRANT USAGE ON SCHEMA bigquery TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA bigquery TO authenticated;
