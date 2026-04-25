-- ============================================================
-- BOLÃO: Custom scoring weights per stage
-- Adds scoring_weights JSONB to boloes so owners can customize
-- the multiplier for each stage (not just the fixed preset).
-- ============================================================

-- 1. Add scoring_weights column (nullable = use defaults)
ALTER TABLE public.boloes
  ADD COLUMN IF NOT EXISTS scoring_weights jsonb;

COMMENT ON COLUMN public.boloes.scoring_weights IS
  'Optional per-stage multipliers when scoring_preset = weighted_stages. '
  'Shape: { "group": 1.0, "round_of_32": 1.5, "round_of_16": 1.5, '
  '"quarter": 2.0, "semi": 3.0, "third_place": 2.0, "final": 5.0 }. '
  'NULL = use defaults.';

-- 2. Update calculate_bolao_scores to read custom weights
CREATE OR REPLACE FUNCTION public.calculate_bolao_scores(p_match_id integer)
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
  FROM public.wc_matches WHERE id = p_match_id;

  IF NOT v_is_finished OR v_home_score IS NULL OR v_away_score IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Jogo não finalizado ou sem placar');
  END IF;

  IF v_home_score > v_away_score THEN v_match_result := 'home';
  ELSIF v_away_score > v_home_score THEN v_match_result := 'away';
  ELSE v_match_result := 'draw';
  END IF;

  FOR rec IN
    SELECT bp.id, bp.predicted_home_score, bp.predicted_away_score,
           b.scoring_exact, b.scoring_result, b.scoring_preset, b.scoring_weights
    FROM public.bolao_predictions bp
    JOIN public.boloes b ON b.id = bp.bolao_id
    WHERE bp.match_id = p_match_id
  LOOP
    DECLARE
      v_pred_result text;
      v_points int := 0;
      v_multiplier numeric := 1.0;
      v_default numeric;
    BEGIN
      IF rec.scoring_preset = 'weighted_stages' THEN
        v_default := CASE v_match_stage
          WHEN 'group'       THEN 1.0
          WHEN 'round_of_32' THEN 1.5
          WHEN 'round_of_16' THEN 1.5
          WHEN 'quarter'     THEN 2.0
          WHEN 'semi'        THEN 3.0
          WHEN 'third_place' THEN 2.0
          WHEN 'final'       THEN 5.0
          ELSE 1.0
        END;
        -- Read custom weight from scoring_weights jsonb; fallback to default
        v_multiplier := COALESCE(
          (rec.scoring_weights ->> v_match_stage)::numeric,
          v_default
        );
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

      UPDATE public.bolao_predictions
        SET points_earned = v_points, updated_at = now()
      WHERE id = rec.id;

      v_updated_count := v_updated_count + 1;
    END;
  END LOOP;

  RETURN json_build_object('success', true, 'updated', v_updated_count);
END;
$$;

-- 3. Update update_bolao_scoring to accept optional scoring_weights
DROP FUNCTION IF EXISTS public.update_bolao_scoring(uuid, text, int, int);

CREATE OR REPLACE FUNCTION public.update_bolao_scoring(
  p_bolao_id uuid,
  p_preset text,
  p_scoring_result int DEFAULT NULL,
  p_scoring_exact int DEFAULT NULL,
  p_scoring_weights jsonb DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_r int; v_e int;
  v_weights jsonb;
  v_allowed_stages text[] := ARRAY['group','round_of_32','round_of_16','quarter','semi','third_place','final'];
  v_key text;
  v_val numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.boloes WHERE id = p_bolao_id AND owner_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not the owner');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.boloes WHERE id = p_bolao_id AND is_premium = true) THEN
    RETURN json_build_object('success', false, 'error', 'Premium required');
  END IF;

  IF p_preset = 'standard' THEN
    v_r := 1; v_e := 3;
  ELSIF p_preset = 'classic' THEN
    v_r := 1; v_e := 5;
  ELSIF p_preset = 'weighted_stages' THEN
    v_r := COALESCE(p_scoring_result, 1);
    v_e := COALESCE(p_scoring_exact, 3);
  ELSIF p_preset = 'custom' THEN
    IF p_scoring_result IS NULL OR p_scoring_exact IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Custom preset requires scoring values');
    END IF;
    v_r := p_scoring_result; v_e := p_scoring_exact;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Invalid preset');
  END IF;

  IF v_r < 1 OR v_r > 10 THEN
    RETURN json_build_object('success', false, 'error', 'scoring_result must be 1-10');
  END IF;
  IF v_e < 1 OR v_e > 20 THEN
    RETURN json_build_object('success', false, 'error', 'scoring_exact must be 1-20');
  END IF;

  -- Validate scoring_weights if provided
  IF p_scoring_weights IS NOT NULL THEN
    IF p_preset <> 'weighted_stages' THEN
      v_weights := NULL; -- only persist weights when preset is weighted_stages
    ELSE
      FOR v_key IN SELECT jsonb_object_keys(p_scoring_weights) LOOP
        IF NOT (v_key = ANY(v_allowed_stages)) THEN
          RETURN json_build_object('success', false, 'error', 'Invalid stage in scoring_weights: ' || v_key);
        END IF;
        v_val := (p_scoring_weights ->> v_key)::numeric;
        IF v_val < 0.5 OR v_val > 10 THEN
          RETURN json_build_object('success', false, 'error', 'Weight for ' || v_key || ' must be 0.5-10');
        END IF;
      END LOOP;
      v_weights := p_scoring_weights;
    END IF;
  ELSE
    -- Preset changed away from weighted_stages → clear custom weights
    IF p_preset <> 'weighted_stages' THEN
      v_weights := NULL;
    ELSE
      -- Keep existing weights if not sent
      SELECT scoring_weights INTO v_weights FROM public.boloes WHERE id = p_bolao_id;
    END IF;
  END IF;

  UPDATE public.boloes
    SET scoring_preset = p_preset,
        scoring_result = v_r,
        scoring_exact = v_e,
        scoring_weights = v_weights
    WHERE id = p_bolao_id;

  RETURN json_build_object(
    'success', true,
    'scoring_result', v_r,
    'scoring_exact', v_e,
    'scoring_weights', v_weights
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_bolao_scoring(uuid, text, int, int, jsonb) TO authenticated;
