-- 097_futebol_rpc_janela_daily.sql
--
-- C8, parte 1 de 2: a tela de odds pode mostrar preço de dias atrás.
--
-- Numerada 097 porque a develop ja usa ate a 096 (092-096 sao as RPCs da agenda,
-- das premissas e dos grupos). Nenhuma delas toca as funcoes alteradas aqui.
--
-- DEFEITO
-- As duas RPCs de odds escolhem a janela de coleta corrente com um CASE que
-- conhece apenas tres janelas:
--
--     case when collection_window = 't15m' then 3
--          when collection_window = 't1h'  then 2
--          else 1 end
--
-- A quarta janela, 'daily', entrou em 07/08/2026 com a coleta de 7 dias
-- (data-engineering#34) e caiu no ELSE, empatando com 't24h'. Em empate o
-- DISTINCT ON do Postgres resolve arbitrariamente, e pode trocar de resposta
-- entre chamadas sem nenhuma mudanca de dado.
--
-- ALCANCE MEDIDO
-- 27.066 chaves (fixture, casa, mercado, saida) empatadas em 25 fixtures no PRD
-- (medicao do Mateus, 10/08). Reproduzido no espelho de staging: 26 fixtures.
-- Sao exatamente os jogos que ja tem 'daily' e 't24h' e ainda nao tem 't1h' /
-- 't15m', ou seja os que estao entrando na janela de 24h -- justamente os que o
-- assinante esta olhando.
--
-- CORRECAO
-- Ordem total e explicita entre as quatro janelas, sem ELSE ambiguo:
--     t15m (4) > t1h (3) > t24h (2) > daily (1) > qualquer outra (0)
--
-- O 'else 0' cobre janela nova que venha a existir sem ninguem lembrar deste
-- arquivo: ela perde de todas as conhecidas em vez de empatar com uma delas.
-- Foi o empate, e nao a ausencia, que causou o defeito.
--
-- ============================================================================
-- ATENCAO ANTES DE APLICAR
--
-- 1. Os corpos abaixo foram extraidos de pg_get_functiondef no espelho de
--    STAGING (kpbjuplcwiyrymafhehz), nao do PRD. Nao tenho acesso de leitura ao
--    PRD. Se o PRD tiver alteracao que o staging nao tem, este CREATE OR REPLACE
--    a reverte em silencio.
--    => DIFERENCIAR CONTRA O PRD ANTES DE APLICAR. O unico trecho alterado por
--       esta migration e o CASE da janela; qualquer outra diferenca e sinal de
--       divergencia entre os ambientes.
--
-- 2. docs/futebol-prod-deploy.sql JA ESTAVA OBSOLETO. A definicao viva de
--    get_futebol_fixture_odds tem um filtro que o arquivo nao tem
--    ("where (a.market_name <> 'Asian Handicap' or a.n_books >= 3)").
--    Nao usar aquele arquivo como fonte.
--
-- 3. Esta migration NAO altera assinatura de funcao, entao nao exige DROP e nao
--    interfere na ordem de deploy do dbt. Pode ir sozinha.
--
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1/2  get_futebol_fixture_odds  (tela de detalhe do jogo)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_odds(p_fixture_id bigint)
 RETURNS TABLE(market_key text, market_label text, outcome_label text, outcome_order integer, line double precision, pinnacle_odd double precision, avg_odd double precision, best_odd double precision, best_book text, n_books integer, pin_open double precision, pin_close double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return query
  with base as (
    select o.market_name, o.outcome_label, o.bookmaker_name, o.collection_window, o.odd_decimal, o.line_value
    from futebol.fact_odds_snapshot o
    where o.fixture_id = p_fixture_id
      and ( o.market_name = 'Match Winner'
         or o.market_name = 'Both Teams Score'
         or o.market_name = 'Double Chance'
         or (o.market_name = 'Goals Over/Under' and o.outcome_label in
             ('Over 0.5','Under 0.5','Over 1.5','Under 1.5','Over 2.5','Under 2.5','Over 3.5','Under 3.5','Over 4.5','Under 4.5'))
         or (o.market_name = 'Asian Handicap' and abs(o.line_value - trunc(o.line_value)) = 0.5 and abs(o.line_value) <= 2.5) )
  ),
  win_rank as ( select *, case when collection_window='t15m' then 4 when collection_window='t1h' then 3 when collection_window='t24h' then 2 when collection_window='daily' then 1 else 0 end wr from base ),
  cur_pick as (
    select distinct on (b.market_name, b.outcome_label, b.bookmaker_name)
      b.market_name, b.outcome_label, b.bookmaker_name, b.odd_decimal, b.line_value
    from win_rank b
    order by b.market_name, b.outcome_label, b.bookmaker_name, b.wr desc
  ),
  agg as (
    select c.market_name, c.outcome_label, max(c.line_value) line_value,
      count(distinct c.bookmaker_name)::int n_books, avg(c.odd_decimal) avg_odd
    from cur_pick c group by c.market_name, c.outcome_label
  ),
  best_bk as (
    select distinct on (c.market_name, c.outcome_label)
      c.market_name, c.outcome_label, c.bookmaker_name best_book, c.odd_decimal best_odd
    from cur_pick c order by c.market_name, c.outcome_label, c.odd_decimal desc
  ),
  pin as (
    select b.market_name, b.outcome_label,
      max(b.odd_decimal) filter (where b.collection_window='t24h') t24,
      max(b.odd_decimal) filter (where b.collection_window='t1h')  t1,
      max(b.odd_decimal) filter (where b.collection_window='t15m') t15
    from base b where b.bookmaker_name = 'Pinnacle'
    group by b.market_name, b.outcome_label
  )
  select
    case a.market_name when 'Match Winner' then 'match_winner'
      when 'Goals Over/Under' then 'over_under'
      when 'Both Teams Score' then 'btts'
      when 'Double Chance' then 'double_chance'
      when 'Asian Handicap' then 'asian_handicap' end,
    a.market_name, a.outcome_label,
    case when a.outcome_label in ('Home','Yes','Home/Draw') or a.outcome_label like 'Over %' or a.outcome_label like 'Home %' then 1
         when a.outcome_label in ('Draw','No','Home/Away') or a.outcome_label like 'Under %' or a.outcome_label like 'Away %' then 2 else 3 end,
    case when a.market_name in ('Goals Over/Under','Asian Handicap') then a.line_value else null end,
    coalesce(p.t15, p.t1, p.t24), a.avg_odd,
    bb.best_odd, bb.best_book, a.n_books, p.t24, coalesce(p.t15, p.t1)
  from agg a
  join best_bk bb on bb.market_name = a.market_name and bb.outcome_label = a.outcome_label
  left join pin p on p.market_name = a.market_name and p.outcome_label = a.outcome_label
  where (a.market_name <> 'Asian Handicap' or a.n_books >= 3)
  order by 1, 5 nulls first, 4;
end $function$;

-- ---------------------------------------------------------------------------
-- 2/2  get_futebol_odds_board  (board de odds)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_futebol_odds_board()
 RETURNS TABLE(fixture_id bigint, home_team_id bigint, away_team_id bigint, home_team_name text, away_team_name text, competition text, kickoff_utc timestamp without time zone, status_short text, market_key text, market_label text, outcome_label text, outcome_order integer, line double precision, pinnacle_odd double precision, avg_odd double precision, best_odd double precision, best_book text, n_books integer, pin_open double precision, pin_close double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return query
  with base as (
    select o.fixture_id, o.market_name, o.outcome_label, o.bookmaker_name, o.collection_window, o.odd_decimal, o.line_value
    from futebol.fact_odds_snapshot o
    where ( o.market_name = 'Match Winner'
         or o.market_name = 'Both Teams Score'
         or o.market_name = 'Double Chance'
         or (o.market_name = 'Goals Over/Under' and o.outcome_label in
             ('Over 0.5','Under 0.5','Over 1.5','Under 1.5','Over 2.5','Under 2.5','Over 3.5','Under 3.5','Over 4.5','Under 4.5')) )
  ),
  cur_pick as (
    select distinct on (b.fixture_id, b.market_name, b.outcome_label, b.bookmaker_name)
      b.fixture_id, b.market_name, b.outcome_label, b.bookmaker_name, b.odd_decimal, b.line_value
    from base b
    order by b.fixture_id, b.market_name, b.outcome_label, b.bookmaker_name,
             case when b.collection_window='t15m' then 4 when b.collection_window='t1h' then 3 when b.collection_window='t24h' then 2 when b.collection_window='daily' then 1 else 0 end desc
  ),
  agg as (
    select c.fixture_id, c.market_name, c.outcome_label, max(c.line_value) line_value,
      count(distinct c.bookmaker_name)::int n_books, avg(c.odd_decimal) avg_odd
    from cur_pick c group by c.fixture_id, c.market_name, c.outcome_label
  ),
  best_bk as (
    select distinct on (c.fixture_id, c.market_name, c.outcome_label)
      c.fixture_id, c.market_name, c.outcome_label, c.bookmaker_name best_book, c.odd_decimal best_odd
    from cur_pick c order by c.fixture_id, c.market_name, c.outcome_label, c.odd_decimal desc
  ),
  pin as (
    select b.fixture_id, b.market_name, b.outcome_label,
      max(b.odd_decimal) filter (where b.collection_window='t24h') t24,
      max(b.odd_decimal) filter (where b.collection_window='t1h')  t1,
      max(b.odd_decimal) filter (where b.collection_window='t15m') t15
    from base b where b.bookmaker_name = 'Pinnacle'
    group by b.fixture_id, b.market_name, b.outcome_label
  )
  select
    a.fixture_id, f.home_team_id, f.away_team_id, f.home_team_name, f.away_team_name,
    f.competition, f.kickoff_utc, f.status_short,
    case a.market_name when 'Match Winner' then 'match_winner'
      when 'Goals Over/Under' then 'over_under'
      when 'Both Teams Score' then 'btts'
      when 'Double Chance' then 'double_chance' end,
    a.market_name, a.outcome_label,
    case when a.outcome_label in ('Home','Yes','Home/Draw') or a.outcome_label like 'Over %' then 1
         when a.outcome_label in ('Draw','No','Home/Away') or a.outcome_label like 'Under %' then 2 else 3 end,
    case when a.market_name = 'Goals Over/Under' then a.line_value else null end,
    coalesce(p.t15, p.t1, p.t24), a.avg_odd,
    bb.best_odd, bb.best_book, a.n_books, p.t24, coalesce(p.t15, p.t1)
  from agg a
  join futebol.fact_fixtures f on f.fixture_id = a.fixture_id
  join best_bk bb on bb.fixture_id=a.fixture_id and bb.market_name=a.market_name and bb.outcome_label=a.outcome_label
  left join pin p on p.fixture_id=a.fixture_id and p.market_name=a.market_name and p.outcome_label=a.outcome_label
  order by a.fixture_id, 9, 13 nulls first, 12;
end $function$;

-- ============================================================================
-- VERIFICACAO APOS APLICAR
--
-- 1. As duas funcoes passam a conhecer a janela 'daily':
--
--    select p.proname,
--           position('daily' in pg_get_functiondef(p.oid)) > 0 as conhece_daily
--    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('get_futebol_fixture_odds','get_futebol_odds_board');
--    -- esperado: true nas duas
--
-- 2. Nenhuma chave empatada sobra. Antes da migration esta consulta devolvia
--    linhas; depois tem que devolver zero:
--
--    with s as (
--      select fixture_id, bookmaker_id, market_id,
--             coalesce(outcome_side, outcome_label) as saida,
--             coalesce(line_value, -999) as linha,
--             count(*) filter (where collection_window in ('daily','t24h')) as empatadas,
--             count(*) filter (where collection_window in ('t1h','t15m'))   as mais_novas
--      from futebol.fact_odds_snapshot
--      group by 1,2,3,4,5
--    )
--    select count(*) from s where empatadas = 2 and mais_novas = 0;
--    -- a consulta acima mede a POPULACAO em risco, que continua existindo.
--    -- O que a migration garante e que a escolha entre as duas deixa de ser
--    -- arbitraria: 't24h' sempre vence 'daily'. Para provar, chamar a RPC duas
--    -- vezes seguidas num fixture dessa lista e conferir que a odd nao muda.
--
-- 3. Chamar get_futebol_fixture_odds no mesmo fixture 3x seguidas e conferir
--    que pinnacle_odd, best_odd e avg_odd sao identicos nas tres.
-- ============================================================================
