-- ============================================================
-- bracket_advance — avança/troca o vencedor de um confronto do mata-mata
-- ============================================================
-- Usado pelo chaveamento clicável. Ao mandar o `p_winner` avançar num jogo cuja
-- fase seguinte é `p_next_stage`:
--   - adiciona o vencedor em p_next_stage (idempotente);
--   - remove o perdedor de p_next_stage + TODAS as fases mais profundas + campeão
--     (ele perdeu aqui, não pode estar adiante). Isso invalida picks downstream
--     quando o usuário troca o vencedor.
-- O campeão (final) é tratado à parte no front (upsert_champion_prediction).
-- Atômico. Valida membro + prazo.
-- ============================================================
CREATE OR REPLACE FUNCTION public.bracket_advance(
  p_bolao_id uuid,
  p_winner text,
  p_loser text,
  p_next_stage text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_kickoff timestamptz;
  v_order text[] := ARRAY['round_of_16','quarterfinalist','semifinalist','finalist'];
  v_idx int;
  v_deeper text[];
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

  v_idx := array_position(v_order, p_next_stage);
  IF v_idx IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Fase inválida');
  END IF;
  v_deeper := v_order[v_idx:array_length(v_order, 1)];  -- a fase + todas as mais profundas

  -- adiciona o vencedor na fase seguinte (idempotente via UNIQUE)
  INSERT INTO bolao_special_predictions (bolao_id, user_id, prediction_type, predicted_team_code)
    VALUES (p_bolao_id, v_user_id, p_next_stage, p_winner)
    ON CONFLICT (bolao_id, user_id, prediction_type, predicted_team_code) DO NOTHING;

  -- remove o perdedor desta fase + mais profundas + campeão
  DELETE FROM bolao_special_predictions
    WHERE bolao_id = p_bolao_id AND user_id = v_user_id
      AND predicted_team_code = p_loser
      AND prediction_type = ANY (v_deeper || ARRAY['champion']);

  RETURN json_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.bracket_advance(uuid, text, text, text) TO authenticated;
