-- ============================================================
-- 078_settlement_reminders — lembrete de liquidação no Telegram
-- ============================================================
-- Ataca o buraco da retenção: ~72% das apostas morrem em 'pending' porque
-- liquidar exige entrar no site. Agora o Betinho manda DM quando o jogo acaba,
-- com botões inline [✅ Green] [❌ Red] — 1 toque e a banca atualiza.
--
-- Duas classes de lembrete (decididas na edge function notify-settlement):
--   • Copa (casada com wc_matches encerrado): chega COM o placar e, quando o
--     mercado é computável (ML/over-under/ambas marcam), com o veredito
--     sugerido — "pelo placar, essa bateu ✅".
--   • Genérica (qualquer esporte/liga sem placar no banco): jogo já passou →
--     pergunta com os mesmos botões, sem veredito.
--
-- Também adiciona o placar dos 90' em wc_matches (fulltime_*): mercados de
-- aposta liquidam no tempo normal; home/away_score inclui prorrogação e
-- liquidaria errado jogo de mata-mata que foi pro tempo extra.
--
-- PRÉ-REQUISITO POR AMBIENTE (rodar uma vez via SQL, igual ao 048/073):
--   vault.create_secret('<x-cron-secret>', 'notify_settlement_cron_secret', ...);
--   vault.create_secret('<url da função>', 'notify_settlement_url', ...);
--   E os secrets da função (TELEGRAM_BOT_TOKEN, CRON_SECRET) no painel.
-- Além disso: o setWebhook do bot precisa entregar callback_query (se
-- allowed_updates foi restringido a ["message"], reconfigurar — ver runbook).
-- ============================================================

-- ── wc_matches: placar dos 90 minutos (base de liquidação) ──
ALTER TABLE public.wc_matches
  ADD COLUMN IF NOT EXISTS fulltime_home integer,
  ADD COLUMN IF NOT EXISTS fulltime_away integer;
COMMENT ON COLUMN public.wc_matches.fulltime_home IS
  'Gols do mandante nos 90 min (score.fulltime da API). Base de liquidação de apostas; home_score inclui prorrogação.';
COMMENT ON COLUMN public.wc_matches.fulltime_away IS
  'Gols do visitante nos 90 min (score.fulltime da API). Base de liquidação de apostas; away_score inclui prorrogação.';

-- ── bets: cadência/idempotência do lembrete ──────────────────
ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS settlement_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_reminder_at timestamptz;
COMMENT ON COLUMN public.bets.settlement_reminder_count IS
  'Quantos lembretes de liquidação já enviamos (teto 2 — não vira spam).';
COMMENT ON COLUMN public.bets.settlement_reminder_at IS
  'Último lembrete enviado (gap mínimo de 20h entre lembretes da mesma aposta).';

-- Consulta do cron: pendentes recentes com lembrete disponível.
CREATE INDEX IF NOT EXISTS idx_bets_settlement_pending
  ON public.bets (bet_date)
  WHERE status = 'pending' AND settlement_reminder_count < 2;

-- ── users: opt-out (botão 🔕 na própria mensagem) ────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS settlement_reminders_muted boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.users.settlement_reminders_muted IS
  'true = usuário pediu pra parar os lembretes de liquidação (🔕 no bot). /lembretes reativa.';

-- ── RPC: candidatas a lembrete AGORA ─────────────────────────
-- Filtro grosso no banco (pendente, usuário linkado e não mutado, lembretes
-- restantes, gap respeitado, aposta recente). O refinamento — casar com
-- wc_matches encerrado, janela de silêncio, teto por usuário — fica na função,
-- que loga e instrumenta cada decisão.
CREATE OR REPLACE FUNCTION public.get_settlement_reminder_candidates()
RETURNS TABLE(
  bet_id uuid, user_id uuid, chat_id text, user_name text,
  bet_type text, sport text, league text, betting_market text,
  match_description text, bet_description text,
  odds numeric, stake_amount numeric, potential_return numeric,
  bet_date timestamptz, match_date timestamptz,
  reminder_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  -- casts: colunas varchar(n) da tabela ≠ text do RETURNS TABLE sem cast explícito
  SELECT b.id, b.user_id, u.telegram_chat_id::text, u.name::text,
         b.bet_type::text, b.sport::text, b.league::text, b.betting_market::text,
         b.match_description::text, b.bet_description::text,
         b.odds::numeric, b.stake_amount::numeric, b.potential_return::numeric,
         b.bet_date, b.match_date,
         b.settlement_reminder_count
  FROM bets b
  JOIN users u ON u.id = b.user_id
    AND u.telegram_chat_id IS NOT NULL
    AND u.settlement_reminders_muted = false
  WHERE b.status = 'pending'
    AND b.settlement_reminder_count < 2
    AND (b.settlement_reminder_at IS NULL OR b.settlement_reminder_at < now() - interval '20 hours')
    AND b.bet_date > now() - interval '14 days'
  ORDER BY b.bet_date DESC
  LIMIT 500;
$function$;

GRANT EXECUTE ON FUNCTION public.get_settlement_reminder_candidates() TO service_role;

-- ── Cron: a cada 15 min (o "logo após o apito" é o momento mágico) ──
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-settlement') THEN
    PERFORM cron.unschedule('notify-settlement');
  END IF;
END $$;

SELECT cron.schedule('notify-settlement', '*/15 * * * *', $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_settlement_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_settlement_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$job$);
