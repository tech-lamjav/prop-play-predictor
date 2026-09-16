-- 20260917120000_146_futebol_historico_com_vantagem_publicada
--
-- As telas escondiam linha que o assinante VIU.
--
-- Regra do PM, registrada na issue #420 em 15/09/2026: o que não apareceu para o
-- assinante no board não aparece em lugar nenhum — e, pelo mesmo princípio, o
-- que APARECEU continua aparecendo.
--
-- O corte de valor (144) tira da vitrine a linha que paga abaixo do limiar. Com
-- a linha viva isso está certo. Depois do apito, não: tanto
-- `get_futebol_value_history` quanto `get_futebol_fixture_value` passam a
-- devolver a FOTO DO APITO, e o board é reconstruído o tempo todo. Uma linha sai
-- com vantagem de −1%, é exibida no painel e alertada na DM, e no apito está em
-- −2,5%. Julgando pela foto do apito, ela some das duas telas — some uma linha
-- que a pessoa viu, e possivelmente apostou.
--
-- Pior: o placar dos sócios julga pela FOTO DE NASCIMENTO
-- (`get_futebol_oportunidades_publicadas`), então as telas discordavam sobre a
-- mesma linha.
--
-- ## O que muda
--
-- As três RPCs passam a devolver `edge_publicacao` — a vantagem da foto de
-- nascimento:
--
--   · no HISTÓRICO e no DETALHE DO JOGO, a vantagem da PRIMEIRA versão de cada
--     oportunidade no snapshot, que é aquela com que ela foi publicada e vista;
--   · no BOARD, e no detalhe enquanto o jogo não começou, a própria `edge`:
--     ali a linha está viva, e a vantagem corrente É a que está publicada agora.
--
-- O front corta por `edge_publicacao`, caindo para `edge` quando ela não vier —
-- histórico anterior a esta migration, ou front novo contra banco velho.
--
-- O board precisa da coluna mesmo sem ter o que acrescentar, e isso NÃO é
-- enfeite: `futebol-contrato-score.test.ts` exige que board e histórico exponham
-- exatamente a mesma forma, porque as duas telas compartilham
-- `FutebolValueBoardRow` no front. Uma coluna a mais de um lado quebraria a
-- outra tela sem erro de compilação.
--
-- ⚠️ DROP e CREATE, não `create or replace`: o retorno tabular muda, e o
-- Postgres recusa `create or replace` que altere o RETURNS TABLE. Mesmo motivo
-- documentado na 112, que criou a versão atual das três.
--
-- ⚠️ Sem filtro de `score_versao` nos CTEs de nascimento, ao contrário do que a
-- RPC do placar faz. Lá o filtro existe para não somar duas escalas de NOTA;
-- aqui o que viaja é PREÇO, que não mudou de escala entre `legacy` e
-- `contexto_v1`. Consequência conhecida e registrada na #420: para uma
-- oportunidade nascida antes do cutover de 03/09 e reavaliada depois, o placar
-- chama de nascimento a primeira versão `contexto_v1` e estas RPCs chamam a
-- primeira de todas. Quem está certo é o histórico — "apareceu na tela" não tem
-- versão de metodologia —, e fechar a divergência é mexer no placar, em ticket
-- próprio.
--
-- ⚠️ SEM revoke de PUBLIC nestas três. `anon` e `authenticated` precisam
-- executá-las — é o painel, com a chave pública — e no Supabase o revoke de
-- PUBLIC não tira o grant explícito que o privilégio padrão do schema dá a esses
-- dois papéis (ver a 143). Revogar só de PUBLIC aqui não fecharia nada e faria
-- `PASSIVO-definidoras-abertas.txt` registrar um fechamento que não houve.
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
    -- A FOTO DE NASCIMENTO: a primeira versão de cada oportunidade, com a
    -- vantagem que ela tinha quando foi publicada e vista. `asc` é a única
    -- diferença de ordem para o CTE acima; `dbt_scd_id` é o desempate
    -- explícito que a 102 exige do DISTINCT ON, para o dia em que o snapshot
    -- produzir duas versões com o mesmo `dbt_valid_from`.
    select distinct on (h.opportunity_key)
      h.opportunity_key, h.edge
    from futebol.fact_value_opportunities_hist h
    join futebol.fact_fixtures fx on fx.fixture_id = h.fixture_id
    where fx.kickoff_utc >= ((p_from::timestamp at time zone 'America/Sao_Paulo') at time zone 'UTC')
      and fx.kickoff_utc <  (((p_to + 1)::timestamp at time zone 'America/Sao_Paulo') at time zone 'UTC')
      and fx.kickoff_utc <  (now() at time zone 'UTC')
    order by h.opportunity_key, h.dbt_valid_from asc, h.dbt_scd_id asc
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

grant execute on function public.get_futebol_value_history(date, date) to anon, authenticated, service_role;

-- ── O detalhe do jogo ───────────────────────────────────────────────────────
-- Sem isto, o corte de valor continuaria escondendo no detalhe a linha que o
-- histórico passou a mostrar, e as duas telas voltariam a discordar — que é o
-- defeito que esta migration existe para fechar.
drop function if exists public.get_futebol_fixture_value(bigint);

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_value(p_fixture_id bigint)
 returns table(market text, outcome text, outcome_order integer, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_premissas integer, penalidades integer, penalidades_especificas_pts integer, score integer, faixa text, score_versao text, modelo_api_concorda boolean, linha_sharp_confirma boolean, evidencias text[], avisos text[], contras text[], premissas_sem_dado integer, edge_publicacao double precision)
 language sql
 security definer
 set search_path to ''
as $function$
  -- migration 101: kickoff no futuro lê o board; kickoff já passado lê a FOTO DO
  -- APITO no snapshot. migration 105: os avisos leem as colunas pen_* do mart.
  with v_src as (
    select fixture_id, market, outcome, line_value, competition, season, edge,
           pts_premissas, penalidades, score, faixa, score_versao, best_odd, best_book,
           avg_odd, n_casas, prob_justa_fechamento, valor_fonte, janela_usada,
           penalidades_especificas_pts, modelo_api_concorda,
           linha_sharp_confirma, pin_n_outcomes, is_half_line, dbt_loaded_at, premissas_sem_dado,
           pen_odd_outlier, pen_poucas_casas, pen_odd_longshot, pen_odd_juice
    from futebol.fact_value_opportunities
    where fixture_id = p_fixture_id
      and exists (select 1 from futebol.fact_fixtures fx
                   where fx.fixture_id = p_fixture_id and fx.kickoff_utc > (now() at time zone 'UTC'))
    union all
    select fixture_id, market, outcome, line_value, competition, season, edge,
           pts_premissas, penalidades, score, faixa, score_versao, best_odd, best_book,
           avg_odd, n_casas, prob_justa_fechamento, valor_fonte, janela_usada,
           penalidades_especificas_pts, modelo_api_concorda,
           linha_sharp_confirma, pin_n_outcomes, is_half_line, dbt_loaded_at, premissas_sem_dado,
           pen_odd_outlier, pen_poucas_casas, pen_odd_longshot, pen_odd_juice
    from futebol.fact_value_opportunities_hist h
    where h.fixture_id = p_fixture_id
      and exists (select 1 from futebol.fact_fixtures fx
                   where fx.fixture_id = p_fixture_id
                     and fx.kickoff_utc <= (now() at time zone 'UTC')
                     and h.dbt_valid_from <= fx.kickoff_utc
                     and (h.dbt_valid_to is null or fx.kickoff_utc < h.dbt_valid_to))
  ), nascimento as (
    -- A FOTO DE NASCIMENTO das linhas deste jogo. Chaveada pelas quatro colunas
    -- que identificam a saída, e não por `opportunity_key`, porque `v_src` não a
    -- carrega: ela vem do board no ramo de cima, e lá a coluna não existe.
    select distinct on (h.market, h.outcome, h.line_value)
      h.market, h.outcome, h.line_value, h.edge
    from futebol.fact_value_opportunities_hist h
    where h.fixture_id = p_fixture_id
    order by h.market, h.outcome, h.line_value, h.dbt_valid_from asc, h.dbt_scd_id asc
  )
  select v.market, v.outcome,
    (case when v.market = 'match_winner'
          then (case v.outcome when 'Home' then 1 when 'Draw' then 2 else 3 end)
          when v.market = 'goals_over_under'
          then (coalesce(v.line_value,0)*10 + case when v.outcome='Over' then 1 else 2 end)::int
          when v.market = 'asian_handicap'
          then (1000 + (case v.outcome when 'Home' then 0 else 500 end) + (coalesce(v.line_value,0)*10))::int
          when v.market = 'btts'
          then (2000 + case when v.outcome in ('Yes') then 0 else 1 end)
          when v.market = 'double_chance'
          then (3000 + case v.outcome when '1X' then 1 else 2 end)
          else 0 end),
    v.line_value, v.edge, v.best_odd, v.best_book, v.avg_odd, v.n_casas::int, v.janela_usada, v.prob_justa_fechamento,
    v.pts_premissas::int, v.penalidades::int,
    v.penalidades_especificas_pts::int, v.score::int, v.faixa, v.score_versao,
    v.modelo_api_concorda, v.linha_sharp_confirma,
    public.futebol_copy('evidencia', v.market, case v.outcome when 'Home' then 'home' when 'Away' then 'away' else 'any' end, public.futebol_flags(to_jsonb(v), to_jsonb(p), to_jsonb(o), to_jsonb(ah), to_jsonb(bt), to_jsonb(dc))),
    public.futebol_copy('aviso', v.market, case v.outcome when 'Home' then 'home' when 'Away' then 'away' else 'any' end, public.futebol_flags(to_jsonb(v), to_jsonb(p), to_jsonb(o), to_jsonb(ah), to_jsonb(bt), to_jsonb(dc))),
    (public.futebol_copy('contra', v.market, case v.outcome when 'Home' then 'home' when 'Away' then 'away' else 'any' end, public.futebol_flags(to_jsonb(v), to_jsonb(p), to_jsonb(o), to_jsonb(ah), to_jsonb(bt), to_jsonb(dc))))[1:3],
    v.premissas_sem_dado::int,
    -- Jogo por começar: a linha está viva e a vantagem corrente é a publicada.
    -- Jogo encerrado: a da foto de nascimento.
    coalesce(n.edge, v.edge)
  from v_src v
  left join nascimento n on n.market = v.market and n.outcome = v.outcome and n.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  where v.fixture_id = p_fixture_id
  order by (case v.market when 'match_winner' then 1 when 'goals_over_under' then 2 when 'asian_handicap' then 3 when 'btts' then 4 when 'double_chance' then 5 else 9 end), 3;
$function$;

grant execute on function public.get_futebol_fixture_value(bigint) to anon, authenticated, service_role;
