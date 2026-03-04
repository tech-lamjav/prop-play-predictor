-- Create RPC functions to query BigQuery foreign tables
-- Skip when BigQuery FDW is not configured (e.g. staging without BigQuery)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.foreign_tables WHERE foreign_table_schema = 'bigquery' AND foreign_table_name = 'dim_players') THEN
    RAISE NOTICE 'BigQuery foreign table bigquery.dim_players not found - skipping RPC functions (get_players, get_teams, get_player_by_id)';
    RETURN;
  END IF;

  EXECUTE 'CREATE OR REPLACE FUNCTION get_players()
    RETURNS TABLE (id INTEGER, name TEXT, team_name TEXT, "position" TEXT, current_status TEXT, games_played INTEGER, minutes FLOAT, team_rating_rank INTEGER)
    LANGUAGE SQL SECURITY DEFINER AS $f$
      SELECT id, name, team_name, "position", current_status, games_played, minutes, team_rating_rank
      FROM bigquery.dim_players ORDER BY name;
    $f$';

  EXECUTE 'CREATE OR REPLACE FUNCTION get_teams()
    RETURNS TABLE (team_name TEXT)
    LANGUAGE SQL SECURITY DEFINER AS $f$
      SELECT DISTINCT team_name FROM bigquery.dim_players ORDER BY team_name;
    $f$';

  EXECUTE 'CREATE OR REPLACE FUNCTION get_player_by_id(player_id INTEGER)
    RETURNS TABLE (id INTEGER, name TEXT, team_name TEXT, "position" TEXT, current_status TEXT, games_played INTEGER, minutes FLOAT, team_rating_rank INTEGER)
    LANGUAGE SQL SECURITY DEFINER AS $f$
      SELECT id, name, team_name, "position", current_status, games_played, minutes, team_rating_rank
      FROM bigquery.dim_players WHERE id = player_id;
    $f$';

  GRANT EXECUTE ON FUNCTION get_players() TO authenticated;
  GRANT EXECUTE ON FUNCTION get_teams() TO authenticated;
  GRANT EXECUTE ON FUNCTION get_player_by_id(INTEGER) TO authenticated;
END $$;
