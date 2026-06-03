-- ============================================================
-- M3 — Schema dos palpites de JOGADOR (artilheiro/goleiro/revelação/craque)
-- ============================================================
-- Reusa bolao_special_predictions (em vez de tabela nova) pra aproveitar
-- get_my_special_predictions/summary/scoring. Diferenças do palpite de jogador:
--   - alvo é predicted_player_id (não predicted_team_code)
--   - pick ÚNICO por tipo (1 jogador), via índice parcial
-- + tabela global wc_player_awards (verdade dos vencedores) e config no boloes.
-- RPCs (set_player_prediction, resolve_player_awards, get_my_special_predictions
-- com player_id) ficam na migration seguinte (051).
-- ============================================================

-- ─── 1) bolao_special_predictions: aceita tipos de jogador ───
ALTER TABLE public.bolao_special_predictions
  DROP CONSTRAINT IF EXISTS bolao_special_predictions_prediction_type_check;
ALTER TABLE public.bolao_special_predictions
  ADD CONSTRAINT bolao_special_predictions_prediction_type_check
  CHECK (prediction_type = ANY (ARRAY[
    'champion','finalist','semifinalist','quarterfinalist','round_of_32',
    'top_scorer','best_goalkeeper','best_young_player','best_player'
  ]));

-- alvo jogador + team_code passa a ser opcional
ALTER TABLE public.bolao_special_predictions
  ADD COLUMN IF NOT EXISTS predicted_player_id bigint REFERENCES public.wc_players(player_id);
ALTER TABLE public.bolao_special_predictions
  ALTER COLUMN predicted_team_code DROP NOT NULL;

-- coerência: tipo de jogador → player_id (sem team_code); tipo de time → team_code (sem player_id)
ALTER TABLE public.bolao_special_predictions
  DROP CONSTRAINT IF EXISTS bolao_special_predictions_target_check;
ALTER TABLE public.bolao_special_predictions
  ADD CONSTRAINT bolao_special_predictions_target_check CHECK (
    (prediction_type = ANY (ARRAY['top_scorer','best_goalkeeper','best_young_player','best_player'])
       AND predicted_player_id IS NOT NULL AND predicted_team_code IS NULL)
    OR
    (prediction_type = ANY (ARRAY['champion','finalist','semifinalist','quarterfinalist','round_of_32'])
       AND predicted_team_code IS NOT NULL AND predicted_player_id IS NULL)
  );

-- pick ÚNICO por prêmio de jogador (a UNIQUE antiga inclui team_code=NULL e não restringe)
CREATE UNIQUE INDEX IF NOT EXISTS bolao_special_predictions_player_unique
  ON public.bolao_special_predictions (bolao_id, user_id, prediction_type)
  WHERE prediction_type = ANY (ARRAY['top_scorer','best_goalkeeper','best_young_player','best_player']);

-- ─── 2) wc_player_awards: verdade global dos vencedores ──────
CREATE TABLE IF NOT EXISTS public.wc_player_awards (
  award_type       text PRIMARY KEY
                     CHECK (award_type = ANY (ARRAY['top_scorer','best_goalkeeper','best_young_player','best_player'])),
  winner_player_id bigint REFERENCES public.wc_players(player_id),
  resolved_at      timestamptz,
  resolved_by      uuid REFERENCES auth.users(id)
);
ALTER TABLE public.wc_player_awards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wc_player_awards_public_read" ON public.wc_player_awards;
CREATE POLICY "wc_player_awards_public_read" ON public.wc_player_awards
  FOR SELECT USING (true);
-- Escrita: só service_role (resolução central). Sem policy de write p/ anon/auth.

-- ─── 3) boloes: liga/desliga + pesos dos prêmios de jogador ──
ALTER TABLE public.boloes
  ADD COLUMN IF NOT EXISTS player_awards_enabled jsonb NOT NULL
    DEFAULT '{"top_scorer":true,"best_goalkeeper":true,"best_young_player":true,"best_player":true}'::jsonb;
ALTER TABLE public.boloes
  ADD COLUMN IF NOT EXISTS player_award_points jsonb NOT NULL
    DEFAULT '{"top_scorer":10,"best_goalkeeper":8,"best_young_player":8,"best_player":10}'::jsonb;
