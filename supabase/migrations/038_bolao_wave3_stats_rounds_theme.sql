-- ============================================================
-- WAVE 3: Stats, Round Rankings, Color Theme, Logo
-- Applied to staging: 2026-04-15
-- ============================================================

-- 1. get_bolao_stats
CREATE OR REPLACE FUNCTION get_bolao_stats(p_bolao_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bolao boloes%ROWTYPE;
  v_result json;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = auth.uid()) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_bolao FROM boloes WHERE id = p_bolao_id;
  SELECT json_build_object(
    'total_members',        (SELECT COUNT(*) FROM bolao_members WHERE bolao_id = p_bolao_id),
    'total_predictions',    (SELECT COUNT(*) FROM bolao_predictions WHERE bolao_id = p_bolao_id),
    'distinct_games',       (SELECT COUNT(DISTINCT match_id) FROM bolao_predictions WHERE bolao_id = p_bolao_id),
    'exact_scores',         (SELECT COUNT(*) FROM bolao_predictions WHERE bolao_id = p_bolao_id AND points_earned = v_bolao.scoring_exact),
    'correct_results',      (SELECT COUNT(*) FROM bolao_predictions WHERE bolao_id = p_bolao_id AND points_earned = v_bolao.scoring_result),
    'total_points_awarded', (SELECT COALESCE(SUM(points_earned), 0) FROM bolao_predictions WHERE bolao_id = p_bolao_id),
    'finished_games',       (SELECT COUNT(*) FROM wc_matches WHERE is_finished = true),
    'top_team_champion',    (
      SELECT predicted_team_code FROM bolao_special_predictions
      WHERE bolao_id = p_bolao_id AND prediction_type = 'champion'
      GROUP BY predicted_team_code ORDER BY COUNT(*) DESC LIMIT 1
    ),
    'champion_pick_count',  (
      SELECT COUNT(DISTINCT user_id) FROM bolao_special_predictions
      WHERE bolao_id = p_bolao_id AND prediction_type = 'champion'
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$;

-- 2. get_bolao_round_ranking
CREATE OR REPLACE FUNCTION get_bolao_round_ranking(
  p_bolao_id uuid,
  p_stage text DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  user_name text,
  user_email text,
  total_points bigint,
  exact_scores bigint,
  correct_results bigint,
  total_predictions bigint,
  rank bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
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
      COALESCE(ms.total_points, 0)::bigint     AS total_points,
      COALESCE(ms.exact_scores, 0)::bigint      AS exact_scores,
      COALESCE(ms.correct_results, 0)::bigint   AS correct_results,
      COALESCE(ms.total_predictions, 0)::bigint AS total_predictions
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
$$;

-- 3. update_bolao_theme
CREATE OR REPLACE FUNCTION update_bolao_theme(
  p_bolao_id uuid,
  p_color text DEFAULT NULL,
  p_logo_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    SET custom_color      = COALESCE(p_color, custom_color),
        custom_banner_url = COALESCE(p_logo_url, custom_banner_url)
    WHERE id = p_bolao_id;
  RETURN json_build_object('success', true);
END;
$$;
