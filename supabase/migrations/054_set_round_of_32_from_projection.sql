-- ============================================================
-- set_round_of_32_from_projection — auto-preenche os 16 avos (32 seleções)
-- ============================================================
-- Usado pelo CTA "Usar projeção nos 16 avos": recebe os 32 códigos projetados a
-- partir dos palpites de grupo do usuário e SUBSTITUI os round_of_32 dele.
-- Atômico, com confirmação no front. Valida: autenticado, membro, prazo (antes
-- da abertura), ≤32 códigos, todos válidos (existem em wc_matches).
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_round_of_32_from_projection(
  p_bolao_id uuid,
  p_codes text[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_kickoff timestamptz;
  v_count int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not a member');
  END IF;

  SELECT min((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
    INTO v_kickoff FROM wc_matches;
  IF v_kickoff IS NOT NULL AND now() >= v_kickoff THEN
    RETURN json_build_object('success', false, 'error', 'Prazo encerrado (Copa começou)');
  END IF;

  IF array_length(p_codes, 1) IS NULL OR array_length(p_codes, 1) > 32 THEN
    RETURN json_build_object('success', false, 'error', 'Lista inválida (máx 32 seleções)');
  END IF;

  -- todos os códigos precisam existir em wc_matches (e não ser TBD)
  IF EXISTS (
    SELECT 1 FROM unnest(p_codes) AS c
    WHERE c NOT IN (
      SELECT home_team_code FROM wc_matches WHERE home_team_code <> 'TBD'
      UNION
      SELECT away_team_code FROM wc_matches WHERE away_team_code <> 'TBD'
    )
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Código de seleção inválido');
  END IF;

  -- substitui os round_of_32 do usuário pelos projetados
  DELETE FROM bolao_special_predictions
    WHERE bolao_id = p_bolao_id AND user_id = v_user_id AND prediction_type = 'round_of_32';
  INSERT INTO bolao_special_predictions (bolao_id, user_id, prediction_type, predicted_team_code)
    SELECT p_bolao_id, v_user_id, 'round_of_32', c FROM unnest(p_codes) AS c;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('success', true, 'count', v_count);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_round_of_32_from_projection(uuid, text[]) TO authenticated;
