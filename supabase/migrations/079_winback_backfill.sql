-- ============================================================
-- 079_winback_backfill — reconquista de quem sumiu (R1 do roadmap)
-- ============================================================
-- Suporte à edge function winback-backfill (one-shot MANUAL, sem cron):
-- fecha o histórico antigo de apostas pendentes com dado verificável
-- (nba_mart pra props NBA, API-Sports histórico pra futebol) e manda UMA
-- DM de reconquista: "atualizamos seu histórico — seu ROI real está pronto".
--
-- Aqui: tabela de idempotência do aviso + RPCs de leitura do nba_mart
-- (o schema é trancado pra acesso direto desde a 056 — padrão é RPC) +
-- RPC que monta os alvos do notify com ROI real calculado.
--
-- SEM cron de propósito: a execução é decisão humana (report → execute →
-- notify), ver runbook WINBACK_BACKFILL_SETUP.md.
-- ============================================================

-- ── Idempotência do aviso: 1 DM por usuário, nunca 2 ─────────
CREATE TABLE IF NOT EXISTS public.winback_notifications (
  user_id      uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  bets_settled integer NOT NULL DEFAULT 0,
  roi          numeric
);
COMMENT ON TABLE public.winback_notifications IS
  'Idempotência do aviso de reconquista (winback-backfill mode=notify): quem já recebeu não recebe de novo.';
ALTER TABLE public.winback_notifications ENABLE ROW LEVEL SECURITY;
-- sem policy: só service_role acessa (RLS bloqueia anon/authenticated)

-- ── RPC: busca jogador no mart por pedaço do nome ────────────
CREATE OR REPLACE FUNCTION public.winback_find_nba_player(p_name_part text)
RETURNS TABLE(player_id bigint, player_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT DISTINCT p.player_id, p.player_name
  FROM nba_mart.dim_players p
  WHERE p.player_name ILIKE '%' || p_name_part || '%'
  LIMIT 25;
$function$;

-- ── RPC: stat realizada do jogador numa janela de datas ──────
CREATE OR REPLACE FUNCTION public.winback_nba_stat_window(
  p_player_id bigint, p_stat_type text, p_from date, p_to date
)
RETURNS TABLE(game_date date, stat_value double precision, is_played text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT s.game_date, s.stat_value, s.is_played
  FROM nba_mart.ft_game_player_stats s
  WHERE s.player_id = p_player_id
    AND s.stat_type = p_stat_type
    AND s.game_date BETWEEN p_from AND p_to
  ORDER BY s.game_date;
$function$;

-- ── RPC: alvos do notify, com ROI real calculado ─────────────
-- Usuário entra se: tem aposta fechada pelo winback (evidência em
-- processed_data.winback), tem Telegram, não silenciou lembretes e ainda
-- não recebeu o aviso. Devolve tudo que a DM precisa.
CREATE OR REPLACE FUNCTION public.get_winback_notify_targets()
RETURNS TABLE(
  user_id uuid, chat_id text, user_name text,
  settled bigint, greens bigint,
  profit numeric, roi numeric, leftovers bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH winback_settled AS (
    SELECT b.user_id,
           count(*) AS settled,
           count(*) FILTER (WHERE b.status = 'won') AS greens
    FROM bets b
    WHERE b.processed_data ? 'winback'
      AND b.status IN ('won','lost')
    GROUP BY b.user_id
  ),
  historico AS (  -- ROI real: TODAS as apostas resolvidas do usuário
    SELECT b.user_id,
           sum(b.stake_amount) AS staked,
           sum(CASE
             WHEN b.status = 'won'       THEN b.potential_return
             WHEN b.status = 'cashout'   THEN coalesce(b.cashout_amount, 0)
             WHEN b.status = 'half_won'  THEN (b.stake_amount + b.potential_return) / 2
             WHEN b.status = 'half_lost' THEN b.stake_amount / 2
             ELSE 0
           END) AS returns
    FROM bets b
    WHERE b.status IN ('won','lost','cashout','half_won','half_lost')
    GROUP BY b.user_id
  ),
  sobras AS (  -- pendências antigas que o motor não conseguiu fechar
    SELECT b.user_id, count(*) AS leftovers
    FROM bets b
    WHERE b.status = 'pending' AND b.bet_date < now() - interval '7 days'
    GROUP BY b.user_id
  )
  SELECT u.id, u.telegram_chat_id::text, u.name::text,
         w.settled, w.greens,
         round(coalesce(h.returns, 0) - coalesce(h.staked, 0), 2) AS profit,
         round(CASE WHEN coalesce(h.staked, 0) > 0
           THEN (coalesce(h.returns, 0) - h.staked) / h.staked * 100 ELSE 0 END, 1) AS roi,
         coalesce(s.leftovers, 0) AS leftovers
  FROM winback_settled w
  JOIN users u ON u.id = w.user_id
    AND u.telegram_chat_id IS NOT NULL
    AND coalesce(u.settlement_reminders_muted, false) = false
  LEFT JOIN historico h ON h.user_id = w.user_id
  LEFT JOIN sobras s ON s.user_id = w.user_id
  WHERE NOT EXISTS (SELECT 1 FROM winback_notifications n WHERE n.user_id = w.user_id);
$function$;

GRANT EXECUTE ON FUNCTION public.winback_find_nba_player(text)                        TO service_role;
GRANT EXECUTE ON FUNCTION public.winback_nba_stat_window(bigint, text, date, date)    TO service_role;
GRANT EXECUTE ON FUNCTION public.get_winback_notify_targets()                         TO service_role;
