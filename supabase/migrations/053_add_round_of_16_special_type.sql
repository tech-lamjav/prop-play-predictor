-- ============================================================
-- Adiciona a fase de OITAVAS (round_of_16) aos palpites especiais
-- ============================================================
-- A Copa 2026 (48 seleções) tem 5 fases de mata-mata: 16 avos (round_of_32, 32),
-- OITAVAS (round_of_16, 16), quartas (8), semis (4), final (2). A tiering dos
-- palpites especiais pulava de round_of_32 direto pra quarterfinalist — faltava
-- o tier de oitavas. Esta migration libera 'round_of_16' como tipo de palpite
-- de seleção nos dois CHECK constraints.
-- ============================================================

ALTER TABLE public.bolao_special_predictions
  DROP CONSTRAINT IF EXISTS bolao_special_predictions_prediction_type_check;
ALTER TABLE public.bolao_special_predictions
  ADD CONSTRAINT bolao_special_predictions_prediction_type_check
  CHECK (prediction_type = ANY (ARRAY[
    'champion','finalist','semifinalist','quarterfinalist','round_of_16','round_of_32',
    'top_scorer','best_goalkeeper','best_young_player','best_player'
  ]));

ALTER TABLE public.bolao_special_predictions
  DROP CONSTRAINT IF EXISTS bolao_special_predictions_target_check;
ALTER TABLE public.bolao_special_predictions
  ADD CONSTRAINT bolao_special_predictions_target_check CHECK (
    (prediction_type = ANY (ARRAY['top_scorer','best_goalkeeper','best_young_player','best_player'])
       AND predicted_player_id IS NOT NULL AND predicted_team_code IS NULL)
    OR
    (prediction_type = ANY (ARRAY['champion','finalist','semifinalist','quarterfinalist','round_of_16','round_of_32'])
       AND predicted_team_code IS NOT NULL AND predicted_player_id IS NULL)
  );

-- ─── toggle_special_prediction: aceita round_of_16 + conserta max ───
-- Bug pré-existente: round_of_32 estava capado em 16 picks (deveria ser 32).
-- Agora: finalist 2, semifinalist 4, quarterfinalist 8, round_of_16 16, round_of_32 32.
CREATE OR REPLACE FUNCTION public.toggle_special_prediction(
  p_bolao_id uuid, p_prediction_type text, p_team_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_max_picks int;
  v_current_count int;
  v_exists boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_prediction_type NOT IN ('finalist', 'semifinalist', 'quarterfinalist', 'round_of_16', 'round_of_32') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid prediction type');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Not a member');
  END IF;

  v_max_picks := CASE p_prediction_type
    WHEN 'finalist'        THEN 2
    WHEN 'semifinalist'    THEN 4
    WHEN 'quarterfinalist' THEN 8
    WHEN 'round_of_16'     THEN 16
    WHEN 'round_of_32'     THEN 32
    ELSE 4
  END;

  SELECT EXISTS(
    SELECT 1 FROM bolao_special_predictions
    WHERE bolao_id = p_bolao_id AND user_id = v_user_id
      AND prediction_type = p_prediction_type AND predicted_team_code = p_team_code
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM bolao_special_predictions
      WHERE bolao_id = p_bolao_id AND user_id = v_user_id
        AND prediction_type = p_prediction_type AND predicted_team_code = p_team_code;
    RETURN json_build_object('success', true, 'action', 'removed');
  ELSE
    SELECT COUNT(*) INTO v_current_count
    FROM bolao_special_predictions
    WHERE bolao_id = p_bolao_id AND user_id = v_user_id AND prediction_type = p_prediction_type;

    IF v_current_count >= v_max_picks THEN
      RETURN json_build_object('success', false, 'error', 'Max picks reached', 'max', v_max_picks);
    END IF;

    INSERT INTO bolao_special_predictions (bolao_id, user_id, prediction_type, predicted_team_code)
      VALUES (p_bolao_id, v_user_id, p_prediction_type, p_team_code);
    RETURN json_build_object('success', true, 'action', 'added', 'count', v_current_count + 1);
  END IF;
END;
$function$;
