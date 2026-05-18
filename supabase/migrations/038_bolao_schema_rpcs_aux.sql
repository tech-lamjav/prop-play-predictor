-- ============================================================
-- BOLÃO COPA 2026 — Schema baseline (2/5): RPCs auxiliares
-- ============================================================
-- 3 funções utilitárias usadas pelas policies e por outras RPCs.
-- Precisam estar criadas ANTES de 036_7 (RLS), porque
-- get_user_bolao_ids() é referenciado em quase todas as policies.
-- ============================================================

-- ─── get_user_bolao_ids ─────────────────────────────────────
-- Retorna os bolao_ids dos quais o user é membro. Centraliza a
-- regra "user pode ver seus bolões e os bolões em que está".
CREATE OR REPLACE FUNCTION public.get_user_bolao_ids(p_user_id uuid DEFAULT auth.uid())
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT bolao_id FROM public.bolao_members WHERE user_id = p_user_id;
$function$;

-- ─── get_prediction_deadline ────────────────────────────────
-- Calcula o prazo de palpite pra uma partida baseado no modo
-- escolhido pelo dono do bolão:
--   per_match        — kickoff do próprio jogo
--   per_day          — primeiro kickoff do dia
--   per_round        — primeiro kickoff da rodada (grupo: R1/R2/R3; mata-mata: cada stage)
--   per_stage        — primeiro kickoff da fase inteira
--   tournament_start — primeiro kickoff da Copa (legacy)
CREATE OR REPLACE FUNCTION public.get_prediction_deadline(
  p_bolao_id uuid,
  p_match_id integer
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_mode text;
  v_stage text;
  v_match_date date;
  v_round_num int;
  v_deadline timestamptz;
BEGIN
  SELECT prediction_deadline_mode INTO v_mode
  FROM public.boloes WHERE id = p_bolao_id;
  IF v_mode IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_mode = 'per_match' THEN
    SELECT (match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo'
      INTO v_deadline
    FROM public.wc_matches WHERE id = p_match_id;

  ELSIF v_mode = 'per_day' THEN
    SELECT match_date INTO v_match_date
    FROM public.wc_matches WHERE id = p_match_id;
    IF v_match_date IS NULL THEN RETURN NULL; END IF;
    SELECT MIN((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_deadline
    FROM public.wc_matches
    WHERE match_date = v_match_date;

  ELSIF v_mode = 'per_round' THEN
    SELECT stage INTO v_stage
    FROM public.wc_matches WHERE id = p_match_id;
    IF v_stage IS NULL THEN RETURN NULL; END IF;

    IF v_stage = 'group' THEN
      -- Group stage: identifica rodada (1, 2, 3) por índice cronológico no grupo
      WITH ranked AS (
        SELECT
          m.id,
          m.match_date,
          m.match_time_brasilia,
          ROW_NUMBER() OVER (
            PARTITION BY m.group_name
            ORDER BY m.match_date, m.match_time_brasilia
          ) AS idx
        FROM public.wc_matches m
        WHERE m.stage = 'group'
      )
      SELECT
        CASE
          WHEN idx <= 2 THEN 1
          WHEN idx <= 4 THEN 2
          ELSE 3
        END
        INTO v_round_num
      FROM ranked
      WHERE id = p_match_id;

      WITH ranked AS (
        SELECT
          m.match_date,
          m.match_time_brasilia,
          CASE
            WHEN ROW_NUMBER() OVER (
              PARTITION BY m.group_name
              ORDER BY m.match_date, m.match_time_brasilia
            ) <= 2 THEN 1
            WHEN ROW_NUMBER() OVER (
              PARTITION BY m.group_name
              ORDER BY m.match_date, m.match_time_brasilia
            ) <= 4 THEN 2
            ELSE 3
          END AS round_num
        FROM public.wc_matches m
        WHERE m.stage = 'group'
      )
      SELECT MIN((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
        INTO v_deadline
      FROM ranked
      WHERE round_num = v_round_num;
    ELSE
      -- Knockout: cada stage é uma rodada própria
      SELECT MIN((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
        INTO v_deadline
      FROM public.wc_matches
      WHERE stage = v_stage;
    END IF;

  ELSIF v_mode = 'per_stage' THEN
    SELECT stage INTO v_stage
    FROM public.wc_matches WHERE id = p_match_id;
    IF v_stage IS NULL THEN RETURN NULL; END IF;
    SELECT MIN((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_deadline
    FROM public.wc_matches
    WHERE stage = v_stage;

  ELSIF v_mode = 'tournament_start' THEN
    SELECT MIN((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_deadline
    FROM public.wc_matches;
  END IF;

  RETURN v_deadline;
END;
$function$;

-- ─── _generate_match_insights ───────────────────────────────
-- Internal: dispara insights pós-cálculo de pontos (rare_correct,
-- exact_score_lonely, majority_wrong, streak_3, streak_5).
-- Chamada por calculate_bolao_scores depois de cada UPDATE de points.
CREATE OR REPLACE FUNCTION public._generate_match_insights(
  p_bolao_id uuid,
  p_user_id uuid,
  p_match_id integer,
  p_was_exact boolean,
  p_was_correct_result boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_total_predictions int;
  v_exact_count int;
  v_correct_count int;
BEGIN
  SELECT COUNT(*)
    INTO v_total_predictions
  FROM public.bolao_predictions
  WHERE bolao_id = p_bolao_id AND match_id = p_match_id;

  IF v_total_predictions <= 1 THEN RETURN; END IF;

  IF p_was_exact THEN
    SELECT COUNT(*)
      INTO v_exact_count
    FROM public.bolao_predictions
    WHERE bolao_id = p_bolao_id AND match_id = p_match_id
      AND predicted_home_score = (SELECT home_score FROM public.wc_matches WHERE id = p_match_id)
      AND predicted_away_score = (SELECT away_score FROM public.wc_matches WHERE id = p_match_id);

    IF v_exact_count <= 3 THEN
      INSERT INTO public.bolao_insights (bolao_id, user_id, match_id, type, payload)
      VALUES (
        p_bolao_id, p_user_id, p_match_id, 'rare_correct',
        json_build_object('exact_count', v_exact_count, 'total_predictions', v_total_predictions)
      );
    ELSIF v_exact_count::float / v_total_predictions::float < 0.3 THEN
      INSERT INTO public.bolao_insights (bolao_id, user_id, match_id, type, payload)
      VALUES (
        p_bolao_id, p_user_id, p_match_id, 'exact_score_lonely',
        json_build_object('exact_count', v_exact_count, 'total_predictions', v_total_predictions,
                          'percentage', ROUND((v_exact_count::float / v_total_predictions::float) * 100))
      );
    END IF;
  END IF;

  IF p_was_correct_result AND NOT p_was_exact THEN
    SELECT COUNT(*)
      INTO v_correct_count
    FROM public.bolao_predictions bp
    JOIN public.wc_matches m ON m.id = bp.match_id
    WHERE bp.bolao_id = p_bolao_id AND bp.match_id = p_match_id
      AND (
        (bp.predicted_home_score > bp.predicted_away_score AND m.home_score > m.away_score)
        OR (bp.predicted_away_score > bp.predicted_home_score AND m.away_score > m.home_score)
        OR (bp.predicted_home_score = bp.predicted_away_score AND m.home_score = m.away_score)
      );

    IF v_correct_count::float / v_total_predictions::float < 0.3 THEN
      INSERT INTO public.bolao_insights (bolao_id, user_id, match_id, type, payload)
      VALUES (
        p_bolao_id, p_user_id, p_match_id, 'majority_wrong',
        json_build_object('correct_count', v_correct_count, 'total_predictions', v_total_predictions,
                          'wrong_percentage', ROUND((1.0 - v_correct_count::float / v_total_predictions::float) * 100))
      );
    END IF;
  END IF;

  IF p_was_correct_result THEN
    DECLARE
      v_streak int := 0;
    BEGIN
      SELECT COUNT(*)
        INTO v_streak
      FROM (
        SELECT bp.points_earned, m.match_date, m.match_time_brasilia
        FROM public.bolao_predictions bp
        JOIN public.wc_matches m ON m.id = bp.match_id
        WHERE bp.user_id = p_user_id
          AND bp.bolao_id = p_bolao_id
          AND m.is_finished = true
          AND bp.points_earned IS NOT NULL
        ORDER BY m.match_date DESC, m.match_time_brasilia DESC
      ) recent
      WHERE recent.points_earned > 0;

      IF v_streak >= 5 THEN
        INSERT INTO public.bolao_insights (bolao_id, user_id, match_id, type, payload)
        VALUES (p_bolao_id, p_user_id, p_match_id, 'streak_5',
                json_build_object('streak', v_streak));
      ELSIF v_streak >= 3 THEN
        INSERT INTO public.bolao_insights (bolao_id, user_id, match_id, type, payload)
        VALUES (p_bolao_id, p_user_id, p_match_id, 'streak_3',
                json_build_object('streak', v_streak));
      END IF;
    END;
  END IF;
END;
$function$;
