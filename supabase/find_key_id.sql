-- Run this to find the correct key_id for your BigQuery secret
SELECT name, id, key_id, description 
FROM vault.secrets;

-- Once you have the correct key_id (it should be a UUID), 
-- replace the value in the CREATE SERVER block in supabase/foreign_tables.sql
-- 
-- CREATE SERVER bigquery_server
--   FOREIGN DATA WRAPPER bigquery_wrapper
--   OPTIONS (
--     sa_key_id 'YOUR_CORRECT_KEY_ID_HERE',
--     ...
--   );
