-- ============================================================
-- B3 — delete_bolao com cascade completo + transação atômica
-- ============================================================
-- Bug do PR #140 review: a versão anterior do delete_bolao fazia DELETE manual
-- em 4 tabelas (special_predictions, predictions, members, boloes) sem
-- BEGIN/EXCEPTION. Se um DELETE intermediário falhasse, o estado ficava
-- inconsistente (membros/palpites apagados mas bolão preservado).
--
-- Além disso, não cobria bolao_insights e bolao_subscriptions.
--
-- Fix:
--   - Confia no FK cascade (já configurado no baseline):
--     * bolao_members         ON DELETE CASCADE
--     * bolao_predictions     ON DELETE CASCADE
--     * bolao_special_predictions ON DELETE CASCADE
--     * bolao_insights        ON DELETE CASCADE
--     * bolao_subscriptions   ON DELETE SET NULL (preserva histórico contábil)
--   - Wrap em BEGIN...EXCEPTION pra rollback atômico em caso de erro
--   - Em caso de falha, retorna JSON com erro descritivo em vez de propagar exception
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

  -- Bloco atômico: se o DELETE falhar (ex: FK orphan inesperado, constraint
  -- check, etc.), faz rollback automático do bloco e retorna erro estruturado
  -- em vez de propagar exception pro client (RLS / RPC ficaria broken).
  BEGIN
    -- DELETE em boloes dispara CASCADE em tudo que tem FK CASCADE,
    -- e SET NULL em bolao_subscriptions.bolao_id.
    DELETE FROM boloes WHERE id = p_bolao_id;

    RETURN json_build_object('success', true);

  EXCEPTION WHEN OTHERS THEN
    -- Log no postgres log + retorno estruturado
    RAISE WARNING '[delete_bolao] Falha excluindo % (user %): %',
      p_bolao_id, v_user_id, SQLERRM;
    RETURN json_build_object(
      'success', false,
      'error', 'Erro ao excluir: ' || SQLERRM
    );
  END;
END;
$function$;
