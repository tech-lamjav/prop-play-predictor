-- ============================================================
-- WAVE 4: Weighted Stages Preset, Round-of-32 Special Pred,
--         Storage bucket para logos
-- Applied to staging: 2026-04-15
-- ============================================================

-- 1. update calculate_bolao_scores to apply stage multipliers
CREATE OR REPLACE FUNCTION calculate_bolao_scores(p_match_id integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_home_score int;
  v_away_score int;
  v_is_finished boolean;
  v_match_result text;
  v_match_stage text;
  v_updated_count int := 0;
  rec RECORD;
BEGIN
  SELECT home_score, away_score, is_finished, stage
    INTO v_home_score, v_away_score, v_is_finished, v_match_stage
  FROM wc_matches WHERE id = p_match_id;

  IF NOT v_is_finished OR v_home_score IS NULL OR v_away_score IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Jogo não finalizado ou sem placar');
  END IF;

  IF v_home_score > v_away_score THEN v_match_result := 'home';
  ELSIF v_away_score > v_home_score THEN v_match_result := 'away';
  ELSE v_match_result := 'draw';
  END IF;

  FOR rec IN
    SELECT bp.id, bp.predicted_home_score, bp.predicted_away_score,
           b.scoring_exact, b.scoring_result, b.scoring_preset
    FROM bolao_predictions bp
    JOIN boloes b ON b.id = bp.bolao_id
    WHERE bp.match_id = p_match_id
  LOOP
    DECLARE
      v_pred_result text;
      v_points int := 0;
      v_multiplier numeric := 1.0;
    BEGIN
      IF rec.scoring_preset = 'weighted_stages' THEN
        v_multiplier := CASE v_match_stage
          WHEN 'group'       THEN 1.0
          WHEN 'round_of_32' THEN 1.5
          WHEN 'round_of_16' THEN 1.5
          WHEN 'quarter'     THEN 2.0
          WHEN 'semi'        THEN 3.0
          WHEN 'third_place' THEN 2.0
          WHEN 'final'       THEN 5.0
          ELSE 1.0
        END;
      END IF;

      IF rec.predicted_home_score > rec.predicted_away_score THEN v_pred_result := 'home';
      ELSIF rec.predicted_away_score > rec.predicted_home_score THEN v_pred_result := 'away';
      ELSE v_pred_result := 'draw';
      END IF;

      IF rec.predicted_home_score = v_home_score AND rec.predicted_away_score = v_away_score THEN
        v_points := ROUND(rec.scoring_exact * v_multiplier);
      ELSIF v_pred_result = v_match_result THEN
        v_points := ROUND(rec.scoring_result * v_multiplier);
      END IF;

      UPDATE bolao_predictions
        SET points_earned = v_points, updated_at = now()
      WHERE id = rec.id;

      v_updated_count := v_updated_count + 1;
    END;
  END LOOP;

  RETURN json_build_object('success', true, 'updated', v_updated_count);
END;
$$;

-- 2. update update_bolao_scoring to accept weighted_stages
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

  IF p_preset = 'standard' THEN
    v_r := 1; v_e := 3;
  ELSIF p_preset = 'classic' THEN
    v_r := 1; v_e := 5;
  ELSIF p_preset = 'weighted_stages' THEN
    v_r := 1; v_e := 3; -- base; multiplied per stage on calculation
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

-- 3. update toggle_special_prediction to accept round_of_32
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
  IF p_prediction_type NOT IN ('finalist', 'semifinalist', 'quarterfinalist', 'round_of_32') THEN
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
$$;

-- 4. Storage bucket para logos de bolão
INSERT INTO storage.buckets (id, name, public)
  VALUES ('bolao-logos', 'bolao-logos', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read bolao-logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bolao-logos');

CREATE POLICY "Authenticated upload bolao-logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bolao-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated update bolao-logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'bolao-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated delete bolao-logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'bolao-logos' AND auth.uid() IS NOT NULL);
