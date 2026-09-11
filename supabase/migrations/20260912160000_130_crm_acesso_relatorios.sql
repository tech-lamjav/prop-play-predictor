-- 20260912160000_130_crm_acesso_relatorios
--
-- Um quarto produto no acesso dado na mão: os relatórios.
--
-- `users.has_report_access` é uma marca booleana que existe desde antes do CRM,
-- e `use-report-access` consulta ela ANTES de olhar qualquer assinatura. Ou
-- seja: é um caminho de acesso legítimo e independente do Stripe, e a ficha não
-- mostrava nenhum dos dois. Uma conta liberada por essa marca aparecia como
-- "sem acesso" enquanto o produto deixava a pessoa entrar, e foi assim que a
-- tela pareceu não bater com o banco.
--
-- Migration à parte, e não uma edição da 129, porque a 129 pode já estar
-- aplicada. `create or replace` deixa as duas ordens de aplicação darem no
-- mesmo lugar.
--
-- Conferência depois de aplicar, logado como sócio:
--   select public.crm_definir_acesso('<uuid>', 'relatorios', true, null);

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

  -- O produto escolhe um RAMO, e nunca vira nome de coluna. A versão genérica
  -- com `execute format` transformaria "produto" em qualquer coluna da tabela,
  -- `is_socio` inclusive: um sócio comprometido viraria todos os sócios.
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

  elsif p_produto = 'relatorios' then
    -- Marca booleana, e não status: escrever 'premium' aqui seria escrever
    -- texto numa coluna que só entende sim ou não.
    v_nome := 'Relatorios';
    update public.users
      set has_report_access = p_ativo
      where id = p_user_id;

  else
    raise exception 'produto desconhecido: %', p_produto;
  end if;

  if not found then
    raise exception 'pessoa nao encontrada';
  end if;

  insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
  values (p_user_id, 'acesso', v_nome || ': ' || v_quando, (select auth.uid()));
end;
$function$;

comment on function public.crm_definir_acesso(uuid, text, boolean, timestamptz) is
  'Sócio libera ou tira um produto na mão. O produto escolhe um ramo, nunca uma coluna. Registra na linha do tempo.';

revoke execute on function public.crm_definir_acesso(uuid, text, boolean, timestamptz) from public;
grant execute on function public.crm_definir_acesso(uuid, text, boolean, timestamptz) to authenticated;
