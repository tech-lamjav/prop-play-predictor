-- ============================================================
-- get_bolao_round_ranking: nome completo (igual ao ranking geral)
-- ============================================================
-- A aba Estatísticas usa get_bolao_round_ranking (ranking por fase). Ela só
-- juntava auth.users e resolvia o nome por
--   COALESCE(raw_user_meta_data->>'full_name', ->>'name', handle do e-mail)
-- — sem consultar public.users.name. Pra cadastros por e-mail (sem full_name no
-- metadata) isso caía no handle do e-mail, divergindo do ranking geral (que após
-- a 067 usa public.users.name).
--
-- Alinha à mesma cadeia da 067:
--   public.users.name → auth full_name → auth name → handle do e-mail formatado.
-- ============================================================

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
    COALESCE(
      NULLIF(TRIM(pu.name), ''),
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      INITCAP(REPLACE(REPLACE(split_part(u.email, '@', 1), '.', ' '), '_', ' '))
    ) AS user_name,
    u.email AS user_email,
    c.total_points,
    c.exact_scores,
    c.correct_results,
    c.total_predictions,
    RANK() OVER (ORDER BY c.total_points DESC, c.exact_scores DESC)::bigint AS rank
  FROM combined c
  JOIN auth.users u ON u.id = c.user_id
  LEFT JOIN public.users pu ON pu.id = c.user_id
  WHERE EXISTS (SELECT 1 FROM bolao_members WHERE bolao_id = p_bolao_id AND user_id = auth.uid())
  ORDER BY rank, c.user_id;
$function$;
