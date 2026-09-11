-- 20260913100000_131_crm_assinatura_manual
--
-- A assinatura dada na mão vira uma coisa que se acompanha.
--
-- A 129 e a 130 ligam produtos soltos e não guardam que aquilo foi dado na mão.
-- A consequência prática é que ninguém sabe a quem cobrar: uma assinatura
-- manual NÃO renova sozinha, ela vence, e alguém precisa falar com a pessoa
-- antes disso. Sem registro, o acesso simplesmente some um dia e a conversa
-- acontece tarde.
--
-- Por isso a concessão vira um FATO com linha própria: quem, qual plano, até
-- quando, quem deu. O estado em `public.users` continua sendo o que manda para
-- o produto; esta tabela é o que manda para a cobrança.
--
-- ⚠️ A escada de planos está escrita aqui uma segunda vez. A primeira é
-- `supabase/functions/shared/concessoes.ts`, que é a FONTE DA VERDADE e roda em
-- Deno; esta roda no Postgres, e não há módulo que os dois importem. É o mesmo
-- caso do prazo do teste do futebol, que também vive duplicado entre runtimes.
-- Há um teste (`crm-assinatura-migration.test.ts`) que lê os dois arquivos e
-- cobra que eles concedam o mesmo: se divergirem, um assinante manual do
-- Essencial ganha um acesso a menos que um pagante do mesmo plano.
--
-- A escada é CUMULATIVA: Entrada é o Betinho; Essencial é futebol mais Betinho;
-- Completo é os três.
--
-- Conferência depois de aplicar, logado como sócio:
--   select public.crm_dar_assinatura_manual('<uuid>', 'essencial', '2026-10-31');
--   select * from public.crm_assinatura_manual where encerrada_em is null;

-- ── A tabela ────────────────────────────────────────────────────────────────
create table if not exists public.crm_assinatura_manual (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plano text not null check (plano in ('entrada', 'essencial', 'completo')),
  -- `date` e não `timestamptz`: ninguém combina cortesia com hora. E não é
  -- opcional, porque a tela de cobrança inteira existe para ordenar por ela.
  vence_em date not null,
  criada_em timestamptz not null default now(),
  criada_por uuid references public.users(id),
  -- Encerrar é MARCAR, e não apagar: o histórico é o que responde "quantas a
  -- gente deu este mês" e "esta pessoa já teve uma antes".
  encerrada_em timestamptz,
  encerrada_por uuid references public.users(id)
);

comment on table public.crm_assinatura_manual is
  'Assinaturas concedidas por socio, fora do Stripe. Quem, qual plano, ate quando. E daqui que sai a fila de cobranca.';

-- Uma pessoa não tem duas abertas. Com duas, a tela de cobrança mostraria a
-- mesma pessoa duas vezes com datas diferentes e ninguém saberia qual vale.
create unique index if not exists idx_crm_assinatura_manual_aberta
  on public.crm_assinatura_manual(user_id)
  where encerrada_em is null;

create index if not exists idx_crm_assinatura_manual_vence
  on public.crm_assinatura_manual(vence_em)
  where encerrada_em is null;

alter table public.crm_assinatura_manual enable row level security;

drop policy if exists "Socios leem as assinaturas manuais" on public.crm_assinatura_manual;
create policy "Socios leem as assinaturas manuais"
  on public.crm_assinatura_manual for select to authenticated
  using (public.eh_socio());

-- Escrita só pelas funções abaixo, que são `security definer`. A política de
-- escrita existe mesmo assim: sem ela, ligar RLS trancaria até o dono.
drop policy if exists "Socios gerenciam as assinaturas manuais" on public.crm_assinatura_manual;
create policy "Socios gerenciam as assinaturas manuais"
  on public.crm_assinatura_manual for all to authenticated
  using (public.eh_socio()) with check (public.eh_socio());

-- ── Dar o plano inteiro de uma vez ──────────────────────────────────────────
create or replace function public.crm_dar_assinatura_manual(
  p_user_id uuid,
  p_plano text,
  p_vence_em date
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_rotulo text;
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  if p_vence_em is null then
    raise exception 'sem data de vencimento';
  end if;

  -- O plano escolhe um RAMO, e nunca vira nome de coluna. A versão genérica
  -- com `execute format` transformaria "plano" em qualquer coluna da tabela de
  -- usuários, `is_socio` inclusive.
  --
  -- O `subscription_product_type` também é escrito aqui, e é o que faz a ficha
  -- mostrar "Essencial" em vez de "não informado". ⚠️ O webhook do Stripe é o
  -- único outro lugar que escreve essa coluna, e ele vence quando falar.
  if p_plano = 'entrada' then
    v_rotulo := 'Entrada';
    update public.users
      set subscription_product_type = 'entrada',
          betinho_subscription_status = 'premium',
          betinho_subscription_period_end = p_vence_em
      where id = p_user_id;

  elsif p_plano = 'essencial' then
    v_rotulo := 'Essencial';
    update public.users
      set subscription_product_type = 'essencial',
          futebol_subscription_status = 'premium',
          betinho_subscription_status = 'premium',
          betinho_subscription_period_end = p_vence_em
      where id = p_user_id;

  elsif p_plano = 'completo' then
    v_rotulo := 'Completo';
    update public.users
      set subscription_product_type = 'completo',
          futebol_subscription_status = 'premium',
          betinho_subscription_status = 'premium',
          analytics_subscription_status = 'premium',
          betinho_subscription_period_end = p_vence_em,
          analytics_subscription_period_end = p_vence_em
      where id = p_user_id;

  else
    raise exception 'plano desconhecido: %', p_plano;
  end if;

  if not found then
    raise exception 'pessoa nao encontrada';
  end if;

  -- Renovar é dar de novo. Sem encerrar a anterior, o índice único derruba a
  -- gravação e o sócio vê um erro de banco sem entender o que fez de errado.
  update public.crm_assinatura_manual
    set encerrada_em = now(), encerrada_por = (select auth.uid())
    where user_id = p_user_id and encerrada_em is null;

  insert into public.crm_assinatura_manual (user_id, plano, vence_em, criada_por)
  values (p_user_id, p_plano, p_vence_em, (select auth.uid()))
  returning id into v_id;

  insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
  values (
    p_user_id,
    'acesso',
    v_rotulo || ' na mao, ate ' || to_char(p_vence_em, 'DD/MM/YYYY'),
    (select auth.uid())
  );

  return v_id;
end;
$function$;

comment on function public.crm_dar_assinatura_manual(uuid, text, date) is
  'Socio concede um plano inteiro na mao, seguindo a escada cumulativa. Registra a concessao e a linha do tempo.';

revoke execute on function public.crm_dar_assinatura_manual(uuid, text, date) from public;
grant execute on function public.crm_dar_assinatura_manual(uuid, text, date) to authenticated;

-- ── Encerrar ────────────────────────────────────────────────────────────────
-- Tira os acessos que o plano tinha dado e fecha a linha. Não mexe no que o
-- Stripe deu: se a pessoa assinou de verdade no meio do caminho, encerrar a
-- cortesia não pode derrubar o acesso que ela está pagando.
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

  -- Quem passou a pagar de verdade fica com o acesso. A cortesia acabou, mas a
  -- assinatura dela é outra coisa, e derrubar as duas juntas tiraria o produto
  -- de quem está pagando por ele.
  if v_tem_stripe then
    insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
    values (
      v_user_id,
      'acesso',
      'Cortesia encerrada. O acesso segue pela assinatura do Stripe.',
      (select auth.uid())
    );
    return;
  end if;

  update public.users
    set subscription_product_type = null,
        betinho_subscription_status = 'free',
        futebol_subscription_status = 'free',
        analytics_subscription_status = 'free',
        betinho_subscription_period_end = null,
        analytics_subscription_period_end = null
    where id = v_user_id;

  insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
  values (v_user_id, 'acesso', 'Cortesia encerrada', (select auth.uid()));
end;
$function$;

comment on function public.crm_encerrar_assinatura_manual(uuid) is
  'Encerra uma cortesia e tira os acessos. Quem tem assinatura no Stripe mantem o acesso: sao coisas diferentes.';

revoke execute on function public.crm_encerrar_assinatura_manual(uuid) from public;
grant execute on function public.crm_encerrar_assinatura_manual(uuid) to authenticated;
