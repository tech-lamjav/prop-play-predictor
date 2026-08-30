-- 20260829210000_115_futebol_disponivel_desde_antes_do_apito
--
-- Corrige a migration 114: "Disponível desde" podia devolver um horário
-- POSTERIOR ao fim da partida.
--
-- A migration 114 monta as ilhas de disponibilidade sobre todas as versões do
-- snapshot, sem limite superior. Só que o mart é full-refresh e continua
-- reescrevendo o jogo depois de encerrado — medido no dev em 29/08/2026: 97%
-- das versões nascem DEPOIS do apito, em média 668h depois. Numa chave fechada
-- e reaberta no dia seguinte, a ilha mais recente começa no dia seguinte, e a
-- tela dizia que a oportunidade estava disponível desde depois do jogo.
--
-- O corte é o apito inicial: só conta como disponibilidade o que existiu antes
-- de a bola rolar, que é o único período em que dava para apostar.
--
-- Efeito medido no dev, com a função corrigida:
--   - fixture 1570342 (caso de aceite da issue #300): segue 25/08/2026 15:03:09
--     BRT, 56 minutos antes do apito.
--   - fixtures 1489381 e 1489391 (apitos de 17/06 e 19/06, cuja única versão no
--     snapshot nasce em 27/07): passam a não devolver nada, em vez de dizerem
--     "disponível desde 03/08" — um mês depois do jogo.
--
-- Sem DROP: a assinatura não muda, então CREATE OR REPLACE preserva as grants.

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_disponivel_desde(p_fixture_id bigint)
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
    join futebol.fact_fixtures fx on fx.fixture_id = h.fixture_id
    where h.fixture_id = p_fixture_id
      -- Só versões anteriores ao apito (ver o cabeçalho).
      and h.dbt_valid_from < fx.kickoff_utc
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
