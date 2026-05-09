-- ============================================================
-- get_user_special_predictions
-- ============================================================
-- Companion to get_my_special_predictions, but takes a user_id
-- parameter so any member of the bolão can see another member's
-- special predictions (campeão, finalistas, semis, quartas, R32).
--
-- Permission rule: caller must be a member of the bolão. Otherwise
-- returns empty (security definer function gates by membership).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_special_predictions(
  p_bolao_id uuid,
  p_user_id  uuid
)
RETURNS TABLE (
  prediction_type      text,
  predicted_team_code  text,
  points_earned        int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Caller must be a member of the bolão
  IF NOT EXISTS (
    SELECT 1 FROM bolao_members
    WHERE bolao_members.bolao_id = p_bolao_id
      AND bolao_members.user_id  = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT sp.prediction_type, sp.predicted_team_code, sp.points_earned
  FROM bolao_special_predictions sp
  WHERE sp.bolao_id = p_bolao_id
    AND sp.user_id  = p_user_id
  ORDER BY sp.prediction_type, sp.predicted_team_code;
END;
$function$;
