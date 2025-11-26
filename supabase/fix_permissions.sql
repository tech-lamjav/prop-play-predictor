-- Enable pgsodium extension if not exists
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Grant usage on pgsodium schema
GRANT USAGE ON SCHEMA pgsodium TO service_role, authenticated, postgres;

-- Grant execute on all functions in pgsodium (broad grant for local dev)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgsodium TO service_role, authenticated, postgres;

-- Specifically grant on the function mentioned in the error if it's not covered above (internal functions might be tricky)
-- But usually granting on schema functions covers it.

-- Also ensure vault usage
GRANT USAGE ON SCHEMA vault TO service_role, authenticated, postgres;
GRANT ALL ON ALL TABLES IN SCHEMA vault TO service_role, authenticated, postgres;

-- Specific grants for functions causing errors
GRANT EXECUTE ON FUNCTION pgsodium.crypto_kx_seed_new_keypair() TO service_role, authenticated, postgres, anon;
GRANT EXECUTE ON FUNCTION pgsodium.derive_key(text, bigint, bytea) TO service_role, authenticated, postgres, anon;
GRANT EXECUTE ON FUNCTION pgsodium.pgsodium_derive(bigint, int, text) TO service_role, authenticated, postgres, anon;
GRANT EXECUTE ON FUNCTION pgsodium.pgsodium_derive(bigint, int) TO service_role, authenticated, postgres, anon;
GRANT EXECUTE ON FUNCTION pgsodium.pgsodium_derive(bigint) TO service_role, authenticated, postgres, anon;

-- Broad grant on all pgsodium functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgsodium TO service_role, authenticated, postgres, anon;
