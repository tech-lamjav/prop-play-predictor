-- ============================================================
-- 088_ops_healthcheck — vigia dos crons (Onda 2 da revisão do Betinho)
-- ============================================================
-- Mata a classe de falha "cron mudo": job agendado cujos vault secrets nunca
-- foram criados falha em SILÊNCIO (net.http_post com url null) — já aconteceu
-- 3x (notify-kickoff; notify-opportunities + ingest-fixtures semanas mudos em
-- prod; quase 4ª com o notify-weekly-summary).
--
-- Desenho em 2 peças (o bot token vive em env de edge, não no Vault, então o
-- check não pode ser 100% SQL):
--   • RPC get_cron_health() — para cada cron.job: extrai por regex os secrets
--     que o comando referencia e confere existência no vault; conta falhas nas
--     últimas 5 execuções.
--   • edge ops-healthcheck (cron diário 8h BRT) — chama a RPC e manda DM pro
--     admin SÓ se houver problema (silêncio = tudo bem). Se auto-verifica: o
--     próprio job aparece na listagem.
--
-- ops_config guarda o chat do admin (dado operacional, não segredo) — evita
-- depender de env var que ninguém confirma se foi setada.
--
-- PRÉ-REQUISITO POR AMBIENTE (o CI não cria — exatamente o que este vigia pega):
--   vault.create_secret('<url da função>', 'ops_healthcheck_url', ...);
--   vault.create_secret('<x-cron-secret>', 'ops_healthcheck_cron_secret', ...);
--   INSERT INTO ops_config VALUES ('admin_telegram_chat_id', '<chat_id>');
-- ============================================================

-- ── Config operacional (service-role only) ───────────────────
CREATE TABLE IF NOT EXISTS public.ops_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);
COMMENT ON TABLE public.ops_config IS
  'Config operacional (ex.: admin_telegram_chat_id). Não é segredo — segredo vive no Vault.';
ALTER TABLE public.ops_config ENABLE ROW LEVEL SECURITY;
-- sem policy: só service_role

-- ── Saúde dos crons ──────────────────────────────────────────
-- missing_secrets: nomes referenciados no comando (padrão vault.decrypted_secrets
-- WHERE name = 'x') que NÃO existem no vault. failed/total_recent: últimas 5 runs.
CREATE OR REPLACE FUNCTION public.get_cron_health()
RETURNS TABLE(jobname text, active boolean, missing_secrets text[], failed_recent int, total_recent int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH jobs AS (
    SELECT j.jobid, j.jobname, j.active, j.command FROM cron.job j
  ),
  refs AS (
    SELECT j.jobid, m.cap[1] AS secret_name
    FROM jobs j,
    LATERAL regexp_matches(j.command, 'decrypted_secrets\s+WHERE\s+name\s*=\s*''([a-z0-9_]+)''', 'g') AS m(cap)
  ),
  missing AS (
    SELECT r.jobid, array_agg(DISTINCT r.secret_name) AS missing
    FROM refs r
    WHERE NOT EXISTS (SELECT 1 FROM vault.secrets s WHERE s.name = r.secret_name)
    GROUP BY r.jobid
  ),
  runs AS (
    SELECT d.jobid,
           count(*) FILTER (WHERE d.status = 'failed')::int AS failed_recent,
           count(*)::int AS total_recent
    FROM (
      SELECT jobid, status, row_number() OVER (PARTITION BY jobid ORDER BY start_time DESC) AS rn
      FROM cron.job_run_details
    ) d
    WHERE d.rn <= 5
    GROUP BY d.jobid
  )
  SELECT j.jobname, j.active,
         COALESCE(m.missing, '{}'::text[]),
         COALESCE(r.failed_recent, 0),
         COALESCE(r.total_recent, 0)
  FROM jobs j
  LEFT JOIN missing m ON m.jobid = j.jobid
  LEFT JOIN runs r ON r.jobid = j.jobid
  ORDER BY j.jobname;
$function$;

REVOKE ALL ON FUNCTION public.get_cron_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cron_health() TO service_role;

-- ── Cron: diário 8h BRT (11:00 UTC) ──────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ops-healthcheck') THEN
    PERFORM cron.unschedule('ops-healthcheck');
  END IF;
END $$;

SELECT cron.schedule('ops-healthcheck', '0 11 * * *', $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ops_healthcheck_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ops_healthcheck_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$job$);
