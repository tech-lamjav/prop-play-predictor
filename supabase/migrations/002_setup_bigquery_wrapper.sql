-- ============================================
-- SETUP BIGQUERY WRAPPER - ESTRUTURA BASE
-- ============================================
-- Esta migration cria apenas a estrutura base (extensão, schema, FDW)
-- As credenciais e foreign tables são configuradas manualmente via setup_bigquery_local.sql

-- Habilitar extensão wrappers
CREATE EXTENSION IF NOT EXISTS wrappers WITH SCHEMA extensions;

-- Criar schema para foreign tables
CREATE SCHEMA IF NOT EXISTS bigquery;

-- Criar o Foreign Data Wrapper para BigQuery
-- IMPORTANTE: O handler é "big_query_fdw_handler" (com underscores)
CREATE FOREIGN DATA WRAPPER bigquery_wrapper
  HANDLER big_query_fdw_handler
  VALIDATOR big_query_fdw_validator;

-- ============================================
-- NOTA: O servidor e as foreign tables são criados manualmente
-- usando o arquivo supabase/setup_bigquery_local.sql
-- porque as credenciais (sa_key_id) são geradas dinamicamente pelo Vault
-- ============================================
