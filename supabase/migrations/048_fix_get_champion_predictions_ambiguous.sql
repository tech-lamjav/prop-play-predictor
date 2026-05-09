-- ============================================================
-- Fix get_champion_predictions: ambiguous column reference
-- ============================================================
-- Problem: RETURNS TABLE(user_id uuid, ...) declares user_id as
-- an OUT parameter. The body then references `user_id = auth.uid()`
-- in a WHERE on bolao_members, which Postgres cannot disambiguate.
-- Result: function errors with "42702: column reference user_id
-- is ambiguous" and the query never returns. Champion picks then
-- appear to "disappear" on refetch (F5) because the frontend hook
-- gets no data despite the row being saved correctly.
--
-- Fix: qualify the column with the table name.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_champion_predictions(p_bolao_id uuid)
RETURNS TABLE(
  user_id uuid,
  user_name text,
  predicted_team_code text,
  points_earned integer,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify caller is a member
  IF NOT EXISTS (
    SELECT 1 FROM bolao_members
    WHERE bolao_members.bolao_id = p_bolao_id
      AND bolao_members.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    sp.user_id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email)::text AS user_name,
    sp.predicted_team_code,
    sp.points_earned,
    sp.created_at
  FROM bolao_special_predictions sp
  LEFT JOIN auth.users u ON u.id = sp.user_id
  WHERE sp.bolao_id = p_bolao_id
    AND sp.prediction_type = 'champion'
  ORDER BY sp.created_at;
END;
$function$;
