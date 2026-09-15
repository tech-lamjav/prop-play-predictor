-- ============================================================================
-- 133 · O insumo do placar da metodologia
-- ============================================================================
-- Uma RPC só, restrita a sócio, que devolve a FOTO DE NASCIMENTO de cada
-- oportunidade publicada num período, junto com o placar final do jogo.
--
-- Foto de nascimento é o primeiro registro de cada oportunidade no histórico —
-- a odd, a nota e a faixa com que ela foi publicada e alertada. É o que o placar
-- julga, porque é sobre essa régua que a decisão de publicar foi tomada.
--
-- ⚠️ Por que não reusamos `get_futebol_value_history`: ela devolve o registro
-- que estava vivo NO APITO, que é a última coisa que o assinante viu. São duas
-- séries legítimas e diferentes sobre os mesmos jogos, e responder as duas com
-- o mesmo número é como duas pessoas chegam a taxas diferentes para a mesma
-- semana. O motivo completo está no ADR 0003.
--
-- ⚠️ Esta RPC NÃO liquida. Ela devolve o placar do jogo e o estado dele, e quem
-- diz se a oportunidade bateu é a regra do site, em `futebol-settlement.ts`,
-- única fonte dessa conta (ADR 0002).
--
-- ⚠️ Ela devolve o BOARD, não a vitrine: mercado oculto vem junto, porque
-- decidir se ele volta é uma das decisões que o placar precisa sustentar. É por
-- isso que ela é restrita a sócio, e não aberta como as RPCs do assinante.
--
-- O período aceita as duas perguntas de uma vez: entra a linha cujo JOGO caiu no
-- intervalo e também a linha DETECTADA no intervalo. São perguntas diferentes —
-- uma mede o resultado da semana, a outra mede a régua que publicou — e quem
-- escolhe o eixo é a tela, com as duas datas na mão.
-- ============================================================================

drop function if exists public.get_futebol_oportunidades_publicadas(date, date);

create or replace function public.get_futebol_oportunidades_publicadas(
  p_de date,
  p_ate date
)
returns table(
  opportunity_key text,
  fixture_id bigint,
  competition text,
  home_team_name text,
  away_team_name text,
  kickoff_utc timestamp without time zone,
  status_short text,
  goals_home integer,
  goals_away integer,
  detectada_em timestamp without time zone,
  market text,
  outcome text,
  line_value double precision,
  best_odd double precision,
  edge double precision,
  score integer,
  faixa text,
  score_versao text,
  pts_premissas integer,
  penalidades integer,
  premissas_sem_dado integer,
  modelo_api_concorda boolean,
  linha_sharp_confirma boolean,
  pen_odd_outlier boolean,
  pen_poucas_casas boolean,
  pen_odd_longshot boolean,
  pen_odd_juice boolean
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  -- O mesmo porteiro do CRM. Sem ele, a chave pública do navegador leria o
  -- board inteiro, inclusive o mercado que saiu da vitrine.
  if not public.eh_socio() then
    raise exception 'apenas socios';
  end if;

  return query
  with nascimento as (
    select distinct on (h.opportunity_key)
      h.opportunity_key, h.fixture_id, h.market, h.outcome, h.line_value,
      h.best_odd, h.edge, h.score, h.faixa, h.score_versao,
      h.pts_premissas, h.penalidades, h.premissas_sem_dado,
      h.modelo_api_concorda, h.linha_sharp_confirma,
      h.pen_odd_outlier, h.pen_poucas_casas, h.pen_odd_longshot, h.pen_odd_juice,
      h.dbt_valid_from
    from futebol.fact_value_opportunities_hist h
    -- Só a metodologia vigente. A nota `legacy` veio de outro método, e somar
    -- as duas inventa uma série que nunca existiu.
    where h.score_versao = 'contexto_v1'
    order by h.opportunity_key, h.dbt_valid_from asc
  )
  select
    n.opportunity_key,
    n.fixture_id,
    f.competition,
    f.home_team_name,
    f.away_team_name,
    f.kickoff_utc,
    f.status_short,
    f.goals_home::int,
    f.goals_away::int,
    n.dbt_valid_from,
    n.market,
    n.outcome,
    n.line_value,
    n.best_odd,
    n.edge,
    n.score::int,
    n.faixa,
    n.score_versao,
    n.pts_premissas::int,
    n.penalidades::int,
    n.premissas_sem_dado::int,
    n.modelo_api_concorda,
    n.linha_sharp_confirma,
    n.pen_odd_outlier,
    n.pen_poucas_casas,
    n.pen_odd_longshot,
    n.pen_odd_juice
  from nascimento n
  join futebol.fact_fixtures f on f.fixture_id = n.fixture_id
  -- O dia é o de Brasília nos dois eixos, como em toda data que o produto
  -- mostra. Em UTC, jogo das 21h de sábado cairia no domingo.
  where (f.kickoff_utc at time zone 'UTC' at time zone 'America/Sao_Paulo')::date
          between p_de and p_ate
     or (n.dbt_valid_from at time zone 'UTC' at time zone 'America/Sao_Paulo')::date
          between p_de and p_ate
  order by f.kickoff_utc desc, n.score desc;
end;
$function$;

revoke execute on function public.get_futebol_oportunidades_publicadas(date, date) from public;
grant execute on function public.get_futebol_oportunidades_publicadas(date, date) to authenticated;

comment on function public.get_futebol_oportunidades_publicadas(date, date) is
  'Foto de nascimento das oportunidades publicadas no período, com o placar do jogo. Insumo do placar da metodologia. Restrita a sócio: devolve o board inteiro, inclusive mercado oculto.';
