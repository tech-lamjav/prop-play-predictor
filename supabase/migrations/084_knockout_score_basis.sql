-- ============================================================
-- 084_knockout_score_basis — placar do mata-mata: com prorrogação ou só 90'
-- ============================================================
-- Caso real (bolão do Kadu, 12/07): o dono combinou com os membros que o
-- placar válido era o do TEMPO NORMAL (90 min), mas o sistema pontua com o
-- placar final (prorrogação inclusa; empate só quando decidido nos pênaltis).
-- Ex.: Argentina 1×1 Suíça nos 90' → 3×1 na prorrogação. Quem apostou empate
-- estava certo no critério combinado e levou 0.
--
-- Solução: base de placar POR BOLÃO.
--   'full'       → placar final (com prorrogação; pênaltis nunca contam) — atual.
--   'regulation' → placar dos 90 minutos (fulltime_home/away, capturados pela
--                  ingestão desde a migration 078). Prorrogação vira empate.
-- Vale só pro mata-mata (grupos não têm prorrogação). O "quem avança" não
-- muda (usa o vencedor real, winner_team_code). Recalculável e idempotente.
-- ============================================================

ALTER TABLE public.boloes
  ADD COLUMN IF NOT EXISTS knockout_score_basis text NOT NULL DEFAULT 'full';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'boloes_knockout_score_basis_check'
  ) THEN
    ALTER TABLE public.boloes
      ADD CONSTRAINT boloes_knockout_score_basis_check
      CHECK (knockout_score_basis IN ('full', 'regulation'));
  END IF;
END $$;

COMMENT ON COLUMN public.boloes.knockout_score_basis IS
  'Placar que vale no mata-mata: full = com prorrogação (default); regulation = só os 90 minutos (fulltime_*).';

-- ── calculate_bolao_scores v2 — base de placar por bolão ────
-- Igual à v1 (040), com uma diferença: cada bolão pontua contra o placar da
-- SUA base. Fallback seguro: se fulltime_* ainda não veio da ingestão, usa o
-- placar final (comportamento antigo).
CREATE OR REPLACE FUNCTION public.calculate_bolao_scores(p_match_id integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_home_score int;
  v_away_score int;
  v_ft_home int;
  v_ft_away int;
  v_is_finished boolean;
  v_match_stage text;
  v_updated_count int := 0;
  rec RECORD;
BEGIN
  SELECT home_score, away_score, fulltime_home, fulltime_away, is_finished, stage
    INTO v_home_score, v_away_score, v_ft_home, v_ft_away, v_is_finished, v_match_stage
  FROM public.wc_matches WHERE id = p_match_id;

  IF NOT v_is_finished OR v_home_score IS NULL OR v_away_score IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Jogo não finalizado ou sem placar');
  END IF;

  FOR rec IN
    SELECT bp.id, bp.bolao_id, bp.user_id, bp.predicted_home_score, bp.predicted_away_score,
           b.scoring_exact, b.scoring_result, b.scoring_preset, b.scoring_weights,
           COALESCE(b.knockout_score_basis, 'full') AS score_basis
    FROM public.bolao_predictions bp
    JOIN public.boloes b ON b.id = bp.bolao_id
    WHERE bp.match_id = p_match_id
  LOOP
    DECLARE
      v_eff_home int;
      v_eff_away int;
      v_match_result text;
      v_pred_result text;
      v_points int := 0;
      v_multiplier numeric := 1.0;
      v_default numeric;
      v_was_exact boolean := false;
      v_was_correct_result boolean := false;
    BEGIN
      -- placar efetivo pra ESTE bolão
      IF rec.score_basis = 'regulation' AND v_match_stage <> 'group'
         AND v_ft_home IS NOT NULL AND v_ft_away IS NOT NULL THEN
        v_eff_home := v_ft_home;
        v_eff_away := v_ft_away;
      ELSE
        v_eff_home := v_home_score;
        v_eff_away := v_away_score;
      END IF;

      IF v_eff_home > v_eff_away THEN v_match_result := 'home';
      ELSIF v_eff_away > v_eff_home THEN v_match_result := 'away';
      ELSE v_match_result := 'draw';
      END IF;

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

      IF rec.predicted_home_score = v_eff_home AND rec.predicted_away_score = v_eff_away THEN
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

-- ── recalc_finished_ko_scores — recalcula o mata-mata inteiro ─
-- Chamado pelo painel admin quando o dono troca a base de placar. Recalcula
-- TODOS os bolões (calculate é determinístico por bolão; quem não mudou de
-- base recebe os mesmos pontos). Idempotente.
CREATE OR REPLACE FUNCTION public.recalc_finished_ko_scores()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id FROM wc_matches
           WHERE stage <> 'group' AND is_finished = true
             AND home_score IS NOT NULL AND away_score IS NOT NULL LOOP
    PERFORM calculate_bolao_scores(r.id);
    n := n + 1;
  END LOOP;
  RETURN json_build_object('success', true, 'jogos', n);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.recalc_finished_ko_scores() TO authenticated, service_role;
