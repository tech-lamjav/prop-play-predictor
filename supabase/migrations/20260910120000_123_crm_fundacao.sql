-- 20260910120000_123_crm_fundacao
--
-- O CRM dos sócios: quem enxerga, e onde a abordagem fica registrada.
--
-- Spec em `docs/crm-socios.md`, vocabulário em `src/components/admin/CONTEXT.md`.
--
-- Até aqui o repositório não tinha NENHUMA noção de sócio, papel ou permissão
-- elevada. O site inteiro lê o banco direto do navegador com a chave pública, e
-- a única regra da tabela de usuários é "cada um enxerga só a própria linha".
-- Esta migration é o portão, e ele mora aqui de propósito: a rota escondida no
-- front é conveniência, não segurança — o bundle é público e o caminho está
-- dentro dele.
--
-- ⚠️ A ARMADILHA DA RECURSÃO
-- A política que libera o sócio precisa saber se quem pergunta é sócio, e essa
-- informação está na PRÓPRIA tabela que a política protege. Escrita ingênua:
--
--   create policy ... on public.users for select using (
--     exists (select 1 from public.users u where u.id = auth.uid() and u.is_socio)
--   );
--
-- Isso recursa. O Postgres reaplica a política dentro do subselect, e a leitura
-- da tabela inteira morre — inclusive a de quem não é sócio, ou seja, o site
-- todo para de saber quem está logado. A saída é a função `eh_socio()` abaixo:
-- `security definer` roda como dono do banco, e o dono não é submetido a RLS.
--
-- Conferência depois de aplicar:
--   update public.users set is_socio = true where email = '<e-mail do sócio>';
--   select public.eh_socio();   -- logado como sócio, espera true

-- ── Quem é sócio ────────────────────────────────────────────────────────────
alter table public.users
  add column if not exists is_socio boolean not null default false;

comment on column public.users.is_socio is
  'Acesso ao painel administrativo. Ligado na mão, direto no banco. Não tem relação com plano assinado.';

-- `stable` e não `volatile`: assim o planejador chama a função uma vez por
-- consulta em vez de uma vez por linha. Numa varredura da base inteira — que é
-- exatamente o que o painel faz — a diferença é entre uma chamada e milhares.
create or replace function public.eh_socio()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  -- O coalesce importa: sem linha, a função devolveria null, e `using (null)`
  -- não libera nada. O sócio simplesmente não veria o painel, sem erro nenhum
  -- para explicar por quê.
  select coalesce(
    (select u.is_socio from public.users u where u.id = (select auth.uid())),
    false
  );
$function$;

comment on function public.eh_socio() is
  'Responde se quem chamou é sócio. Definer de propósito: uma política sobre users que consulta users recursa.';

grant execute on function public.eh_socio() to authenticated;

-- ── O que o sócio enxerga ───────────────────────────────────────────────────
-- Políticas de RLS somam: esta convive com a "Users can only see their own
-- data" da migration 005 sem mexer nela. Quem não é sócio continua exatamente
-- como estava.
--
-- Só SELECT. O painel lê a base inteira e escreve apenas nas tabelas do CRM —
-- mudar o plano de alguém pela tela nunca esteve em questão, e um `for all`
-- aqui daria isso de graça a quem só precisava ler.
drop policy if exists "Socios leem todos os cadastros" on public.users;
create policy "Socios leem todos os cadastros"
  on public.users
  for select
  to authenticated
  using (public.eh_socio());

-- ── A etapa de cada lead ────────────────────────────────────────────────────
-- Quem nunca foi tocado NÃO tem linha aqui, e vale `novo`. A ausência é o
-- estado inicial de propósito: exigir uma escrita para o lead existir faria
-- todo cadastro novo depender de um gatilho, e um gatilho que falha esconde o
-- lead em vez de mostrá-lo errado.
create table if not exists public.crm_etapa (
  user_id uuid primary key references public.users(id) on delete cascade,
  etapa text not null check (etapa in ('novo', 'contatado', 'conversando', 'proposta', 'assinou', 'sem_resposta')),
  atualizada_em timestamptz not null default now(),
  atualizada_por uuid references public.users(id)
);

create index if not exists idx_crm_etapa_etapa on public.crm_etapa(etapa);

comment on table public.crm_etapa is
  'Onde cada lead está no funil. Sem linha = novo.';

-- ── O histórico das mudanças ────────────────────────────────────────────────
-- Append-only: corrigir uma etapa errada acrescenta um evento, nunca apaga o
-- anterior. É o que torna possível medir depois quanto tempo um lead ficou
-- parado em cada etapa — e uma correção que apaga destrói justamente a medida.
create table if not exists public.crm_etapa_evento (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  de text,
  para text not null,
  em timestamptz not null default now(),
  por uuid references public.users(id)
);

create index if not exists idx_crm_etapa_evento_user on public.crm_etapa_evento(user_id, em desc);

comment on table public.crm_etapa_evento is
  'Histórico append-only das mudanças de etapa. Nunca sofre update nem delete.';

-- ── A linha do tempo ────────────────────────────────────────────────────────
create table if not exists public.crm_anotacao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  tipo text not null check (tipo in ('anotacao', 'feedback', 'objecao')),
  -- O banco recusa texto em branco porque a tela não é o único caminho até
  -- aqui: qualquer sócio com o cliente na mão escreve direto na tabela.
  texto text not null check (length(btrim(texto)) > 0),
  criada_em timestamptz not null default now(),
  criada_por uuid references public.users(id)
);

create index if not exists idx_crm_anotacao_user on public.crm_anotacao(user_id, criada_em desc);

comment on table public.crm_anotacao is
  'Linha do tempo de cada pessoa. Feedback é um TIPO daqui, não uma tabela à parte.';

-- ── Só sócio entra ──────────────────────────────────────────────────────────
-- Ligar RLS sem policy tranca todo mundo, inclusive o sócio; ligar com policy
-- frouxa abre para o assinante comum. Os dois erros são silenciosos, então o
-- par abaixo vai junto para cada tabela.
alter table public.crm_etapa enable row level security;
alter table public.crm_etapa_evento enable row level security;
alter table public.crm_anotacao enable row level security;

drop policy if exists "Socios gerenciam a etapa" on public.crm_etapa;
create policy "Socios gerenciam a etapa"
  on public.crm_etapa for all to authenticated
  using (public.eh_socio()) with check (public.eh_socio());

-- O histórico é append-only, e isso precisa ser a POLÍTICA, não um comentário.
-- Duas políticas em vez de um `for all`: sem update e sem delete, nem o sócio
-- reescreve o passado. Corrigir uma etapa errada acrescenta um evento novo — e
-- é exatamente essa a diferença entre um histórico e um campo com data.
drop policy if exists "Socios leem e registram eventos de etapa" on public.crm_etapa_evento;
drop policy if exists "Socios leem o historico de etapa" on public.crm_etapa_evento;
create policy "Socios leem o historico de etapa"
  on public.crm_etapa_evento for select to authenticated
  using (public.eh_socio());

drop policy if exists "Socios registram no historico de etapa" on public.crm_etapa_evento;
create policy "Socios registram no historico de etapa"
  on public.crm_etapa_evento for insert to authenticated
  with check (public.eh_socio());

drop policy if exists "Socios gerenciam anotacoes" on public.crm_anotacao;
create policy "Socios gerenciam anotacoes"
  on public.crm_anotacao for all to authenticated
  using (public.eh_socio()) with check (public.eh_socio());
