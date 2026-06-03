-- ============================================================
-- M4 — resolve_player_awards: settlement dos prêmios de jogador
-- ============================================================
-- Lê os vencedores oficiais em wc_player_awards e grava points_earned nos
-- palpites de jogador de TODOS os bolões, respeitando o peso de cada bolão
-- (boloes.player_award_points). Idempotente: recalcula tudo a cada chamada.
--
-- Disparada após a final: pelo job de topscorers (artilheiro automático) e/ou
-- pela mini-tela de admin (prêmios de júri). Só pontua prêmios que já têm
-- winner_player_id definido.
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_player_awards()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_scored int := 0;
BEGIN
  UPDATE public.bolao_special_predictions bsp
     SET points_earned = CASE
           WHEN bsp.predicted_player_id = wpa.winner_player_id
             THEN COALESCE((b.player_award_points ->> bsp.prediction_type)::int, 0)
           ELSE 0
         END
    FROM public.wc_player_awards wpa
    JOIN public.boloes b ON true
   WHERE bsp.prediction_type = wpa.award_type
     AND wpa.winner_player_id IS NOT NULL
     AND b.id = bsp.bolao_id;

  GET DIAGNOSTICS v_scored = ROW_COUNT;
  RETURN json_build_object('success', true, 'scored', v_scored);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_player_awards() TO service_role;
