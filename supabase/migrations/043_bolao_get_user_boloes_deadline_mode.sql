-- ============================================================
-- BOLÃO: expor prediction_deadline_mode em get_user_boloes
-- Onda 1 — Deadline visibility (badge na home precisa do modo).
-- ============================================================

-- DROP necessário porque o RETURNS TABLE muda (nova coluna no fim).
DROP FUNCTION IF EXISTS public.get_user_boloes(uuid);

CREATE OR REPLACE FUNCTION public.get_user_boloes(p_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, name text, description text, invite_code text, is_premium boolean, is_closed boolean, max_participants integer, owner_id uuid, owner_name text, member_count bigint, user_rank integer, user_points integer, user_predictions bigint, pending_predictions bigint, has_champion_prediction boolean, created_at timestamp with time zone, prediction_deadline_mode text)
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
    mb.prediction_deadline_mode
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

GRANT EXECUTE ON FUNCTION public.get_user_boloes(uuid) TO authenticated;
