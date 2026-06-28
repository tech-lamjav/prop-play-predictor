-- ============================================================
-- 072_special_deadline_knockout_real — prazo do bracket no modo "times reais"
-- ============================================================
-- Quando o bolão liga `knockout_real_predictions_enabled` (chaveamento com times
-- reais), o bracket de QUEM AVANÇA (16 avos → finalistas) trava de uma vez, no
-- início do mata-mata (1º jogo dos 16 avos). É uma janela curta: o jogador
-- preenche quem avança em cada fase até a final antes do mata-mata começar.
-- O CAMPEÃO fica de fora — o pessoal já escolheu no início, então mantém o
-- prazo próprio dele (preset/override normais).
--
-- Só altera o helper central `special_prediction_deadline`; os 5 RPCs que gating
-- os especiais (toggle/bracket_advance/champion/…) já o consultam, então passam
-- a respeitar a janela automaticamente. Sem o flag, comportamento é idêntico ao
-- da migration 064 (override → preset rolling/opening). Mirror client em
-- src/components/bolao/special-deadlines.ts (param knockoutRealMode).
-- ============================================================
CREATE OR REPLACE FUNCTION public.special_prediction_deadline(p_bolao_id uuid, p_type text)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg jsonb;
  v_override text;
  v_mode text;
  v_stage text;
  v_deadline timestamptz;
  v_knockout_real boolean;
BEGIN
  SELECT special_deadlines, COALESCE(knockout_real_predictions_enabled, false)
    INTO v_cfg, v_knockout_real
    FROM boloes WHERE id = p_bolao_id;

  -- 1) Override explícito por tipo vence tudo.
  v_override := v_cfg -> 'overrides' ->> p_type;
  IF v_override IS NOT NULL AND v_override <> '' THEN
    RETURN v_override::timestamptz;
  END IF;

  -- 1.5) Modo "chaveamento com times reais": o bracket de quem avança (16 avos →
  --      finalistas) trava no início do mata-mata (1º jogo dos 16 avos). O
  --      campeão NÃO entra aqui — segue o prazo próprio (preset/override).
  IF v_knockout_real AND p_type IN
       ('round_of_32','round_of_16','quarterfinalist','semifinalist','finalist') THEN
    SELECT min((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_deadline FROM wc_matches WHERE stage = 'round_of_32';
    RETURN v_deadline;
  END IF;

  v_mode := COALESCE(v_cfg ->> 'mode', 'rolling');

  -- 2) Preset "opening": tudo fecha na abertura da Copa.
  IF v_mode = 'opening' THEN
    SELECT min((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_deadline FROM wc_matches;
    RETURN v_deadline;
  END IF;

  -- 3) Preset "rolling" (padrão): trava no início da rodada que decide o tipo.
  v_stage := CASE p_type
    WHEN 'round_of_32'     THEN 'round_of_32'
    WHEN 'round_of_16'     THEN 'round_of_32'
    WHEN 'quarterfinalist' THEN 'round_of_16'
    WHEN 'semifinalist'    THEN 'quarter'
    WHEN 'finalist'        THEN 'semi'
    WHEN 'champion'        THEN 'final'
    ELSE NULL  -- prêmios de jogador → abertura da Copa
  END;

  IF v_stage IS NULL THEN
    SELECT min((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_deadline FROM wc_matches;
  ELSE
    SELECT min((match_date + match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo')
      INTO v_deadline FROM wc_matches WHERE stage = v_stage;
  END IF;
  RETURN v_deadline;
END;
$function$;
