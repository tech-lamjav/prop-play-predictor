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

  -- Idempotencia. Testa a ASSINATURA, nao o texto inteiro: procurar so por
  -- 'premissas_sem_dado' casaria com uma mencao em comentario dentro do corpo, e
  -- a migration sairia anunciando "nada a fazer" sem ter feito nada.
  IF position('premissas_sem_dado integer)' in v) > 0 THEN
    RAISE NOTICE 'get_futebol_value_board ja devolve premissas_sem_dado. Nada a fazer.';
    RETURN;
  END IF;

  -- Guardas: cada ancora tem que existir EXATAMENTE UMA VEZ.
  -- Contar em vez de so testar existencia importa porque replace() troca TODAS
  -- as ocorrencias. Com a ancora repetida, a substituicao corromperia a funcao
  -- em silencio -- e o corpo muda quando a A1 do Score mexer nele.
  IF array_length(string_to_array(v, 'evidencias text[])'), 1) - 1 <> 1 THEN
    RAISE EXCEPTION 'get_futebol_value_board: a ancora do RETURNS TABLE nao aparece exatamente uma vez. Definicao viva divergente do esperado.';
  END IF;

  IF array_length(string_to_array(v, E'], null)\n  from futebol.fact_value_opportunities v'), 1) - 1 <> 1 THEN
    RAISE EXCEPTION 'get_futebol_value_board: a ancora da projecao nao aparece exatamente uma vez. Definicao viva divergente do esperado.';
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

  -- Reemitir o grant. Neste projeto ha ALTER DEFAULT PRIVILEGES em `public`
  -- concedendo execute a anon/authenticated/service_role, entao a funcao nova
  -- ja nasceria com ele -- verificado no espelho. Fica explicito assim mesmo:
  -- o DROP apaga a ACL, e depender de um padrao implicito do ambiente para
  -- restaurar acesso e o tipo de coisa que funciona ate o dia em que alguem
  -- muda o padrao e ninguem liga uma coisa na outra.
  GRANT EXECUTE ON FUNCTION public.get_futebol_value_board() TO anon, authenticated, service_role;
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
-- C) nenhuma linha perdida no DROP + recriar.
--
--    ⚠️ Comparar a contagem da RPC com a da tabela NAO serve como assercao: a
--    RPC faz INNER JOIN em fact_fixtures, entao oportunidade sem fixture
--    correspondente sai do resultado por desenho, e nao por causa do DROP.
--    Hoje sao 0 dessas, mas isso e estado do dado, nao garantia.
--
--    A comparacao que de fato prova o DROP e antes/depois da propria RPC:
--
--    -- ANTES de aplicar:
--    select count(*) from public.get_futebol_value_board();
--    -- DEPOIS: mesmo numero.
--
--    E, se quiser explicar uma diferenca eventual:
--    select count(*) from futebol.fact_value_opportunities v
--    where not exists (select 1 from futebol.fact_fixtures f
--                      where f.fixture_id = v.fixture_id);
--    -- quantas oportunidades o INNER JOIN descarta
-- ============================================================================
