-- ============================================================
-- get_bolao_ranking: nome completo em vez do handle do e-mail
-- ============================================================
-- Antes: COALESCE(u.name, split_part(u.email,'@',1)) — quando o
-- public.users.name estava vazio, caía no handle do e-mail ("mtexcrippa",
-- "lucas.z.gava"). A imagem de compartilhamento e a tabela usam o mesmo campo,
-- então ambas ficavam com o handle.
--
-- Agora a fonte do nome é, em ordem:
--   1. public.users.name (preenchido no cadastro)
--   2. auth.users.raw_user_meta_data->>'full_name'  (OAuth/metadata)
--   3. auth.users.raw_user_meta_data->>'name'
--   4. handle do e-mail FORMATADO (ponto/underscore viram espaço + initcap)
--      — último recurso, ainda melhor que o handle cru.
--
-- Mesmo padrão de nome que as outras RPCs de especiais (migration 040) já usam
-- via auth.users. A função é SECURITY DEFINER, então enxerga auth.users.
-- ============================================================

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
    COALESCE(
      NULLIF(TRIM(u.name), ''),
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name',
      INITCAP(REPLACE(REPLACE(split_part(u.email, '@', 1), '.', ' '), '_', ' '))
    )::text AS user_name,
    u.email::text AS user_email,
    COALESCE(SUM(bp.points_earned), 0)::int AS total_points,
    COUNT(CASE WHEN bp.points_earned IS NOT NULL AND bp.points_earned >= b.scoring_exact THEN 1 END)::int AS exact_scores,
    COUNT(CASE WHEN bp.points_earned IS NOT NULL AND bp.points_earned = b.scoring_result THEN 1 END)::int AS correct_results,
    COUNT(bp.id)::int AS total_predictions,
    RANK() OVER (ORDER BY COALESCE(SUM(bp.points_earned), 0) DESC) AS rank
  FROM bolao_members bm
  JOIN users u ON u.id = bm.user_id
  JOIN boloes b ON b.id = bm.bolao_id
  LEFT JOIN auth.users au ON au.id = bm.user_id
  LEFT JOIN bolao_predictions bp ON bp.bolao_id = bm.bolao_id AND bp.user_id = bm.user_id
  WHERE bm.bolao_id = p_bolao_id
  GROUP BY bm.user_id, u.name, u.email, au.raw_user_meta_data, b.scoring_exact, b.scoring_result
  ORDER BY total_points DESC, exact_scores DESC, correct_results DESC;
END;
$function$;
