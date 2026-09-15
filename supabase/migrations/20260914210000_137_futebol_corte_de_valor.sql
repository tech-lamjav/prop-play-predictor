-- 20260914210000_137_futebol_corte_de_valor
--
-- A linha que paga abaixo do preço justo sai da vitrine — por mercado.
--
-- Decisão do PM em 12/09/2026 (ClickUp `wdx6zf1gpn`): no `asian_handicap`, a
-- linha cuja vantagem sobre a referência sharp é de −2% ou pior não aparece no
-- painel nem nas mensagens. O board continua publicando e gravando no funil e no
-- histórico — mesmo princípio da 116: parar de publicar pararia de medir.
--
-- O número que motivou, remedido na analytics-engineering#156 em 14/09/2026
-- (com piso de histórico e com os gates de preço do board), kickoff desde 01/09:
--
--   vantagem acima de −2%       122 linhas   ROI  +7,9   EP 9,0
--   vantagem de −2% ou pior     232 linhas   ROI −17,4   EP 7,5
--
-- O corte separa com folga: 25 pontos entre os dois lados. O NÍVEL do lado que
-- fica ainda não se distingue de zero, e é por isso que esta migration NÃO
-- devolve o handicap à vitrine. Ela deixa o corte pronto; religar continua sendo
-- o UPDATE da 116, e é decisão separada.
--
-- ⚠️ POR QUE TABELA E NÃO CONSTANTE
-- O mesmo argumento da 116: o painel roda no browser e a DM roda em Deno, e os
-- dois não compartilham módulo. Um corte só no front esconderia no painel e
-- deixaria a DM mandando a linha cortada. O banco é a única fonte comum.
--
-- ⚠️ POR QUE `vigente_desde`
-- É a lição da 119. O histórico mostra o passado, e sem a data a linha cortada
-- hoje voltaria amanhã pela foto do apito. Antes da data a linha fica, porque
-- esteve na tela; a partir dela, some em qualquer tela.
--
-- Mudar o limiar é UPDATE em `limiar` E em `vigente_desde`. Uma data só não
-- guarda a história dos limiares: a linha anterior à mudança passa a ser julgada
-- pelo limiar novo. Aceito enquanto o limiar for um só por mercado e mudar
-- raramente; se passar a mudar com frequência, isto vira tabela de vigências.
--
-- Conferência depois de aplicar:
--   select * from public.get_futebol_limiar_valor();
--   -- espera asian_handicap, -0.02, vigente_desde = momento da aplicação

-- ── O corte ─────────────────────────────────────────────────────────────────
create table if not exists public.futebol_limiar_valor (
  market text primary key,
  -- Fração, na MESMA escala da coluna `edge` do board: −0,02 é −2%. O check
  -- barra o erro mais provável de digitação, que é escrever −2 querendo −2%.
  limiar numeric not null check (limiar > -1 and limiar < 1),
  vigente_desde timestamptz not null default now(),
  motivo text not null
);

-- RLS ligada e SEM policy, no padrão da 116: ninguém lê a tabela direto, só a
-- RPC abaixo, que é SECURITY DEFINER.
alter table public.futebol_limiar_valor enable row level security;

comment on table public.futebol_limiar_valor is
  'Limiar de vantagem por mercado. Linha com edge <= limiar sai da vitrine (painel e DM). Não é gate: o board continua publicando.';

-- ── A leitura ───────────────────────────────────────────────────────────────
create or replace function public.get_futebol_limiar_valor()
returns table (market text, limiar numeric, vigente_desde timestamptz)
language sql
stable
security definer
set search_path to ''
as $function$
  select l.market, l.limiar, l.vigente_desde
    from public.futebol_limiar_valor l
   order by l.market;
$function$;

comment on function public.get_futebol_limiar_valor() is
  'O corte de valor por mercado, com a data em que passou a valer. A data separa a linha que esteve na tela da que nunca esteve.';

-- Função nova em Postgres nasce executável por PUBLIC, e grant sem revoke não
-- fecha nada (issue #408). O revoke vem no MESMO arquivo, e o grant abaixo é o
-- que de fato deixa ler — o painel precisa dela para anon e authenticated.
revoke execute on function public.get_futebol_limiar_valor() from public;
grant execute on function public.get_futebol_limiar_valor() to anon, authenticated, service_role;

-- ── O primeiro caso ─────────────────────────────────────────────────────────
insert into public.futebol_limiar_valor (market, limiar, motivo)
values (
  'asian_handicap',
  -0.02,
  'Desde 01/09: edge > -2% ROI +7,9 em 122 linhas (EP 9,0); edge <= -2% ROI -17,4 em 232 (EP 7,5). Remedicao na analytics-engineering#156. Decisao do PM em 12/09/2026, ClickUp wdx6zf1gpn.'
)
on conflict (market) do nothing;
