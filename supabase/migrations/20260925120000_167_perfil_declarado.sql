-- 20260925120000_167_perfil_declarado
--
-- O que a pessoa declara sobre si na chegada: o que ela veio buscar e quanto
-- aposta hoje.
--
-- Spec na issue #522, ticket #523.
--
-- Por que no banco, e não no localStorage como os tours: a pesquisa é adiável e
-- não dispensável — volta a cada sessão até ser respondida. Com localStorage,
-- que é por navegador, quem trocasse de celular ou limpasse o navegador voltaria
-- a ser perguntado para sempre. "Já respondeu" precisa valer para a PESSOA, não
-- para o aparelho.
--
-- ── SEM LINHA É O ESTADO INICIAL ───────────────────────────────────────────
-- Quem nunca viu a pesquisa não tem linha aqui, e isso vale "nunca respondeu e
-- nunca adiou". É o mesmo desenho de `crm_etapa` e pelo mesmo motivo: exigir uma
-- escrita para a pessoa existir faria todo cadastro novo depender de um gatilho,
-- e um gatilho que falha esconde a pessoa em vez de mostrá-la errada.
--
-- A linha nasce no primeiro adiamento — por isso `objetivo` e `frequencia` são
-- anuláveis, e por isso existe a restrição de resposta inteira abaixo.
--
-- ── OS CÓDIGOS NÃO SE RENOMEIAM ─────────────────────────────────────────────
-- Os oito valores dos `check` são os mesmos que viajam para o PostHog como
-- propriedade de pessoa. Renomear um parte a série em duas e ninguém percebe: o
-- texto que aparece na tela é outra coisa, mora no front e pode ser reescrito à
-- vontade sem tocar aqui.
--
-- Conferência depois de aplicar:
--   select * from public.perfil_declarado limit 1;
--   insert into public.perfil_declarado (user_id, objetivo) values (auth.uid(), 'economizar_tempo');
--     -- espera erro: meia resposta não entra (perfil_declarado_resposta_inteira)

create table if not exists public.perfil_declarado (
  user_id uuid primary key references public.users(id) on delete cascade,

  objetivo text check (objetivo in (
    'oportunidades_prontas',
    'entender_o_porque',
    'economizar_tempo',
    'aprender_a_analisar'
  )),

  frequencia text check (frequencia in (
    'comecando',
    'de_vez_em_quando',
    'toda_semana',
    'quase_todo_dia'
  )),

  respondido_em timestamptz,

  -- Quantas vezes a pessoa apertou Pular. Não é enfeite: é o único jeito de
  -- descobrir se insistir até responder está funcionando ou só incomodando.
  adiamentos integer not null default 0,

  atualizado_em timestamptz not null default now(),

  -- Meia resposta não entra. As duas perguntas e o carimbo andam juntos: ou a
  -- linha é só um registro de adiamento, ou é uma resposta completa. Sem isto,
  -- uma gravação parcial viraria uma pessoa que "já respondeu" sem ter dito nada,
  -- e a pesquisa nunca mais voltaria para ela.
  constraint perfil_declarado_resposta_inteira check (
    (objetivo is null and frequencia is null and respondido_em is null)
    or (objetivo is not null and frequencia is not null and respondido_em is not null)
  )
);

comment on table public.perfil_declarado is
  'O que a pessoa declarou na chegada. Sem linha = nunca respondeu e nunca adiou.';

comment on column public.perfil_declarado.objetivo is
  'O que a pessoa mais quer conseguir. Código fixo — nunca renomear, viaja para o PostHog.';

comment on column public.perfil_declarado.frequencia is
  'Com que frequência a pessoa aposta hoje. Código fixo — nunca renomear, viaja para o PostHog.';

comment on column public.perfil_declarado.respondido_em is
  'Quando respondeu. Preenchido = já respondeu, e a pesquisa não volta mais.';

comment on column public.perfil_declarado.adiamentos is
  'Quantas vezes apertou Pular antes de responder (ou até agora, se ainda não respondeu).';

-- ── Quem enxerga ────────────────────────────────────────────────────────────
-- Duas políticas somadas, no mesmo par que `public.users` já usa.
alter table public.perfil_declarado enable row level security;

drop policy if exists "Cada um cuida do proprio perfil" on public.perfil_declarado;
create policy "Cada um cuida do proprio perfil"
  on public.perfil_declarado
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Só SELECT, como a política de sócio sobre `users`. O sócio precisa poder
-- consultar o perfil de quem ele atende; mudar a resposta declarada de alguém
-- nunca esteve em questão, e um `for all` daria isso de graça.
--
-- ⚠️ Dar leitura ao sócio NÃO é o mesmo que mostrar isto na ficha do lead. A
-- ficha tem teste exigindo que ela não prometa saber de onde a pessoa veio, e
-- encostar perfil ali é decisão de produto separada.
drop policy if exists "Socios leem todos os perfis" on public.perfil_declarado;
create policy "Socios leem todos os perfis"
  on public.perfil_declarado
  for select
  to authenticated
  using (public.eh_socio());

-- Sem índice além da chave primária, de propósito: toda leitura do produto é
-- por `user_id`, e a única leitura ampla é a do sócio, que varre a tabela
-- inteira de qualquer jeito. Índice aqui seria escrita mais cara sem leitura
-- mais rápida.
