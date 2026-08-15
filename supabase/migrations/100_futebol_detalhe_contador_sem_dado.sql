-- 100_futebol_detalhe_contador_sem_dado.sql
--
-- Ticket #245, segunda metade: o contador tambem chega a tela de DETALHE.
--
-- A 099 fez a RPC do board devolver premissas_sem_dado. Esta faz o mesmo na
-- get_futebol_fixture_value, que alimenta a bancada de mercados do detalhe.
--
-- ============================================================================
-- POR QUE UMA COLUNA, E NAO UMA FRASE DENTRO DE `avisos`
--
-- A #241 sugeriu que o aviso coubesse no array `avisos`, que esta funcao ja
-- monta. Discordo, e o motivo e de produto:
--
-- Todo aviso daquele array carrega desconto de pontos entre parenteses
-- (−30, −12, −15, −10). Sao penalidades de verdade: cada um tira nota.
--
-- Este NAO tira. A ADR 0003 e explicita -- dado faltante DIAGNOSTICA, NAO
-- PENALIZA, e o score nao muda. Se ele entrar no mesmo array, herda a mesma
-- renderizacao, aparece ao lado de numeros negativos, e passa a comunicar
-- exatamente o oposto do que existe para dizer: o assinante le "esta aposta e
-- pior" quando a frase quer dizer "sabemos menos sobre esta aposta".
--
-- Expondo o NUMERO, o front decide a forma: sem pontos, sem cor de erro, tom de
-- ressalva. E o que o ticket #246 exige, e nao daria para cumprir com a frase
-- pronta vindo de dentro do array.
--
-- ============================================================================
-- ORDEM E CONFLITO
--
-- Esta migration vem DEPOIS da 098, que corrigiu o desempate de janela e de
-- mercado na mesma funcao por substituicao guardada.
--
-- Como o corpo aqui e capturado da definicao VIVA, ele ja inclui a correcao da
-- 098 -- e por isso as duas nao se atropelam. Se esta rodar antes da 098 por
-- engano, a 098 ainda funciona depois: ela e idempotente e so aplica o patch se
-- encontrar o texto antigo.
--
-- ⚠️ E DROP + recriar, pelo mesmo motivo da 099: acrescentar coluna ao
--    RETURNS TABLE altera a assinatura. Migration antes do sync.
--
-- Mesmo racional da 099 para nao transcrever o corpo: sao 10.295 caracteres,
-- quase todos frases acentuadas em portugues que o assinante le na tela.
-- ============================================================================

DO $migration$
DECLARE
  v text;
  v_novo text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_futebol_fixture_value';

  IF v IS NULL THEN
    RAISE EXCEPTION 'get_futebol_fixture_value nao existe';
  END IF;

  IF position('premissas_sem_dado' in v) > 0 THEN
    RAISE NOTICE 'get_futebol_fixture_value ja devolve premissas_sem_dado. Nada a fazer.';
    RETURN;
  END IF;

  IF position('contras text[])' in v) = 0 THEN
    RAISE EXCEPTION 'get_futebol_fixture_value: nao encontrei o fim do RETURNS TABLE.';
  END IF;

  IF position(E'], null))[1:3]\n  from futebol.fact_value_opportunities v' in v) = 0 THEN
    RAISE EXCEPTION 'get_futebol_fixture_value: nao encontrei o fim da projecao.';
  END IF;

  -- Aviso se a 098 ainda nao rodou: nao impede, mas quem le o log precisa saber.
  IF position('d.janela_usada is not distinct from v.janela_usada' in v) = 0 THEN
    RAISE WARNING 'get_futebol_fixture_value ainda nao tem o desempate de janela da 098. Rodar a 098 depois desta.';
  END IF;

  v_novo := replace(v,
    'contras text[])',
    'contras text[], premissas_sem_dado integer)');

  v_novo := replace(v_novo,
    E'], null))[1:3]\n  from futebol.fact_value_opportunities v',
    E'], null))[1:3],\n    v.premissas_sem_dado::int\n  from futebol.fact_value_opportunities v');

  IF v_novo = v THEN
    RAISE EXCEPTION 'get_futebol_fixture_value: nenhuma substituicao aplicada. Abortado.';
  END IF;

  DROP FUNCTION IF EXISTS public.get_futebol_fixture_value(bigint);
  EXECUTE v_novo;
END
$migration$;

-- ============================================================================
-- VERIFICACAO APOS APLICAR
--
-- A) a coluna esta na assinatura e o desempate da 098 sobreviveu:
--
--    select position('premissas_sem_dado' in pg_get_functiondef(p.oid)) > 0 as tem_contador,
--           position('d.janela_usada is not distinct from v.janela_usada' in pg_get_functiondef(p.oid)) > 0 as manteve_098
--    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'get_futebol_fixture_value';
--    -- esperado: true, true
--
-- B) o valor bate com a tabela, e nenhuma linha se perdeu:
--
--    with alvos as (select distinct fixture_id from futebol.fact_value_opportunities limit 20)
--    select count(*) as divergentes
--    from alvos a, public.get_futebol_fixture_value(a.fixture_id) r
--    join futebol.fact_value_opportunities v
--      on v.fixture_id = a.fixture_id and v.market = r.market and v.outcome = r.outcome
--     and v.line_value is not distinct from r.line_value
--    where r.premissas_sem_dado is distinct from v.premissas_sem_dado::int;
--    -- esperado: 0
-- ============================================================================
