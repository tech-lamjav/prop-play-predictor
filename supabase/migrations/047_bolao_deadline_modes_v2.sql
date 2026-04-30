-- ============================================================
-- BOLÃO: Prediction deadline modes — V2
-- ----------------------------------------------------------------
-- Adds 2 new modes and renames the legacy 'per_round' (which actually
-- meant "by stage") to 'per_stage' to free 'per_round' for its real
-- meaning (a round of matches inside the group stage: R1/R2/R3).
--
-- Final values:
--   per_match  — each match has its own deadline (= kickoff)
--   per_day    — first kickoff of the day defines the deadline
--                for all matches of that day
--   per_round  — group stage: matches grouped in R1/R2/R3 (each
--                round = 24 matches across all 12 groups). Knockout
--                stages: each round (round_of_32, etc) is its own
--                round.
--   per_stage  — group stage = single deadline for all 72 matches.
--                Knockout stages: each stage (round_of_32, etc) =
--                its own deadline.
--   tournament_start — kept as legacy. Hidden in UI but preserved
--                in DB for backward-compat.
--
-- Default for new bolões is now 'per_round'.
-- ============================================================

-- 1. Migrate existing 'per_round' (legacy meaning: by stage) → 'per_stage'
--    BEFORE swapping the CHECK constraint, otherwise the UPDATE would
--    violate the new constraint or vice-versa.
ALTER TABLE public.boloes
  DROP CONSTRAINT IF EXISTS boloes_prediction_deadline_mode_check;

UPDATE public.boloes
  SET prediction_deadline_mode = 'per_stage'
  WHERE prediction_deadline_mode = 'per_round';

-- 2. New constraint with all 5 values
ALTER TABLE public.boloes
  ADD CONSTRAINT boloes_prediction_deadline_mode_check
    CHECK (prediction_deadline_mode IN (
      'per_match',
      'per_day',
      'per_round',
      'per_stage',
      'tournament_start'
    ));

-- 3. Update default to 'per_round' for new bolões
ALTER TABLE public.boloes
  ALTER COLUMN prediction_deadline_mode SET DEFAULT 'per_round';

COMMENT ON COLUMN public.boloes.prediction_deadline_mode IS
  'When predictions close. per_match (kickoff), per_day (first kickoff of the day), per_round (group: R1/R2/R3, knockout: each stage), per_stage (group: all together, knockout: each stage), tournament_start (legacy, first kickoff of the Cup).';

-- 4. Update get_prediction_deadline with new logic
CREATE OR REPLACE FUNCTION public.get_prediction_deadline(
  p_bolao_id uuid,
  p_match_id int
) RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
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

  -- per_match: kickoff do próprio jogo
  IF v_mode = 'per_match' THEN
    SELECT (match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo'
      INTO v_deadline
    FROM public.wc_matches WHERE id = p_match_id;

  -- per_day: primeiro kickoff do dia
  ELSIF v_mode = 'per_day' THEN
    SELECT match_date INTO v_match_date
    FROM public.wc_matches WHERE id = p_match_id;
    IF v_match_date IS NULL THEN RETURN NULL; END IF;
    SELECT MIN((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_deadline
    FROM public.wc_matches
    WHERE match_date = v_match_date;

  -- per_round: rodada (group: R1/R2/R3 cronológico; knockout: cada stage)
  ELSIF v_mode = 'per_round' THEN
    SELECT stage INTO v_stage
    FROM public.wc_matches WHERE id = p_match_id;
    IF v_stage IS NULL THEN RETURN NULL; END IF;

    IF v_stage = 'group' THEN
      -- Identifica qual rodada (1, 2, 3) baseado no índice cronológico
      -- do match dentro do grupo
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

      -- Pega o menor kickoff da rodada inteira
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

  -- per_stage: a fase inteira (group = tudo junto; knockout = cada stage)
  ELSIF v_mode = 'per_stage' THEN
    SELECT stage INTO v_stage
    FROM public.wc_matches WHERE id = p_match_id;
    IF v_stage IS NULL THEN RETURN NULL; END IF;
    SELECT MIN((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_deadline
    FROM public.wc_matches
    WHERE stage = v_stage;

  -- tournament_start: primeiro kickoff da Copa (legacy)
  ELSIF v_mode = 'tournament_start' THEN
    SELECT MIN((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_deadline
    FROM public.wc_matches;
  END IF;

  RETURN v_deadline;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_prediction_deadline(uuid, int) TO authenticated;

-- 5. Update update_bolao_deadline_mode RPC pra aceitar os novos valores
--    (depende da implementação atual; recriamos apenas se a constraint
--    em PL/pgSQL precisar ser relaxada)
CREATE OR REPLACE FUNCTION public.update_bolao_deadline_mode(
  p_bolao_id uuid,
  p_mode text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.update_bolao_deadline_mode(uuid, text) TO authenticated;
