-- ============================================================
-- Bolão: Free pode ter até 20 participantes (era 10)
-- ============================================================
-- Premium continua ilimitado. A diferença entre Free e Premium
-- agora é APENAS quantidade de participantes — todas as features
-- (pontuação custom, multiplicador por fase, palpites especiais,
--  identidade visual, destaques) são liberadas em Free também.
--
-- Substitui a função `join_bolao_by_code` que enforça o limite.
-- ============================================================

CREATE OR REPLACE FUNCTION public.join_bolao_by_code(p_invite_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id      uuid;
  v_bolao_id     uuid;
  v_is_premium   boolean;
  v_is_closed    boolean;
  v_member_count int;
  v_max_free     int := 20;  -- Era 10. Premium continua sem limite.
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT b.id, b.is_premium, b.is_closed
    INTO v_bolao_id, v_is_premium, v_is_closed
    FROM boloes b
   WHERE b.invite_code = upper(p_invite_code);

  IF v_bolao_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Bolão não encontrado');
  END IF;

  IF v_is_closed THEN
    RETURN json_build_object('success', false, 'error', 'Inscrições encerradas');
  END IF;

  -- Já é membro? short-circuit (idempotente)
  IF EXISTS (
    SELECT 1 FROM bolao_members m
     WHERE m.bolao_id = v_bolao_id AND m.user_id = v_user_id
  ) THEN
    RETURN json_build_object(
      'success', true,
      'bolao_id', v_bolao_id,
      'already_member', true
    );
  END IF;

  -- Limite só pra Free
  IF NOT COALESCE(v_is_premium, false) THEN
    SELECT COUNT(*) INTO v_member_count
      FROM bolao_members m
     WHERE m.bolao_id = v_bolao_id;
    IF v_member_count >= v_max_free THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Bolão lotado. Free aceita até ' || v_max_free || ' pessoas — peça pro dono fazer upgrade pra Premium.'
      );
    END IF;
  END IF;

  INSERT INTO bolao_members (bolao_id, user_id, role)
    VALUES (v_bolao_id, v_user_id, 'member');

  RETURN json_build_object('success', true, 'bolao_id', v_bolao_id);
END;
$function$;
