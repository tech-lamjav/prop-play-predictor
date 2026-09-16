-- 20260917120000_146_futebol_historico_com_vantagem_publicada
--
-- O histórico escondia linha que o assinante VIU.
--
-- Regra do PM, registrada na issue #420 em 15/09/2026: o que não apareceu para o
-- assinante no board não aparece em lugar nenhum — e, pelo mesmo princípio, o
-- que APARECEU continua aparecendo.
--
-- O corte de valor (144) tira da vitrine a linha que paga abaixo do limiar. No
-- board isso é imediato e correto. No histórico, não: a `get_futebol_value_history`
-- devolve a FOTO DO APITO, e o board é reconstruído o tempo todo. Uma linha sai
-- com vantagem de −1%, é exibida no painel e alertada na DM, e no apito está em
-- −2,5%. Julgando pela foto do apito, ela some do histórico — some uma linha que
-- a pessoa viu, e possivelmente apostou.
--
-- Pior: o placar dos sócios julga pela vantagem de NASCIMENTO
-- (`get_futebol_oportunidades_publicadas`), então as duas telas discordavam
-- sobre a mesma linha.
--
-- ## O que muda
--
-- As duas RPCs passam a devolver `edge_publicacao`:
--
--   · no HISTÓRICO, a vantagem da PRIMEIRA versão de cada oportunidade no
--     snapshot — aquela com que ela foi publicada e vista;
--   · no BOARD, a própria `edge`, porque ali a linha está viva: a vantagem
--     corrente É a vantagem com que ela está publicada agora.
--
-- O board precisa da coluna mesmo sem ter o que acrescentar, e isso NÃO é
-- enfeite: `futebol-contrato-score.test.ts` exige que board e histórico exponham
-- exatamente a mesma forma, porque as duas telas compartilham
-- `FutebolValueBoardRow` no front. Uma coluna a mais de um lado quebraria a
-- outra tela sem erro de compilação.
--
-- O front corta por `edge_publicacao`, caindo para `edge` quando ela não vier —
-- histórico anterior a esta migration, ou front novo contra banco velho.
--
-- ⚠️ DROP e CREATE, não `create or replace`: o retorno tabular muda, e o
-- Postgres recusa `create or replace` que altere o RETURNS TABLE. Mesmo motivo
-- documentado na 112, que criou a versão atual das duas.
--
-- ⚠️ Sem filtro de `score_versao` no CTE novo, ao contrário do que a RPC do
-- placar faz. Lá o filtro existe para não somar duas escalas de NOTA; aqui o que
-- viaja é PREÇO, que não mudou de escala entre `legacy` e `contexto_v1`.
--
-- Conferência depois de aplicar:
--   select fixture_id, market, edge, edge_publicacao
--     from public.get_futebol_value_history(current_date - 7, current_date)
--    where edge is distinct from edge_publicacao
--    limit 5;
--   -- espera linhas onde as duas divergem: é justamente o caso que motivou

-- ── O board ─────────────────────────────────────────────────────────────────
drop function if exists public.get_futebol_value_board();

CREATE OR REPLACE FUNCTION public.get_futebol_value_board()
 returns table(fixture_id bigint, home_team_id bigint, away_team_id bigint, home_team_name text, away_team_name text, competition text, kickoff_utc timestamp without time zone, status_short text, market text, outcome text, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_premissas integer, penalidades integer, score integer, faixa text, score_versao text, evidencias text[], premissas_sem_dado integer, edge_publicacao double precision)
 language sql
 security definer
 set search_path to ''
as $function$
  select v.fixture_id, f.home_team_id, f.away_team_id, f.home_team_name, f.away_team_name,
    f.competition, f.kickoff_utc, f.status_short,
    v.market, v.outcome, v.line_value, v.edge, v.best_odd, v.best_book, v.avg_odd, v.n_casas::int, v.janela_usada, v.prob_justa_fechamento,
    v.pts_premissas::int, v.penalidades::int, v.score::int, v.faixa, v.score_versao,
    public.futebol_copy('evidencia', v.market, case v.outcome when 'Home' then 'home' when 'Away' then 'away' else 'any' end, public.futebol_flags(to_jsonb(v), to_jsonb(p), to_jsonb(o), to_jsonb(ah), to_jsonb(bt), to_jsonb(dc))),
    v.premissas_sem_dado::int,
    -- A linha está viva: a vantagem corrente é a que está publicada agora.
    v.edge
  from futebol.fact_value_opportunities v
  join futebol.fact_fixtures f on f.fixture_id = v.fixture_id
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  order by v.score desc, v.edge desc;
$function$;

revoke execute on function public.get_futebol_value_board() from public;
grant execute on function public.get_futebol_value_board() to anon, authenticated, service_role;

-- ── O histórico ─────────────────────────────────────────────────────────────
drop function if exists public.get_futebol_value_history(date, date);

CREATE OR REPLACE FUNCTION public.get_futebol_value_history(p_from date, p_to date)
 returns table(fixture_id bigint, home_team_id bigint, away_team_id bigint, home_team_name text, away_team_name text, competition text, kickoff_utc timestamp without time zone, status_short text, market text, outcome text, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_premissas integer, penalidades integer, score integer, faixa text, score_versao text, evidencias text[], premissas_sem_dado integer, edge_publicacao double precision)
 language sql
 security definer
 set search_path to ''
as $function$
  with pit as (
    select distinct on (h.opportunity_key)
      h.opportunity_key,
      h.fixture_id, h.market, h.outcome, h.line_value, h.edge,
      h.best_odd, h.best_book, h.avg_odd, h.n_casas, h.janela_usada,
      h.prob_justa_fechamento, h.pts_premissas,
      h.penalidades, h.score, h.faixa, h.score_versao,
      h.modelo_api_concorda, h.linha_sharp_confirma, h.premissas_sem_dado
    from futebol.fact_value_opportunities_hist h
    join futebol.fact_fixtures fx on fx.fixture_id = h.fixture_id
    where fx.kickoff_utc >= ((p_from::timestamp at time zone 'America/Sao_Paulo') at time zone 'UTC')
      and fx.kickoff_utc <  (((p_to + 1)::timestamp at time zone 'America/Sao_Paulo') at time zone 'UTC')
      and fx.kickoff_utc <  (now() at time zone 'UTC')
      and h.dbt_valid_from <= fx.kickoff_utc
      and (h.dbt_valid_to is null or fx.kickoff_utc < h.dbt_valid_to)
    order by h.opportunity_key, h.dbt_valid_from desc
  ), nascimento as (
    -- A PRIMEIRA versão de cada oportunidade: a vantagem com que ela foi
    -- publicada e vista. `asc` é a única diferença para o CTE acima.
    select distinct on (h.opportunity_key)
      h.opportunity_key, h.edge
    from futebol.fact_value_opportunities_hist h
    join futebol.fact_fixtures fx on fx.fixture_id = h.fixture_id
    where fx.kickoff_utc >= ((p_from::timestamp at time zone 'America/Sao_Paulo') at time zone 'UTC')
      and fx.kickoff_utc <  (((p_to + 1)::timestamp at time zone 'America/Sao_Paulo') at time zone 'UTC')
      and fx.kickoff_utc <  (now() at time zone 'UTC')
    order by h.opportunity_key, h.dbt_valid_from asc
  )
  select v.fixture_id, f.home_team_id, f.away_team_id, f.home_team_name, f.away_team_name,
    f.competition, f.kickoff_utc, f.status_short,
    v.market, v.outcome, v.line_value, v.edge, v.best_odd, v.best_book, v.avg_odd, v.n_casas::int, v.janela_usada, v.prob_justa_fechamento,
    v.pts_premissas::int, v.penalidades::int, v.score::int, v.faixa, v.score_versao,
    public.futebol_copy('evidencia', v.market, case v.outcome when 'Home' then 'home' when 'Away' then 'away' else 'any' end, public.futebol_flags(to_jsonb(v), to_jsonb(p), to_jsonb(o), to_jsonb(ah), to_jsonb(bt), to_jsonb(dc))),
    v.premissas_sem_dado::int,
    n.edge
  from pit v
  join futebol.fact_fixtures f on f.fixture_id = v.fixture_id
  left join nascimento n on n.opportunity_key = v.opportunity_key
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  order by f.kickoff_utc desc, v.score desc, v.edge desc;
$function$;

-- Função nova nasce executável por PUBLIC (issue #408), e no Supabase o schema
-- public ainda dá EXECUTE explícito a anon e authenticated por privilégio padrão
-- (ver a 143). Aqui anon e authenticated PRECISAM executar — é o painel, com a
-- chave pública —, então o revoke fecha só PUBLIC e o grant declara os três.
revoke execute on function public.get_futebol_value_history(date, date) from public;
grant execute on function public.get_futebol_value_history(date, date) to anon, authenticated, service_role;
