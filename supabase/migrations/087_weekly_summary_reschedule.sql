-- ============================================================
-- 087_weekly_summary_reschedule — resumo semanal às 9h30 BRT (revisão UX)
-- ============================================================
-- A 086 agendou o resumo pra segunda 10h BRT ('0 13 * * 1') — MESMO minuto do
-- daily de oportunidades ('0 13 * * *'): toda segunda o usuário receberia as
-- duas DMs juntas, em ordem aleatória. Correção da revisão de UX (2026-07-20):
-- resumo às 9h30, daily às 10h — narrativa passado→futuro ("sua semana fechou
-- assim" → "as oportunidades de hoje").
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-weekly-summary') THEN
    PERFORM cron.unschedule('notify-weekly-summary');
  END IF;
END $$;

SELECT cron.schedule('notify-weekly-summary', '30 12 * * 1', $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_weekly_summary_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_weekly_summary_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$job$);
