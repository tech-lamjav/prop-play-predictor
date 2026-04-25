-- ============================================================
-- BOLÃO: RPC to update prediction_deadline_mode after creation
-- Owner-only. Moved from creation form to settings panel.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_bolao_deadline_mode(
  p_bolao_id uuid,
  p_mode text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.boloes WHERE id = p_bolao_id AND owner_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not the owner');
  END IF;
  IF p_mode NOT IN ('per_match','per_round','tournament_start') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid mode');
  END IF;

  UPDATE public.boloes
    SET prediction_deadline_mode = p_mode
    WHERE id = p_bolao_id;

  RETURN json_build_object('success', true, 'prediction_deadline_mode', p_mode);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_bolao_deadline_mode(uuid, text) TO authenticated;
