-- Clean up existing BigQuery setup and recreate with correct credentials
-- This migration drops all existing BigQuery components and recreates them

-- Drop existing foreign tables first
DROP FOREIGN TABLE IF EXISTS bigquery.player_stats CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.betting_lines CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.team_lineups CASCADE;
DROP FOREIGN TABLE IF EXISTS bigquery.game_schedule CASCADE;

-- Drop the existing server
DROP SERVER IF EXISTS bigquery_server CASCADE;

-- Drop the existing wrapper
DROP FOREIGN DATA WRAPPER IF EXISTS bigquery_wrapper CASCADE;

-- Enable the wrappers extension
CREATE EXTENSION IF NOT EXISTS wrappers WITH SCHEMA extensions;

-- Create the BigQuery foreign data wrapper
CREATE FOREIGN DATA WRAPPER bigquery_wrapper
  HANDLER big_query_fdw_handler
  VALIDATOR big_query_fdw_validator;

-- Create a schema for BigQuery foreign tables
CREATE SCHEMA IF NOT EXISTS bigquery;

-- Create the BigQuery server with correct credentials
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
  id INTEGER,
  name TEXT,
  position TEXT,
  team_id INTEGER,
  team_name TEXT,
  team_abbreviation TEXT,
  age INTEGER,
  games_played INTEGER,
  minutes FLOAT,
  last_game_text TEXT,
  last_games TEXT,
  current_status TEXT,
  conference_rank FLOAT,
  team_rating_rank INTEGER,
  team_offensive_rating_rank INTEGER,
  team_defensive_rating_rank INTEGER,
  next_opponent_id INTEGER,
  next_opponent_name TEXT,
  next_opponent_abbreviation TEXT,
  next_opponent_last_games TEXT,
  next_opponent_conference_rank FLOAT,
  next_opponent_team_rating_rank INTEGER,
  next_opponent_team_offensive_rating_rank INTEGER,
  next_opponent_team_defensive_rating_rank INTEGER,
  loaded_at TIMESTAMP
)
SERVER bigquery_server
OPTIONS (
  table 'dim_players',
  location 'us-east1'
);

-- 2. dim_prop_player table
CREATE FOREIGN TABLE bigquery.dim_prop_player (
  player_id INTEGER,
  team_id INTEGER,
  stat_type TEXT,
  stat_value FLOAT,
  line FLOAT,
  delta FLOAT,
  stat_rank INTEGER,
  team_avg_stat FLOAT,
  team_stddev_stat FLOAT,
  zscore FLOAT,
  rating_stars INTEGER,
  current_status TEXT,
  is_leader_with_injury BOOLEAN,
  is_available_backup BOOLEAN,
  next_available_id INTEGER,
  next_player_stats_when_leader_out FLOAT,
  next_player_stats_normal FLOAT,
  loaded_at TIMESTAMP
)
SERVER bigquery_server
OPTIONS (
  table 'dim_prop_player',
  location 'us-east1'
);

-- 3. dim_player_stat_line_perf table
CREATE FOREIGN TABLE bigquery.dim_player_stat_line_perf (
  player_id INTEGER,
  stat_type TEXT,
  over_lines INTEGER,
  totals INTEGER,
  perc_over_line FLOAT,
  game_numbers TEXT
)
SERVER bigquery_server
OPTIONS (
  table 'dim_player_stat_line_perf',
  location 'us-east1'
);

-- 4. ft_player_stat_over_line table
CREATE FOREIGN TABLE bigquery.ft_player_stat_over_line (
  player_id INTEGER,
  game_date DATE,
  game_id INTEGER,
  stat_type TEXT,
  stat_value FLOAT,
  line FLOAT,
  stat_vs_line TEXT,
  played_against TEXT,
  is_b2b_game BOOLEAN,
  home_away TEXT
)
SERVER bigquery_server
OPTIONS (
  table 'ft_player_stat_over_line',
  location 'us-east1'
);

-- Create a function to execute BigQuery queries
CREATE OR REPLACE FUNCTION execute_bigquery_query(query_text TEXT)
RETURNS TABLE(result JSONB)
LANGUAGE plpgsql
AS $$
BEGIN
  -- This function would execute the query and return results
  -- In a real implementation, you'd need to handle the query execution
  -- For now, this is a placeholder
  RETURN QUERY SELECT '{"error": "Function not implemented"}'::JSONB;
END;
$$;

-- Grant permissions
GRANT USAGE ON SCHEMA bigquery TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA bigquery TO authenticated;
GRANT EXECUTE ON FUNCTION execute_bigquery_query TO authenticated;
