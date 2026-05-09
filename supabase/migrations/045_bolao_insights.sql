-- ============================================================
-- BOLÃO: insights pós-jogo
-- Tabela onde insights gerados pelo scoring são gravados pra serem
-- consumidos na UI (banner). Cada user vê os seus + insights do bolão.
--
-- Tipos de insight (campo type):
--   exact_score_lonely  — user cravou placar exato e <30% do bolão também
--   majority_wrong      — >70% errou e user acertou
--   rare_correct        — user é 1 de N (≤3) que cravaram placar exato
--   rank_jumped_up      — subiu N posições no ranking
--   streak_3 / streak_5 — N acertos seguidos (resultado correto)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bolao_insights (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bolao_id    uuid NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
  -- user_id NULL = insight do bolão inteiro (todos veem)
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id    integer REFERENCES public.wc_matches(id) ON DELETE SET NULL,
  type        text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  seen        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bolao_insights_user_unseen
  ON public.bolao_insights (user_id, seen, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bolao_insights_bolao
  ON public.bolao_insights (bolao_id, created_at DESC);

-- RLS: só o dono do insight (user_id = auth.uid()) ou insights públicos
-- (user_id NULL) do bolão onde o user é membro.
ALTER TABLE public.bolao_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_or_public_insights" ON public.bolao_insights
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      user_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.bolao_members bm
        WHERE bm.bolao_id = bolao_insights.bolao_id
          AND bm.user_id = auth.uid()
      )
    )
  );

-- Sem INSERT/UPDATE policy — escrita só via RPC SECURITY DEFINER

-- ============================================================
-- Augment calculate_bolao_scores: depois de calcular pontos,
-- gera insights baseados na performance dos members.
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_bolao_scores(p_match_id integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

      -- Generate insights for this user/match
      PERFORM public._generate_match_insights(
        rec.bolao_id, rec.user_id, p_match_id, v_was_exact, v_was_correct_result
      );
    END;
  END LOOP;

  RETURN json_build_object('success', true, 'updated', v_updated_count);
END;
$$;

-- ============================================================
-- Helper interno: gera insights pra um user específico após save
-- de um match. Roda dentro de calculate_bolao_scores no loop.
-- ============================================================

CREATE OR REPLACE FUNCTION public._generate_match_insights(
  p_bolao_id uuid,
  p_user_id uuid,
  p_match_id integer,
  p_was_exact boolean,
  p_was_correct_result boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_total_predictions int;
  v_exact_count int;
  v_correct_count int;
BEGIN
  -- Quantas pessoas no bolão palpitaram esse jogo
  SELECT COUNT(*)
    INTO v_total_predictions
  FROM public.bolao_predictions
  WHERE bolao_id = p_bolao_id AND match_id = p_match_id;

  IF v_total_predictions <= 1 THEN RETURN; END IF; -- precisa de comparação

  -- Insight: cravou placar enquanto poucos cravaram
  IF p_was_exact THEN
    SELECT COUNT(*)
      INTO v_exact_count
    FROM public.bolao_predictions
    WHERE bolao_id = p_bolao_id AND match_id = p_match_id
      AND predicted_home_score = (SELECT home_score FROM public.wc_matches WHERE id = p_match_id)
      AND predicted_away_score = (SELECT away_score FROM public.wc_matches WHERE id = p_match_id);

    -- Raro: 1-3 pessoas cravaram, e user é uma delas
    IF v_exact_count <= 3 THEN
      INSERT INTO public.bolao_insights (bolao_id, user_id, match_id, type, payload)
      VALUES (
        p_bolao_id, p_user_id, p_match_id, 'rare_correct',
        json_build_object('exact_count', v_exact_count, 'total_predictions', v_total_predictions)
      );
    -- Solitário: <30% cravou
    ELSIF v_exact_count::float / v_total_predictions::float < 0.3 THEN
      INSERT INTO public.bolao_insights (bolao_id, user_id, match_id, type, payload)
      VALUES (
        p_bolao_id, p_user_id, p_match_id, 'exact_score_lonely',
        json_build_object('exact_count', v_exact_count, 'total_predictions', v_total_predictions,
                          'percentage', ROUND((v_exact_count::float / v_total_predictions::float) * 100))
      );
    END IF;
  END IF;

  -- Insight: maioria errou, user acertou (resultado, não exato)
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

    -- >70% errou
    IF v_correct_count::float / v_total_predictions::float < 0.3 THEN
      INSERT INTO public.bolao_insights (bolao_id, user_id, match_id, type, payload)
      VALUES (
        p_bolao_id, p_user_id, p_match_id, 'majority_wrong',
        json_build_object('correct_count', v_correct_count, 'total_predictions', v_total_predictions,
                          'wrong_percentage', ROUND((1.0 - v_correct_count::float / v_total_predictions::float) * 100))
      );
    END IF;
  END IF;

  -- Insight: streak de 3 ou 5 acertos consecutivos (resultado correto)
  IF p_was_correct_result THEN
    DECLARE
      v_streak int := 0;
      v_streak_match_ids integer[];
    BEGIN
      -- Conta backwards: jogos finalizados ordenados por data desc, parando no primeiro erro
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

      -- Detecta streak ininterrupta. Simplificação: se top N tem todos > 0, é streak.
      -- (Implementação ideal seria com window functions, mas suficiente pra MVP.)
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
$$;

-- ============================================================
-- RPC: get_my_bolao_insights — retorna insights do user (não vistos primeiro)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_bolao_insights(
  p_bolao_id uuid,
  p_limit int DEFAULT 10
) RETURNS TABLE (
  id uuid,
  match_id integer,
  type text,
  payload jsonb,
  seen boolean,
  created_at timestamptz,
  match_home_team text,
  match_away_team text,
  match_home_score int,
  match_away_score int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.get_my_bolao_insights(uuid, int) TO authenticated;

-- ============================================================
-- RPC: mark_insights_seen
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_insights_seen(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.bolao_insights
    SET seen = true
  WHERE id = ANY(p_ids)
    AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_insights_seen(uuid[]) TO authenticated;
