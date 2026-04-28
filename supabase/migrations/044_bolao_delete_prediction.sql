-- ============================================================
-- BOLÃO: deletar palpite individual
-- Permite o usuário "zerar" um palpite, removendo-o completamente.
-- O card volta ao estado vazio ("- x -"), não persiste como 0/0.
-- Aplica as mesmas validações de submit (deadline + is_closed).
-- ============================================================

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

  -- Mesma regra de deadline do submit_bolao_prediction
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
