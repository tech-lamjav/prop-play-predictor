-- ============================================================
-- 075_resolve_special_scores — pontua o "quem avança" + soma no ranking
-- ============================================================
-- Credita os pontos dos palpites especiais de QUEM AVANÇA, com o modelo
-- "fecha a fase, então pontua":
--   - Uma fase só é pontuada quando está 100% decidida (nenhum TBD na rodada).
--   - Mapa fase→stage: round_of_16=oitavas, quarterfinalist=quartas,
--     semifinalist=semis, finalist=final, round_of_32=16 avos. Um time "alcançou
--     a fase X" se aparece como mandante/visitante em algum jogo do stage X.
--   - Campeão: decidido quando a final encerra (wc_matches.winner_team_code).
--   - Por MODO do bolão: real → oitavas..campeão (round_of_32 é vestigial, não
--     pontua); projeção → inclui round_of_32 ("acertou os classificados").
--   - Lê a config de pontos NA HORA (special_predictions_points / champion_points)
--     → dono pode ajustar os pontos de uma fase até ela fechar. Recalculável.
-- Prêmios de jogador continuam no resolve_player_awards (migration 052).
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_special_scores(p_bolao_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_real boolean; v_cfg jsonb; v_pts jsonb; v_champ_pts int;
  v_special_enabled boolean; v_champ_enabled boolean;
  v_types text[]; v_t text; v_stage text; v_determined boolean; v_pt int;
  v_champion text;
BEGIN
  SELECT COALESCE(knockout_real_predictions_enabled, false),
         COALESCE(special_predictions_config, '{}'::jsonb),
         COALESCE(special_predictions_points, '{}'::jsonb),
         COALESCE(champion_points, 0),
         COALESCE(special_predictions_enabled, true),
         COALESCE(champion_enabled, true)
    INTO v_real, v_cfg, v_pts, v_champ_pts, v_special_enabled, v_champ_enabled
    FROM boloes WHERE id = p_bolao_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Bolão não encontrado'); END IF;

  -- Tipos a pontuar conforme o modo
  IF v_real THEN
    v_types := ARRAY['round_of_16','quarterfinalist','semifinalist','finalist'];
  ELSE
    v_types := ARRAY['round_of_32','round_of_16','quarterfinalist','semifinalist','finalist'];
  END IF;

  IF v_special_enabled THEN
    FOREACH v_t IN ARRAY v_types LOOP
      -- respeita a config de habilitado da fase (default true)
      CONTINUE WHEN COALESCE((v_cfg ->> v_t)::boolean, true) = false;

      v_stage := CASE v_t
        WHEN 'round_of_32' THEN 'round_of_32' WHEN 'round_of_16' THEN 'round_of_16'
        WHEN 'quarterfinalist' THEN 'quarter' WHEN 'semifinalist' THEN 'semi'
        WHEN 'finalist' THEN 'final' END;

      -- fase 100% decidida? (existe e nenhum TBD)
      SELECT EXISTS (SELECT 1 FROM wc_matches WHERE stage = v_stage)
         AND NOT EXISTS (SELECT 1 FROM wc_matches WHERE stage = v_stage
                           AND (home_team_code = 'TBD' OR away_team_code = 'TBD'))
        INTO v_determined;
      CONTINUE WHEN NOT v_determined;

      v_pt := COALESCE((v_pts ->> v_t)::int, 0);

      UPDATE bolao_special_predictions sp
      SET points_earned = CASE WHEN sp.predicted_team_code IN (
            SELECT home_team_code FROM wc_matches WHERE stage = v_stage AND home_team_code <> 'TBD'
            UNION
            SELECT away_team_code FROM wc_matches WHERE stage = v_stage AND away_team_code <> 'TBD'
          ) THEN v_pt ELSE 0 END
      WHERE sp.bolao_id = p_bolao_id AND sp.prediction_type = v_t;
    END LOOP;
  END IF;

  -- Campeão: decidido quando a final encerra (vencedor real setado)
  IF v_champ_enabled THEN
    SELECT winner_team_code INTO v_champion
      FROM wc_matches WHERE stage = 'final' AND is_finished = true AND winner_team_code IS NOT NULL
      LIMIT 1;
    IF v_champion IS NOT NULL THEN
      UPDATE bolao_special_predictions sp
      SET points_earned = CASE WHEN sp.predicted_team_code = v_champion THEN v_champ_pts ELSE 0 END
      WHERE sp.bolao_id = p_bolao_id AND sp.prediction_type = 'champion';
    END IF;
  END IF;

  RETURN json_build_object('success', true);
END;
$function$;

-- Recomputa todos os bolões (gancho do cron + recompute manual após ajustar pontos)
CREATE OR REPLACE FUNCTION public.resolve_all_special_scores()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id FROM boloes
           WHERE COALESCE(special_predictions_enabled, true) OR COALESCE(champion_enabled, true) LOOP
    PERFORM resolve_special_scores(r.id);
    n := n + 1;
  END LOOP;
  RETURN json_build_object('success', true, 'boloes', n);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_special_scores(uuid) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_all_special_scores()  TO service_role;

-- ── Ranking passa a somar placar + especiais ────────────────
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
    (COALESCE(SUM(bp.points_earned), 0) + COALESCE(MAX(sp.special_pts), 0))::int AS total_points,
    COUNT(CASE WHEN bp.points_earned IS NOT NULL AND bp.points_earned >= b.scoring_exact THEN 1 END)::int AS exact_scores,
    COUNT(CASE WHEN bp.points_earned IS NOT NULL AND bp.points_earned = b.scoring_result THEN 1 END)::int AS correct_results,
    COUNT(bp.id)::int AS total_predictions,
    RANK() OVER (ORDER BY (COALESCE(SUM(bp.points_earned), 0) + COALESCE(MAX(sp.special_pts), 0)) DESC) AS rank
  FROM bolao_members bm
  JOIN users u ON u.id = bm.user_id
  JOIN boloes b ON b.id = bm.bolao_id
  LEFT JOIN auth.users au ON au.id = bm.user_id
  LEFT JOIN bolao_predictions bp ON bp.bolao_id = bm.bolao_id AND bp.user_id = bm.user_id
  LEFT JOIN (
    -- alias explícito: a função tem um OUT param `user_id`, então a coluna
    -- precisa ser qualificada (bsp.) e renomeada (uid) pra não dar ambiguidade.
    SELECT bsp.user_id AS uid, COALESCE(SUM(bsp.points_earned), 0) AS special_pts
    FROM bolao_special_predictions bsp
    WHERE bsp.bolao_id = p_bolao_id
    GROUP BY bsp.user_id
  ) sp ON sp.uid = bm.user_id
  WHERE bm.bolao_id = p_bolao_id
  GROUP BY bm.user_id, u.name, u.email, au.raw_user_meta_data, b.scoring_exact, b.scoring_result
  ORDER BY total_points DESC, exact_scores DESC, correct_results DESC;
END;
$function$;
