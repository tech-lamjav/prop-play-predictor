-- ============================================================
-- B2 — Idempotência do webhook Stripe via UNIQUE(stripe_session_id)
-- ============================================================
-- Bug do PR #140 review: bolao_subscriptions sem UNIQUE em stripe_session_id.
-- Stripe retenta eventos quando o webhook responde com 5xx/timeout —
-- sem UNIQUE, duas entregas da mesma session geram duas rows = inconsistência
-- contábil + double-charge ghost.
--
-- Fix: PARTIAL UNIQUE INDEX em stripe_session_id WHERE NOT NULL.
-- Permite múltiplas rows com NULL (legacy / não-Stripe) mas garante 1:1
-- pra sessões reais do Stripe.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'bolao_subscriptions_stripe_session_id_unique'
  ) THEN
    CREATE UNIQUE INDEX bolao_subscriptions_stripe_session_id_unique
      ON public.bolao_subscriptions (stripe_session_id)
      WHERE stripe_session_id IS NOT NULL;
  END IF;
END
$$;
