-- ============================================================
-- Prazos dos palpites especiais — configuráveis pelo dono do bolão
-- ============================================================
-- Modelo "presets + ajuste fino":
--   boloes.special_deadlines jsonb = {
--     "mode": "rolling" | "opening",          -- preset (default: rolling)
--     "overrides": { "<tipo>": "<timestamptz ISO>" | null }  -- vence o preset
--   }
--
-- mode = 'rolling' (padrão, "rolável por rodada"): cada palpite trava quando
--   começa a rodada que o decide:
--     16 avos (round_of_32) + Oitavas (round_of_16) → início do mata-mata
--     Quartas (quarterfinalist) → início das oitavas
--     Semis (semifinalist)      → início das quartas
--     Finalistas (finalist)     → início das semis
--     Campeão (champion)        → a final
--     Prêmios de jogador        → abertura da Copa
-- mode = 'opening': tudo trava na abertura da Copa (1º jogo).
-- overrides[tipo]: data/hora explícita definida pelo dono — vence o preset.
--
-- O servidor é a autoridade: os 5 RPCs que gating os especiais consultam
-- special_prediction_deadline(bolao_id, tipo) antes de gravar.
-- ============================================================

ALTER TABLE public.boloes ADD COLUMN IF NOT EXISTS special_deadlines jsonb;
COMMENT ON COLUMN public.boloes.special_deadlines IS
  'Config de prazo dos palpites especiais: {mode: rolling|opening, overrides: {tipo: timestamptz}}. null = rolling.';

-- Helper: prazo (timestamptz) do tipo para o bolão, considerando override → mode.
CREATE OR REPLACE FUNCTION public.special_prediction_deadline(p_bolao_id uuid, p_type text)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg jsonb;
  v_override text;
  v_mode text;
  v_stage text;
  v_deadline timestamptz;
BEGIN
  SELECT special_deadlines INTO v_cfg FROM boloes WHERE id = p_bolao_id;

  -- 1) Override explícito por tipo vence tudo.
  v_override := v_cfg -> 'overrides' ->> p_type;
  IF v_override IS NOT NULL AND v_override <> '' THEN
    RETURN v_override::timestamptz;
  END IF;

  v_mode := COALESCE(v_cfg ->> 'mode', 'rolling');

  -- 2) Preset "opening": tudo fecha na abertura da Copa.
  IF v_mode = 'opening' THEN
    SELECT min((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_deadline FROM wc_matches;
    RETURN v_deadline;
  END IF;

  -- 3) Preset "rolling" (padrão): trava no início da rodada que decide o tipo.
  v_stage := CASE p_type
    WHEN 'round_of_32'     THEN 'round_of_32'
    WHEN 'round_of_16'     THEN 'round_of_32'
    WHEN 'quarterfinalist' THEN 'round_of_16'
    WHEN 'semifinalist'    THEN 'quarter'
    WHEN 'finalist'        THEN 'semi'
    WHEN 'champion'        THEN 'final'
    ELSE NULL  -- prêmios de jogador → abertura da Copa
  END;

  IF v_stage IS NULL THEN
    SELECT min((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_deadline FROM wc_matches;
  ELSE
    SELECT min((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_deadline FROM wc_matches WHERE stage = v_stage;
  END IF;
  RETURN v_deadline;
END;
$function$;

-- ─── toggle_special_prediction (seleção: 16avos..finalistas) ─
CREATE OR REPLACE FUNCTION public.toggle_special_prediction(
  p_bolao_id uuid, p_prediction_type text, p_team_code text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid; v_max_picks int; v_current_count int; v_exists boolean; v_deadline timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF p_prediction_type NOT IN ('finalist','semifinalist','quarterfinalist','round_of_16','round_of_32') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid prediction type'); END IF;
  IF NOT EXISTS (SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not a member'); END IF;
  v_deadline := special_prediction_deadline(p_bolao_id, p_prediction_type);
  IF v_deadline IS NOT NULL AND now() >= v_deadline THEN
    RETURN json_build_object('success', false, 'error', 'Prazo encerrado'); END IF;

  v_max_picks := CASE p_prediction_type
    WHEN 'finalist' THEN 2 WHEN 'semifinalist' THEN 4 WHEN 'quarterfinalist' THEN 8
    WHEN 'round_of_16' THEN 16 WHEN 'round_of_32' THEN 32 ELSE 4 END;

  SELECT EXISTS(
    SELECT 1 FROM bolao_special_predictions
    WHERE bolao_id = p_bolao_id AND user_id = v_user_id
      AND prediction_type = p_prediction_type AND predicted_team_code = p_team_code
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM bolao_special_predictions
      WHERE bolao_id = p_bolao_id AND user_id = v_user_id
        AND prediction_type = p_prediction_type AND predicted_team_code = p_team_code;
    RETURN json_build_object('success', true, 'action', 'removed');
  ELSE
    SELECT COUNT(*) INTO v_current_count FROM bolao_special_predictions
      WHERE bolao_id = p_bolao_id AND user_id = v_user_id AND prediction_type = p_prediction_type;
    IF v_current_count >= v_max_picks THEN
      RETURN json_build_object('success', false, 'error', 'Max picks reached', 'max', v_max_picks); END IF;
    INSERT INTO bolao_special_predictions (bolao_id, user_id, prediction_type, predicted_team_code)
      VALUES (p_bolao_id, v_user_id, p_prediction_type, p_team_code);
    RETURN json_build_object('success', true, 'action', 'added', 'count', v_current_count + 1);
  END IF;
END;
$function$;

-- ─── set_player_prediction (prêmios de jogador) ─────────────
CREATE OR REPLACE FUNCTION public.set_player_prediction(
  p_bolao_id uuid, p_prediction_type text, p_player_id bigint
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid; v_enabled jsonb; v_player record; v_deadline timestamptz;
  v_young_cutoff date := '2005-01-01';
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF p_prediction_type NOT IN ('top_scorer','best_goalkeeper','best_young_player','best_player') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid prediction type'); END IF;
  IF NOT EXISTS (SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not a member'); END IF;
  SELECT player_awards_enabled INTO v_enabled FROM boloes WHERE id = p_bolao_id;
  IF v_enabled IS NULL OR COALESCE((v_enabled ->> p_prediction_type)::boolean, false) = false THEN
    RETURN json_build_object('success', false, 'error', 'Prêmio desabilitado neste bolão'); END IF;
  v_deadline := special_prediction_deadline(p_bolao_id, p_prediction_type);
  IF v_deadline IS NOT NULL AND now() >= v_deadline THEN
    RETURN json_build_object('success', false, 'error', 'Prazo encerrado'); END IF;

  IF p_player_id IS NULL THEN
    DELETE FROM bolao_special_predictions
      WHERE bolao_id = p_bolao_id AND user_id = v_user_id AND prediction_type = p_prediction_type;
    RETURN json_build_object('success', true, 'action', 'removed');
  END IF;

  SELECT * INTO v_player FROM wc_players WHERE player_id = p_player_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Jogador não encontrado'); END IF;
  IF p_prediction_type = 'best_goalkeeper' AND v_player.position IS DISTINCT FROM 'Goalkeeper' THEN
    RETURN json_build_object('success', false, 'error', 'Esse prêmio aceita só goleiros'); END IF;
  IF p_prediction_type = 'best_young_player' THEN
    IF v_player.birth_date IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Elegibilidade indisponível (sem data de nascimento)'); END IF;
    IF v_player.birth_date < v_young_cutoff THEN
      RETURN json_build_object('success', false, 'error', 'Jogador não elegível ao prêmio de revelação'); END IF;
  END IF;

  DELETE FROM bolao_special_predictions
    WHERE bolao_id = p_bolao_id AND user_id = v_user_id AND prediction_type = p_prediction_type;
  INSERT INTO bolao_special_predictions (bolao_id, user_id, prediction_type, predicted_player_id)
    VALUES (p_bolao_id, v_user_id, p_prediction_type, p_player_id);
  RETURN json_build_object('success', true, 'action', 'set');
END;
$function$;

-- ─── set_round_of_32_from_projection (16 avos) ──────────────
CREATE OR REPLACE FUNCTION public.set_round_of_32_from_projection(
  p_bolao_id uuid, p_codes text[]
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid; v_deadline timestamptz; v_count int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NOT EXISTS (SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not a member'); END IF;
  v_deadline := special_prediction_deadline(p_bolao_id, 'round_of_32');
  IF v_deadline IS NOT NULL AND now() >= v_deadline THEN
    RETURN json_build_object('success', false, 'error', 'Prazo encerrado'); END IF;
  IF array_length(p_codes, 1) IS NULL OR array_length(p_codes, 1) > 32 THEN
    RETURN json_build_object('success', false, 'error', 'Lista inválida (máx 32 seleções)'); END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_codes) AS c
    WHERE c NOT IN (
      SELECT home_team_code FROM wc_matches WHERE home_team_code <> 'TBD'
      UNION SELECT away_team_code FROM wc_matches WHERE away_team_code <> 'TBD')
  ) THEN RETURN json_build_object('success', false, 'error', 'Código de seleção inválido'); END IF;

  DELETE FROM bolao_special_predictions
    WHERE bolao_id = p_bolao_id AND user_id = v_user_id AND prediction_type = 'round_of_32';
  INSERT INTO bolao_special_predictions (bolao_id, user_id, prediction_type, predicted_team_code)
    SELECT p_bolao_id, v_user_id, 'round_of_32', c FROM unnest(p_codes) AS c;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN json_build_object('success', true, 'count', v_count);
END;
$function$;

-- ─── bracket_advance (avanço no chaveamento) ────────────────
CREATE OR REPLACE FUNCTION public.bracket_advance(
  p_bolao_id uuid, p_winner text, p_loser text, p_next_stage text
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid; v_deadline timestamptz;
  v_order text[] := ARRAY['round_of_16','quarterfinalist','semifinalist','finalist'];
  v_idx int; v_deeper text[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NOT EXISTS (SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not a member'); END IF;
  v_idx := array_position(v_order, p_next_stage);
  IF v_idx IS NULL THEN RETURN json_build_object('success', false, 'error', 'Fase inválida'); END IF;
  v_deadline := special_prediction_deadline(p_bolao_id, p_next_stage);
  IF v_deadline IS NOT NULL AND now() >= v_deadline THEN
    RETURN json_build_object('success', false, 'error', 'Prazo encerrado'); END IF;
  v_deeper := v_order[v_idx:array_length(v_order, 1)];

  INSERT INTO bolao_special_predictions (bolao_id, user_id, prediction_type, predicted_team_code)
    VALUES (p_bolao_id, v_user_id, p_next_stage, p_winner)
    ON CONFLICT (bolao_id, user_id, prediction_type, predicted_team_code) DO NOTHING;
  DELETE FROM bolao_special_predictions
    WHERE bolao_id = p_bolao_id AND user_id = v_user_id
      AND predicted_team_code = p_loser
      AND prediction_type = ANY (v_deeper || ARRAY['champion']);
  RETURN json_build_object('success', true);
END;
$function$;

-- ─── upsert_champion_prediction (campeão) ───────────────────
CREATE OR REPLACE FUNCTION public.upsert_champion_prediction(p_bolao_id uuid, p_team_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user_id uuid; v_deadline timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF NOT EXISTS (SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not a member'); END IF;
  v_deadline := special_prediction_deadline(p_bolao_id, 'champion');
  IF v_deadline IS NOT NULL AND now() >= v_deadline THEN
    RETURN json_build_object('success', false, 'error', 'Prazo encerrado'); END IF;
  DELETE FROM bolao_special_predictions
    WHERE bolao_id = p_bolao_id AND user_id = v_user_id AND prediction_type = 'champion';
  INSERT INTO bolao_special_predictions (bolao_id, user_id, prediction_type, predicted_team_code)
    VALUES (p_bolao_id, v_user_id, 'champion', p_team_code);
  RETURN json_build_object('success', true);
END;
$function$;

-- Remove o helper antigo de 1 argumento (substituído pela versão configurável).
DROP FUNCTION IF EXISTS public.special_prediction_deadline(text);
