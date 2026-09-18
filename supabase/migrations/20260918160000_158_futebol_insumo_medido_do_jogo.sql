-- ============================================================
-- 158_futebol_insumo_medido_do_jogo — o front passa a poder LER o valor medido
-- ============================================================
-- Contexto (#464, absorvendo a #406): o mart publica, por jogo e saída, o VALOR
-- que cada premissa comparou — não só se ela acendeu. Isso vive em
-- `futebol.fact_insumos_medidos`, espelhada do BigQuery (ADR 0016).
--
-- O front não tem como ler: o schema `futebol` é fechado por decreto (todo
-- acesso revogado para anon e authenticated, seção 2b do shape file), e o
-- acesso é só por RPC com definidor de segurança. Esta é a RPC que faltava.
--
-- ── Por que uma RPC nova, e não colunas na 094 ──────────────────────────────
--
-- O grão não cabe lá. `get_futebol_fixture_numeros` devolve UMA linha por lado
-- do confronto; esta tabela é comprida de propósito — uma linha por jogo ×
-- saída × premissa × insumo — para passar pelo sync e não engordar em largura a
-- cada premissa nova. Espremer isso na 094 significaria ou pivotar para colunas
-- (o formato que a decisão do mart rejeitou) ou multiplicar as linhas dela,
-- quebrando todos os consumidores atuais.
--
-- ── Agnóstica de nome, de propósito ─────────────────────────────────────────
--
-- Ela devolve `premissa` e `insumo` como vieram, sem traduzir. Os nomes de
-- insumo vivem no catálogo do dbt, não aqui, e decorar uma frase por nome neste
-- lado seria criar uma terceira cópia de vocabulário para divergir sozinha —
-- que é exatamente o problema que a #464 está consertando.
--
-- ── Hoje só o 1X2 ───────────────────────────────────────────────────────────
--
-- A Entrega 2 do mart cobriu só o `match_winner`; `market` e `line_value` já
-- estão no grão mesmo assim, porque mudar o grão de tabela já sincronizada é o
-- que quebrou o sync quatro vezes neste repositório. Quando os outros mercados
-- entrarem, esta função não muda.
--
-- Linha antiga não tem valor medido: o funil é append-only e a coluna nasceu
-- agora. Quem chama tem de tratar ausência como normal, e não como erro — é por
-- isso que a rota ancorada da 156 e da 157 continua existindo atrás desta.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_insumos(p_fixture_id bigint)
 RETURNS TABLE(outcome text, market text, line_value double precision, premissa text, insumo text, valor double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select i.outcome, i.market, i.line_value, i.premissa, i.insumo, i.valor
  from futebol.fact_insumos_medidos i
  where i.fixture_id = p_fixture_id
  order by i.outcome, i.market, i.premissa, i.insumo;
$function$;

COMMENT ON FUNCTION public.get_futebol_fixture_insumos(bigint) IS
  'O VALOR que cada premissa comparou num jogo, por saída e mercado, direto do mart (#464/#406). Uma linha por saída × mercado × premissa × insumo. Devolve `premissa` e `insumo` sem traduzir: o vocabulário é do dbt. Hoje só o 1X2 é populado, e linha gravada antes do deploy não tem valor — ausência é normal, e quem chama cai na rota ancorada da 156/157.';

-- Fechar ANTES de conceder, e no mesmo arquivo que cria: entre nascer aberta e
-- ser fechada depois existe uma janela, e nas duas funções da #408 essa janela
-- durou meses em produção.
--
-- Revogar só de PUBLIC não basta no Supabase. O schema `public` tem privilégio
-- padrão (pg_default_acl) que dá EXECUTE explícito a anon, authenticated e
-- service_role em toda função nova, e esses três grants sobrevivem ao revoke de
-- PUBLIC — foi assim que a 140 fechou as duas da #408 e elas continuaram
-- abertas, até a 143. Por isso os três nomes estão aqui.
revoke execute on function public.get_futebol_fixture_insumos(bigint) from public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_futebol_fixture_insumos(bigint) TO anon, authenticated, service_role;
