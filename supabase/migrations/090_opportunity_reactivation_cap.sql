-- ============================================================
-- 090_opportunity_reactivation_cap — afrouxa o teto da reativação (2 → 5)
-- ============================================================
-- O daily de oportunidades (08′) tem 2 públicos (ver 081):
--   A · futebol ativo   — recebe SEMPRE, sem teto.
--   B · reativação      — Telegram linkado + inativo. Tinha teto de 2 envios
--                         sem clique; 2 era agressivo demais e cortava gente
--                         que ainda podia reengajar (ex.: sócios/base fria).
-- Decisão de produto (2026-07-22): sobe pra 5 envios sem clique antes de parar.
-- Só muda o número da regra do B — o A segue sem teto.
-- ============================================================

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
       -- reativação: inativo há 14+ dias (ou nunca apostou) e regra dos 5 envios
       (b.ultima_aposta IS NULL OR b.ultima_aposta < now() - interval '14 days')
       AND coalesce(s.sends_without_click, 0) < 5
     );
$function$;

GRANT EXECUTE ON FUNCTION public.get_opportunity_recipients() TO service_role;
