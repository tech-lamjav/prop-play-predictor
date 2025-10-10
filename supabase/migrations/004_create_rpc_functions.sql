-- Create RPC functions to query BigQuery foreign tables

-- Function to get all players
CREATE OR REPLACE FUNCTION get_players()
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  team_name TEXT,
  "position" TEXT,
  current_status TEXT,
  games_played INTEGER,
  minutes FLOAT,
  team_rating_rank INTEGER
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    id,
    name,
    team_name,
    "position",
    current_status,
    games_played,
    minutes,
    team_rating_rank
  FROM bigquery.dim_players
  ORDER BY name;
$$;

-- Function to get teams
CREATE OR REPLACE FUNCTION get_teams()
RETURNS TABLE (team_name TEXT)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT DISTINCT team_name
  FROM bigquery.dim_players
  ORDER BY team_name;
$$;

-- Function to get player by ID
CREATE OR REPLACE FUNCTION get_player_by_id(player_id INTEGER)
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  team_name TEXT,
  "position" TEXT,
  current_status TEXT,
  games_played INTEGER,
  minutes FLOAT,
  team_rating_rank INTEGER
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT 
    id,
    name,
    team_name,
    "position",
    current_status,
    games_played,
    minutes,
    team_rating_rank
  FROM bigquery.dim_players
  WHERE id = player_id;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_players() TO authenticated;
GRANT EXECUTE ON FUNCTION get_teams() TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_by_id(INTEGER) TO authenticated;
