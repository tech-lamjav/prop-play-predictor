-- ============================================================
-- 080_handoff_final_notifications — DM de encerramento do bolão (H1)
-- ============================================================
-- Suporte à edge function notify-handoff (one-shot MANUAL, sem cron):
-- no dia da final (19/jul), cada membro de bolão com Telegram recebe UMA
-- DM com sua posição definitiva + as duas portas de continuação
-- (Betinho pro casual, análise de futebol pro frequente).
--
-- O rank vem de get_bolao_ranking() — a MESMA função que o site usa —
-- então a DM nunca diverge do ranking exibido.
-- ============================================================

-- ── Idempotência: 1 DM por usuário, nunca 2 ──────────────────
CREATE TABLE IF NOT EXISTS public.bolao_handoff_notifications (
  user_id      uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  boloes_count integer NOT NULL DEFAULT 0
);
COMMENT ON TABLE public.bolao_handoff_notifications IS
  'Idempotência da DM de encerramento do bolão (notify-handoff): quem já recebeu não recebe de novo.';
ALTER TABLE public.bolao_handoff_notifications ENABLE ROW LEVEL SECURITY;
-- sem policy: só service_role acessa

-- ── RPC: alvos da DM — 1 linha por (usuário, bolão) ──────────
-- A função agrupa por usuário; bolões ordenados do mais populoso pro menor.
CREATE OR REPLACE FUNCTION public.get_handoff_targets()
RETURNS TABLE(
  user_id uuid, chat_id text, user_name text,
  bolao_name text, user_rank bigint, total_players bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT u.id, u.telegram_chat_id::text, u.name::text,
         b.name::text, r.rank, cnt.total
  FROM users u
  JOIN bolao_members bm ON bm.user_id = u.id
  JOIN boloes b ON b.id = bm.bolao_id
  JOIN LATERAL (
    SELECT g.rank FROM get_bolao_ranking(b.id) g WHERE g.user_id = u.id
  ) r ON true
  JOIN LATERAL (
    SELECT count(*)::bigint AS total FROM bolao_members WHERE bolao_id = b.id
  ) cnt ON true
  WHERE u.telegram_chat_id IS NOT NULL
    AND coalesce(u.settlement_reminders_muted, false) = false
    AND NOT EXISTS (SELECT 1 FROM bolao_handoff_notifications n WHERE n.user_id = u.id)
  ORDER BY u.id, cnt.total DESC, b.name;
$function$;

GRANT EXECUTE ON FUNCTION public.get_handoff_targets() TO service_role;
