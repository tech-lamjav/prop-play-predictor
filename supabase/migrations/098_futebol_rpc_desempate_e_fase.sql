-- 098_futebol_rpc_desempate_e_fase.sql
--
-- C8, parte 2 de 2. Dois defeitos, um em cada funcao.
--
-- Parte 1 (097) tratou o defeito visivel na tela. Esta trata os dois que
-- bloqueiam a fila: o desempate de janela no detalhe da oportunidade, que e o
-- que destrava a C5, e a fase da escalacao, que quebra quando a C1 subir.
--
-- ============================================================================
-- DEFEITO A -- get_futebol_fixture_value escolhe a janela arbitrariamente
--
-- A funcao le as quatro penalidades de odd de um CTE assim:
--
--     select distinct on (fixture_id, outcome_side, line_value)
--            fixture_id, outcome_side, line_value,
--            pen_odd_outlier, pen_poucas_casas, pen_odd_longshot, pen_odd_juice
--     from futebol.int_futebol_odds_devig
--     order by fixture_id, outcome_side, line_value
--
-- Sem desempate alem das proprias chaves. Faltam DUAS colunas na chave:
--
--   janela_usada -- a C5 mudou o grao do de-vig para uma linha por janela.
--                   Antes havia 1 linha por (fixture, saida, linha); agora ha
--                   ate 4. O DISTINCT ON passa a escolher qualquer uma delas.
--                   Efeito medido em producao pelo Mateus em 10/08: uma Over 2.5
--                   que fechou em 2,05 aparecia com "Odd alta (zebra), entra com
--                   cautela", aviso calculado do preco de 5,20 da janela diaria.
--                   E qual linha ganhava mudava entre syncs, sem mudanca de dado.
--
--   market_id    -- defeito que JA EXISTIA antes da C5 e ninguem tinha visto.
--                   Gols O/U (mercado 5) e Gols O/U 1o Tempo (mercado 6) tem
--                   Over/Under na MESMA line_value. Sem market_id na chave, uma
--                   linha de 1o tempo pode fornecer as penalidades de uma linha
--                   de jogo inteiro.
--
-- ALCANCE MEDIDO (espelho de staging, 15/08, ja com o grao da C5):
--   26.932 grupos de (fixture, saida, linha) no de-vig
--   23.804 com colisao, ou 88,4%
--     - 22.855 colidem por janela
--     -  6.455 colidem por mercado
--
-- Exemplo real encontrado durante a verificacao, fixture 1489392: a linha
-- "Under 3.5" do mercado 5 nao tem penalidade nenhuma, mas a "Under 3.5" do
-- mercado 6 (1o tempo) tem. Sem market_id na chave, o detalhe do jogo podia
-- exibir o aviso da linha errada.
--
-- CORRECAO
--   1. chave do DISTINCT ON passa a ser
--      (fixture_id, market_id, outcome_side, line_value, janela_usada)
--   2. o join passa a casar tambem por janela e por mercado, traduzindo o
--      market text do mart para o market_id do de-vig
--
-- COMPATIVEL NOS DOIS SENTIDOS: funciona com o grao antigo (uma janela por
-- linha) e com o novo (quatro). Nao depende da ordem de deploy da C5.
--
-- ============================================================================
-- DEFEITO B -- get_futebol_fixture_extras nao distingue a fase da escalacao
--
-- A funcao agrega fact_fixture_lineups e fact_fixture_lineups_players sem
-- filtro de fase e sem projetar lineup_phase. O app nao consegue distinguir as
-- duas, entao cada time e cada jogador apareceriam DUAS VEZES na tela.
--
-- HOJE ISSO NAO ACONTECE, e o motivo importa: nenhum fixture tem as duas fases
-- ao mesmo tempo (medido: 0). Nao e porque a funcao esta certa, e porque o
-- "ultimo vence" da consolidacao destroi a escalacao pre-jogo quando a pos-jogo
-- chega. E exatamente isso que a C1 conserta.
--
-- => Este conserto tem que estar em producao ANTES da C1 subir. Ele nao arruma
--    nada hoje; ele impede que a C1 quebre a tela.
--
-- AS DUAS FASES, medidas no espelho:
--   'confirmed' -- escalacao confirmada, publicada antes do apito.
--                    8 linhas / 4 jogos em lineups
--                  399 linhas / 137 jogos em lineups_players
--   'real'      -- registro pos-jogo, com quem de fato entrou.
--                16.183 linhas / 8.097 jogos em lineups
--               350.947 linhas / 8.067 jogos em lineups_players
--
-- ⚠️ NOMENCLATURA: nao existe escalacao "provavel" na fonte. A API nao publica
--    escalacao provavel em momento nenhum (sondado pelo Mateus). As duas fases
--    sao CONFIRMADA (pre-jogo) e REAL (pos-jogo). O produto deve nomear assim.
--
-- CORRECAO (decisao do Victor, 15/08): devolver UMA fase so, nunca as duas
--   misturadas. Prefere 'confirmed'; cai para 'real' quando nao houver
--   confirmada naquele fixture. lineup_phase e projetado dentro do jsonb para o
--   app saber o que esta exibindo.
--
--   POR QUE COM FALLBACK, e nao 'confirmed' puro: hoje so 4 jogos tem escalacao
--   confirmada em fact_fixture_lineups, contra 8.097 com a real. Filtrar apenas
--   'confirmed' apagaria a escalacao de praticamente todo jogo ja encerrado.
--
--   As duas tabelas sao avaliadas SEPARADAMENTE porque discordam entre si:
--   confirmada existe em 4 jogos de fact_fixture_lineups e em 137 de
--   fact_fixture_lineups_players. Uma variavel so faria uma delas mentir.
--
-- ⚠️ A ASSINATURA NAO MUDA. A funcao ja retorna jsonb, e acrescentar campo
--    dentro do jsonb nao altera RETURNS. Portanto NAO exige DROP FUNCTION e NAO
--    entra na ordem rigida de deploy do dbt. (A avaliacao inicial supunha que
--    exigiria; supunha que lineup_phase sairia fora do jsonb.)
--
--    O front PRECISA ser atualizado junto, porque a partir da C1 vao chegar as
--    duas fases e sem tratamento a tela duplica.
--
-- ============================================================================
-- ATENCAO ANTES DE APLICAR
--
-- O corpo do DEFEITO B abaixo foi extraido do espelho de STAGING. Nao tenho
-- acesso de leitura ao PRD. Diferenciar antes de aplicar: o unico trecho que
-- esta migration altera e a projecao de lineup_phase e a ordenacao.
--
-- O DEFEITO A e aplicado por substituicao guardada sobre a definicao VIVA, e
-- por isso nao corre esse risco: ele altera o que estiver no ar, e aborta se
-- nao encontrar exatamente o texto que espera. A escolha e deliberada -- a
-- funcao tem 10 mil caracteres, o repositorio nao e a fonte da verdade dela, e
-- transcrever o corpo inteiro para ca criaria justamente o risco de reverter
-- alteracao que so exista no PRD.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- DEFEITO A  get_futebol_fixture_value  (substituicao guardada)
-- ---------------------------------------------------------------------------

DO $migration$
DECLARE v text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_futebol_fixture_value';

  IF v IS NULL THEN
    RAISE EXCEPTION 'get_futebol_fixture_value nao existe';
  END IF;

  -- Guarda: se a definicao viva nao for a esperada, aborta sem tocar em nada.
  IF position('distinct on (fixture_id, outcome_side, line_value)' in v) = 0
     OR position('left join d on d.fixture_id = v.fixture_id and d.outcome_side = v.outcome and d.line_value is not distinct from v.line_value' in v) = 0 THEN
    RAISE EXCEPTION 'get_futebol_fixture_value: definicao viva divergente do esperado. Revisar antes de aplicar.';
  END IF;

  -- Guarda de idempotencia: se ja tem o desempate, nao faz nada.
  IF position('d.janela_usada is not distinct from v.janela_usada' in v) > 0 THEN
    RAISE NOTICE 'get_futebol_fixture_value ja tem o desempate. Nada a fazer.';
    RETURN;
  END IF;

  v := replace(v,
    'select distinct on (fixture_id, outcome_side, line_value) fixture_id, outcome_side, line_value,',
    'select distinct on (fixture_id, market_id, outcome_side, line_value, janela_usada) fixture_id, market_id, outcome_side, line_value, janela_usada,');

  v := replace(v,
    'from futebol.int_futebol_odds_devig order by fixture_id, outcome_side, line_value',
    'from futebol.int_futebol_odds_devig order by fixture_id, market_id, outcome_side, line_value, janela_usada');

  v := replace(v,
    'left join d on d.fixture_id = v.fixture_id and d.outcome_side = v.outcome and d.line_value is not distinct from v.line_value',
    'left join d on d.fixture_id = v.fixture_id and d.outcome_side = v.outcome and d.line_value is not distinct from v.line_value and d.janela_usada is not distinct from v.janela_usada and d.market_id = (case v.market when ''match_winner'' then 1 when ''asian_handicap'' then 4 when ''goals_over_under'' then 5 when ''btts'' then 8 when ''double_chance'' then 12 end)');

  EXECUTE v;
END
$migration$;


-- ---------------------------------------------------------------------------
-- DEFEITO B  get_futebol_fixture_extras  (corpo explicito)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_extras(p_fixture_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_fix record;
  v_fase_times text;
  v_fase_jogadores text;
begin
  select f.* into v_fix from futebol.fact_fixtures f where f.fixture_id = p_fixture_id limit 1;
  if not found then return jsonb_build_object('events', '[]'::jsonb); end if;

  -- Uma fase so, nunca as duas. Prefere a confirmada; cai para a real quando
  -- nao houver confirmada. As duas tabelas sao decididas em separado porque
  -- discordam entre si.
  select case when count(*) filter (where lineup_phase = 'confirmed') > 0
              then 'confirmed' else 'real' end
    into v_fase_times
    from futebol.fact_fixture_lineups where fixture_id = p_fixture_id;

  select case when count(*) filter (where lineup_phase = 'confirmed') > 0
              then 'confirmed' else 'real' end
    into v_fase_jogadores
    from futebol.fact_fixture_lineups_players where fixture_id = p_fixture_id;

  return jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'minute', e.minute, 'minute_extra', e.minute_extra, 'team_side', e.team_side,
        'team_name', e.team_name, 'player_name', e.player_name, 'assist_player_name', e.assist_player_name,
        'event_type', e.event_type, 'event_detail', e.event_detail
      ) order by e.minute nulls last, e.event_order)
      from futebol.fact_fixture_events e where e.fixture_id = p_fixture_id
    ), '[]'::jsonb),
    'player_stats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id', p.player_id, 'team_side', p.team_side, 'player_name', p.player_name,
        'minutes', p.minutes, 'rating', p.rating, 'goals', p.goals_total, 'assists', p.assists,
        'shots_total', p.shots_total, 'shots_on', p.shots_on, 'passes_key', p.passes_key,
        'tackles_total', p.tackles_total, 'is_substitute', p.is_substitute
      ))
      from futebol.fact_fixture_player_stats p where p.fixture_id = p_fixture_id
    ), '[]'::jsonb),
    'form_home', public._futebol_team_form(v_fix.home_team_id, v_fix.competition, v_fix.season, v_fix.date_utc),
    'form_away', public._futebol_team_form(v_fix.away_team_id, v_fix.competition, v_fix.season, v_fix.date_utc),
    'lineups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', l.team_id, 'team_name', l.team_name, 'team_side', l.team_side,
        'formation', l.formation, 'coach_name', l.coach_name, 'lineup_phase', l.lineup_phase
      ) order by l.team_side) from (
        select team_id, team_name, team_side, formation, coach_name, lineup_phase
        from futebol.fact_fixture_lineups
        where fixture_id = p_fixture_id and lineup_phase = v_fase_times
      ) l
    ), '[]'::jsonb),
    'lineup_players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', lp.team_id, 'team_side', lp.team_side, 'is_starter', lp.is_starter,
        'player_slot', lp.player_slot, 'player_id', lp.player_id, 'player_name', lp.player_name,
        'shirt_number', lp.shirt_number, 'position', lp.position, 'grid', lp.grid,
        'lineup_phase', lp.lineup_phase
      ) order by lp.team_side, lp.is_starter desc nulls last, lp.player_slot) from (
        select team_id, team_side, is_starter, player_slot, player_id, player_name, shirt_number, position, grid, lineup_phase
        from futebol.fact_fixture_lineups_players
        where fixture_id = p_fixture_id and lineup_phase = v_fase_jogadores
      ) lp
    ), '[]'::jsonb)
  );
end; $function$;


-- ============================================================================
-- VERIFICACAO APOS APLICAR
--
-- A) o desempate entrou nas duas dimensoes:
--
--    select position('janela_usada' in pg_get_functiondef(p.oid)) > 0 as tem_janela,
--           position('when ''match_winner'' then 1' in pg_get_functiondef(p.oid)) > 0 as tem_mercado
--    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'get_futebol_fixture_value';
--    -- esperado: true, true
--
-- B) nenhuma linha perdida no join mais estrito. Para qualquer fixture do
--    board, a funcao tem que devolver exatamente o que o mart tem:
--
--    with alvos as (select distinct fixture_id from futebol.fact_value_opportunities limit 20)
--    select a.fixture_id,
--      (select count(*) from public.get_futebol_fixture_value(a.fixture_id)) as devolvidas,
--      (select count(*) from futebol.fact_value_opportunities v where v.fixture_id = a.fixture_id) as no_mart
--    from alvos a;
--    -- esperado: devolvidas = no_mart em todas
--
-- C) o join casa em exatamente uma linha (nao zero, nao duas):
--    ver a consulta de conferencia de chave no comentario da C8.
--
-- D) a fase chega ao app:
--
--    select jsonb_path_query_first(
--             public.get_futebol_fixture_extras(f.fixture_id),
--             '$.lineups[0].lineup_phase')
--    from futebol.fact_fixture_lineups f limit 1;
--    -- esperado: "confirmed" ou "real", nunca null
-- ============================================================================
