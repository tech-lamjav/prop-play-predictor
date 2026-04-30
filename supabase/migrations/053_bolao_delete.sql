-- ============================================================
-- Bolão: RPC para deletar um bolão (apenas dono)
-- ============================================================
-- Apaga em cascata: predictions, special_predictions, members, e a row
-- de boloes. SECURITY DEFINER porque precisa bypassar RLS pra remover
-- linhas dos outros membros (predictions/specials de outros usuários
-- naquele bolão).
--
-- Validações:
--   - usuário autenticado
--   - bolão existe
--   - usuário é o dono (owner_id)
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_bolao(p_bolao_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id  uuid;
  v_owner_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT owner_id INTO v_owner_id
    FROM boloes
   WHERE id = p_bolao_id;

  IF v_owner_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Bolão não encontrado');
  END IF;

  IF v_owner_id <> v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Apenas o dono pode excluir o bolão');
  END IF;

  -- Cascade manual (não dependemos de ON DELETE CASCADE estar setado)
  DELETE FROM bolao_special_predictions WHERE bolao_id = p_bolao_id;
  DELETE FROM bolao_predictions         WHERE bolao_id = p_bolao_id;
  DELETE FROM bolao_members             WHERE bolao_id = p_bolao_id;
  DELETE FROM boloes                    WHERE id       = p_bolao_id;

  RETURN json_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_bolao(uuid) TO authenticated;
