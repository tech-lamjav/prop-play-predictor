-- Enable the wrappers extension
CREATE EXTENSION IF NOT EXISTS wrappers WITH SCHEMA extensions;

-- Create the BigQuery foreign data wrapper
CREATE FOREIGN DATA WRAPPER bigquery_wrapper
  HANDLER big_query_fdw_handler
  VALIDATOR big_query_fdw_validator;

-- Create a schema for BigQuery foreign tables
CREATE SCHEMA IF NOT EXISTS bigquery;

-- Create the BigQuery server (you'll need to replace these with your actual credentials)
-- Note: In production, use Vault to store credentials securely
CREATE SERVER bigquery_server
  FOREIGN DATA WRAPPER bigquery_wrapper
  OPTIONS (
    -- Replace with your actual BigQuery credentials
    sa_key_id 'b2a29dbe-f9e0-4b1a-8489-87636f09d7bf', -- Your Vault Key ID
    project_id 'sigma-heuristic-469419-h3', -- Replace with your actual GCP project ID
    dataset_id 'sigma-heuristic-469419-h3.bi' -- Replace with your actual BigQuery dataset ID
  );

-- Create foreign tables for NBA data
-- Player Statistics Table
CREATE FOREIGN TABLE bigquery.player_stats (
  player_id TEXT,
  player_name TEXT,
  team TEXT,
  position TEXT,
  game_date DATE,
  points NUMERIC,
  assists NUMERIC,
  rebounds NUMERIC,
  steals NUMERIC,
  blocks NUMERIC,
  turnovers NUMERIC,
  fouls NUMERIC,
  minutes_played NUMERIC,
  fg_made NUMERIC,
  fg_attempted NUMERIC,
  threes_made NUMERIC,
  threes_attempted NUMERIC,
  ft_made NUMERIC,
  ft_attempted NUMERIC,
  plus_minus NUMERIC,
  efficiency NUMERIC,
  season TEXT
)
SERVER bigquery_server
OPTIONS (
  table 'player_stats',
  location 'US'
);

-- Betting Lines Table
CREATE FOREIGN TABLE bigquery.betting_lines (
  player_id TEXT,
  player_name TEXT,
  stat_type TEXT,
  line NUMERIC,
  over_odds NUMERIC,
  under_odds NUMERIC,
  game_date DATE,
  bookmaker TEXT,
  last_updated TIMESTAMP
)
SERVER bigquery_server
OPTIONS (
  table 'betting_lines',
  location 'US'
);

-- Team Lineups Table
CREATE FOREIGN TABLE bigquery.team_lineups (
  team_id TEXT,
  team_name TEXT,
  game_date DATE,
  player_id TEXT,
  player_name TEXT,
  position TEXT,
  status TEXT,
  avg_points NUMERIC,
  avg_assists NUMERIC,
  avg_rebounds NUMERIC
)
SERVER bigquery_server
OPTIONS (
  table 'team_lineups',
  location 'US'
);

-- Game Schedule Table
CREATE FOREIGN TABLE bigquery.game_schedule (
  game_id TEXT,
  home_team TEXT,
  away_team TEXT,
  game_date DATE,
  game_time TEXT,
  venue TEXT,
  status TEXT
)
SERVER bigquery_server
OPTIONS (
  table 'game_schedule',
  location 'US'
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
