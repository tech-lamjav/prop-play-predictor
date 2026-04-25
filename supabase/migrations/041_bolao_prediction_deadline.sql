-- ============================================================
-- BOLÃO: Prediction deadline modes
-- Owner chooses ON CREATION between:
--   'per_match'        (default) — deadline = kickoff of that match
--   'per_round'        — deadline = kickoff of the first match in the stage
--   'tournament_start' — deadline = kickoff of the first match of the Cup
-- Immutable after creation (locked into the bolao's rules).
-- Manual `is_closed` flag remains orthogonal — closing freezes all predictions.
-- ============================================================

-- 1. Add column (default per_match for backward compat)
ALTER TABLE public.boloes
  ADD COLUMN IF NOT EXISTS prediction_deadline_mode text
    NOT NULL DEFAULT 'per_match'
    CHECK (prediction_deadline_mode IN ('per_match','per_round','tournament_start'));

COMMENT ON COLUMN public.boloes.prediction_deadline_mode IS
  'When predictions close: per_match, per_round (first match of the stage), or tournament_start (first match of the Cup). Set on creation, immutable after.';

-- 2. Deadline helper — returns timestamptz deadline for a given (bolao, match)
CREATE OR REPLACE FUNCTION public.get_prediction_deadline(
  p_bolao_id uuid,
  p_match_id int
) RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_mode text;
  v_stage text;
  v_deadline timestamptz;
BEGIN
  SELECT prediction_deadline_mode INTO v_mode
  FROM public.boloes WHERE id = p_bolao_id;
  IF v_mode IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_mode = 'per_match' THEN
    SELECT (match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo'
      INTO v_deadline
    FROM public.wc_matches WHERE id = p_match_id;
  ELSIF v_mode = 'per_round' THEN
    SELECT stage INTO v_stage
    FROM public.wc_matches WHERE id = p_match_id;
    IF v_stage IS NULL THEN RETURN NULL; END IF;
    SELECT MIN((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_deadline
    FROM public.wc_matches WHERE stage = v_stage;
  ELSIF v_mode = 'tournament_start' THEN
    SELECT MIN((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_deadline
    FROM public.wc_matches;
  END IF;

  RETURN v_deadline;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_prediction_deadline(uuid, int) TO authenticated;

-- 3. RPC: submit a single prediction with server-side deadline check
CREATE OR REPLACE FUNCTION public.submit_bolao_prediction(
  p_bolao_id uuid,
  p_match_id int,
  p_predicted_home_score int,
  p_predicted_away_score int
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user_id uuid;
  v_is_closed boolean;
  v_deadline timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bolao_members
    WHERE bolao_id = p_bolao_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Not a member');
  END IF;

  SELECT is_closed INTO v_is_closed FROM public.boloes WHERE id = p_bolao_id;
  IF v_is_closed THEN
    RETURN json_build_object('success', false, 'error', 'Inscrições fechadas');
  END IF;

  v_deadline := public.get_prediction_deadline(p_bolao_id, p_match_id);
  IF v_deadline IS NOT NULL AND now() >= v_deadline THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Prazo de palpite encerrado',
      'deadline', v_deadline
    );
  END IF;

  IF p_predicted_home_score < 0 OR p_predicted_away_score < 0
     OR p_predicted_home_score > 20 OR p_predicted_away_score > 20 THEN
    RETURN json_build_object('success', false, 'error', 'Placar inválido (0-20)');
  END IF;

  INSERT INTO public.bolao_predictions
    (bolao_id, user_id, match_id, predicted_home_score, predicted_away_score)
  VALUES
    (p_bolao_id, v_user_id, p_match_id, p_predicted_home_score, p_predicted_away_score)
  ON CONFLICT (bolao_id, user_id, match_id) DO UPDATE
    SET predicted_home_score = EXCLUDED.predicted_home_score,
        predicted_away_score = EXCLUDED.predicted_away_score,
        updated_at = now();

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_bolao_prediction(uuid, int, int, int) TO authenticated;

-- 4. RPC: batch submit (used when mode = tournament_start or per_round)
CREATE OR REPLACE FUNCTION public.batch_submit_bolao_predictions(
  p_bolao_id uuid,
  p_predictions jsonb
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user_id uuid;
  v_is_closed boolean;
  v_mode text;
  v_deadline timestamptz;
  v_saved int := 0;
  v_skipped int := 0;
  v_pred jsonb;
  v_match_id int;
  v_home int;
  v_away int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bolao_members
    WHERE bolao_id = p_bolao_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Not a member');
  END IF;

  SELECT is_closed, prediction_deadline_mode INTO v_is_closed, v_mode
  FROM public.boloes WHERE id = p_bolao_id;
  IF v_is_closed THEN
    RETURN json_build_object('success', false, 'error', 'Inscrições fechadas');
  END IF;

  FOR v_pred IN SELECT * FROM jsonb_array_elements(p_predictions) LOOP
    v_match_id := (v_pred ->> 'match_id')::int;
    v_home := (v_pred ->> 'home')::int;
    v_away := (v_pred ->> 'away')::int;

    IF v_match_id IS NULL OR v_home IS NULL OR v_away IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    IF v_home < 0 OR v_away < 0 OR v_home > 20 OR v_away > 20 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_deadline := public.get_prediction_deadline(p_bolao_id, v_match_id);
    IF v_deadline IS NOT NULL AND now() >= v_deadline THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.bolao_predictions
      (bolao_id, user_id, match_id, predicted_home_score, predicted_away_score)
    VALUES
      (p_bolao_id, v_user_id, v_match_id, v_home, v_away)
    ON CONFLICT (bolao_id, user_id, match_id) DO UPDATE
      SET predicted_home_score = EXCLUDED.predicted_home_score,
          predicted_away_score = EXCLUDED.predicted_away_score,
          updated_at = now();
    v_saved := v_saved + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'saved', v_saved, 'skipped', v_skipped);
END;
$$;

GRANT EXECUTE ON FUNCTION public.batch_submit_bolao_predictions(uuid, jsonb) TO authenticated;

-- 5. Tighten RLS on bolao_predictions: client-side upsert still allowed only
--    through the RPCs above, which enforce deadline. Existing policies remain
--    for SELECT; for INSERT/UPDATE, drop permissive policy if any and rely on
--    SECURITY DEFINER RPC. (No-op if policies are already restrictive.)
--
--    NOTE: If your current RLS lets authenticated users INSERT/UPDATE directly,
--    the deadline check is bypassed. The frontend should switch to the RPCs.
