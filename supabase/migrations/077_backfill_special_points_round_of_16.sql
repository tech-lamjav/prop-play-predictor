-- ============================================================
-- 077_backfill_special_points_round_of_16 — pontos das Oitavas
-- ============================================================
-- Mesmo esquecimento da 065, só que nos PONTOS: o default de
-- special_predictions_points (037) não tem a chave round_of_16
-- ({finalist:10, round_of_32:1, semifinalist:5, quarterfinalist:3}).
-- A 065 backfillou a CONFIG (fase habilitada) mas não os pontos.
--
-- Efeito do bug: o resolve_special_scores lê COALESCE(pts->>'round_of_16', 0)
-- → quem acertou classificado pras oitavas ganhou 0 ponto nos bolões cujo
-- dono nunca ajustou os pontos. O front sempre PROMETEU 2 pts por acerto
-- (fallback `pointsConfig.round_of_16 ?? 2` no SpecialPredictionsModal /
-- SpecialPredictionsSection) — o backfill usa o mesmo 2.
--
-- Preserva quem configurou explicitamente (só adiciona onde a chave falta).
-- Após aplicar, rodar: SELECT resolve_all_special_scores();  (recalculável)
-- ============================================================

-- 1) Bolões existentes: adiciona round_of_16=2 só onde a chave está ausente.
UPDATE public.boloes
SET special_predictions_points =
      jsonb_build_object('round_of_16', 2) || special_predictions_points
WHERE NOT (special_predictions_points ? 'round_of_16');

-- 2) Default da coluna para bolões novos (inclui round_of_16).
ALTER TABLE public.boloes
  ALTER COLUMN special_predictions_points SET DEFAULT
    '{"finalist": 10, "round_of_16": 2, "round_of_32": 1, "semifinalist": 5, "quarterfinalist": 3}'::jsonb;

-- 3) Recredita o "quem avança" com os pontos corretos (idempotente).
SELECT public.resolve_all_special_scores();
