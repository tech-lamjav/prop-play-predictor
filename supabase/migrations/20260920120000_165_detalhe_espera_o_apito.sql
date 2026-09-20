-- ============================================================================
-- 165 — o detalhe do jogo espera o APITO, e não o kickoff
-- ============================================================================
-- Duas telas falavam números diferentes sobre a mesma linha, com o jogo
-- rolando. Visto em staging em 20/09/2026, Fiorentina × Napoli, Ambos marcam:
-- Não, jogo EM ANDAMENTO:
--
--   · tela de Oportunidades ... chance 47%, odd 2.00, valor −6,2%
--   · tela do jogo ........... chance 43%, odd 2.30, valor −0,5%
--
-- Odd diferente explica valor diferente: é uma LINHA de origem diferente, e não
-- uma conta errada.
--
-- ## Por que as duas discordam
--
-- A tela do jogo troca de fonte no KICKOFF: passado o horário, ela para de ler
-- `fact_value_opportunities` e passa a ler a versão do snapshot que atravessa o
-- kickoff (migration 101).
--
-- A lista tentaria fazer o mesmo — o comentário de `mergeBoardAndHistory` diz
-- que, passado o kickoff, "vence a linha do histórico". Só que a RPC do
-- histórico só devolve jogo ENCERRADO, `status_short in ('FT','AET','PEN')`. Com
-- o jogo em andamento ela não devolve nada, e a lista cai na linha VIVA do
-- board.
--
-- Resultado: entre o kickoff e o apito, a lista mostra a linha viva e o detalhe
-- mostra a foto do kickoff. Todo jogo em andamento, todos os dias.
--
-- ## Por que o conserto não pode ser soltar a trava do histórico
--
-- Ela existe por um motivo que continua valendo: `get_futebol_value_history` é
-- ABERTA — é a prova de método, e quem não assina a executa. Soltar a trava
-- devolveria valor apostável ao vivo para quem não paga, que é exatamente o
-- defeito que ela fechou. A RPC do detalhe é outra história: ela se fecha por
-- dentro, com `futebol_acesso_do_chamador()`.
--
-- Então quem muda é o detalhe.
--
-- ## O que muda
--
-- O portão dos dois ramos deixa de ser o kickoff e passa a ser o FIM DO JOGO, a
-- mesma condição que o histórico já usa:
--
--   · jogo não encerrado → a linha viva do board, igual à lista;
--   · jogo encerrado ..... → a versão do snapshot que atravessa o kickoff.
--
-- A ESCOLHA DA VERSÃO NÃO MUDA: continua sendo a que estava viva no kickoff, com
-- `dbt_valid_from <= kickoff < dbt_valid_to`. O que muda é QUANDO se passa a
-- olhar para ela.
--
-- ⚠️ E isso conserta o vocabulário de quebra. Hoje se chama "foto do apito" uma
-- versão tirada no KICKOFF, e se passa a usá-la no kickoff. Nenhuma das duas
-- coisas era o apito.
--
-- ⚠️ STATUS NULO CONTA COMO NÃO ENCERRADO. `not in` com nulo devolve nulo, e a
-- linha sumiria da tela enquanto o mart não carregasse o status — trocando uma
-- divergência por um desaparecimento, que é pior. O `coalesce` deixa explícito
-- que a ausência é tratada como "ainda rolando".
--
-- ⚠️ O CUSTO, declarado: um jogo encerrado cujo status ainda não chegou ao mart
-- continua mostrando a linha viva por mais um tempo. Mas o histórico já se
-- comporta assim, então as duas telas passam a errar JUNTAS em vez de
-- discordar — que é o que se pediu. E a lista, nessa janela, não mostra a linha
-- de jeito nenhum: ela é de um dia passado e o histórico não a devolve. Antes e
-- depois desta migration, aquela janela tem a lista vazia; o que muda é só o
-- que o detalhe mostra nela.
--
-- ⚠️ `create or replace`: o `returns table(...)` não muda, só o corpo.
--
-- ⚠️ ESTA MIGRATION NUNCA RODOU CONTRA UM POSTGRES. Só tem teste de texto, como
-- as irmãs. Conferência depois de aplicar, com um jogo EM ANDAMENTO:
--
--   select v.market, v.outcome, v.line_value, v.best_odd, v.edge
--     from public.get_futebol_fixture_value(<fixture_em_andamento>) v
--    where v.market = 'btts';
--   -- espera os MESMOS números que a tela de Oportunidades mostra para a linha
-- ============================================================================

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

  -- migration 165: jogo NÃO ENCERRADO lê o board; jogo encerrado lê no snapshot
  -- a versão que atravessa o kickoff. O portão é o mesmo do histórico, e é isso
  -- que faz as duas telas falarem o mesmo número com o jogo rolando.
  -- migration 105: os avisos leem as colunas pen_* do mart.
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
                   where fx.fixture_id = p_fixture_id
                     and coalesce(fx.status_short, '') not in ('FT', 'AET', 'PEN'))
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
                     and fx.status_short in ('FT', 'AET', 'PEN')
                     and h.dbt_valid_from <= fx.kickoff_utc
                     and (h.dbt_valid_to is null or fx.kickoff_utc < h.dbt_valid_to))
  ), janelas as (
    -- A JANELA EM QUE CADA VERSÃO PÔDE SER VISTA.
    --
    -- Uma versão do snapshot não é um instante: ela vale de `dbt_valid_from` até
    -- `dbt_valid_to`. Perguntar se ela estava visível NO NASCIMENTO é a pergunta
    -- errada, e foi o primeiro defeito desta migration: a versão do Brentford
    -- +0,5 nasceu em 15/09 com o handicap ainda fora da vitrine, e ficou viva
    -- até 16/09 06h04 — visível E acima do limiar desde a volta do mercado, que
    -- é exatamente quando o assinante a viu e o daily a enviou.
    --
    -- `fim` é o fim da vida da versão, encurtado pela vigência do limiar quando
    -- a vantagem NÃO passa nele: antes da vigência não havia limiar para
    -- esconder coisa nenhuma. Vantagem nula não passa, pelo mesmo motivo do
    -- front: não saber o preço de um mercado onde o preço decide não é motivo
    -- para mostrar.
    select h.opportunity_key, h.edge, h.dbt_valid_from, h.dbt_scd_id,
           (mo.oculto_desde at time zone 'UTC') as escondido_de,
           (mo.oculto_ate   at time zone 'UTC') as escondido_ate,
           least(
             coalesce(h.dbt_valid_to, 'infinity'::timestamp),
             case when lv.market is null or h.edge > lv.limiar::double precision
                  then 'infinity'::timestamp
                  else (lv.vigente_desde at time zone 'UTC') end
           ) as fim
    from futebol.fact_value_opportunities_hist h
    left join public.futebol_mercados_ocultos mo on mo.market = h.market
    left join public.futebol_limiar_valor lv on lv.market = h.market
    where h.fixture_id = p_fixture_id
  ), nascimento as (
    -- A FOTO DE NASCIMENTO: a primeira versão VISÍVEL de cada oportunidade.
    --
    -- Visível, e não apenas a primeira: o snapshot grava o board, que é o
    -- universo do que foi publicado — mercado escondido e linha abaixo do
    -- limiar incluídos. A primeira linha do snapshot pode ser de um trecho em
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
    select distinct on (j.opportunity_key)
      j.opportunity_key, j.edge
    from janelas j
    -- A janela não pode ser vazia...
    where j.dbt_valid_from < j.fim
      -- ...e precisa cruzar algum trecho em que o mercado estava na vitrine: ou
      -- ela começa antes de o mercado sair, ou ela ainda estava viva quando ele
      -- voltou. Sem linha na vitrine, o mercado nunca saiu.
      and (j.escondido_de is null
           or j.dbt_valid_from < j.escondido_de
           or (j.escondido_ate is not null and j.fim > j.escondido_ate))
    order by j.opportunity_key, j.dbt_valid_from asc, j.dbt_scd_id asc
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
    -- Jogo não encerrado (sem chave): a linha está viva e a vantagem corrente é
    -- a publicada. Jogo encerrado (com chave): a da primeira versão visível, que
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
