-- ============================================
-- SETUP BIGQUERY WRAPPER - ESTRUTURA BASE
-- ============================================
-- Esta migration cria apenas a estrutura base (extensão, schema, FDW).
-- As credenciais e foreign tables são configuradas manualmente via setup_bigquery_local.sql.
--
-- Resiliente a ambientes sem BigQuery FDW (Supabase Free, CI, staging):
-- se o handler não estiver disponível, apenas loga um NOTICE e continua.
-- O NBA dashboard ficará inativo nesses ambientes, mas todo o resto funciona.

-- Criar schema para foreign tables (sempre seguro)
CREATE SCHEMA IF NOT EXISTS bigquery;

-- Habilitar extensão wrappers (pode não existir no Free — captura qualquer erro)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS wrappers WITH SCHEMA extensions;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Extensão wrappers não disponível (código %): %. BigQuery FDW será ignorado.', SQLSTATE, SQLERRM;
END $$;

-- Criar o Foreign Data Wrapper para BigQuery (se o handler existir)
DO $$
BEGIN
  -- Pula se já existe
  IF EXISTS (SELECT 1 FROM pg_foreign_data_wrapper WHERE fdwname = 'bigquery_wrapper') THEN
    RAISE NOTICE 'BigQuery FDW já existe, pulando criação.';
    RETURN;
  END IF;

  -- Tenta com schema explícito (Supabase Pro / instâncias com wrappers completos)
  BEGIN
    CREATE FOREIGN DATA WRAPPER bigquery_wrapper
      HANDLER extensions.big_query_fdw_handler
      VALIDATOR extensions.big_query_fdw_validator;
    RAISE NOTICE 'BigQuery FDW criado com sucesso (extensions.big_query_fdw_handler).';
    RETURN;
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;

  -- Fallback sem schema
  BEGIN
    CREATE FOREIGN DATA WRAPPER bigquery_wrapper
      HANDLER big_query_fdw_handler
      VALIDATOR big_query_fdw_validator;
    RAISE NOTICE 'BigQuery FDW criado com sucesso (big_query_fdw_handler).';
    RETURN;
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;

  RAISE NOTICE 'BigQuery FDW handler não disponível neste ambiente. Habilite em Database > Extensions > wrappers ou faça upgrade do PostgreSQL. O NBA dashboard ficará inativo.';
END $$;
