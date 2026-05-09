-- ============================================================
-- WAVE 2: Special Predictions (multi-pick) + Scoring Presets
-- Applied to staging: 2026-04-15
-- ============================================================

-- 1. Fix UNIQUE constraint to allow multi-pick per type
ALTER TABLE bolao_special_predictions
  DROP CONSTRAINT bolao_special_predictions_bolao_id_user_id_prediction_type_key;

ALTER TABLE bolao_special_predictions
  ADD CONSTRAINT bolao_special_predictions_unique
  UNIQUE (bolao_id, user_id, prediction_type, predicted_team_code);

-- 2. Update upsert_champion_prediction for new constraint (DELETE+INSERT)
CREATE OR REPLACE FUNCTION upsert_champion_prediction(
  p_bolao_id uuid,
  p_team_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Not a member');
  END IF;
  DELETE FROM bolao_special_predictions
    WHERE bolao_id = p_bolao_id AND user_id = v_user_id AND prediction_type = 'champion';
  INSERT INTO bolao_special_predictions (bolao_id, user_id, prediction_type, predicted_team_code)
    VALUES (p_bolao_id, v_user_id, 'champion', p_team_code);
  RETURN json_build_object('success', true);
END;
$$;

-- 3. toggle_special_prediction — finalist/semifinalist/quarterfinalist (premium)
CREATE OR REPLACE FUNCTION toggle_special_prediction(
  p_bolao_id uuid,
  p_prediction_type text,
  p_team_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_is_premium boolean;
  v_max_picks int;
  v_current_count int;
  v_exists boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_prediction_type NOT IN ('finalist', 'semifinalist', 'quarterfinalist') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid prediction type');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Not a member');
  END IF;
  SELECT is_premium INTO v_is_premium FROM boloes WHERE id = p_bolao_id;
  IF NOT COALESCE(v_is_premium, false) THEN
    RETURN json_build_object('success', false, 'error', 'Premium required');
  END IF;
  v_max_picks := CASE p_prediction_type
    WHEN 'finalist'        THEN 2
    WHEN 'semifinalist'    THEN 4
    WHEN 'quarterfinalist' THEN 8
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
$$;

-- 4. get_my_special_predictions
CREATE OR REPLACE FUNCTION get_my_special_predictions(p_bolao_id uuid)
RETURNS TABLE (
  prediction_type text,
  predicted_team_code text,
  points_earned int
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT prediction_type, predicted_team_code, points_earned
  FROM bolao_special_predictions
  WHERE bolao_id = p_bolao_id AND user_id = auth.uid()
  ORDER BY prediction_type, predicted_team_code;
$$;

-- 5. get_bolao_special_summary
CREATE OR REPLACE FUNCTION get_bolao_special_summary(p_bolao_id uuid)
RETURNS TABLE (
  prediction_type text,
  predicted_team_code text,
  pick_count bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT prediction_type, predicted_team_code, COUNT(*) AS pick_count
  FROM bolao_special_predictions
  WHERE bolao_id = p_bolao_id
    AND EXISTS (
      SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = auth.uid()
    )
  GROUP BY prediction_type, predicted_team_code
  ORDER BY prediction_type, pick_count DESC, predicted_team_code;
$$;

-- 6. update_bolao_scoring
CREATE OR REPLACE FUNCTION update_bolao_scoring(
  p_bolao_id uuid,
  p_preset text,
  p_scoring_result int DEFAULT NULL,
  p_scoring_exact int DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_r int; v_e int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM boloes WHERE id = p_bolao_id AND owner_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not the owner');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM boloes WHERE id = p_bolao_id AND is_premium = true) THEN
    RETURN json_build_object('success', false, 'error', 'Premium required');
  END IF;
  IF p_preset = 'standard' THEN v_r := 1; v_e := 3;
  ELSIF p_preset = 'classic'  THEN v_r := 1; v_e := 5;
  ELSIF p_preset = 'custom' THEN
    IF p_scoring_result IS NULL OR p_scoring_exact IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Custom preset requires scoring values');
    END IF;
    IF p_scoring_result < 1 OR p_scoring_result > 5 THEN
      RETURN json_build_object('success', false, 'error', 'scoring_result must be 1-5');
    END IF;
    IF p_scoring_exact < 3 OR p_scoring_exact > 10 THEN
      RETURN json_build_object('success', false, 'error', 'scoring_exact must be 3-10');
    END IF;
    v_r := p_scoring_result; v_e := p_scoring_exact;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Invalid preset');
  END IF;
  UPDATE boloes SET scoring_preset = p_preset, scoring_result = v_r, scoring_exact = v_e
    WHERE id = p_bolao_id;
  RETURN json_build_object('success', true, 'scoring_result', v_r, 'scoring_exact', v_e);
END;
$$;
