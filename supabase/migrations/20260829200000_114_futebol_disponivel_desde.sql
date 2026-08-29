-- 20260829200000_114_futebol_disponivel_desde
--
-- "Disponível desde": o início do período de disponibilidade CONTÍNUA ATUAL de
-- cada oportunidade do jogo (issue #300, investigação AE #120/#121).
--
-- A pergunta que o usuário faz é "desde quando isso está aqui?", e a tela
-- respondia com `janela_usada`, que é a janela de odds da versão viva — outra
-- coisa. O caso que abriu a investigação: um assinante achou que o Valencia ×
-- Betis Mais de 3,5 "não estava lá de tarde". Estava: foi publicado às 15:03:09
-- BRT, 56 minutos antes do apito, e ficou disponível sem interrupção.
--
-- RPC PRÓPRIA, e não uma coluna a mais em get_futebol_fixture_value, por duas
-- razões. A issue pede para não empilhar duas mudanças de contrato na mesma
-- janela — e a migration 112 já troca a assinatura daquela RPC na virada do
-- Score de contexto. E como função nova não altera contrato de ninguém, esta
-- entrega pode subir sozinha, sem esperar a janela.
--
-- ⚠️ Três formas de o campo mentir, todas endereçadas abaixo:
--   1. MIN(dbt_valid_from) da chave data o PRIMEIRO nascimento de sempre e
--      ignora reativação, que é justamente a distinção pedida.
--   2. janela_usada não é isto.
--   3. O snapshot estreou em 27/07/2026. Para uma chave que já existia antes,
--      o primeiro dbt_valid_from data a estreia do snapshot, não a publicação
--      da oportunidade. Nesse caso o campo vem VAZIO: melhor vazio que um
--      horário inventado.

-- ⚠️ A função devolve a corrida da ÚLTIMA versão que o snapshot tem, inclusive
-- de chave que já saiu do board. É de propósito: é o que faz o campo continuar
-- respondendo no jogo encerrado, cujo detalhe lê a foto do apito (migration
-- 101) — e o caso de aceite da issue é justamente um jogo de 25/08. Quem decide
-- se aquilo está publicado AGORA é get_futebol_fixture_value, e a tela só
-- escreve a frase quando as duas concordam.
--
-- Medido no dev em 29/08/2026: das 284 chaves do snapshot, 276 têm a última
-- versão fechada e 8 têm versão aberta; nenhuma das 8 está fora do board. Ou
-- seja, o snapshot fecha a linha quando a oportunidade sai, e por isso os
-- buracos existem — são 74 chaves com reativação. Sem esse fechamento não
-- haveria ilha nenhuma e o campo viraria o MIN da chave, que é a forma 1 de
-- mentir.

DROP FUNCTION IF EXISTS public.get_futebol_fixture_disponivel_desde(bigint);

CREATE FUNCTION public.get_futebol_fixture_disponivel_desde(p_fixture_id bigint)
RETURNS TABLE(
  market text,
  outcome text,
  line_value double precision,
  disponivel_desde timestamp without time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  -- Ilhas e buracos sobre as versões do snapshot. Versões contíguas
  -- (dbt_valid_to de uma = dbt_valid_from da seguinte) são ATUALIZAÇÃO da mesma
  -- disponibilidade; um buraco entre elas é REATIVAÇÃO, e reinicia o relógio.
  with versoes as (
    select
      h.opportunity_key,
      h.market,
      h.outcome,
      h.line_value,
      h.dbt_valid_from,
      lag(h.dbt_valid_to) over (
        partition by h.opportunity_key order by h.dbt_valid_from
      ) as fim_da_anterior
    from futebol.fact_value_opportunities_hist h
    where h.fixture_id = p_fixture_id
  ), ilhas as (
    select
      v.*,
      -- Cada vez que o fim da versão anterior não encosta no início desta,
      -- começa uma ilha nova. A primeira versão sempre abre uma.
      count(*) filter (where v.fim_da_anterior is distinct from v.dbt_valid_from) over (
        partition by v.opportunity_key
        order by v.dbt_valid_from
        rows between unbounded preceding and current row
      ) as ilha
    from versoes v
  ), por_chave as (
    select distinct on (i.opportunity_key)
      i.opportunity_key,
      i.market,
      i.outcome,
      i.line_value,
      -- Início da ilha da versão MAIS RECENTE: a disponibilidade atual.
      min(i.dbt_valid_from) over (partition by i.opportunity_key, i.ilha) as inicio_da_ilha,
      -- Primeira versão que o snapshot tem desta chave, para detectar o caso 3.
      min(i.dbt_valid_from) over (partition by i.opportunity_key) as primeira_versao
    from ilhas i
    order by i.opportunity_key, i.dbt_valid_from desc
  )
  select
    c.market,
    c.outcome,
    c.line_value,
    -- Vazio quando a corrida atual começa na primeira versão que o snapshot tem
    -- E essa versão está na estreia dele: aí o horário é a data em que o
    -- snapshot passou a existir, não a hora em que a oportunidade foi publicada.
    -- Uma reativação POSTERIOR à estreia continua confiável, e por isso a
    -- comparação é com o início da ilha, não com a chave inteira.
    case
      when c.inicio_da_ilha = c.primeira_versao
       and c.primeira_versao < timestamp '2026-07-28 00:00:00'
      then null
      else c.inicio_da_ilha
    end
  from por_chave c
  order by c.market, c.outcome, c.line_value;
$function$;

GRANT EXECUTE ON FUNCTION public.get_futebol_fixture_disponivel_desde(bigint) TO anon, authenticated, service_role;
