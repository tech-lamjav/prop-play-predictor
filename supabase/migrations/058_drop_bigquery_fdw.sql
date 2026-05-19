-- ============================================================
-- Fase 5 do PLANO_OTIMIZACAO_BQ_SUPABASE.md (cleanup)
-- ============================================================
-- Remove o BigQuery FDW: server, wrapper, schema bigquery e o secret
-- da service account. Apos a Fase 4 (migration 057) todas as RPCs ja
-- apontam pra nba_mart, entao o FDW deixou de ter dependentes.
--
-- Pre-requisito: nba_mart populado pelo Cloud Run sync. Aplicar em
-- ambiente onde sync ainda nao rodou quebra o app, mesmo com 057
-- aplicada (RPCs leem nba_mart vazio).
--
-- Reversao: recriar o FDW seguindo prop-play-predictor/supabase/
-- setup_bigquery_local.sql (esse arquivo continua versionado no historico
-- do git mesmo apos removido em Fase 5). Cuidado: o secret precisa ser
-- recriado no vault antes.
-- ============================================================

DROP SERVER IF EXISTS bigquery_server CASCADE;
DROP FOREIGN DATA WRAPPER IF EXISTS bigquery_wrapper CASCADE;
DROP SCHEMA IF EXISTS bigquery CASCADE;

DELETE FROM vault.secrets WHERE name = 'bigquery_sa_key';
