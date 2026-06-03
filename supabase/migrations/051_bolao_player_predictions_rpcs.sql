-- ============================================================
-- M3 — RPCs dos palpites de JOGADOR
-- ============================================================
-- 1) get_my_special_predictions: recriada INCLUINDO predicted_player_id no retorno.
--    ⚠️ É a função do incidente de drift (migration 045). Muda OUT columns →
--    DROP+CREATE. Sincronizar staging E prod ao promover (ver runbook).
-- 2) set_player_prediction: grava o palpite de jogador (pick único). Validações:
--    autenticado, membro, prêmio habilitado no bolão, prazo (antes da abertura),
--    jogador existe, goleiro só aceita Goalkeeper, revelação exige birth_date
--    conhecido E elegível (bloqueio seguro enquanto birth_date não foi enriquecido).
-- ============================================================

-- ─── get_my_special_predictions (agora com player_id) ───────
DROP FUNCTION IF EXISTS public.get_my_special_predictions(uuid);
CREATE FUNCTION public.get_my_special_predictions(p_bolao_id uuid)
RETURNS TABLE(prediction_type text, predicted_team_code text, predicted_player_id bigint, points_earned integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT prediction_type, predicted_team_code, predicted_player_id, points_earned
  FROM public.bolao_special_predictions
  WHERE bolao_id = p_bolao_id AND user_id = auth.uid()
  ORDER BY prediction_type, predicted_team_code, predicted_player_id;
$function$;
GRANT EXECUTE ON FUNCTION public.get_my_special_predictions(uuid) TO authenticated;

-- ─── set_player_prediction ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_player_prediction(
  p_bolao_id uuid,
  p_prediction_type text,
  p_player_id bigint
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_enabled jsonb;
  v_player record;
  v_kickoff timestamptz;
  v_young_cutoff date := '2005-01-01';  -- a confirmar p/ 2026 (nascidos >= esta data)
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_prediction_type NOT IN ('top_scorer','best_goalkeeper','best_young_player','best_player') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid prediction type');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not a member');
  END IF;

  -- Prêmio habilitado neste bolão?
  SELECT player_awards_enabled INTO v_enabled FROM boloes WHERE id = p_bolao_id;
  IF v_enabled IS NULL OR COALESCE((v_enabled ->> p_prediction_type)::boolean, false) = false THEN
    RETURN json_build_object('success', false, 'error', 'Prêmio desabilitado neste bolão');
  END IF;

  -- Prazo: até a abertura da Copa (kickoff do primeiro jogo)
  SELECT min((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
    INTO v_kickoff FROM wc_matches;
  IF v_kickoff IS NOT NULL AND now() >= v_kickoff THEN
    RETURN json_build_object('success', false, 'error', 'Prazo encerrado (Copa começou)');
  END IF;

  -- Remoção: player_id nulo limpa o palpite
  IF p_player_id IS NULL THEN
    DELETE FROM bolao_special_predictions
      WHERE bolao_id = p_bolao_id AND user_id = v_user_id AND prediction_type = p_prediction_type;
    RETURN json_build_object('success', true, 'action', 'removed');
  END IF;

  SELECT * INTO v_player FROM wc_players WHERE player_id = p_player_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Jogador não encontrado');
  END IF;

  IF p_prediction_type = 'best_goalkeeper' AND v_player.position IS DISTINCT FROM 'Goalkeeper' THEN
    RETURN json_build_object('success', false, 'error', 'Esse prêmio aceita só goleiros');
  END IF;

  IF p_prediction_type = 'best_young_player' THEN
    IF v_player.birth_date IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Elegibilidade indisponível (sem data de nascimento)');
    END IF;
    IF v_player.birth_date < v_young_cutoff THEN
      RETURN json_build_object('success', false, 'error', 'Jogador não elegível ao prêmio de revelação');
    END IF;
  END IF;

  -- Pick único: substitui o anterior do mesmo tipo
  DELETE FROM bolao_special_predictions
    WHERE bolao_id = p_bolao_id AND user_id = v_user_id AND prediction_type = p_prediction_type;
  INSERT INTO bolao_special_predictions (bolao_id, user_id, prediction_type, predicted_player_id)
    VALUES (p_bolao_id, v_user_id, p_prediction_type, p_player_id);

  RETURN json_build_object('success', true, 'action', 'set');
END;
$function$;
GRANT EXECUTE ON FUNCTION public.set_player_prediction(uuid, text, bigint) TO authenticated;
