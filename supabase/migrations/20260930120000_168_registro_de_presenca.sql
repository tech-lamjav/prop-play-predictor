-- 20260930120000_168_registro_de_presenca
--
-- De onde a pessoa estava quando usou a plataforma.
--
-- Spec na issue #548, ticket #550.
--
-- Existe para sustentar uma frase diante do fisco: "no dia tal, tantas pessoas
-- ativas, e de quais países". Essa frase é metade da caracterização de
-- exportação de serviços — a outra metade é o ingresso de divisas, que não
-- passa por aqui.
--
-- ── É DIÁRIO DE PRESENÇA, NÃO LOG DE TRÁFEGO ────────────────────────────────
-- Uma linha por pessoa por DIA. Abrir dez telas no mesmo dia continua sendo uma
-- linha. A chave primária composta garante isso por construção, e não por
-- cuidado de quem escreve — que é a diferença entre uma regra e uma intenção.
--
-- O formato não é economia de disco: a 40 MB por ano a cada mil pessoas ativas,
-- o disco nunca seria o limite. O formato é o da PERGUNTA. E IP é dado pessoal
-- sob a LGPD, então cada linha a mais é exposição a mais sem resposta a mais.
--
-- ── A PRIMEIRA DO DIA VENCE, E A LINHA NÃO MUDA ─────────────────────────────
-- Quem já tem linha no dia não a reescreve. Um registro que pode ser
-- sobrescrito é um registro mais fraco, e o que ele precisa provar é justamente
-- que ninguém mexeu depois.
--
-- ⚠️ Isso NÃO enfraquece o bloqueio, porque o bloqueio não lê esta tabela. O
-- porteiro DEVOLVE o veredito deste momento, e a tela obedece o que foi
-- devolvido; a tabela guarda o do primeiro acesso do dia, para a prova. São
-- duas coisas com o mesmo nome e propósitos diferentes: uma decide agora, a
-- outra conta depois.
--
-- ── O PAÍS CHEGA DEPOIS ─────────────────────────────────────────────────────
-- Em tempo real o porteiro só pergunta "é do Brasil?", que tem resposta local.
-- "De que país é" exige consultar alguém, e consultar alguém no caminho de quem
-- chega é exatamente o custo que este desenho existe para não pagar. O país é
-- preenchido em lote depois (#553), e por isso nasce vazio.
--
-- Conferência depois de aplicar:
--   select count(*) from public.registro_de_presenca;
--   select value from public.ops_config where key = 'bloqueio_brasil_ligado';  -- espera 'nao'

create table if not exists public.registro_de_presenca (
  user_id uuid not null references public.users(id) on delete cascade,
  dia date not null,

  -- O endereço que o NOSSO servidor viu. Não é declarado por ninguém, e é por
  -- isso que ele serve de prova. Veja a origem observada no glossário da
  -- pessoa, em src/components/perfil/CONTEXT.md.
  ip inet not null,

  -- ── DUAS COLUNAS, DUAS PERGUNTAS ──────────────────────────────────────────
  -- `origem` é uma OBSERVAÇÃO: o que o endereço disse. `veredito` é o que
  -- ACONTECEU com a pessoa. Guardar só o segundo pareceria suficiente e não é:
  -- enquanto a chave do bloqueio estiver desligada, todo mundo entra, e um
  -- registro só de vereditos não provaria nada sobre esse período inteiro.
  --
  -- E observação envelhece melhor que decisão. Se a política mudar, as linhas
  -- antigas de `veredito` passam a significar outra coisa; as de `origem`
  -- continuam significando exatamente o que significavam.

  -- O que o endereço disse. Três estados, e não dois: "nao_sei" é a nossa
  -- ignorância, "fora" é uma afirmação sobre o IP. Achatar os dois faria um
  -- defeito nosso virar prova de que alguém estava no exterior — que é
  -- justamente a prova que este registro existe para sustentar.
  origem text not null check (origem in ('brasil', 'fora', 'nao_sei')),

  -- O que aconteceu com a pessoa no primeiro acesso do dia.
  --
  -- Só dois estados: a incerteza mora em `origem`, e origem incerta deixa
  -- entrar. Uma pessoa ou entrou ou não entrou; não existe meio acesso.
  veredito text not null check (veredito in ('entrou', 'barrado')),

  -- Código do país, em duas letras. Vazio quer dizer "ainda não resolvido" —
  -- veja `pais_resolvido_em` abaixo para o que distingue isso de "não deu".
  pais text,

  -- Quando o lote tentou resolver o país, tenha ele conseguido ou não.
  --
  -- Existe para separar duas situações que um `pais` vazio confunde: a linha
  -- que ninguém processou ainda, e a linha cujo endereço não resolveu em país
  -- nenhum. Sem esta coluna, o lote reprocessaria para sempre as que nunca vão
  -- resolver, e ninguém saberia que elas existem.
  pais_resolvido_em timestamptz,

  criado_em timestamptz not null default now(),

  primary key (user_id, dia)
);

comment on table public.registro_de_presenca is
  'Diário de presença: uma linha por pessoa por dia, com o endereço que o servidor viu e o veredito do porteiro. Evidência fiscal de que o serviço é usufruído fora do Brasil (#548).';
comment on column public.registro_de_presenca.ip is
  'Origem observada: o endereço que o servidor viu, nunca o que a pessoa declara. Dado pessoal sob a LGPD.';
comment on column public.registro_de_presenca.origem is
  'O que o endereço disse: brasil, fora, ou nao_sei. É a observação, e é ela que serve de prova — vale mesmo com o bloqueio desligado.';
comment on column public.registro_de_presenca.veredito is
  'O que aconteceu com a pessoa no PRIMEIRO acesso do dia. O bloqueio não lê daqui — ele usa o veredito devolvido no momento.';
comment on column public.registro_de_presenca.pais is
  'Resolvido em lote depois (#553). Vazio com pais_resolvido_em preenchido quer dizer que não foi possível resolver.';

-- ── Quem enxerga ────────────────────────────────────────────────────────────
-- Só o sócio lê, e ninguém escreve pela API: quem escreve é a função do
-- porteiro, com service role, que não passa por RLS.
--
-- A pessoa NÃO lê a própria linha, e é de propósito. Esta tabela não é um
-- recurso do produto, é registro sobre a pessoa — e um registro que o
-- registrado pode consultar em tempo real é um registro que ele aprende a
-- contornar.
alter table public.registro_de_presenca enable row level security;

drop policy if exists "Socios leem o registro de presenca" on public.registro_de_presenca;
create policy "Socios leem o registro de presenca"
  on public.registro_de_presenca
  for select
  to authenticated
  using (public.eh_socio());

-- Índice parcial só para a fila do lote que resolve o país.
--
-- Ele encolhe sozinho: cada linha resolvida sai do índice, então o que sobra é
-- sempre a fila pendente, e não a tabela inteira. Sem ele, o lote varreria o
-- histórico completo toda vez que rodasse, e o custo cresceria para sempre.
--
-- Não há índice por `dia`, de propósito: o relatório roda raramente e varrer a
-- tabela inteira num relatório raro é mais barato que manter um índice em toda
-- escrita.
create index if not exists registro_de_presenca_pais_pendente
  on public.registro_de_presenca (criado_em)
  where pais_resolvido_em is null;

-- ── A chave do bloqueio ─────────────────────────────────────────────────────
-- Nasce DESLIGADA. O bloqueio precisa poder ser exercitado em staging antes de
-- valer, e a data de virada é decisão de negócio, não de deploy.
--
-- Em `ops_config` e não em variável de ambiente porque aqui dá para auditar por
-- SQL quem ligou e quando — variável de ambiente ninguém confere, e esta é uma
-- chave que desliga o acesso de um país inteiro.
insert into public.ops_config (key, value)
values ('bloqueio_brasil_ligado', 'nao')
on conflict (key) do nothing;
