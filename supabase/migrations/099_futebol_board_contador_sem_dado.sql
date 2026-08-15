-- 099_futebol_board_contador_sem_dado.sql
--
-- Ticket #245. O contador de premissas sem dado chega ao app.
--
-- ============================================================================
-- O QUE E
--
-- O Motor ja calcula e o Postgres ja tem: a coluna premissas_sem_dado esta
-- populada nas 7 tabelas de futebol desde 14/08 (analytics-engineering#41).
-- Medido no espelho em 15/08: 122 linhas no board, 43 com contador > 0,
-- media 0,70, maximo 7.
--
-- O que faltava e a RPC devolver a coluna. Sem isso o numero existe no banco e
-- nao chega a tela.
--
-- A decisao de dominio esta na ADR 0003 e e curta: dado faltante DIAGNOSTICA,
-- NAO PENALIZA. O score nao muda. O que muda e o leitor passar a saber que uma
-- nota baixa pode ser POUCA INFORMACAO em vez de INFORMACAO CONTRARIA.
--
-- ============================================================================
-- POR QUE E DROP + RECRIAR, E NAO CREATE OR REPLACE
--
-- Acrescentar coluna ao RETURNS TABLE altera a assinatura da funcao, e o
-- Postgres recusa CREATE OR REPLACE nesse caso. Nao ha como evitar o DROP.
--
-- ⚠️ ORDEM DE DEPLOY: esta migration antes do sync. Invertida, o parity check
--    encontra divergencia de schema e aborta as 21 tabelas de uma vez.
--
-- ============================================================================
-- POR QUE O CORPO E CAPTURADO DA DEFINICAO VIVA
--
-- Mesmo racional da 098, e aqui ainda mais forte: o corpo tem 5.800 caracteres
-- e e quase todo string acentuada em portugues ("Ataque forte contra defesa
-- fragil do adversario", e outras 40). Transcrever isso a mao para ca e um
-- gerador de erro silencioso -- basta um acento trocado para o texto que o
-- assinante le mudar.
--
-- Entao o corpo nao e transcrito: e lido de pg_get_functiondef, alterado em
-- dois pontos declarados, e reexecutado. A migration aborta se nao encontrar
-- exatamente os dois pontos, e nao faz nada se a coluna ja estiver la.
--
-- Efeito colateral bom: o que estiver no PRD e o que sera alterado. Nao ha como
-- esta migration reverter em silencio uma mudanca que so exista la.
--
-- ============================================================================
-- O QUE NAO ENTRA
--
-- premissas_cegas (a lista de QUAIS premissas ficaram cegas) NAO entra. E
-- ARRAY<STRING>, e o sync pula colunas array -- como ja pula evidencias e
-- avisos. Ela nao existe no Postgres.
--
-- Consequencia de produto, e vale estar escrita aqui: o aviso na tela diz
-- QUANTAS premissas ficaram sem dado, nunca QUAIS.
--
-- ============================================================================
-- NOTA SOBRE UMA SEGUNDA MUDANCA DE ASSINATURA
--
-- A frente A1 do Redesenho do Score vai REMOVER pts_valor, pts_corroboracao e
-- penalidades desta mesma RPC, o que exige outro DROP.
--
-- Decidido nao esperar: a A1 esta atras de outras frentes na fila e pode levar
-- semanas. O custo de nao esperar e uma migration a mais. O custo de esperar e
-- o contador ficar na gaveta com o dado pronto no banco.
-- ============================================================================

DO $migration$
DECLARE
  v text;
  v_novo text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_futebol_value_board';

  IF v IS NULL THEN
    RAISE EXCEPTION 'get_futebol_value_board nao existe';
  END IF;

  -- Idempotencia: ja tem a coluna, nada a fazer.
  IF position('premissas_sem_dado' in v) > 0 THEN
    RAISE NOTICE 'get_futebol_value_board ja devolve premissas_sem_dado. Nada a fazer.';
    RETURN;
  END IF;

  -- Guarda: os dois pontos de alteracao tem que existir exatamente assim.
  IF position('evidencias text[])' in v) = 0 THEN
    RAISE EXCEPTION 'get_futebol_value_board: nao encontrei o fim do RETURNS TABLE. Definicao viva divergente do esperado.';
  END IF;

  IF position(E'], null)\n  from futebol.fact_value_opportunities v' in v) = 0 THEN
    RAISE EXCEPTION 'get_futebol_value_board: nao encontrei o fim da projecao. Definicao viva divergente do esperado.';
  END IF;

  -- 1. a coluna entra no fim do RETURNS TABLE
  v_novo := replace(v,
    'evidencias text[])',
    'evidencias text[], premissas_sem_dado integer)');

  -- 2. e no fim da projecao, na mesma posicao, senao a ordem nao casa.
  --    ::int porque a coluna e bigint no Postgres e a assinatura declara integer.
  v_novo := replace(v_novo,
    E'], null)\n  from futebol.fact_value_opportunities v',
    E'], null),\n    v.premissas_sem_dado::int\n  from futebol.fact_value_opportunities v');

  IF v_novo = v THEN
    RAISE EXCEPTION 'get_futebol_value_board: nenhuma substituicao aplicada. Abortado.';
  END IF;

  DROP FUNCTION IF EXISTS public.get_futebol_value_board();
  EXECUTE v_novo;
END
$migration$;

-- ============================================================================
-- VERIFICACAO APOS APLICAR
--
-- A) a coluna esta na assinatura:
--
--    select position('premissas_sem_dado' in pg_get_functiondef(p.oid)) > 0
--    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'get_futebol_value_board';
--    -- esperado: true
--
-- B) o que a RPC devolve bate com a tabela, linha a linha:
--
--    select count(*) as divergentes
--    from public.get_futebol_value_board() r
--    join futebol.fact_value_opportunities v
--      on v.fixture_id = r.fixture_id and v.market = r.market
--     and v.outcome = r.outcome and v.line_value is not distinct from r.line_value
--    where r.premissas_sem_dado is distinct from v.premissas_sem_dado::int;
--    -- esperado: 0
--
-- C) nenhuma linha perdida no DROP + recriar:
--
--    select (select count(*) from public.get_futebol_value_board()) as da_rpc,
--           (select count(*) from futebol.fact_value_opportunities) as da_tabela;
--    -- esperado: iguais
-- ============================================================================
