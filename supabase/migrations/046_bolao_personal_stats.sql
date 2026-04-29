-- ============================================================
-- BOLÃO: Stats pessoais agregadas pra a tab "Você"
-- - get_my_bolao_personal_stats: aggregates + evolution + personality data
-- - get_my_team_heatmap (Premium): % acerto por seleção
-- - get_versus_stats (Premium): comparação 1-a-1 com outro membro
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_bolao_personal_stats(p_bolao_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
  IF v_user_id IS NULL THEN RETURN json_build_object('error', 'Not authenticated'); END IF;

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
    SELECT bp.predicted_home_score, bp.predicted_away_score
    FROM public.bolao_predictions bp
    WHERE bp.bolao_id = p_bolao_id AND bp.user_id = v_user_id
  )
  SELECT json_build_object(
    'total', COUNT(*),
    'draws', COUNT(*) FILTER (WHERE predicted_home_score = predicted_away_score),
    'high_scoring', COUNT(*) FILTER (WHERE predicted_home_score + predicted_away_score >= 4),
    'low_scoring', COUNT(*) FILTER (WHERE predicted_home_score + predicted_away_score <= 1),
    'blowouts', COUNT(*) FILTER (WHERE ABS(predicted_home_score - predicted_away_score) >= 3),
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
$$;

GRANT EXECUTE ON FUNCTION public.get_my_bolao_personal_stats(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_team_heatmap(p_bolao_id uuid)
RETURNS TABLE (
  team_code text,
  team_name text,
  matches_predicted int,
  matches_finished int,
  exact_scores int,
  correct_results int,
  total_points int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
      ac.code, ac.name,
      bp.points_earned, m.is_finished, b.scoring_exact
    FROM all_codes ac
    JOIN public.wc_matches m ON (m.home_team_code = ac.code OR m.away_team_code = ac.code)
    JOIN public.bolao_predictions bp ON bp.match_id = m.id AND bp.user_id = v_user_id AND bp.bolao_id = p_bolao_id
    JOIN public.boloes b ON b.id = bp.bolao_id
  )
  SELECT
    ip.code::text, ip.name::text,
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE ip.is_finished)::int,
    COUNT(*) FILTER (WHERE ip.is_finished AND ip.points_earned >= ip.scoring_exact)::int,
    COUNT(*) FILTER (WHERE ip.is_finished AND ip.points_earned > 0)::int,
    COALESCE(SUM(ip.points_earned), 0)::int
  FROM involved_predictions ip
  GROUP BY ip.code, ip.name
  ORDER BY total_points DESC, exact_scores DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_team_heatmap(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_versus_stats(p_bolao_id uuid, p_opponent_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.get_versus_stats(uuid, uuid) TO authenticated;
