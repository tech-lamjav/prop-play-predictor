-- ============================================================
-- 081_notify_opportunities — oportunidades do dia no Telegram (08′)
-- ============================================================
-- O motor já existe (dbt → fact_value_opportunities → get_futebol_value_board);
-- aqui entra SÓ o formato de entrega: um daily no Telegram com os melhores
-- picks do dia (Score + evidências, mesma língua do site).
--
-- Dois segmentos de público (decisão de produto 2026-07-08):
--   A · futebol ativo  — trial vigente ou assinante + Telegram. Recebe sempre.
--   B · reativação     — conectou o Telegram mas está inativo. Recebe até
--       2 envios; se não CLICAR em nenhum, para de receber (a mensagem tem
--       que merecer continuar existindo). Clique zera o contador.
--
-- O clique é medido pelo redirecionador `go` (edge function): registra em
-- notification_clicks + zera o contador, e manda a pessoa pro destino.
--
-- PRÉ-REQUISITO POR AMBIENTE (rodar uma vez via SQL, igual 048/073/078):
--   vault.create_secret('<x-cron-secret>', 'notify_opportunities_cron_secret', ...);
--   vault.create_secret('<url da função>', 'notify_opportunities_url', ...);
-- ============================================================

-- ── Estado de cadência por usuário ───────────────────────────
CREATE TABLE IF NOT EXISTS public.opportunity_dispatch_state (
  user_id             uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  segment             text NOT NULL,               -- 'A' (futebol ativo) | 'B' (reativação)
  sends_without_click integer NOT NULL DEFAULT 0,  -- regra do B: >= 2 → para
  last_sent_at        timestamptz,
  last_click_at       timestamptz
);
COMMENT ON TABLE public.opportunity_dispatch_state IS
  'Cadência do daily de oportunidades: no segmento B (reativação), 2 envios sem clique = para de receber.';
ALTER TABLE public.opportunity_dispatch_state ENABLE ROW LEVEL SECURITY;
-- sem policy: só service_role

-- ── Cliques rastreados (funil enviado → clicou) ──────────────
CREATE TABLE IF NOT EXISTS public.notification_clicks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.users(id) ON DELETE CASCADE,
  campaign    text NOT NULL,
  destination text NOT NULL,
  clicked_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_clicks_user ON public.notification_clicks(user_id, clicked_at);
ALTER TABLE public.notification_clicks ENABLE ROW LEVEL SECURITY;
-- sem policy: só service_role

-- ── RPC: quem recebe o daily HOJE ────────────────────────────
-- A: acesso ao futebol vigente (assinante OU trial de 7d ainda rodando).
-- B: Telegram linkado + inativo no Betinho (sem aposta há 14+ dias) + ainda
--    dentro da regra dos 2 envios sem clique. A e B são disjuntos (B exclui A).
CREATE OR REPLACE FUNCTION public.get_opportunity_recipients()
RETURNS TABLE(user_id uuid, chat_id text, user_name text, segment text, sends_without_click integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT u.id, u.telegram_chat_id, u.name,
           (coalesce(u.futebol_subscription_status,'free') = 'premium'
             OR (u.futebol_trial_started_at IS NOT NULL
                 AND u.futebol_trial_started_at + interval '7 days' > now())) AS futebol_ativo,
           (SELECT max(b.bet_date) FROM bets b WHERE b.user_id = u.id) AS ultima_aposta
    FROM users u
    WHERE u.telegram_chat_id IS NOT NULL
      AND coalesce(u.settlement_reminders_muted, false) = false
  )
  SELECT b.id, b.telegram_chat_id::text, b.name::text,
         CASE WHEN b.futebol_ativo THEN 'A' ELSE 'B' END AS segment,
         coalesce(s.sends_without_click, 0)
  FROM base b
  LEFT JOIN opportunity_dispatch_state s ON s.user_id = b.id
  WHERE b.futebol_ativo
     OR (
       -- reativação: inativo há 14+ dias (ou nunca apostou) e regra dos 2 envios
       (b.ultima_aposta IS NULL OR b.ultima_aposta < now() - interval '14 days')
       AND coalesce(s.sends_without_click, 0) < 2
     );
$function$;

GRANT EXECUTE ON FUNCTION public.get_opportunity_recipients() TO service_role;

-- ── Cron: diário às 13:00 UTC (10h BRT — logo após o dbt da madrugada) ──
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-opportunities') THEN
    PERFORM cron.unschedule('notify-opportunities');
  END IF;
END $$;

SELECT cron.schedule('notify-opportunities', '0 13 * * *', $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_opportunities_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_opportunities_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
