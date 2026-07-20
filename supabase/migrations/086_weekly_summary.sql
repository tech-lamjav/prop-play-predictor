-- ============================================================
-- 086_weekly_summary — Resumo semanal de desempenho (item 04, Marco 2)
-- ============================================================
-- DM no Telegram (Betinho) 1x/semana com o desempenho dos ÚLTIMOS 7 DIAS
-- (rolling, não semana-calendário — decisão de produto 2026-07-15). Recompensa
-- recorrente que vira hábito. Entregue por edge function `notify-weekly-summary`.
--
-- NÃO confundir com o legado WhatsApp (010 weekly_performance / 015
-- performance_semanal): aquele é semana-calendário, por esporte, canal morto e
-- lucro incompleto (ignora half/void). Esta RPC é sob medida:
--   • janela rolling 7d por bet_date, só apostas LIQUIDADAS
--   • lucro pelo mesmo profitForBet do app (inclui cashout/half_won/half_lost/void)
--   • melhor mercado por lucro (não por esporte)
--   • unidade efetiva (R$) igual ao effectiveUnit do telegram-webhook (item 15)
--   • elegível: >= 2 apostas liquidadas na janela
--
-- Segredos do cron (Vault, criar 1x por ambiente — o CI NÃO cria):
--   vault.create_secret('<url da função>', 'notify_weekly_summary_url', ...);
--   vault.create_secret('<x-cron-secret>', 'notify_weekly_summary_cron_secret', ...);
-- ============================================================

-- ── Opt-out + idempotência (por usuário) ─────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS weekly_summary_muted   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_summary_sent_at timestamptz;

COMMENT ON COLUMN public.users.weekly_summary_muted IS
  'Opt-out do resumo semanal (item 04). Independente do settlement_reminders_muted.';
COMMENT ON COLUMN public.users.weekly_summary_sent_at IS
  'Último envio do resumo semanal — idempotência (não reenviar dentro de ~6 dias).';

-- ── Candidatos do resumo semanal ─────────────────────────────
-- Devolve, por usuário elegível, os agregados prontos pra edge só formatar/enviar.
-- Espelha get_settlement_reminder_candidates. Lucro = profitForBet (app).
CREATE OR REPLACE FUNCTION public.get_weekly_recap_candidates()
RETURNS TABLE(
  user_id uuid,
  chat_id text,
  user_name text,
  n_settled integer,
  total_stake numeric,
  total_profit numeric,
  unit_value_rs numeric,
  best_market text,
  best_market_profit numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH settled AS (
    SELECT
      b.user_id,
      b.stake_amount::numeric AS stake,
      COALESCE(NULLIF(b.betting_market, ''), 'Outros')::text AS market,
      -- profitForBet (src/utils/dashboardAggregations.ts) — fonte de verdade do app
      CASE b.status
        WHEN 'won'       THEN b.potential_return - b.stake_amount
        WHEN 'lost'      THEN -b.stake_amount
        WHEN 'cashout'   THEN (CASE WHEN b.cashout_amount IS NOT NULL THEN b.cashout_amount - b.stake_amount ELSE 0 END)
        WHEN 'half_won'  THEN (b.stake_amount + b.potential_return) / 2.0 - b.stake_amount
        WHEN 'half_lost' THEN b.stake_amount / 2.0 - b.stake_amount
        ELSE 0  -- void
      END::numeric AS profit
    FROM public.bets b
    WHERE b.status IN ('won','lost','cashout','half_won','half_lost','void')
      AND b.bet_date > now() - interval '7 days'
  ),
  agg AS (
    SELECT s.user_id, count(*)::int AS n, sum(s.stake) AS stake, sum(s.profit) AS profit
    FROM settled s GROUP BY s.user_id
  ),
  bymkt AS (
    SELECT s.user_id, s.market,
           sum(s.profit) AS p,
           row_number() OVER (PARTITION BY s.user_id ORDER BY sum(s.profit) DESC, count(*) DESC) AS rn
    FROM settled s GROUP BY s.user_id, s.market
  )
  SELECT
    a.user_id,
    u.telegram_chat_id::text,
    u.name::text,
    a.n,
    a.stake,
    a.profit,
    -- effectiveUnit (telegram-webhook): direct = unit_value; percentual = banca * u/100
    (CASE
       WHEN COALESCE(u.unit_value, 0) <= 0 THEN NULL
       WHEN u.unit_calculation_method = 'percentual'
         THEN (CASE WHEN COALESCE(u.bank_amount, 0) <= 0 THEN NULL
                    ELSE round(u.bank_amount * (u.unit_value / 100.0), 2) END)
       ELSE u.unit_value
     END)::numeric AS unit_value_rs,
    m.market::text,
    m.p::numeric
  FROM agg a
  JOIN public.users u ON u.id = a.user_id
    AND u.telegram_chat_id IS NOT NULL
    AND COALESCE(u.weekly_summary_muted, false) = false
    AND (u.weekly_summary_sent_at IS NULL OR u.weekly_summary_sent_at < now() - interval '6 days')
  LEFT JOIN bymkt m ON m.user_id = a.user_id AND m.rn = 1
  WHERE a.n >= 2;
$function$;

-- ── Cron: segunda 10h BRT (13:00 UTC) ────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-weekly-summary') THEN
    PERFORM cron.unschedule('notify-weekly-summary');
  END IF;
END $$;

SELECT cron.schedule('notify-weekly-summary', '0 13 * * 1', $job$
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
