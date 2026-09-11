-- 20260913160000_132_crm_encerrar_por_plano
--
-- Encerrar uma assinatura manual tira só o que AQUELE plano deu.
--
-- A versão da 131 lia o plano da linha, guardava em `v_plano` e nunca usava a
-- variável: o ramo de quem não tem Stripe zerava betinho, futebol e analytics
-- de uma vez. A variável sem leitor era a pista.
--
-- O estrago: a escada é cumulativa, então cada plano concedeu um conjunto
-- diferente, e os interruptores por produto existem justamente para dar um
-- produto solto por fora de plano nenhum. Encerrar um "Entrada" apagava o
-- futebol e as análises que tinham vindo de outro lugar, e o sócio via dois
-- acessos sumirem sem ter pedido.
--
-- ⚠️ A escada continua sendo a mesma de `shared/concessoes.ts`, e continua
-- escrita duas vezes por necessidade de runtime. O guarda de
-- `crm-assinatura-migration.test.ts` lê os dois arquivos e cobra que a CONCESSÃO
-- não divirja; os ramos de saída aqui são o espelho dela.
--
-- Conferência depois de aplicar, logado como sócio:
--   select public.crm_encerrar_assinatura_manual('<uuid da concessao>');

create or replace function public.crm_encerrar_assinatura_manual(p_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_plano text;
  v_tem_stripe boolean;
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  update public.crm_assinatura_manual
    set encerrada_em = now(), encerrada_por = (select auth.uid())
    where id = p_id and encerrada_em is null
    returning user_id, plano into v_user_id, v_plano;

  if v_user_id is null then
    raise exception 'assinatura nao encontrada ou ja encerrada';
  end if;

  select u.stripe_subscription_id is not null into v_tem_stripe
    from public.users u where u.id = v_user_id;

  -- Quem passou a pagar de verdade fica com o acesso. A assinatura manual
  -- acabou, mas a do Stripe é outra coisa, e derrubar as duas juntas tiraria o
  -- produto de quem está pagando por ele.
  if v_tem_stripe then
    insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
    values (
      v_user_id,
      'acesso',
      'Assinatura manual encerrada. O acesso segue pela assinatura do Stripe.',
      (select auth.uid())
    );
    return;
  end if;

  -- O tipo do plano sai sempre: ele descreve a assinatura que acabou de acabar.
  update public.users set subscription_product_type = null where id = v_user_id;

  -- E cada plano tira só o que ele mesmo deu.
  if v_plano = 'entrada' then
    update public.users
      set betinho_subscription_status = 'free',
          betinho_subscription_period_end = null
      where id = v_user_id;

  elsif v_plano = 'essencial' then
    update public.users
      set futebol_subscription_status = 'free',
          betinho_subscription_status = 'free',
          betinho_subscription_period_end = null
      where id = v_user_id;

  elsif v_plano = 'completo' then
    update public.users
      set futebol_subscription_status = 'free',
          betinho_subscription_status = 'free',
          analytics_subscription_status = 'free',
          betinho_subscription_period_end = null,
          analytics_subscription_period_end = null
      where id = v_user_id;

  else
    -- Plano que a tabela aceitou e esta função não conhece. Levanta em vez de
    -- passar calado: o `check` da tabela e esta escada precisam andar juntos, e
    -- um `else` silencioso deixaria a pessoa com o acesso de uma assinatura que
    -- a tela já está mostrando como encerrada.
    raise exception 'plano desconhecido ao encerrar: %', v_plano;
  end if;

  insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
  values (v_user_id, 'acesso', 'Assinatura manual encerrada', (select auth.uid()));
end;
$function$;

comment on function public.crm_encerrar_assinatura_manual(uuid) is
  'Encerra uma assinatura manual e tira SO o que aquele plano deu. Quem tem assinatura no Stripe mantem o acesso.';

revoke execute on function public.crm_encerrar_assinatura_manual(uuid) from public;
grant execute on function public.crm_encerrar_assinatura_manual(uuid) to authenticated;
