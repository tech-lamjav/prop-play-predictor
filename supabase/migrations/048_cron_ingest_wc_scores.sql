-- ============================================================
-- Agendamento (cron) da ingestão de placar — ingest-wc-scores
-- ============================================================
-- Habilita pg_cron + pg_net e agenda a chamada da edge function ingest-wc-scores
-- a cada 5 min. URL e secret são lidos do Vault (NÃO ficam hardcoded aqui), então
-- esta migration é portável entre ambientes.
--
-- PRÉ-REQUISITO POR AMBIENTE (não versionado — rodar uma vez via SQL, ver runbook):
--   vault.create_secret('<x-cron-secret>',  'ingest_wc_cron_secret', ...);
--   vault.create_secret('<url da função>',  'ingest_wc_url', ...);
-- E os secrets da própria função (API_SPORTS_KEY, CRON_SECRET) setados no painel.
--
-- TODO prod: restringir à janela do torneio (jun/jul) e usar cadência menor em
-- horário de jogo (ex: */2) e maior fora dele.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ingest-wc-scores') THEN
    PERFORM cron.unschedule('ingest-wc-scores');
  END IF;
END $$;

SELECT cron.schedule('ingest-wc-scores', '*/5 * * * *', $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ingest_wc_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ingest_wc_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$job$);
