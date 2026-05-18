-- ============================================================
-- BOLÃO COPA 2026 — Schema baseline (4/5): RPCs principais
-- ============================================================
-- 25 RPCs de negócio do bolão. CREATE OR REPLACE garante idempotência.
-- Todas extraídas do staging em 17/mai/2026 via pg_get_functiondef.
-- ============================================================

-- ─── batch_submit_bolao_predictions ─────────────────────────
-- Submete vários palpites de uma vez (Quick Pick). Skip se prazo passou.
CREATE OR REPLACE FUNCTION public.batch_submit_bolao_predictions(p_bolao_id uuid, p_predictions jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;

-- ─── calculate_bolao_scores ─────────────────────────────────
-- Calcula pontos de todos os palpites de um jogo finalizado.
-- Dispara insights via _generate_match_insights.
CREATE OR REPLACE FUNCTION public.calculate_bolao_scores(p_match_id integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_home_score int;
  v_away_score int;
  v_is_finished boolean;
  v_match_result text;
  v_match_stage text;
  v_updated_count int := 0;
  rec RECORD;
BEGIN
  SELECT home_score, away_score, is_finished, stage
    INTO v_home_score, v_away_score, v_is_finished, v_match_stage
  FROM public.wc_matches WHERE id = p_match_id;

  IF NOT v_is_finished OR v_home_score IS NULL OR v_away_score IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Jogo não finalizado ou sem placar');
  END IF;

  IF v_home_score > v_away_score THEN v_match_result := 'home';
  ELSIF v_away_score > v_home_score THEN v_match_result := 'away';
  ELSE v_match_result := 'draw';
  END IF;

  FOR rec IN
    SELECT bp.id, bp.bolao_id, bp.user_id, bp.predicted_home_score, bp.predicted_away_score,
           b.scoring_exact, b.scoring_result, b.scoring_preset, b.scoring_weights
    FROM public.bolao_predictions bp
    JOIN public.boloes b ON b.id = bp.bolao_id
    WHERE bp.match_id = p_match_id
  LOOP
    DECLARE
      v_pred_result text;
      v_points int := 0;
      v_multiplier numeric := 1.0;
      v_default numeric;
      v_was_exact boolean := false;
      v_was_correct_result boolean := false;
    BEGIN
      IF rec.scoring_preset = 'weighted_stages' THEN
        v_default := CASE v_match_stage
          WHEN 'group'       THEN 1.0
          WHEN 'round_of_32' THEN 1.5
          WHEN 'round_of_16' THEN 1.5
          WHEN 'quarter'     THEN 2.0
          WHEN 'semi'        THEN 3.0
          WHEN 'third_place' THEN 2.0
          WHEN 'final'       THEN 5.0
          ELSE 1.0
        END;
        v_multiplier := COALESCE((rec.scoring_weights ->> v_match_stage)::numeric, v_default);
      END IF;

      IF rec.predicted_home_score > rec.predicted_away_score THEN v_pred_result := 'home';
      ELSIF rec.predicted_away_score > rec.predicted_home_score THEN v_pred_result := 'away';
      ELSE v_pred_result := 'draw';
      END IF;

      IF rec.predicted_home_score = v_home_score AND rec.predicted_away_score = v_away_score THEN
        v_points := ROUND(rec.scoring_exact * v_multiplier);
        v_was_exact := true;
        v_was_correct_result := true;
      ELSIF v_pred_result = v_match_result THEN
        v_points := ROUND(rec.scoring_result * v_multiplier);
        v_was_correct_result := true;
      END IF;

      UPDATE public.bolao_predictions
        SET points_earned = v_points, updated_at = now()
      WHERE id = rec.id;

      v_updated_count := v_updated_count + 1;

      PERFORM public._generate_match_insights(
        rec.bolao_id, rec.user_id, p_match_id, v_was_exact, v_was_correct_result
      );
    END;
  END LOOP;

  RETURN json_build_object('success', true, 'updated', v_updated_count);
END;
$function$;

-- ─── delete_bolao ───────────────────────────────────────────
-- Apaga bolão + cascade manual de filhos. Só dono.
CREATE OR REPLACE FUNCTION public.delete_bolao(p_bolao_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id  uuid;
  v_owner_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT owner_id INTO v_owner_id FROM boloes WHERE id = p_bolao_id;

  IF v_owner_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Bolão não encontrado');
  END IF;

  IF v_owner_id <> v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Apenas o dono pode excluir o bolão');
  END IF;

  DELETE FROM bolao_special_predictions WHERE bolao_id = p_bolao_id;
  DELETE FROM bolao_predictions         WHERE bolao_id = p_bolao_id;
  DELETE FROM bolao_members             WHERE bolao_id = p_bolao_id;
  DELETE FROM boloes                    WHERE id       = p_bolao_id;

  RETURN json_build_object('success', true);
END;
$function$;

-- ─── delete_bolao_prediction ────────────────────────────────
-- Apaga um palpite de placar. Bloqueia se prazo passou.
CREATE OR REPLACE FUNCTION public.delete_bolao_prediction(p_bolao_id uuid, p_match_id integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;

-- ─── get_bolao_ranking ──────────────────────────────────────
-- Ranking geral do bolão (somatório de pontos, exatos, acertos).
CREATE OR REPLACE FUNCTION public.get_bolao_ranking(p_bolao_id uuid)
RETURNS TABLE(user_id uuid, user_name text, user_email text, total_points integer, exact_scores integer, correct_results integer, total_predictions integer, rank bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    bm.user_id,
    COALESCE(u.name, split_part(u.email, '@', 1))::text AS user_name,
    u.email::text AS user_email,
    COALESCE(SUM(bp.points_earned), 0)::int AS total_points,
    COUNT(CASE WHEN bp.points_earned IS NOT NULL AND bp.points_earned >= b.scoring_exact THEN 1 END)::int AS exact_scores,
    COUNT(CASE WHEN bp.points_earned IS NOT NULL AND bp.points_earned = b.scoring_result THEN 1 END)::int AS correct_results,
    COUNT(bp.id)::int AS total_predictions,
    RANK() OVER (ORDER BY COALESCE(SUM(bp.points_earned), 0) DESC) AS rank
  FROM bolao_members bm
  JOIN users u ON u.id = bm.user_id
  JOIN boloes b ON b.id = bm.bolao_id
  LEFT JOIN bolao_predictions bp ON bp.bolao_id = bm.bolao_id AND bp.user_id = bm.user_id
  WHERE bm.bolao_id = p_bolao_id
  GROUP BY bm.user_id, u.name, u.email, b.scoring_exact, b.scoring_result
  ORDER BY total_points DESC, exact_scores DESC, correct_results DESC;
END;
$function$;

-- ─── get_bolao_round_ranking ────────────────────────────────
-- Ranking filtrado por fase (group / R32 / R16 / quarter / semi / final).
CREATE OR REPLACE FUNCTION public.get_bolao_round_ranking(p_bolao_id uuid, p_stage text DEFAULT NULL::text)
RETURNS TABLE(user_id uuid, user_name text, user_email text, total_points bigint, exact_scores bigint, correct_results bigint, total_predictions bigint, rank bigint)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  WITH member_scores AS (
    SELECT
      bp.user_id,
      COALESCE(SUM(bp.points_earned), 0)::bigint AS total_points,
      COUNT(*) FILTER (WHERE bp.points_earned = b.scoring_exact)::bigint AS exact_scores,
      COUNT(*) FILTER (WHERE bp.points_earned = b.scoring_result AND bp.points_earned != b.scoring_exact)::bigint AS correct_results,
      COUNT(*)::bigint AS total_predictions
    FROM bolao_predictions bp
    JOIN boloes b ON b.id = bp.bolao_id
    JOIN wc_matches m ON m.id = bp.match_id
    WHERE bp.bolao_id = p_bolao_id
      AND m.is_finished = true
      AND (p_stage IS NULL OR m.stage = p_stage)
    GROUP BY bp.user_id, b.scoring_exact, b.scoring_result
  ),
  all_members AS (
    SELECT user_id FROM bolao_members WHERE bolao_id = p_bolao_id
  ),
  combined AS (
    SELECT
      am.user_id,
      COALESCE(ms.total_points, 0)::bigint       AS total_points,
      COALESCE(ms.exact_scores, 0)::bigint        AS exact_scores,
      COALESCE(ms.correct_results, 0)::bigint     AS correct_results,
      COALESCE(ms.total_predictions, 0)::bigint   AS total_predictions
    FROM all_members am
    LEFT JOIN member_scores ms ON ms.user_id = am.user_id
  )
  SELECT
    c.user_id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name',
             split_part(u.email, '@', 1)) AS user_name,
    u.email AS user_email,
    c.total_points,
    c.exact_scores,
    c.correct_results,
    c.total_predictions,
    RANK() OVER (ORDER BY c.total_points DESC, c.exact_scores DESC)::bigint AS rank
  FROM combined c
  JOIN auth.users u ON u.id = c.user_id
  WHERE EXISTS (SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = auth.uid())
  ORDER BY rank, c.user_id;
$function$;

-- ─── get_bolao_special_summary ──────────────────────────────
-- Agrupa palpites especiais por tipo + time (consenso do grupo).
CREATE OR REPLACE FUNCTION public.get_bolao_special_summary(p_bolao_id uuid)
RETURNS TABLE(prediction_type text, predicted_team_code text, pick_count bigint)
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT prediction_type, predicted_team_code, COUNT(*) AS pick_count
  FROM bolao_special_predictions
  WHERE bolao_id = p_bolao_id
    AND EXISTS (
      SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = auth.uid()
    )
  GROUP BY prediction_type, predicted_team_code
  ORDER BY prediction_type, pick_count DESC, predicted_team_code;
$function$;

-- ─── get_bolao_stats ────────────────────────────────────────
-- Stats agregados (membros, palpites, exatos, pontos, etc.)
CREATE OR REPLACE FUNCTION public.get_bolao_stats(p_bolao_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_bolao boloes%ROWTYPE;
  v_result json;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = auth.uid()) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_bolao FROM boloes WHERE id = p_bolao_id;
  SELECT json_build_object(
    'total_members',       (SELECT COUNT(*) FROM bolao_members WHERE bolao_id = p_bolao_id),
    'total_predictions',   (SELECT COUNT(*) FROM bolao_predictions WHERE bolao_id = p_bolao_id),
    'distinct_games',      (SELECT COUNT(DISTINCT match_id) FROM bolao_predictions WHERE bolao_id = p_bolao_id),
    'exact_scores',        (SELECT COUNT(*) FROM bolao_predictions WHERE bolao_id = p_bolao_id AND points_earned = v_bolao.scoring_exact),
    'correct_results',     (SELECT COUNT(*) FROM bolao_predictions WHERE bolao_id = p_bolao_id AND points_earned = v_bolao.scoring_result),
    'total_points_awarded',(SELECT COALESCE(SUM(points_earned),0) FROM bolao_predictions WHERE bolao_id = p_bolao_id),
    'finished_games',      (SELECT COUNT(*) FROM wc_matches WHERE is_finished = true),
    'top_team_champion',   (
      SELECT predicted_team_code FROM bolao_special_predictions
      WHERE bolao_id = p_bolao_id AND prediction_type = 'champion'
      GROUP BY predicted_team_code ORDER BY COUNT(*) DESC LIMIT 1
    ),
    'champion_pick_count', (
      SELECT COUNT(DISTINCT user_id) FROM bolao_special_predictions
      WHERE bolao_id = p_bolao_id AND prediction_type = 'champion'
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

-- ─── get_champion_predictions ───────────────────────────────
-- Lista palpites de campeão de todos os membros.
CREATE OR REPLACE FUNCTION public.get_champion_predictions(p_bolao_id uuid)
RETURNS TABLE(user_id uuid, user_name text, predicted_team_code text, points_earned integer, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
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

-- ─── get_my_bolao_insights ──────────────────────────────────
-- Insights do user com info do match (sort: unseen primeiro).
CREATE OR REPLACE FUNCTION public.get_my_bolao_insights(p_bolao_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE(id uuid, match_id integer, type text, payload jsonb, seen boolean, created_at timestamp with time zone, match_home_team text, match_away_team text, match_home_score integer, match_away_score integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    i.id, i.match_id, i.type, i.payload, i.seen, i.created_at,
    m.home_team::text, m.away_team::text, m.home_score, m.away_score
  FROM public.bolao_insights i
  LEFT JOIN public.wc_matches m ON m.id = i.match_id
  WHERE i.bolao_id = p_bolao_id
    AND i.user_id = auth.uid()
  ORDER BY i.seen ASC, i.created_at DESC
  LIMIT p_limit;
END;
$function$;

-- ─── get_my_bolao_personal_stats ────────────────────────────
-- Stats pessoais do user no bolão (totais + evolução + personalidade).
CREATE OR REPLACE FUNCTION public.get_my_bolao_personal_stats(p_bolao_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid;
  v_total_points int;
  v_exact_scores int;
  v_correct_results int;
  v_total_predictions int;
  v_finished_with_pred int;
  v_evolution jsonb;
  v_personality_data jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bolao_members WHERE bolao_id = p_bolao_id AND user_id = v_user_id) THEN
    RETURN json_build_object('error', 'Not a member');
  END IF;

  SELECT
    COALESCE(SUM(bp.points_earned), 0)::int,
    COUNT(*) FILTER (WHERE bp.points_earned IS NOT NULL AND bp.points_earned >= b.scoring_exact)::int,
    COUNT(*) FILTER (WHERE bp.points_earned IS NOT NULL AND bp.points_earned > 0)::int,
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE m.is_finished = true)::int
  INTO v_total_points, v_exact_scores, v_correct_results, v_total_predictions, v_finished_with_pred
  FROM public.bolao_predictions bp
  JOIN public.boloes b ON b.id = bp.bolao_id
  JOIN public.wc_matches m ON m.id = bp.match_id
  WHERE bp.bolao_id = p_bolao_id AND bp.user_id = v_user_id;

  WITH ordered AS (
    SELECT
      m.id AS match_id,
      m.match_date,
      m.match_time_brasilia,
      bp.points_earned,
      m.home_team_code, m.away_team_code,
      m.home_score, m.away_score
    FROM public.bolao_predictions bp
    JOIN public.wc_matches m ON m.id = bp.match_id
    WHERE bp.bolao_id = p_bolao_id
      AND bp.user_id = v_user_id
      AND m.is_finished = true
      AND bp.points_earned IS NOT NULL
    ORDER BY m.match_date, m.match_time_brasilia
  ),
  cumulative AS (
    SELECT
      match_id, match_date, home_team_code, away_team_code, home_score, away_score,
      points_earned,
      SUM(points_earned) OVER (ORDER BY match_date, match_time_brasilia) AS cumulative_points
    FROM ordered
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'match_id', match_id,
    'match_date', match_date,
    'home', home_team_code,
    'away', away_team_code,
    'home_score', home_score,
    'away_score', away_score,
    'points', points_earned,
    'cumulative', cumulative_points
  ) ORDER BY match_date), '[]'::jsonb)
  INTO v_evolution
  FROM cumulative;

  WITH preds AS (
    SELECT
      bp.predicted_home_score,
      bp.predicted_away_score,
      m.home_team_code,
      m.away_team_code
    FROM public.bolao_predictions bp
    JOIN public.wc_matches m ON m.id = bp.match_id
    WHERE bp.bolao_id = p_bolao_id AND bp.user_id = v_user_id
  )
  SELECT json_build_object(
    'total', COUNT(*),
    'draws', COUNT(*) FILTER (WHERE predicted_home_score = predicted_away_score),
    'high_scoring', COUNT(*) FILTER (WHERE predicted_home_score + predicted_away_score >= 4),
    'low_scoring', COUNT(*) FILTER (WHERE predicted_home_score + predicted_away_score <= 1),
    'blowouts', COUNT(*) FILTER (
      WHERE ABS(predicted_home_score - predicted_away_score) >= 3
    ),
    'tight', COUNT(*) FILTER (
      WHERE predicted_home_score <> predicted_away_score
        AND ABS(predicted_home_score - predicted_away_score) = 1
    )
  )::jsonb INTO v_personality_data
  FROM preds;

  RETURN json_build_object(
    'total_points', v_total_points,
    'exact_scores', v_exact_scores,
    'correct_results', v_correct_results,
    'total_predictions', v_total_predictions,
    'finished_with_pred', v_finished_with_pred,
    'accuracy_pct', CASE WHEN v_finished_with_pred > 0
      THEN ROUND((v_correct_results::numeric / v_finished_with_pred::numeric) * 100, 1)
      ELSE 0 END,
    'evolution', v_evolution,
    'personality_data', v_personality_data
  );
END;
$function$;

-- ─── get_my_team_heatmap ────────────────────────────────────
-- Heatmap por time: quantos palpites + acertos pra cada seleção. Premium only.
CREATE OR REPLACE FUNCTION public.get_my_team_heatmap(p_bolao_id uuid)
RETURNS TABLE(team_code text, team_name text, matches_predicted integer, matches_finished integer, exact_scores integer, correct_results integer, total_points integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid;
  v_is_premium boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT is_premium INTO v_is_premium FROM public.boloes WHERE id = p_bolao_id;
  IF NOT COALESCE(v_is_premium, false) THEN RETURN; END IF;

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

-- ─── get_user_boloes ────────────────────────────────────────
-- Lista de bolões do user com stats agregados (ranking, palpites, etc).
CREATE OR REPLACE FUNCTION public.get_user_boloes(p_user_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, name text, description text, invite_code text, is_premium boolean, is_closed boolean, max_participants integer, owner_id uuid, owner_name text, member_count bigint, user_rank integer, user_points integer, user_predictions bigint, pending_predictions bigint, has_champion_prediction boolean, created_at timestamp with time zone, prediction_deadline_mode text, custom_banner_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
BEGIN
  RETURN QUERY
  WITH
    my_boloes AS (
      SELECT b.*
      FROM boloes b
      JOIN bolao_members bm ON bm.bolao_id = b.id AND bm.user_id = v_user_id
      ORDER BY b.created_at DESC
    ),
    member_counts AS (
      SELECT bm.bolao_id, COUNT(*) AS cnt
      FROM bolao_members bm
      WHERE bm.bolao_id IN (SELECT mb.id FROM my_boloes mb)
      GROUP BY bm.bolao_id
    ),
    user_stats AS (
      SELECT
        bp.bolao_id,
        COALESCE(SUM(bp.points_earned), 0)::integer AS total_points,
        COUNT(*) AS pred_count
      FROM bolao_predictions bp
      WHERE bp.user_id = v_user_id
        AND bp.bolao_id IN (SELECT mb.id FROM my_boloes mb)
      GROUP BY bp.bolao_id
    ),
    future_matches AS (
      SELECT COUNT(*) AS cnt
      FROM wc_matches m
      WHERE m.is_finished = false AND m.home_team_code != 'TBD'
    ),
    covered_future AS (
      SELECT bp.bolao_id, COUNT(*) AS cnt
      FROM bolao_predictions bp
      JOIN wc_matches m ON m.id = bp.match_id
      WHERE bp.user_id = v_user_id
        AND bp.bolao_id IN (SELECT mb.id FROM my_boloes mb)
        AND m.is_finished = false
        AND m.home_team_code != 'TBD'
      GROUP BY bp.bolao_id
    ),
    champion_preds AS (
      SELECT sp.bolao_id
      FROM bolao_special_predictions sp
      WHERE sp.user_id = v_user_id
        AND sp.prediction_type = 'champion'
        AND sp.bolao_id IN (SELECT mb.id FROM my_boloes mb)
    ),
    boloes_with_points AS (
      SELECT DISTINCT bp.bolao_id
      FROM bolao_predictions bp
      WHERE bp.bolao_id IN (SELECT mb.id FROM my_boloes mb)
        AND bp.points_earned IS NOT NULL AND bp.points_earned > 0
    ),
    user_ranks AS (
      SELECT
        bwp.bolao_id,
        COALESCE((
          SELECT ranking.rk
          FROM (
            SELECT bm3.user_id,
                   RANK() OVER (ORDER BY COALESCE(SUM(bp2.points_earned), 0) DESC) AS rk
            FROM bolao_members bm3
            LEFT JOIN bolao_predictions bp2
              ON bp2.bolao_id = bm3.bolao_id AND bp2.user_id = bm3.user_id
            WHERE bm3.bolao_id = bwp.bolao_id
            GROUP BY bm3.user_id
          ) ranking
          WHERE ranking.user_id = v_user_id
        ), 1)::integer AS user_rank
      FROM boloes_with_points bwp
    )
  SELECT
    mb.id,
    mb.name,
    mb.description,
    mb.invite_code,
    mb.is_premium,
    mb.is_closed,
    mb.max_participants,
    mb.owner_id,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email)::text AS owner_name,
    COALESCE(mc.cnt, 0)                                             AS member_count,
    COALESCE(ur.user_rank, 1)                                       AS user_rank,
    COALESCE(us.total_points, 0)                                    AS user_points,
    COALESCE(us.pred_count, 0)                                      AS user_predictions,
    ((SELECT cnt FROM future_matches) - COALESCE(cf.cnt, 0))        AS pending_predictions,
    (cp.bolao_id IS NOT NULL)                                       AS has_champion_prediction,
    mb.created_at,
    mb.prediction_deadline_mode,
    mb.custom_banner_url
  FROM my_boloes mb
  LEFT JOIN auth.users u          ON u.id = mb.owner_id
  LEFT JOIN member_counts mc      ON mc.bolao_id = mb.id
  LEFT JOIN user_stats us         ON us.bolao_id = mb.id
  LEFT JOIN covered_future cf     ON cf.bolao_id = mb.id
  LEFT JOIN champion_preds cp     ON cp.bolao_id = mb.id
  LEFT JOIN user_ranks ur         ON ur.bolao_id = mb.id
  ORDER BY mb.created_at DESC;
END;
$function$;

-- ─── get_user_special_predictions ───────────────────────────
-- Palpites especiais (campeão / finalistas / etc) de um user específico.
CREATE OR REPLACE FUNCTION public.get_user_special_predictions(p_bolao_id uuid, p_user_id uuid)
RETURNS TABLE(prediction_type text, predicted_team_code text, points_earned integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
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

-- ─── get_versus_stats ───────────────────────────────────────
-- Comparação 1×1 entre user e oponente. Premium only.
CREATE OR REPLACE FUNCTION public.get_versus_stats(p_bolao_id uuid, p_opponent_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid;
  v_is_premium boolean;
  v_my_stats jsonb;
  v_opp_stats jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN json_build_object('error', 'Not authenticated'); END IF;

  SELECT is_premium INTO v_is_premium FROM public.boloes WHERE id = p_bolao_id;
  IF NOT COALESCE(v_is_premium, false) THEN RETURN json_build_object('error', 'Premium required'); END IF;

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

-- ─── join_bolao_by_code ─────────────────────────────────────
-- Entra no bolão via código de convite. Bloqueia se lotado (Free 20).
CREATE OR REPLACE FUNCTION public.join_bolao_by_code(p_invite_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id      uuid;
  v_bolao_id     uuid;
  v_is_premium   boolean;
  v_is_closed    boolean;
  v_member_count int;
  v_max_free     int := 20;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT b.id, b.is_premium, b.is_closed
    INTO v_bolao_id, v_is_premium, v_is_closed
    FROM boloes b
   WHERE b.invite_code = upper(p_invite_code);

  IF v_bolao_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Bolão não encontrado');
  END IF;

  IF v_is_closed THEN
    RETURN json_build_object('success', false, 'error', 'Inscrições encerradas');
  END IF;

  IF EXISTS (
    SELECT 1 FROM bolao_members m
     WHERE m.bolao_id = v_bolao_id AND m.user_id = v_user_id
  ) THEN
    RETURN json_build_object(
      'success', true,
      'bolao_id', v_bolao_id,
      'already_member', true
    );
  END IF;

  IF NOT COALESCE(v_is_premium, false) THEN
    SELECT COUNT(*) INTO v_member_count
      FROM bolao_members m
     WHERE m.bolao_id = v_bolao_id;
    IF v_member_count >= v_max_free THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Bolão lotado. Free aceita até ' || v_max_free || ' pessoas — peça pro dono fazer upgrade pra Premium.'
      );
    END IF;
  END IF;

  INSERT INTO bolao_members (bolao_id, user_id, role)
    VALUES (v_bolao_id, v_user_id, 'member');

  RETURN json_build_object('success', true, 'bolao_id', v_bolao_id);
END;
$function$;

-- ─── mark_insights_seen ─────────────────────────────────────
-- Marca insights como lidos.
CREATE OR REPLACE FUNCTION public.mark_insights_seen(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.bolao_insights
    SET seen = true
  WHERE id = ANY(p_ids)
    AND user_id = auth.uid();
END;
$function$;

-- ─── remove_bolao_member ────────────────────────────────────
-- Dono remove um membro. Não pode remover a si próprio.
CREATE OR REPLACE FUNCTION public.remove_bolao_member(p_bolao_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM boloes
    WHERE id = p_bolao_id AND owner_id = v_caller
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Apenas o dono pode remover participantes');
  END IF;

  IF p_user_id = v_caller THEN
    RETURN json_build_object('success', false, 'error', 'O dono não pode ser removido');
  END IF;

  DELETE FROM bolao_members
  WHERE bolao_id = p_bolao_id AND user_id = p_user_id;

  RETURN json_build_object('success', true);
END;
$function$;

-- ─── submit_bolao_prediction ────────────────────────────────
-- Submete um palpite de placar. Bloqueia se prazo passou. Valida placar 0-20.
CREATE OR REPLACE FUNCTION public.submit_bolao_prediction(p_bolao_id uuid, p_match_id integer, p_predicted_home_score integer, p_predicted_away_score integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;

-- ─── toggle_bolao_closed ────────────────────────────────────
-- Dono abre / fecha inscrições.
CREATE OR REPLACE FUNCTION public.toggle_bolao_closed(p_bolao_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_new_state boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM boloes
    WHERE id = p_bolao_id AND owner_id = v_caller
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Apenas o dono pode alterar as inscrições');
  END IF;

  UPDATE boloes
  SET is_closed = NOT is_closed
  WHERE id = p_bolao_id
  RETURNING is_closed INTO v_new_state;

  RETURN json_build_object('success', true, 'is_closed', v_new_state);
END;
$function$;

-- ─── update_bolao_deadline_mode ─────────────────────────────
-- Dono altera modo de prazo (per_match, per_day, per_round, per_stage).
CREATE OR REPLACE FUNCTION public.update_bolao_deadline_mode(p_bolao_id uuid, p_mode text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid;
  v_owner_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.boloes WHERE id = p_bolao_id;
  IF v_owner_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Bolão não encontrado');
  END IF;
  IF v_owner_id <> v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Só o dono pode alterar');
  END IF;

  IF p_mode NOT IN ('per_match', 'per_day', 'per_round', 'per_stage') THEN
    RETURN json_build_object('success', false, 'error', 'Modo inválido');
  END IF;

  UPDATE public.boloes
    SET prediction_deadline_mode = p_mode
    WHERE id = p_bolao_id;

  RETURN json_build_object(
    'success', true,
    'prediction_deadline_mode', p_mode
  );
END;
$function$;

-- ─── update_bolao_scoring ───────────────────────────────────
-- Dono altera pontuação (preset + valores + pesos por fase). Premium only.
CREATE OR REPLACE FUNCTION public.update_bolao_scoring(p_bolao_id uuid, p_preset text, p_scoring_result integer DEFAULT NULL::integer, p_scoring_exact integer DEFAULT NULL::integer, p_scoring_weights jsonb DEFAULT NULL::jsonb)
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
  IF NOT EXISTS (SELECT 1 FROM public.boloes WHERE id = p_bolao_id AND is_premium = true) THEN
    RETURN json_build_object('success', false, 'error', 'Premium required');
  END IF;

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
-- Dono altera cor + logo. Premium only.
CREATE OR REPLACE FUNCTION public.update_bolao_theme(p_bolao_id uuid, p_color text DEFAULT NULL::text, p_logo_url text DEFAULT NULL::text)
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
  IF NOT EXISTS (SELECT 1 FROM boloes WHERE id = p_bolao_id AND is_premium = true) THEN
    RETURN json_build_object('success', false, 'error', 'Premium required');
  END IF;
  UPDATE boloes
    SET custom_color    = COALESCE(p_color, custom_color),
        custom_banner_url = COALESCE(p_logo_url, custom_banner_url)
    WHERE id = p_bolao_id;
  RETURN json_build_object('success', true);
END;
$function$;

-- ─── upgrade_bolao_to_premium ───────────────────────────────
-- Upgrade Premium via invite_code (admin / manual via WhatsApp PIX).
-- Webhook Stripe usa caminho diferente (lookup por bolao_id).
CREATE OR REPLACE FUNCTION public.upgrade_bolao_to_premium(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_bolao record;
BEGIN
  SELECT id, name, is_premium, invite_code
  INTO v_bolao
  FROM boloes
  WHERE UPPER(invite_code) = UPPER(p_invite_code);

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bolão não encontrado com código: ' || p_invite_code
    );
  END IF;

  IF v_bolao.is_premium THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Bolão já é Premium',
      'bolao_id', v_bolao.id,
      'name', v_bolao.name
    );
  END IF;

  UPDATE boloes
  SET is_premium = true,
      max_participants = 9999
  WHERE id = v_bolao.id;

  RETURN jsonb_build_object(
    'success', true,
    'bolao_id', v_bolao.id,
    'name', v_bolao.name,
    'invite_code', v_bolao.invite_code,
    'message', 'Bolão "' || v_bolao.name || '" atualizado para Premium!'
  );
END;
$function$;

-- ─── upsert_champion_prediction ─────────────────────────────
-- Substitui o palpite de campeão (DELETE + INSERT).
CREATE OR REPLACE FUNCTION public.upsert_champion_prediction(p_bolao_id uuid, p_team_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Not a member');
  END IF;
  DELETE FROM bolao_special_predictions
    WHERE bolao_id = p_bolao_id AND user_id = v_user_id AND prediction_type = 'champion';
  INSERT INTO bolao_special_predictions (bolao_id, user_id, prediction_type, predicted_team_code)
    VALUES (p_bolao_id, v_user_id, 'champion', p_team_code);
  RETURN json_build_object('success', true);
END;
$function$;
