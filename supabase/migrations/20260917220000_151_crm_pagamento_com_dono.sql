-- 20260917220000_151_crm_pagamento_com_dono
--
-- O pai de um pagamento passa a ser a PESSOA, e o CRM abre espaço para o
-- dinheiro do Stripe.
--
-- Esta migration não entrega nada visível. Ela é o expand da ADR 0004: depois
-- dela o webhook pode gravar pagamento, e antes dela não podia.
--
-- ## O que estava no caminho
--
-- A 141 fez `assinatura_id` obrigatório e apontando para a assinatura MANUAL.
-- Enquanto o CRM só registrava Pix isso estava certo: todo pagamento pertencia
-- a um acordo feito na mão. Um pagamento do Stripe não tem esse pai, e nunca
-- vai ter — a assinatura do gateway mora nas colunas de `users` que o webhook
-- mantém, e não nesta tabela.
--
-- A pessoa é o pai que as telas de fato querem, porque a pergunta que elas
-- respondem é "quanto ESTA PESSOA já pagou".
--
-- ## ⚠️ O índice de competência passa a valer só para a origem manual
--
-- A 141 proíbe dois pagamentos não estornados no mesmo mês de competência. Para
-- assinatura manual isso é a regra certa: "pagou setembro" é um fato que
-- acontece uma vez.
--
-- O Stripe pode cobrar duas vezes no mesmo mês e as duas serem legítimas — é o
-- que acontece numa troca de plano com proporcional. Manter o índice como está
-- faria o banco RECUSAR a segunda fatura, e o webhook perderia dinheiro de
-- verdade em silêncio. Por isso o índice ganha `assinatura_id is not null`, e a
-- unicidade do lado do Stripe passa a ser pelo identificador da fatura, que é
-- único no mundo.
--
-- ## ⚠️ A situação crua do Stripe NÃO mora nas colunas de acesso
--
-- As colunas `*_subscription_status` por produto são PORTÃO: o site lê elas
-- para decidir quem entra, e elas só entendem `premium` e `free`. Escrever
-- `past_due` ali daria acesso a quem não deveria ter, ou tiraria de quem
-- deveria — mexer nelas seria mexer em quem tem acesso, e esta migration não
-- faz isso.
--
-- A `subscription_status` da 009 também não serve: a restrição dela aceita só
-- `free`, `premium` e `disabled`, ou seja, recusaria justamente o `past_due`
-- que é o motivo de tudo isto existir. Ela continua parada, sem escritor, como
-- está desde 2025.
--
-- Por isso: coluna nova, ao lado de `stripe_customer_id` e
-- `stripe_subscription_id`, guardando o que o gateway relatou, sem restrição de
-- valores — quem define a lista é o Stripe, e uma restrição nossa quebraria no
-- dia em que ele criar um estado novo.

-- ── O dono do pagamento ─────────────────────────────────────────────────────
-- Em três passos, e não em um: `add column ... not null` numa tabela que já tem
-- linhas falha de cara, porque as linhas existentes não têm valor.
alter table public.crm_pagamento
  add column if not exists user_id uuid references public.users(id) on delete cascade;

update public.crm_pagamento p
   set user_id = a.user_id
  from public.crm_assinatura_manual a
 where p.assinatura_id = a.id
   and p.user_id is null;

-- Se sobrar linha sem dono, este comando derruba a migration — e é o que se
-- quer. Pagamento órfão é dinheiro sem pessoa, e seguir em frente esconderia
-- isso até alguém somar receita e não bater.
alter table public.crm_pagamento
  alter column user_id set not null;

comment on column public.crm_pagamento.user_id is
  'De quem e o dinheiro. E o pai do pagamento: a pergunta que as telas fazem e quanto ESTA PESSOA ja pagou.';

-- ── A assinatura manual vira vínculo opcional ───────────────────────────────
-- Continua obrigatória para a origem manual, mas agora pela regra do índice, e
-- não pela coluna: pagamento do Stripe não tem acordo feito na mão.
alter table public.crm_pagamento
  alter column assinatura_id drop not null;

comment on column public.crm_pagamento.assinatura_id is
  'O acordo feito na mao a que este pagamento pertence. NULO quer dizer origem Stripe: la nao existe assinatura manual.';

-- ── O identificador da fatura do Stripe ─────────────────────────────────────
alter table public.crm_pagamento
  add column if not exists stripe_invoice_id text;

comment on column public.crm_pagamento.stripe_invoice_id is
  'A fatura do Stripe que gerou este pagamento. E o que garante que a mesma fatura entre UMA vez, mesmo com o webhook reentregando o evento.';

-- Único e parcial: o Stripe reentrega evento de propósito, e sem isto a mesma
-- fatura entraria duas vezes e o total inflaria sozinho. Parcial porque o lado
-- manual não tem fatura, e vários nulos não podem colidir entre si.
create unique index if not exists idx_crm_pagamento_fatura_unica
  on public.crm_pagamento(stripe_invoice_id)
  where stripe_invoice_id is not null;

-- ── O mês único passa a valer só para a origem manual ───────────────────────
drop index if exists public.idx_crm_pagamento_mes_unico;

create unique index if not exists idx_crm_pagamento_mes_unico
  on public.crm_pagamento(assinatura_id, competencia)
  where estornado_em is null and assinatura_id is not null;

-- Buscar os pagamentos de uma pessoa passa a ser a leitura mais comum das
-- telas, porque a ficha soma as duas origens.
create index if not exists idx_crm_pagamento_pessoa
  on public.crm_pagamento(user_id, competencia desc);

-- ── A situação crua relatada pelo Stripe ────────────────────────────────────
alter table public.users
  add column if not exists stripe_subscription_status text;

comment on column public.users.stripe_subscription_status is
  'O que o Stripe relatou por ultimo: active, trialing, past_due, canceled, unpaid, incomplete. Cru, sem achatar. NAO e portao de acesso: quem decide acesso sao as colunas por produto, que so entendem premium e free.';

-- ── Registrar pagamento passa a gravar o dono ───────────────────────────────
-- Redefinida por uma razão só: o `insert` precisa preencher `user_id`, que
-- agora é obrigatório. Sem isto a migration sobe e o primeiro Pix lançado pela
-- tela quebra. O resto do corpo é o da 142, sem mudança de comportamento.
create or replace function public.crm_registrar_pagamento(
  p_assinatura_id uuid,
  p_competencia date,
  p_valor numeric,
  p_origem text,
  p_pago_em date default current_date
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_user_id uuid;
  v_plano text;
  v_vence_em date;
  v_vitalicio boolean;
  v_mes date := date_trunc('month', p_competencia)::date;
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  if p_valor is null or p_valor <= 0 then
    raise exception 'valor invalido';
  end if;

  select a.user_id, a.plano, a.vence_em, a.vence_em is null
    into v_user_id, v_plano, v_vence_em, v_vitalicio
    from public.crm_assinatura_manual a
   where a.id = p_assinatura_id and a.encerrada_em is null;

  if v_user_id is null then
    raise exception 'assinatura nao encontrada ou ja encerrada';
  end if;

  insert into public.crm_pagamento
    (user_id, assinatura_id, competencia, valor, origem, pago_em, criada_por)
  values
    (v_user_id, p_assinatura_id, v_mes, p_valor, p_origem, coalesce(p_pago_em, current_date),
     (select auth.uid()))
  returning id into v_id;

  /*
   * O acesso anda um mês para frente, a partir do MAIOR entre o vencimento
   * atual e o fim do mês pago: quem paga adiantado não perde o que já tinha, e
   * quem paga atrasado não ganha um mês extra por ter atrasado.
   *
   * ⚠️ Vitalício continua vitalício. Ele paga e o registro do pagamento fica;
   * o que não acontece é ganhar uma data de fim que ele não tinha.
   */
  if not v_vitalicio then
    update public.crm_assinatura_manual
      set vence_em = greatest(vence_em, (v_mes + interval '1 month' - interval '1 day')::date)
      where id = p_assinatura_id
      returning vence_em into v_vence_em;
  end if;

  -- O acesso do produto acompanha, seguindo a mesma escada da 131. Em
  -- vitalício, `v_vence_em` é nulo e as colunas de prazo ficam nulas também.
  if v_plano = 'entrada' then
    update public.users
      set betinho_subscription_status = 'premium', betinho_subscription_period_end = v_vence_em
      where id = v_user_id;
  elsif v_plano = 'essencial' then
    update public.users
      set futebol_subscription_status = 'premium',
          betinho_subscription_status = 'premium',
          betinho_subscription_period_end = v_vence_em
      where id = v_user_id;
  elsif v_plano = 'completo' then
    update public.users
      set futebol_subscription_status = 'premium',
          betinho_subscription_status = 'premium',
          analytics_subscription_status = 'premium',
          betinho_subscription_period_end = v_vence_em,
          analytics_subscription_period_end = v_vence_em
      where id = v_user_id;
  else
    raise exception 'plano desconhecido ao registrar pagamento: %', v_plano;
  end if;

  insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
  values (
    v_user_id,
    'acesso',
    'Pagou ' || to_char(v_mes, 'MM/YYYY') || ' por ' || p_origem
      || ': R$ ' || to_char(p_valor, 'FM999999990.00')
      || case when v_vitalicio then '. Assinatura vitalicia, sem data de fim.'
              else '. Acesso pago ate ' || to_char(v_vence_em, 'DD/MM/YYYY') || '.' end,
    (select auth.uid())
  );

  return v_id;
end;
$function$;

comment on function public.crm_registrar_pagamento(uuid, date, numeric, text, date) is
  'Registra dinheiro recebido na mao, empurra o acesso um mes e anota na linha do tempo. Vitalicio nao ganha data de fim. O dono do pagamento vem da assinatura.';

-- Revoke antes do grant: função nasce executável por PUBLIC.
--
-- ⚠️ E o `anon` leva revoke PRÓPRIO. No Supabase, tirar de PUBLIC não fecha o
-- anônimo: o schema `public` dá EXECUTE explicitamente a `anon` e a
-- `authenticated`, e esse grant direto continua de pé depois do revoke de
-- PUBLIC.
revoke execute on function public.crm_registrar_pagamento(uuid, date, numeric, text, date) from public;
revoke execute on function public.crm_registrar_pagamento(uuid, date, numeric, text, date) from anon;
grant  execute on function public.crm_registrar_pagamento(uuid, date, numeric, text, date) to authenticated;
