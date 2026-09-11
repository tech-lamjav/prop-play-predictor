-- 20260912100000_129_crm_acesso_manual
--
-- Sócio dando acesso na mão, pela ficha do CRM.
--
-- Esta é a primeira ESCRITA do CRM na tabela de usuários: até aqui o sócio só
-- lia. É de longe a migration mais perigosa do conjunto, porque as colunas
-- mexidas aqui são as mesmas que o webhook do Stripe escreve, e são elas que
-- decidem quem entra no produto.
--
-- Por isso NADA aqui é genérico. A função não recebe nome de coluna; recebe um
-- produto de uma lista curta e decide sozinha o que mexer. A versão genérica
-- seria uma linha mais curta e diria assim:
--
--   execute format('update public.users set %I = $1 where id = $2', p_coluna);
--
-- Com ela, "produto" passa a ser QUALQUER coluna da tabela de usuários, e a
-- primeira que alguém escolheria é `is_socio`. Um sócio comprometido viraria
-- todos os sócios. A escada de `if` abaixo é feia e é a escolha certa.
--
-- ⚠️ O acesso dado aqui vale até o Stripe falar sobre aquela pessoa, e aí ele
-- vence. É assim de propósito: se o CRM ganhasse do webhook, um clique errado
-- daqui viraria assinatura eterna de graça. A tela avisa o sócio disso.
--
-- Conferência depois de aplicar, logado como sócio:
--   select public.crm_definir_acesso('<uuid>', 'betinho', true, now() + interval '30 days');
--   select public.crm_definir_teste_do_futebol('<uuid>', true);

-- ── A linha do tempo ganha um quarto tipo ───────────────────────────────────
-- As duas funções abaixo gravam `tipo = 'acesso'`, e o check da migration 123 só
-- conhece três. Sem soltar a restrição, toda concessão falharia no ÚLTIMO passo,
-- depois de já ter mexido no acesso da pessoa: acesso trocado e nenhum registro
-- dizendo quem trocou, que é o pior dos dois mundos.
alter table public.crm_anotacao drop constraint if exists crm_anotacao_tipo_check;
alter table public.crm_anotacao add constraint crm_anotacao_tipo_check
  check (tipo in ('anotacao', 'feedback', 'objecao', 'acesso'));

-- ── Acesso a um produto ─────────────────────────────────────────────────────
create or replace function public.crm_definir_acesso(
  p_user_id uuid,
  p_produto text,
  p_ativo boolean,
  p_ate timestamptz
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_status text := case when p_ativo then 'premium' else 'free' end;
  v_nome text;
  v_quando text := case
    when not p_ativo then 'tirou'
    when p_ate is null then 'liberou sem prazo'
    else 'liberou ate ' || to_char(p_ate, 'DD/MM/YYYY')
  end;
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  -- O produto escolhe um RAMO, e nunca vira nome de coluna.
  if p_produto = 'betinho' then
    v_nome := 'Betinho';
    update public.users
      set betinho_subscription_status = v_status,
          betinho_subscription_period_end = case when p_ativo then p_ate else null end
      where id = p_user_id;

  elsif p_produto = 'analises' then
    v_nome := 'Analises';
    update public.users
      set analytics_subscription_status = v_status,
          analytics_subscription_period_end = case when p_ativo then p_ate else null end
      where id = p_user_id;

  elsif p_produto = 'futebol' then
    -- O futebol não tem coluna de prazo. Está documentado em
    -- `shared/concessoes.ts`, e a tela avisa que aqui não se marca data.
    v_nome := 'Futebol';
    update public.users
      set futebol_subscription_status = v_status
      where id = p_user_id;

  else
    raise exception 'produto desconhecido: %', p_produto;
  end if;

  if not found then
    raise exception 'pessoa nao encontrada';
  end if;

  -- Dar acesso na mão é decisão comercial, e daqui a três meses alguém vai
  -- perguntar por que aquela pessoa tem o Completo sem nunca ter pago. A
  -- resposta fica na mesma linha do tempo do resto da conversa.
  insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
  values (p_user_id, 'acesso', v_nome || ': ' || v_quando, (select auth.uid()));
end;
$function$;

comment on function public.crm_definir_acesso(uuid, text, boolean, timestamptz) is
  'Sócio libera ou tira um produto na mão. O produto escolhe um ramo, nunca uma coluna. Registra na linha do tempo.';

revoke execute on function public.crm_definir_acesso(uuid, text, boolean, timestamptz) from public;
grant execute on function public.crm_definir_acesso(uuid, text, boolean, timestamptz) to authenticated;

-- ── O teste gratuito do futebol ─────────────────────────────────────────────
-- Função à parte, e não um quarto produto da de cima: o teste NÃO é status de
-- assinatura, é um carimbo de início de onde se contam sete dias. Escrever
-- `futebol_subscription_status = 'premium'` daria acesso para sempre com cara
-- de teste, e ninguém descobriria olhando a tela.
create or replace function public.crm_definir_teste_do_futebol(
  p_user_id uuid,
  p_ligado boolean
)
returns timestamptz
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_inicio timestamptz := case when p_ligado then now() else null end;
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  update public.users
    set futebol_trial_started_at = v_inicio
    where id = p_user_id;

  if not found then
    raise exception 'pessoa nao encontrada';
  end if;

  insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
  values (
    p_user_id,
    'acesso',
    case when p_ligado then 'Teste do futebol: comecou hoje' else 'Teste do futebol: encerrado' end,
    (select auth.uid())
  );

  return v_inicio;
end;
$function$;

comment on function public.crm_definir_teste_do_futebol(uuid, boolean) is
  'Começa ou encerra o teste gratuito de 7 dias do futebol. Mexe no carimbo de início, nunca no status.';

revoke execute on function public.crm_definir_teste_do_futebol(uuid, boolean) from public;
grant execute on function public.crm_definir_teste_do_futebol(uuid, boolean) to authenticated;
