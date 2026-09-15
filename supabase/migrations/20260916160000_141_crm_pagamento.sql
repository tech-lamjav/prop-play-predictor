-- 20260916160000_141_crm_pagamento
--
-- A assinatura manual passa a ser RECORRENTE, e o dinheiro recebido por fora
-- do Stripe passa a ter registro.
--
-- ## O problema, nas palavras do Victor
--
-- O Stripe não vende por Pix, e boa parte dos clientes quer pagar por Pix.
-- Então existe receita que acontece fora do gateway e não tem registro em lugar
-- nenhum: o sócio combina um valor, recebe o Pix de um mês, e no mês seguinte
-- não sabe se aquela pessoa pagou ou não. Sem isso não há como cobrar, e sem
-- cobrar não há como saber quem está inadimplente.
--
-- ## O que muda no modelo
--
-- A 131 criou a assinatura manual como uma JANELA: começa hoje, vence em tal
-- dia, e quando vence morre. Isso serve para sem cobrança, e não para venda.
--
-- Agora ela tem `valor_mensal`, e com ele vira recorrente: todo mês nasce um mês
-- de competência a receber, e `vence_em` deixa de ser "quando a sem cobrança acaba"
-- para ser "até quando o acesso está pago". Registrar um pagamento EMPURRA essa
-- data um mês para frente.
--
-- `valor_mensal` é anulável de propósito: as assinaturas que já existem foram
-- dadas como sem cobrança, sem valor combinado, e inventar um número para elas
-- seria criar receita que ninguém recebeu. Nulo quer dizer sem cobrança; com valor
-- quer dizer venda.
--
-- ## ⚠️ O que NÃO entra aqui: o dinheiro do Stripe
--
-- Quem paga pelo Stripe já tem registro lá, e duas fontes para o mesmo dinheiro
-- discordam. Esta tabela guarda só o que foi recebido NA MÃO, e a tela diz isso
-- com essas palavras.
--
-- Cada pagamento nasce com a `origem` marcada, e é isso que deixa a porta
-- aberta: quando valer a pena sincronizar o Stripe por webhook, os pagamentos
-- dele entram com `origem = 'stripe'` e o total passa a ser consolidado sem
-- mudar o modelo. Está registrado como issue à parte.
--
-- ## Por que PAGAMENTO e não COBRANÇA
--
-- A tabela guarda o que aconteceu, não o que se espera. Os meses em aberto são
-- DERIVADOS — todo mês desde o começo da assinatura, menos os que têm pagamento
-- — e não linhas criadas de antemão.
--
-- A alternativa era gerar uma linha de cobrança por mês, e ela exige um cron
-- que roda todo dia 1º. Cron que falha em silêncio deixa de gerar a cobrança, e
-- o mês simplesmente não aparece como devido: o sistema esquece de cobrar e
-- ninguém descobre. Derivar não tem como esquecer.
--
-- Conferência depois de aplicar, logado como sócio:
--   select public.crm_registrar_pagamento('<uuid da assinatura>', '2026-09-01', 39.90, 'pix');
--   select * from public.crm_pagamento order by criada_em desc limit 5;

-- ── A assinatura ganha valor ────────────────────────────────────────────────
alter table public.crm_assinatura_manual
  add column if not exists valor_mensal numeric(10, 2);

comment on column public.crm_assinatura_manual.valor_mensal is
  'Quanto a pessoa paga por mes. NULO quer dizer sem cobranca: assinatura dada sem valor combinado.';

comment on column public.crm_assinatura_manual.vence_em is
  'Ate quando o acesso esta PAGO. Registrar um pagamento empurra esta data um mes para frente.';

-- ── Os pagamentos recebidos na mão ──────────────────────────────────────────
create table if not exists public.crm_pagamento (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references public.crm_assinatura_manual(id) on delete cascade,
  /*
   * O MÊS a que o pagamento se refere, não o dia em que caiu.
   *
   * Sempre o dia 1º, e a restrição cobra isso: são a mesma coisa dois nomes
   * diferentes se o dia variar, e "pagou setembro" contado duas vezes porque um
   * registro ficou no dia 3 e outro no dia 1º é o erro que mais dói aqui.
   *
   * Um Pix que chega em 2 de outubro pagando setembro tem competência
   * 2026-09-01 e `pago_em` 2026-10-02. Guardar só a data do Pix perderia a
   * distinção, e é ela que responde "qual mês está em aberto".
   */
  competencia date not null,
  valor numeric(10, 2) not null check (valor > 0),
  /*
   * Como o dinheiro chegou.
   *
   * `stripe` já está na lista mesmo sem ninguém escrever ainda: quando o
   * webhook entrar, os pagamentos dele cabem sem migration nova. O resto é o
   * que existe na prática hoje.
   */
  origem text not null check (origem in ('pix', 'dinheiro', 'transferencia', 'stripe', 'outro')),
  /** O dia em que o dinheiro caiu. Pode ser depois do mês de competência. */
  pago_em date not null default current_date,
  criada_em timestamptz not null default now(),
  criada_por uuid references public.users(id),
  /*
   * Estorno em vez de delete, pelo mesmo motivo do resto do CRM: um registro de
   * dinheiro que alguém apaga é um registro que ninguém consegue auditar. Um
   * lançamento errado fica na tabela, marcado, com o motivo.
   */
  estornado_em timestamptz,
  estornado_por uuid references public.users(id),
  motivo_do_estorno text,

  -- Competência sempre no dia 1º, para "setembro" ser um valor só.
  constraint crm_pagamento_competencia_no_dia_1 check (competencia = date_trunc('month', competencia)::date)
);

comment on table public.crm_pagamento is
  'Dinheiro recebido FORA do Stripe, por mes de competencia. O Stripe tem o registro dele; duas fontes para o mesmo dinheiro discordariam.';

-- Um mês de competência é pago uma vez. O índice é parcial porque um pagamento
-- estornado libera o mês para ser lançado de novo — e é justamente para isso
-- que o estorno serve.
create unique index if not exists idx_crm_pagamento_mes_unico
  on public.crm_pagamento(assinatura_id, competencia)
  where estornado_em is null;

create index if not exists idx_crm_pagamento_assinatura
  on public.crm_pagamento(assinatura_id, competencia desc);

alter table public.crm_pagamento enable row level security;

drop policy if exists "Socios leem os pagamentos" on public.crm_pagamento;
create policy "Socios leem os pagamentos"
  on public.crm_pagamento for select to authenticated
  using (public.eh_socio());

-- Escrita só pelas funções abaixo, e SEM política de escrita, de propósito. Com
-- uma política `for all` o sócio conseguiria apagar ou editar um pagamento
-- direto pela API, e o estorno com motivo existiria só na tela: um registro de
-- dinheiro apagado não deixa rastro. As funções são `security definer` e não
-- precisam de política para escrever. O `drop` fica para quem já tinha a
-- política criada por uma versão anterior desta migration, como o staging.
drop policy if exists "Socios gerenciam os pagamentos" on public.crm_pagamento;

-- ── Registrar um pagamento ──────────────────────────────────────────────────
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
  v_mes date := date_trunc('month', p_competencia)::date;
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  if p_valor is null or p_valor <= 0 then
    raise exception 'valor invalido';
  end if;

  select a.user_id, a.plano, a.vence_em
    into v_user_id, v_plano, v_vence_em
    from public.crm_assinatura_manual a
   where a.id = p_assinatura_id and a.encerrada_em is null;

  if v_user_id is null then
    raise exception 'assinatura nao encontrada ou ja encerrada';
  end if;

  insert into public.crm_pagamento
    (assinatura_id, competencia, valor, origem, pago_em, criada_por)
  values
    (p_assinatura_id, v_mes, p_valor, p_origem, coalesce(p_pago_em, current_date),
     (select auth.uid()))
  returning id into v_id;

  /*
   * O acesso anda um mês para frente.
   *
   * A partir do MAIOR entre o vencimento atual e o fim do mês pago, e não
   * sempre de hoje: quem paga adiantado não pode perder o que já tinha, e quem
   * paga um mês atrasado não ganha um mês extra por ter atrasado.
   */
  update public.crm_assinatura_manual
    set vence_em = greatest(vence_em, (v_mes + interval '1 month' - interval '1 day')::date)
    where id = p_assinatura_id
    returning vence_em into v_vence_em;

  -- O acesso do produto acompanha, seguindo a mesma escada da 131.
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
      || '. Acesso pago ate ' || to_char(v_vence_em, 'DD/MM/YYYY') || '.',
    (select auth.uid())
  );

  return v_id;
end;
$function$;

comment on function public.crm_registrar_pagamento(uuid, date, numeric, text, date) is
  'Registra dinheiro recebido na mao, empurra o acesso um mes e anota na linha do tempo.';

revoke execute on function public.crm_registrar_pagamento(uuid, date, numeric, text, date) from public;
grant execute on function public.crm_registrar_pagamento(uuid, date, numeric, text, date) to authenticated;

-- ── Estornar um lançamento errado ───────────────────────────────────────────
-- Marca, não apaga. E NÃO recua o `vence_em`: o acesso já foi dado, a pessoa já
-- usou, e tirar o acesso por causa de um erro de lançamento castiga quem não
-- errou. Quem quiser cortar o acesso usa o encerramento, que é decisão
-- separada e explícita.
create or replace function public.crm_estornar_pagamento(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_competencia date;
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  if v_motivo = '' then
    raise exception 'estorno sem motivo';
  end if;

  update public.crm_pagamento
    set estornado_em = now(),
        estornado_por = (select auth.uid()),
        motivo_do_estorno = v_motivo
    where id = p_id and estornado_em is null
    returning competencia into v_competencia;

  if v_competencia is null then
    raise exception 'pagamento nao encontrado ou ja estornado';
  end if;

  select a.user_id into v_user_id
    from public.crm_pagamento p
    join public.crm_assinatura_manual a on a.id = p.assinatura_id
   where p.id = p_id;

  insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
  values (
    v_user_id,
    'acesso',
    'Estornou o pagamento de ' || to_char(v_competencia, 'MM/YYYY') || ': ' || v_motivo
      || '. O acesso NAO foi recuado.',
    (select auth.uid())
  );
end;
$function$;

comment on function public.crm_estornar_pagamento(uuid, text) is
  'Marca um lancamento como estornado, com motivo. Nao apaga e nao recua o acesso.';

revoke execute on function public.crm_estornar_pagamento(uuid, text) from public;
grant execute on function public.crm_estornar_pagamento(uuid, text) to authenticated;
