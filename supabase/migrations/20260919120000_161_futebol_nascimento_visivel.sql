-- ============================================================================
-- 161 — a foto de nascimento passa a ser a primeira versão VISÍVEL
-- ============================================================================
-- O incidente que esta migration fecha, porque ele volta se ninguém escrever:
--
-- Em 18/09/2026 o Brentford +0,5 (jogo 1557408) apareceu na tela de
-- Oportunidades com nota 100 e faixa Alta, e o detalhe do mesmo jogo mostrava a
-- saída SEM LEITURA. As duas telas discordavam sobre a mesma linha.
--
-- A linha atravessa o limiar de valor nos dois sentidos, e o snapshot mostra
-- isso hora a hora:
--
--   · 12/09 06:04 — nasce em −2,96%, e o mercado de handicap ainda estava FORA
--     da vitrine: ninguém podia ver linha nenhuma desse mercado;
--   · 15/09 06:03 — sobe para −1,94%, que passa no limiar de −2%;
--   · 16/09 02:07 — o limiar de valor entra em vigor;
--   · 16/09 02:10 — o daily envia a linha, com −1,94%;
--   · 18/09 16:00 — apito, com a linha de volta a −2,89%.
--
-- A `edge_publicacao` da 146 é "a primeira versão que existe no snapshot", e
-- essa versão é a de 12/09, com −2,96%. O corte então esconde a linha por uma
-- vantagem de um instante em que ela não estava na tela de ninguém.
--
-- ## A confusão que a 146 carregava
--
-- O snapshot grava o estado interno do board, e o board é o universo — o que
-- foi publicado, escondido incluído. Ele NÃO é a vitrine. Ler a primeira linha
-- do snapshot como "a vantagem com que isto foi publicado e visto" só funciona
-- para a linha que nunca atravessou nenhuma das duas regras de exibição.
--
-- O glossário tinha a mesma confusão no verbete "Foto de nascimento", e ela sai
-- junto com esta migration.
--
-- ## O que muda
--
-- `edge_publicacao` passa a ser a vantagem da primeira versão VISÍVEL de cada
-- oportunidade. Uma versão estava visível no instante em que nasceu quando:
--
--   · o mercado estava na vitrine naquele instante — fora de qualquer período
--     escondido da `futebol_mercados_ocultos`; E
--   · o limiar de valor ainda não vigia naquele instante, OU a vantagem daquela
--     versão passava nele.
--
-- Nunca tendo havido versão visível, a coluna vem NULA. Isso é informação, e não
-- ausência: quer dizer "esta linha nunca esteve na tela", e é o que faz o front
-- cortá-la. É por isso que o front deixa de usar `edge_publicacao ?? edge` e
-- passa a distinguir nulo explícito de coluna ausente.
--
-- ## A chave volta a viajar no detalhe
--
-- A 146 chaveou o nascimento do detalhe por `market, outcome, line_value`, e não
-- por `opportunity_key`, porque o ramo do board não tem a coluna. O preço disso
-- é que uma saída com reativação — 74 chaves medidas em produção — mistura a
-- vida de duas oportunidades diferentes numa foto só.
--
-- Agora a chave viaja dentro do `v_src`: NULA no ramo do board, preenchida no
-- ramo do apito. As duas RPCs passam a usar a mesma chave.
--
-- ⚠️ E isso fecha um defeito latente da 146. O `coalesce(n.edge, v.edge)` dava a
-- vitória ao nascimento sempre que o CTE achasse alguma versão — inclusive num
-- jogo POR COMEÇAR, cujo snapshot já tem versões. O cabeçalho da 146 promete o
-- contrário ("no detalhe enquanto o jogo não começou, a própria `edge`"). Com a
-- chave, a escolha passa a ser explícita: sem chave é board, e board é a viva.
--
-- ⚠️ FUSO. `dbt_valid_from` é `timestamp` sem fuso; `oculto_desde`, `oculto_ate`
-- e `vigente_desde` são `timestamptz`. Comparar os dois direto deixa o resultado
-- na mão do `TimeZone` da sessão, que estas funções não fixam. As três são
-- convertidas com `at time zone 'UTC'`, como o resto do arquivo já faz.
--
-- ⚠️ UM PERÍODO POR MERCADO (migration 145), então o join com a vitrine é 1:1.
-- Se um dia isso virar tabela de períodos, este join vira `exists`.
--
-- ⚠️ `create or replace`, e NÃO drop: o `returns table(...)` das duas não muda —
-- só o corpo. Derrubar aqui jogaria fora os grants por nada.
--
-- ⚠️ A REGRA ESTÁ COPIADA NAS DUAS RPCs, verbatim, como a cascata de evidências
-- já está nas três (ver `docs/futebol-prod-deploy.md`). A guarda que obriga as
-- cópias a andarem juntas é `futebol-nascimento-visivel.test.ts`, e ela quebra o
-- PR quando as duas se afastam.
--
-- Conferência depois de aplicar:
--   select market, outcome, line_value, edge, edge_publicacao
--     from public.get_futebol_fixture_value(1557408)
--    where market = 'asian_handicap' and outcome = 'Home' and line_value = 0.5;
--   -- espera edge_publicacao = -0.0193954659949623, e não -0.0296240601503759
-- ============================================================================

-- ── O histórico ─────────────────────────────────────────────────────────────
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
      -- APITO DADO NAO E JOGO ENCERRADO. Esta funcao fica aberta para quem nao
      -- assina porque e a prova de metodo, e prova de metodo e sobre jogo
      -- LIQUIDADO. So `kickoff < now()` deixava passar a partida EM ANDAMENTO
      -- com aposta, odd, Score, faixa e evidencias -- valor apostavel ao vivo,
      -- sem conta. E a janela padrao do front vai ate HOJE, entao nao era caso
      -- de borda: era toda carga de pagina.
      and fx.status_short in ('FT', 'AET', 'PEN')
      and h.dbt_valid_from <= fx.kickoff_utc
      and (h.dbt_valid_to is null or fx.kickoff_utc < h.dbt_valid_to)
    order by h.opportunity_key, h.dbt_valid_from desc
  ), nascimento as (
    -- A FOTO DE NASCIMENTO: a primeira versão VISÍVEL de cada oportunidade.
    --
    -- Visível, e não apenas a primeira: o snapshot grava o board, que é o
    -- universo do que foi publicado — mercado escondido e linha abaixo do
    -- limiar incluídos. A primeira linha do snapshot pode ser de um instante em
    -- que ninguém podia ver aquilo, e foi assim que o Brentford +0,5 de 18/09
    -- sumiu do detalhe do jogo por uma vantagem de 12/09.
    --
    -- Nenhuma versão visível devolve NADA para esta chave, e o `left join` lá
    -- embaixo transforma isso em NULO — que é o que diz ao front "nunca esteve
    -- na tela". Nulo aqui é resposta, não falta de resposta.
    --
    -- `asc` é a única diferença de ordem para o CTE acima; `dbt_scd_id` é o
    -- desempate explícito que a 102 exige do DISTINCT ON, para o dia em que o
    -- snapshot produzir duas versões com o mesmo `dbt_valid_from`.
    select distinct on (h.opportunity_key)
      h.opportunity_key, h.edge
    from futebol.fact_value_opportunities_hist h
    join futebol.fact_fixtures fx on fx.fixture_id = h.fixture_id
    left join public.futebol_mercados_ocultos mo on mo.market = h.market
    left join public.futebol_limiar_valor lv on lv.market = h.market
    where fx.kickoff_utc >= ((p_from::timestamp at time zone 'America/Sao_Paulo') at time zone 'UTC')
      and fx.kickoff_utc <  (((p_to + 1)::timestamp at time zone 'America/Sao_Paulo') at time zone 'UTC')
      and fx.kickoff_utc <  (now() at time zone 'UTC')
      -- Mesma regra do CTE de cima: encerrado, nao apenas comecado.
      and fx.status_short in ('FT', 'AET', 'PEN')
      -- O mercado estava na vitrine no instante desta versão.
      and (mo.market is null
           or h.dbt_valid_from < (mo.oculto_desde at time zone 'UTC')
           or (mo.oculto_ate is not null
               and h.dbt_valid_from >= (mo.oculto_ate at time zone 'UTC')))
      -- E o limiar de valor ou ainda não vigia, ou a vantagem passa nele.
      -- Vantagem nula não passa, pelo mesmo motivo do front: não saber o preço
      -- de um mercado onde o preço decide não é motivo para mostrar.
      and (lv.market is null
           or h.dbt_valid_from < (lv.vigente_desde at time zone 'UTC')
           or h.edge > lv.limiar::double precision)
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
CREATE OR REPLACE FUNCTION public.get_futebol_fixture_value(p_fixture_id bigint)
 returns table(market text, outcome text, outcome_order integer, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_premissas integer, penalidades integer, penalidades_especificas_pts integer, score integer, faixa text, score_versao text, modelo_api_concorda boolean, linha_sharp_confirma boolean, evidencias text[], avisos text[], contras text[], premissas_sem_dado integer, edge_publicacao double precision)
 language sql
 security definer
 set search_path to ''
as $function$
  -- Sem acesso, zero linha. O filtro e do CHAMADOR, nao da consulta: com o
  -- guarda falso nenhuma linha sobrevive, e a tela mostra bloqueado em vez de
  -- inventar "sem leitura". Vazio, e nao erro: bloqueio nao e falha.
  select * from (

  -- migration 101: kickoff no futuro lê o board; kickoff já passado lê a FOTO DO
  -- APITO no snapshot. migration 105: os avisos leem as colunas pen_* do mart.
  with v_src as (
    -- ⚠️ `opportunity_key` NULA aqui, e isso é o que identifica o ramo do board
    -- lá embaixo. O board não tem a coluna, e a linha dele está VIVA: a vantagem
    -- corrente é a publicada agora, sem foto de nascimento nenhuma.
    select null::text as opportunity_key,
           fixture_id, market, outcome, line_value, competition, season, edge,
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
    select h.opportunity_key,
           h.fixture_id, h.market, h.outcome, h.line_value, h.competition, h.season, h.edge,
           h.pts_premissas, h.penalidades, h.score, h.faixa, h.score_versao, h.best_odd, h.best_book,
           h.avg_odd, h.n_casas, h.prob_justa_fechamento, h.valor_fonte, h.janela_usada,
           h.penalidades_especificas_pts, h.modelo_api_concorda,
           h.linha_sharp_confirma, h.pin_n_outcomes, h.is_half_line, h.dbt_loaded_at, h.premissas_sem_dado,
           h.pen_odd_outlier, h.pen_poucas_casas, h.pen_odd_longshot, h.pen_odd_juice
    from futebol.fact_value_opportunities_hist h
    where h.fixture_id = p_fixture_id
      and exists (select 1 from futebol.fact_fixtures fx
                   where fx.fixture_id = p_fixture_id
                     and fx.kickoff_utc <= (now() at time zone 'UTC')
                     and h.dbt_valid_from <= fx.kickoff_utc
                     and (h.dbt_valid_to is null or fx.kickoff_utc < h.dbt_valid_to))
  ), nascimento as (
    -- A FOTO DE NASCIMENTO: a primeira versão VISÍVEL de cada oportunidade.
    --
    -- Visível, e não apenas a primeira: o snapshot grava o board, que é o
    -- universo do que foi publicado — mercado escondido e linha abaixo do
    -- limiar incluídos. A primeira linha do snapshot pode ser de um instante em
    -- que ninguém podia ver aquilo, e foi assim que o Brentford +0,5 de 18/09
    -- sumiu desta tela por uma vantagem de 12/09.
    --
    -- Nenhuma versão visível devolve NADA para esta chave, e o `left join` lá
    -- embaixo transforma isso em NULO — que é o que diz ao front "nunca esteve
    -- na tela". Nulo aqui é resposta, não falta de resposta.
    --
    -- Chaveada por `opportunity_key`, e não pelas colunas da saída: a saída que
    -- sai do board e volta tem mais de uma oportunidade na vida, e juntá-las
    -- numa foto só mistura a vida de duas. São 74 chaves com reativação em
    -- produção.
    select distinct on (h.opportunity_key)
      h.opportunity_key, h.edge
    from futebol.fact_value_opportunities_hist h
    left join public.futebol_mercados_ocultos mo on mo.market = h.market
    left join public.futebol_limiar_valor lv on lv.market = h.market
    where h.fixture_id = p_fixture_id
      -- O mercado estava na vitrine no instante desta versão.
      and (mo.market is null
           or h.dbt_valid_from < (mo.oculto_desde at time zone 'UTC')
           or (mo.oculto_ate is not null
               and h.dbt_valid_from >= (mo.oculto_ate at time zone 'UTC')))
      -- E o limiar de valor ou ainda não vigia, ou a vantagem passa nele.
      -- Vantagem nula não passa, pelo mesmo motivo do front: não saber o preço
      -- de um mercado onde o preço decide não é motivo para mostrar.
      and (lv.market is null
           or h.dbt_valid_from < (lv.vigente_desde at time zone 'UTC')
           or h.edge > lv.limiar::double precision)
    order by h.opportunity_key, h.dbt_valid_from asc, h.dbt_scd_id asc
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
    -- Jogo por começar (sem chave): a linha está viva e a vantagem corrente é a
    -- publicada. Jogo encerrado (com chave): a da primeira versão visível, que
    -- é NULA quando nunca houve nenhuma.
    case when v.opportunity_key is null then v.edge else n.edge end
  from v_src v
  left join nascimento n on n.opportunity_key = v.opportunity_key
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  where v.fixture_id = p_fixture_id
  order by (case v.market when 'match_winner' then 1 when 'goals_over_under' then 2 when 'asian_handicap' then 3 when 'btts' then 4 when 'double_chance' then 5 else 9 end), 3
  ) _acesso
  where public.futebol_acesso_do_chamador();
$function$;

grant execute on function public.get_futebol_fixture_value(p_fixture_id bigint) to anon, authenticated, service_role;
