-- CRM dos sócios — as quatro migrations em um arquivo só
--
-- Para colar no editor SQL do Supabase quando não for aplicar pelo CLI.
-- É o mesmo conteúdo de supabase/migrations/123 a 126, na ordem, e nada além.
-- Rodar duas vezes não faz mal: tudo é idempotente.
--
-- DEPOIS de rodar, ligue o acesso na mão — sem isto o painel devolve página
-- não encontrada para todo mundo, inclusive para vocês:
--
--   update public.users set is_socio = true where email in ('...', '...');


-- ═══════════════════════════════════════════════════════════════════════
-- 20260910120000_123_crm_fundacao
-- ═══════════════════════════════════════════════════════════════════════

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

-- Revoke antes do grant: funcao nova nasce executavel por PUBLIC, e PUBLIC
-- inclui o anon. O portao interno barraria (auth.uid e nulo fora da sessao),
-- mas um grant que sugere restricao sem ter e pior que nenhum.
revoke execute on function public.eh_socio() from public;
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

-- ── A linha do tempo das mudanças ────────────────────────────────────────────────
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
  'Linha do tempo append-only das mudancas de etapa. Nunca sofre update nem delete.';

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

-- A linha do tempo é append-only, e isso precisa ser a POLÍTICA, não um comentário.
-- Duas políticas em vez de um `for all`: sem update e sem delete, nem o sócio
-- reescreve o passado. Corrigir uma etapa errada acrescenta um evento novo — e
-- é exatamente essa a diferença entre uma linha do tempo e um campo com data.
drop policy if exists "Socios leem e registram eventos de etapa" on public.crm_etapa_evento;
drop policy if exists "Socios leem a linha do tempo de etapa" on public.crm_etapa_evento;
create policy "Socios leem a linha do tempo de etapa"
  on public.crm_etapa_evento for select to authenticated
  using (public.eh_socio());

drop policy if exists "Socios registram na linha do tempo de etapa" on public.crm_etapa_evento;
create policy "Socios registram na linha do tempo de etapa"
  on public.crm_etapa_evento for insert to authenticated
  with check (public.eh_socio());

drop policy if exists "Socios gerenciam anotacoes" on public.crm_anotacao;
create policy "Socios gerenciam anotacoes"
  on public.crm_anotacao for all to authenticated
  using (public.eh_socio()) with check (public.eh_socio());

-- ═══════════════════════════════════════════════════════════════════════
-- 20260910180000_124_crm_resumo_de_apostas
-- ═══════════════════════════════════════════════════════════════════════

-- 20260910180000_124_crm_resumo_de_apostas
--
-- Quantas apostas uma pessoa registrou, para o gancho da ficha.
--
-- O gancho do CRM (`src/components/socios/CONTEXT.md`) é o palpite sobre o que
-- atraiu a pessoa. O sinal mais forte que o banco tem é uso de verdade: quem
-- registrou aposta veio pelo Betinho, mesmo que o plano diga outra coisa. Foi
-- exatamente o caso que originou o CRM — um assinante do Essencial cujo olho
-- brilhou no Betinho.
--
-- ⚠️ POR QUE UMA FUNÇÃO, E NÃO UMA POLÍTICA EM `bets`
-- Dar ao sócio uma policy de select em `bets` abriria a aposta LINHA A LINHA:
-- valor, odd, descrição, o texto cru que a pessoa mandou no Telegram. A ficha
-- não precisa de nada disso — precisa de "registrou?" e "quando foi a última?".
-- A função devolve só o agregado, e a tabela continua fechada.
--
-- Conferência depois de aplicar, logado como sócio:
--   select * from public.crm_resumo_de_apostas('<uuid de alguém>');

create or replace function public.crm_resumo_de_apostas(p_user_id uuid)
returns table (total bigint, ultima timestamptz)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  -- O portão vai DENTRO da função porque ela roda como dono do banco: sem esta
  -- linha, qualquer pessoa logada contaria as apostas de qualquer outra só
  -- sabendo o identificador.
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  return query
    select count(*)::bigint, max(b.bet_date)
      from public.bets b
     where b.user_id = p_user_id;
end;
$function$;

comment on function public.crm_resumo_de_apostas(uuid) is
  'Agregado de apostas de uma pessoa, para o gancho da ficha do CRM. Só sócio. Nunca devolve a aposta em si.';

-- Revoke antes do grant, mesmo motivo da 123: funcao nova nasce executavel por
-- PUBLIC, e PUBLIC inclui o anon.
revoke execute on function public.crm_resumo_de_apostas(uuid) from public;
grant execute on function public.crm_resumo_de_apostas(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 20260911100000_125_crm_mudar_etapa
-- ═══════════════════════════════════════════════════════════════════════

-- 20260911100000_125_crm_mudar_etapa
--
-- Mover um lead de etapa, com a linha do tempo saindo junto.
--
-- ⚠️ POR QUE UMA FUNÇÃO, E NÃO DOIS INSERTS DO NAVEGADOR
-- Mudar de etapa são duas escritas: a linha atual em `crm_etapa` e o evento em
-- `crm_etapa_evento`. Feitas do navegador, elas não são uma transação — a
-- segunda pode falhar sozinha, e aí a etapa anda sem a linha do tempo registrar.
-- Isso não dá erro em lugar nenhum: a tela mostra a etapa nova, e o buraco só
-- aparece meses depois, quando alguém for medir quanto tempo cada lead ficou
-- parado onde. Aqui as duas acontecem ou nenhuma acontece.
--
-- E o `por` é carimbado com `auth.uid()` DENTRO da função, não recebido como
-- parâmetro: quem registrou a mudança não é algo que o cliente deva poder
-- dizer.
--
-- Conferência depois de aplicar, logado como sócio:
--   select public.crm_mudar_etapa('<uuid>', 'contatado');
--   select * from public.crm_etapa_evento order by em desc limit 1;

create or replace function public.crm_mudar_etapa(p_user_id uuid, p_etapa text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_de text;
  v_quem uuid := (select auth.uid());
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  -- Sem linha, a etapa vale `novo`. É o mesmo padrão que a tela assume, e
  -- repetir a regra aqui evita que o primeiro evento de um lead registre um
  -- `de` nulo que ninguém sabe ler depois.
  select e.etapa into v_de from public.crm_etapa e where e.user_id = p_user_id;
  v_de := coalesce(v_de, 'novo');

  -- Reescolher a mesma etapa não é mudança: gravar um evento aqui encheria o
  -- a linha do tempo de eventos que não aconteceram, e a medida de tempo parado em
  -- cada etapa é justamente o que isso estragaria.
  if v_de = p_etapa then
    return v_de;
  end if;

  insert into public.crm_etapa (user_id, etapa, atualizada_em, atualizada_por)
  values (p_user_id, p_etapa, now(), v_quem)
  on conflict (user_id) do update
    set etapa = excluded.etapa,
        atualizada_em = excluded.atualizada_em,
        atualizada_por = excluded.atualizada_por;

  insert into public.crm_etapa_evento (user_id, de, para, por)
  values (p_user_id, v_de, p_etapa, v_quem);

  return p_etapa;
end;
$function$;

comment on function public.crm_mudar_etapa(uuid, text) is
  'Move um lead de etapa e registra o evento na mesma transacao. So socio. O autor vem de auth.uid(), nunca do cliente.';

-- Revoke antes do grant: funcao nova nasce executavel por PUBLIC, e PUBLIC
-- inclui o anon.
revoke execute on function public.crm_mudar_etapa(uuid, text) from public;
grant execute on function public.crm_mudar_etapa(uuid, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 20260911140000_126_crm_anotar
-- ═══════════════════════════════════════════════════════════════════════

-- 20260911140000_126_crm_anotar
--
-- Escrever na linha do tempo de uma pessoa.
--
-- A tabela `crm_anotacao` nasceu na migration 123, com política de sócio e a
-- restrição de texto em branco. Esta função existe por um motivo só, o mesmo do
-- `crm_mudar_etapa`: carimbar o AUTOR com `auth.uid()` em vez de aceitá-lo do
-- cliente. Com insert direto do navegador, um sócio poderia gravar uma
-- anotação em nome do outro — e numa linha do tempo que existe justamente para
-- saber quem falou com quem, isso é o registro mentindo.
--
-- O `trim` também acontece aqui, e não só na tela: a tela é um dos caminhos até
-- a tabela, não o único.
--
-- Conferência depois de aplicar, logado como sócio:
--   select public.crm_anotar('<uuid>', 'feedback', 'achou o Betinho confuso');

create or replace function public.crm_anotar(p_user_id uuid, p_tipo text, p_texto text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
  v_texto text := btrim(coalesce(p_texto, ''));
begin
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  -- Espaço em branco não é anotação. A restrição da tabela já recusaria, mas o
  -- erro que ela devolve fala de `check constraint` — este fala de anotação.
  if v_texto = '' then
    raise exception 'anotacao vazia';
  end if;

  insert into public.crm_anotacao (user_id, tipo, texto, criada_por)
  values (p_user_id, p_tipo, v_texto, (select auth.uid()))
  returning id into v_id;

  return v_id;
end;
$function$;

comment on function public.crm_anotar(uuid, text, text) is
  'Escreve na linha do tempo de uma pessoa. So socio. O autor vem de auth.uid(), nunca do cliente.';

-- Revoke antes do grant: funcao nova nasce executavel por PUBLIC, e PUBLIC
-- inclui o anon.
revoke execute on function public.crm_anotar(uuid, text, text) from public;
grant execute on function public.crm_anotar(uuid, text, text) to authenticated;
