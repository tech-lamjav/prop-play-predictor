-- ============================================================
-- Sync prod ↔ staging — get_my_special_predictions faltante + overload morto
-- ============================================================
-- Diagnóstico (staging × prod): produção divergiu do staging porque várias
-- mudanças de RPC do bolão foram aplicadas direto no banco de staging e nunca
-- viraram migration. O frontend (já em prod) chama `get_my_special_predictions`
-- — função que existe SÓ no staging, em nenhuma migration. Em prod a leitura
-- falha → a tela de Palpites Especiais nunca mostra os palpites do usuário
-- (finalistas travados em 0/2, sem coroa no campeão).
--
-- A 044 (liberar Premium) consertou a ESCRITA (toggle_special_prediction). Esta
-- migration conserta a LEITURA, criando a função que faltava.
--
-- + Limpeza: prod tem um overload morto de update_bolao_scoring (4 args, sem
--   p_scoring_weights) que ficou com o check Premium e nunca foi substituído
--   pela 044. O frontend SEMPRE manda os 5 args (p_scoring_weights ?? null),
--   então esse overload nunca é chamado — mas dropamos pra evitar ambiguidade
--   de resolução no PostgREST e remover código bloqueado.
-- ============================================================

-- ─── get_my_special_predictions ─────────────────────────────
-- Lê os palpites especiais do próprio usuário (auth.uid()) num bolão.
-- Usado por useMySpecialPredictions → desenha finalistas/semis/quartas/mata-mata.
-- Versão canônica do staging, endurecida com search_path + tabela qualificada.
CREATE OR REPLACE FUNCTION public.get_my_special_predictions(p_bolao_id uuid)
RETURNS TABLE(prediction_type text, predicted_team_code text, points_earned integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT prediction_type, predicted_team_code, points_earned
  FROM public.bolao_special_predictions
  WHERE bolao_id = p_bolao_id AND user_id = auth.uid()
  ORDER BY prediction_type, predicted_team_code;
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_special_predictions(uuid) TO authenticated;

-- ─── DROP overload morto de update_bolao_scoring ────────────
-- A versão correta (com p_scoring_weights jsonb) permanece, já liberada pela 044.
DROP FUNCTION IF EXISTS public.update_bolao_scoring(uuid, text, integer, integer);
