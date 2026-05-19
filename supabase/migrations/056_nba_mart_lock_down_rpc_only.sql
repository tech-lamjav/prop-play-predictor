-- ============================================================
-- Fecha exposicao do schema nba_mart via PostgREST
-- ============================================================
-- A primeira versao da migration 055 incluiu GRANT USAGE/SELECT pra
-- anon/authenticated, o que fez PostgREST expor as tabelas direto
-- (qualquer cliente com anon key conseguia ler todos os marts via REST,
-- pulando as RPCs SECURITY DEFINER que sao o ponto de controle).
--
-- Esta migration revoga essas permissoes. Apos isso o acesso e:
--   - App -> RPCs em public (SECURITY DEFINER, rodam como postgres) -> nba_mart
--   - Cloud Run sync -> conecta como role postgres -> nba_mart
-- PostgREST nao enxerga mais o schema porque anon/authenticated perderam
-- USAGE.
--
-- A migration 055 ja foi corrigida em disco (sem GRANTs). Esta 056 existe
-- pra reparar ambientes que receberam a versao antiga (ex: staging).
-- Em ambientes novos rodando 055 corrigida, os REVOKEs aqui sao no-op.
-- ============================================================

REVOKE SELECT ON ALL TABLES IN SCHEMA nba_mart FROM authenticated, anon;
REVOKE USAGE ON SCHEMA nba_mart FROM authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA nba_mart
  REVOKE SELECT ON TABLES FROM authenticated, anon;
