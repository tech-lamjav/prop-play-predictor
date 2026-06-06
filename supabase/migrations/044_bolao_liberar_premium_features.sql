-- ============================================================
-- BUGS DO REVIEW DO DIODY — Liberar features que eram Premium pra Free
-- ============================================================
-- PR #140 do Vitor (Onda 6) decidiu liberar TODAS as features pra Free:
-- pontuação custom, multiplicador, palpites especiais, logo, cores,
-- heatmap, versus. Só o limite de participantes muda (Free 20 / Premium 9999).
--
-- Mas o backend (RPCs) continuou bloqueando com 'Premium required'. Diody
-- testando em prod viu erro em 3 fluxos:
--   - Selecionar finalista        → toggle_special_prediction
--   - Trocar logo                 → update_bolao_theme
--   - Salvar pontuação custom     → update_bolao_scoring
--
-- + 2 funções que também tinham check Premium e merecem ser liberadas:
--   - get_my_team_heatmap (stats por time)
--   - get_versus_stats    (comparação 1×1)
--
-- Esta migration recria as 5 funções SEM o IF NOT is_premium THEN error.
-- ============================================================

-- ─── toggle_special_prediction ──────────────────────────────
-- Toggle palpite especial (finalist/semifinalist/quarterfinalist/round_of_32).
-- Validações: autenticado, membro do bolão, tipo válido, máx picks por tipo.
-- SEM check Premium.
CREATE OR REPLACE FUNCTION public.toggle_special_prediction(
  p_bolao_id uuid,
  p_prediction_type text,
  p_team_code text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_max_picks int;
  v_current_count int;
  v_exists boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_prediction_type NOT IN ('finalist', 'semifinalist', 'quarterfinalist', 'round_of_32') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid prediction type');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Not a member');
  END IF;

  -- SEM check Premium — Diody decisão: liberar pra Free também.

  v_max_picks := CASE p_prediction_type
    WHEN 'finalist'        THEN 2
    WHEN 'semifinalist'    THEN 4
    WHEN 'quarterfinalist' THEN 8
    WHEN 'round_of_32'     THEN 16
    ELSE 4
  END;

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
    SELECT COUNT(*) INTO v_current_count
    FROM bolao_special_predictions
    WHERE bolao_id = p_bolao_id AND user_id = v_user_id AND prediction_type = p_prediction_type;

    IF v_current_count >= v_max_picks THEN
      RETURN json_build_object('success', false, 'error', 'Max picks reached', 'max', v_max_picks);
    END IF;

    INSERT INTO bolao_special_predictions (bolao_id, user_id, prediction_type, predicted_team_code)
      VALUES (p_bolao_id, v_user_id, p_prediction_type, p_team_code);
    RETURN json_build_object('success', true, 'action', 'added', 'count', v_current_count + 1);
  END IF;
END;
$function$;

-- ─── update_bolao_scoring ───────────────────────────────────
-- Dono altera pontuação (preset + valores + pesos por fase).
-- SEM check Premium.
CREATE OR REPLACE FUNCTION public.update_bolao_scoring(
  p_bolao_id uuid,
  p_preset text,
  p_scoring_result integer DEFAULT NULL::integer,
  p_scoring_exact integer DEFAULT NULL::integer,
  p_scoring_weights jsonb DEFAULT NULL::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user_id uuid;
  v_r int; v_e int;
  v_weights jsonb;
  v_allowed_stages text[] := ARRAY['group','round_of_32','round_of_16','quarter','semi','third_place','final'];
  v_key text;
  v_val numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.boloes WHERE id = p_bolao_id AND owner_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not the owner');
  END IF;

  -- SEM check Premium — PR #140 liberou pontuação custom pra Free.

  IF p_preset = 'standard' THEN
    v_r := 1; v_e := 3;
  ELSIF p_preset = 'classic' THEN
    v_r := 1; v_e := 5;
  ELSIF p_preset = 'weighted_stages' THEN
    v_r := COALESCE(p_scoring_result, 1);
    v_e := COALESCE(p_scoring_exact, 3);
  ELSIF p_preset = 'custom' THEN
    IF p_scoring_result IS NULL OR p_scoring_exact IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Custom preset requires scoring values');
    END IF;
    v_r := p_scoring_result; v_e := p_scoring_exact;
  ELSE
    RETURN json_build_object('success', false, 'error', 'Invalid preset');
  END IF;

  IF v_r < 1 OR v_r > 10 THEN
    RETURN json_build_object('success', false, 'error', 'scoring_result must be 1-10');
  END IF;
  IF v_e < 1 OR v_e > 20 THEN
    RETURN json_build_object('success', false, 'error', 'scoring_exact must be 1-20');
  END IF;

  IF p_scoring_weights IS NOT NULL THEN
    IF p_preset <> 'weighted_stages' THEN
      v_weights := NULL;
    ELSE
      FOR v_key IN SELECT jsonb_object_keys(p_scoring_weights) LOOP
        IF NOT (v_key = ANY(v_allowed_stages)) THEN
          RETURN json_build_object('success', false, 'error', 'Invalid stage in scoring_weights: ' || v_key);
        END IF;
        v_val := (p_scoring_weights ->> v_key)::numeric;
        IF v_val < 0.5 OR v_val > 10 THEN
          RETURN json_build_object('success', false, 'error', 'Weight for ' || v_key || ' must be 0.5-10');
        END IF;
      END LOOP;
      v_weights := p_scoring_weights;
    END IF;
  ELSE
    IF p_preset <> 'weighted_stages' THEN
      v_weights := NULL;
    ELSE
      SELECT scoring_weights INTO v_weights FROM public.boloes WHERE id = p_bolao_id;
    END IF;
  END IF;

  UPDATE public.boloes
    SET scoring_preset = p_preset,
        scoring_result = v_r,
        scoring_exact = v_e,
        scoring_weights = v_weights
    WHERE id = p_bolao_id;

  RETURN json_build_object(
    'success', true,
    'scoring_result', v_r,
    'scoring_exact', v_e,
    'scoring_weights', v_weights
  );
END;
$function$;

-- ─── update_bolao_theme ─────────────────────────────────────
-- Dono altera cor + logo do bolão.
-- SEM check Premium.
CREATE OR REPLACE FUNCTION public.update_bolao_theme(
  p_bolao_id uuid,
  p_color text DEFAULT NULL::text,
  p_logo_url text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM boloes WHERE id = p_bolao_id AND owner_id = auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Not the owner');
  END IF;

  -- SEM check Premium — PR #140 liberou customização pra Free.

  UPDATE boloes
    SET custom_color      = COALESCE(p_color, custom_color),
        custom_banner_url = COALESCE(p_logo_url, custom_banner_url)
    WHERE id = p_bolao_id;
  RETURN json_build_object('success', true);
END;
$function$;

-- ─── get_my_team_heatmap ────────────────────────────────────
-- Heatmap por time: quantos palpites + acertos pra cada seleção.
-- SEM check Premium.
CREATE OR REPLACE FUNCTION public.get_my_team_heatmap(p_bolao_id uuid)
RETURNS TABLE(team_code text, team_name text, matches_predicted integer, matches_finished integer, exact_scores integer, correct_results integer, total_points integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- SEM check Premium — stats avançadas liberadas pra todos.

  IF NOT EXISTS (SELECT 1 FROM public.bolao_members WHERE bolao_id = p_bolao_id AND user_id = v_user_id) THEN RETURN; END IF;

  RETURN QUERY
  WITH all_codes AS (
    SELECT DISTINCT m.home_team_code AS code, m.home_team AS name
    FROM public.bolao_predictions bp
    JOIN public.wc_matches m ON m.id = bp.match_id
    WHERE bp.bolao_id = p_bolao_id AND bp.user_id = v_user_id
      AND m.home_team_code <> 'TBD'
    UNION
    SELECT DISTINCT m.away_team_code, m.away_team
    FROM public.bolao_predictions bp
    JOIN public.wc_matches m ON m.id = bp.match_id
    WHERE bp.bolao_id = p_bolao_id AND bp.user_id = v_user_id
      AND m.away_team_code <> 'TBD'
  ),
  involved_predictions AS (
    SELECT
      ac.code,
      ac.name,
      bp.points_earned,
      m.is_finished,
      b.scoring_exact
    FROM all_codes ac
    JOIN public.wc_matches m ON (m.home_team_code = ac.code OR m.away_team_code = ac.code)
    JOIN public.bolao_predictions bp ON bp.match_id = m.id AND bp.user_id = v_user_id AND bp.bolao_id = p_bolao_id
    JOIN public.boloes b ON b.id = bp.bolao_id
  )
  SELECT
    ip.code::text,
    ip.name::text,
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE ip.is_finished)::int,
    COUNT(*) FILTER (WHERE ip.is_finished AND ip.points_earned >= ip.scoring_exact)::int,
    COUNT(*) FILTER (WHERE ip.is_finished AND ip.points_earned > 0)::int,
    COALESCE(SUM(ip.points_earned), 0)::int
  FROM involved_predictions ip
  GROUP BY ip.code, ip.name
  ORDER BY total_points DESC, exact_scores DESC;
END;
$function$;

-- ─── get_versus_stats ───────────────────────────────────────
-- Comparação 1×1 entre user e oponente.
-- SEM check Premium.
CREATE OR REPLACE FUNCTION public.get_versus_stats(p_bolao_id uuid, p_opponent_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid;
  v_my_stats jsonb;
  v_opp_stats jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN json_build_object('error', 'Not authenticated'); END IF;

  -- SEM check Premium — comparação 1×1 liberada pra todos.

  IF NOT EXISTS (SELECT 1 FROM public.bolao_members WHERE bolao_id = p_bolao_id AND user_id = v_user_id) THEN
    RETURN json_build_object('error', 'Not a member');
  END IF;

  WITH stats AS (
    SELECT
      bp.user_id,
      COALESCE(SUM(bp.points_earned), 0)::int AS total_points,
      COUNT(*) FILTER (WHERE bp.points_earned >= b.scoring_exact)::int AS exact_scores,
      COUNT(*) FILTER (WHERE bp.points_earned > 0)::int AS correct_results,
      COUNT(*)::int AS total_predictions
    FROM public.bolao_predictions bp
    JOIN public.boloes b ON b.id = bp.bolao_id
    WHERE bp.bolao_id = p_bolao_id
      AND bp.user_id IN (v_user_id, p_opponent_user_id)
    GROUP BY bp.user_id
  )
  SELECT
    (SELECT to_jsonb(s) FROM stats s WHERE s.user_id = v_user_id),
    (SELECT to_jsonb(s) FROM stats s WHERE s.user_id = p_opponent_user_id)
  INTO v_my_stats, v_opp_stats;

  RETURN json_build_object(
    'me', COALESCE(v_my_stats, '{}'::jsonb),
    'opponent', COALESCE(v_opp_stats, '{}'::jsonb)
  );
END;
$function$;
