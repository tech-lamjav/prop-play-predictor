-- ============================================================
-- BOLÃO: remover gate is_closed dos RPCs de palpite
-- ============================================================
-- Bug encontrado em testes UX: ao "Encerrar inscrições" no admin
-- (is_closed=true), as RPCs submit_bolao_prediction,
-- batch_submit_bolao_predictions e delete_bolao_prediction passavam
-- a rejeitar TODOS os palpites de membros existentes — bloqueando
-- inclusive trocar/apagar palpite que ja existia.
--
-- Semantica correta: is_closed eh sobre NOVAS inscricoes (controlado
-- por join_bolao_by_code, que mantem o gate). Membros que ja entraram
-- continuam palpitando ate o prazo de cada jogo. Esta migration recria
-- as 3 RPCs sem o check de is_closed.
--
-- Substitui partes de:
--   041_bolao_prediction_deadline.sql (submit, batch)
--   044_bolao_delete_prediction.sql   (delete)
-- ============================================================

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

  -- is_closed NAO eh checado: encerrar inscricoes nao bloqueia palpites
  -- de quem ja entrou. So o prazo do jogo bloqueia.
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

  -- is_closed NAO eh checado (vide submit_bolao_prediction).
  SELECT prediction_deadline_mode INTO v_mode
  FROM public.boloes WHERE id = p_bolao_id;

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

CREATE OR REPLACE FUNCTION public.delete_bolao_prediction(
  p_bolao_id uuid,
  p_match_id int
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user_id uuid;
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

  -- is_closed NAO eh checado (vide submit_bolao_prediction).
  v_deadline := public.get_prediction_deadline(p_bolao_id, p_match_id);
  IF v_deadline IS NOT NULL AND now() >= v_deadline THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Prazo de palpite encerrado',
      'deadline', v_deadline
    );
  END IF;

  DELETE FROM public.bolao_predictions
   WHERE bolao_id = p_bolao_id
     AND user_id = v_user_id
     AND match_id = p_match_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_bolao_prediction(uuid, int) TO authenticated;
