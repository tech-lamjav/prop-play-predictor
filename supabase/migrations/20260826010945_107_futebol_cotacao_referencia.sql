-- 20260826010945_107_futebol_cotacao_referencia
--
-- A tela de detalhe precisa distinguir uma linha sem cotacao de uma candidata
-- que tem preco, mas foi rejeitada pelos filtros de oportunidade. A odd de
-- referencia e a mediana DISCRETA: sempre uma cotacao observada; em amostra par,
-- a menor das duas observacoes centrais.

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_quotes(p_fixture_id bigint)
RETURNS TABLE(
  market_key text, market_label text, outcome_label text, outcome_order integer,
  line double precision, pinnacle_odd double precision, avg_odd double precision,
  reference_odd double precision, best_odd double precision, best_book text,
  n_books integer, pin_open double precision, pin_close double precision
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  with base as (
    select o.market_name, o.outcome_label, o.bookmaker_name, o.collection_window,
           o.odd_decimal, o.line_value, f.kickoff_utc
    from futebol.fact_odds_snapshot o
    join futebol.fact_fixtures f on f.fixture_id = o.fixture_id
    where o.fixture_id = p_fixture_id
      and ( o.market_name = 'Match Winner'
         or o.market_name = 'Both Teams Score'
         or o.market_name = 'Double Chance'
         or (o.market_name = 'Goals Over/Under' and o.outcome_label in
             ('Over 0.5','Under 0.5','Over 1.5','Under 1.5','Over 2.5','Under 2.5',
              'Over 3.5','Under 3.5','Over 4.5','Under 4.5'))
         or (o.market_name = 'Asian Handicap'
             and abs(o.line_value - trunc(o.line_value)) = 0.5
             and abs(o.line_value) <= 2.5))
  ),
  ranked as (
    select b.*,
      case b.collection_window
        when 't15m' then 4 when 't1h' then 3 when 't24h' then 2
        when 'daily' then 1 else 0
      end as window_rank
    from base b
  ),
  chosen_window as (
    select market_name, outcome_label,
      case
        -- Jogo passado: a foto PIT e a janela mais proxima disponivel antes do
        -- apito (t15m, com fallback para t1h, t24h e daily).
        when max(kickoff_utc) <= (now() at time zone 'UTC') then coalesce(
          max(window_rank) filter (where collection_window = 't15m'),
          max(window_rank) filter (where collection_window = 't1h'),
          max(window_rank) filter (where collection_window = 't24h'),
          max(window_rank) filter (where collection_window = 'daily')
        )
        -- Jogo futuro: a coleta mais recente que ja existe para a selecao.
        else max(window_rank)
      end as window_rank
    from ranked
    group by market_name, outcome_label
  ),
  current_quotes as (
    select distinct on (r.market_name, r.outcome_label, r.bookmaker_name)
      r.market_name, r.outcome_label, r.bookmaker_name, r.odd_decimal, r.line_value
    from ranked r
    join chosen_window w using (market_name, outcome_label, window_rank)
    order by r.market_name, r.outcome_label, r.bookmaker_name
  ),
  agg as (
    select c.market_name, c.outcome_label, max(c.line_value) as line_value,
      count(distinct c.bookmaker_name)::int as n_books,
      avg(c.odd_decimal) as avg_odd,
      percentile_disc(0.5) within group (order by c.odd_decimal) as reference_odd
    from current_quotes c
    group by c.market_name, c.outcome_label
  ),
  best_book as (
    select distinct on (c.market_name, c.outcome_label)
      c.market_name, c.outcome_label, c.bookmaker_name, c.odd_decimal
    from current_quotes c
    order by c.market_name, c.outcome_label, c.odd_decimal desc
  ),
  pinnacle as (
    select b.market_name, b.outcome_label,
      max(b.odd_decimal) filter (where b.collection_window='t24h') as t24,
      max(b.odd_decimal) filter (where b.collection_window='t1h') as t1,
      max(b.odd_decimal) filter (where b.collection_window='t15m') as t15
    from base b
    where b.bookmaker_name = 'Pinnacle'
    group by b.market_name, b.outcome_label
  )
  select
    case a.market_name
      when 'Match Winner' then 'match_winner'
      when 'Goals Over/Under' then 'over_under'
      when 'Both Teams Score' then 'btts'
      when 'Double Chance' then 'double_chance'
      when 'Asian Handicap' then 'asian_handicap'
    end,
    a.market_name,
    a.outcome_label,
    case
      when a.outcome_label in ('Home','Yes','Home/Draw')
        or a.outcome_label like 'Over %' or a.outcome_label like 'Home %' then 1
      when a.outcome_label in ('Draw','No','Home/Away')
        or a.outcome_label like 'Under %' or a.outcome_label like 'Away %' then 2
      else 3
    end,
    case when a.market_name in ('Goals Over/Under','Asian Handicap') then a.line_value end,
    coalesce(p.t15, p.t1, p.t24), a.avg_odd, a.reference_odd,
    bb.odd_decimal, bb.bookmaker_name, a.n_books, p.t24, coalesce(p.t15, p.t1)
  from agg a
  join best_book bb using (market_name, outcome_label)
  left join pinnacle p using (market_name, outcome_label)
  where a.market_name <> 'Asian Handicap' or a.n_books >= 3
  order by 1, 5 nulls first, 4;
$function$;

GRANT EXECUTE ON FUNCTION public.get_futebol_fixture_quotes(bigint)
TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_futebol_fixture_quotes(bigint) IS
  'Cotacoes do detalhe do jogo na janela mais recente comum a cada selecao, incluindo mediana discreta como odd de referencia.';
