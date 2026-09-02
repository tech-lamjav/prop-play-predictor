-- 20260901200000_116_futebol_mercados_ocultos
--
-- Um mercado pode sair da VITRINE sem sair do BOARD.
--
-- Decisão do PM em 31/08/2026 (prop-play-predictor#324, registrada também na
-- analytics-engineering#109): o `asian_handicap` deixa de ser exibido ao
-- assinante no lançamento do Score de contexto, mas CONTINUA sendo publicado,
-- gravado no funil e no histórico. Parar de publicar pararia de medir, e é a
-- medição que decide quando o mercado volta.
--
-- O número que motivou, do board efetivamente publicado (kickoff 27/07 a
-- 31/08/2026, liquidado nos 90 minutos, erro-padrão agrupado por fixture):
--
--   goals_over_under   50 linhas   ROI +22,3   EP 17,4   31 acertos
--   asian_handicap     23 linhas   ROI −48,4   EP 16,5    6 acertos
--
-- Os dois quase se anulam em unidades (+11,13 contra −11,14), ou seja: o
-- produto empata porque o Gols paga o Handicap. E o buraco é anterior ao
-- redesenho do Score — aparece igual nas duas metodologias.
--
-- A investigação do mercado corre na B3 (ClickUp `wdx6zev656`) e não bloqueia
-- o lançamento.
--
-- ⚠️ POR QUE TABELA E NÃO CONSTANTE NO CÓDIGO
-- Devolver o Handicap à tela precisa ser um UPDATE, não um release. São dois
-- consumidores em runtimes diferentes — o painel (browser) e a DM do Telegram
-- (edge function, Deno) — e eles não compartilham módulo. A tabela é a única
-- fonte que os dois leem, então não há como um voltar sem o outro.
--
-- Conferência depois de aplicar:
--   select * from public.get_futebol_mercados_ocultos();  -- espera {asian_handicap}

-- ── A vitrine ───────────────────────────────────────────────────────────────
create table if not exists public.futebol_mercados_ocultos (
  market text primary key,
  -- A linha existe mesmo com `oculto = false`: ela é o registro de que o
  -- mercado JÁ esteve fora, e `desde` diz desde quando. Apagar a linha para
  -- devolver o mercado perderia essa data, que é o que torna o antes/depois
  -- comparável quando ele voltar.
  oculto boolean not null default true,
  oculto_desde timestamptz not null default now(),
  motivo text not null
);

-- RLS ligada e SEM policy, de propósito, no mesmo padrão da
-- `futebol_premissa_copy` (migration 106): nada lê esta tabela direto. A RPC
-- abaixo é SECURITY DEFINER e lê como dono, então a ausência de policy é o que
-- garante que ninguém leia por fora.
alter table public.futebol_mercados_ocultos enable row level security;

comment on table public.futebol_mercados_ocultos is
  'Mercados retirados da vitrine do produto. Não é gate: o board continua publicando.';

-- ── A leitura ───────────────────────────────────────────────────────────────
-- Devolve `text[]` e não `setof` porque os dois consumidores querem a lista
-- inteira de uma vez, e um array evita o caso de "zero linhas" ter de ser
-- tratado como erro em dois lugares diferentes.
create or replace function public.get_futebol_mercados_ocultos()
returns text[]
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(array_agg(market order by market), array[]::text[])
    from public.futebol_mercados_ocultos
   where oculto;
$function$;

grant execute on function public.get_futebol_mercados_ocultos() to anon, authenticated, service_role;

-- ── O primeiro caso ─────────────────────────────────────────────────────────
insert into public.futebol_mercados_ocultos (market, oculto, oculto_desde, motivo)
values (
  'asian_handicap',
  true,
  timestamptz '2026-09-01 00:00:00+00',
  'ROI -48,4 em 23 linhas publicadas (EP 16,5), contra +22,3 do Gols. Investigacao na B3 (ClickUp wdx6zev656). Decisao do PM em 31/08/2026, prop-play-predictor#324.'
)
on conflict (market) do nothing;
