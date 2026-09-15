-- ============================================================================
-- 134 · As premissas acesas chegam ao placar
-- ============================================================================
-- O placar nasceu dizendo que ROI por premissa era impossível. Estava errado: as
-- tabelas de premissa do mart existem neste banco, uma linha por candidata com
-- uma coluna booleana por premissa, e elas casam com o board publicado em 100%
-- das linhas liquidadas — medido nos cinco mercados. O que eu tinha visto era a
-- RPC da migration 093, que atende UM jogo por chamada; a tabela por trás dela
-- é consultável em lote.
--
-- Esta migration faz duas coisas:
--
--   · uma view que desempilha as cinco tabelas de premissa em (jogo, mercado,
--     saída, linha, premissas acesas), com os mesmos slugs da 093;
--   · a RPC do placar passa a devolver o array de acesas por oportunidade.
--
-- ⚠️ O QUE ISSO NÃO É. A flag é recalculada todo dia, a partir de janelas
-- anteriores ao apito. Para jogo passado o valor é estável, porque os insumos
-- estão congelados — mas se alguém mudar o critério de uma premissa, o passado é
-- reescrito. Não é registro point-in-time do que foi publicado, é recálculo com
-- a régua de hoje, e a tela diz isso.
--
-- ⚠️ E o que ainda falta: o INSUMO e a JANELA de cada premissa, que dizem por
-- QUANTO ela acendeu. Isso o Mateus entregou no mart em 08 e 10/09/2026 e as
-- colunas não vieram no sync. Sem elas dá para separar acesa de apagada, e não
-- dá para separar "acendeu raspando" de "acendeu com folga".
--
-- ⚠️ Só as acesas viajam. As apagadas são o conjunto do LADO menos as acesas, e
-- o lado é fixo no catálogo do front (futebol-premissas.ts) — mandar as duas
-- listas duplicaria na rede uma informação que a tela já tem. Premissa fora do
-- array é "não atingiu o corte" OU "sem dado": as int_* não têm nulo, e é por
-- isso que `premissas_sem_dado` continua vindo à parte.
-- ============================================================================

create or replace view futebol.vw_premissas_acesas as
  select 'match_winner'::text as market,
         p.fixture_id,
         p.outcome,
         null::double precision as line_value,
         array_remove(array[
           case when p.forma                 then 'forma' end,
           case when p.mando                 then 'mando' end,
           case when p.superioridade_tabela  then 'superioridade_tabela' end,
           case when p.forca_mismatch        then 'forca_mismatch' end,
           case when p.superioridade_xg      then 'superioridade_xg' end,
           case when p.h2h_favoravel         then 'h2h_favoravel' end,
           case when p.desfalque_adversario  then 'desfalque_adversario' end
         ], null) as acesas
    from futebol.int_futebol_premissas_1x2 p

  union all

  select 'goals_over_under'::text,
         p.fixture_id,
         p.outcome,
         p.line_value,
         array_remove(array[
           case when p.defesas_firmes      then 'defesas_firmes' end,
           case when p.defesas_vazaveis    then 'defesas_vazaveis' end,
           case when p.ataque_combinado    then 'ataque_combinado' end,
           case when p.xg_baixo_combinado  then 'xg_baixo_combinado' end,
           case when p.xg_combinado_alto   then 'xg_combinado_alto' end,
           case when p.clean_sheets_altos  then 'clean_sheets_altos' end,
           case when p.ataques_fracos      then 'ataques_fracos' end,
           case when p.historico_under     then 'historico_under' end,
           case when p.historico_over      then 'historico_over' end,
           case when p.ambos_vazam         then 'ambos_vazam' end,
           case when p.ritmo_alto          then 'ritmo_alto' end
         ], null)
    from futebol.int_futebol_premissas_ou p

  union all

  select 'asian_handicap'::text,
         p.fixture_id,
         p.outcome,
         p.line_value,
         array_remove(array[
           case when p.supremacia             then 'supremacia' end,
           case when p.tende_golear           then 'tende_golear' end,
           case when p.adversario_fragil_fora then 'adversario_fragil_fora' end,
           case when p.mando_forte            then 'mando_forte' end,
           case when p.sem_rodizio            then 'sem_rodizio' end,
           case when p.raramente_perde_por_2  then 'raramente_perde_por_2' end,
           case when p.defesa_fora_solida     then 'defesa_fora_solida' end
         ], null)
    from futebol.int_futebol_premissas_ah p

  union all

  select 'btts'::text,
         p.fixture_id,
         p.outcome,
         null::double precision,
         array_remove(array[
           case when p.ambos_marcam     then 'ambos_marcam' end,
           case when p.ataque_dos_dois  then 'ataque_dos_dois' end,
           case when p.defesas_vazaveis then 'defesas_vazaveis' end,
           case when p.historico_btts   then 'historico_btts' end,
           case when p.defesa_forte     then 'defesa_forte' end,
           case when p.ataque_trava     then 'ataque_trava' end,
           case when p.historico_seco   then 'historico_seco' end
         ], null)
    from futebol.int_futebol_premissas_btts p

  union all

  select 'double_chance'::text,
         p.fixture_id,
         p.outcome,
         null::double precision,
         array_remove(array[
           case when p.lado_coberto_forte   then 'lado_coberto_forte' end,
           case when p.equilibrio_defensivo then 'equilibrio_defensivo' end,
           case when p.adversario_limitado  then 'adversario_limitado' end,
           case when p.invicto_recente      then 'invicto_recente' end
         ], null)
    from futebol.int_futebol_premissas_dc p;

comment on view futebol.vw_premissas_acesas is
  'As premissas ACESAS de cada candidata, desempilhadas das cinco tabelas do mart. Mesmos slugs da get_futebol_fixture_premissas (093), em lote. Recalculada todo dia: não é registro point-in-time.';

-- ── A RPC do placar, agora com as acesas ────────────────────────────────────
-- O Postgres recusa `create or replace` que altere o RETURNS TABLE, então
-- derruba antes de recriar. A função tem um dia de vida e só o placar a chama.
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
  pen_odd_juice boolean,
  premissas_acesas text[]
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
    n.pen_odd_juice,
    -- Left join, e não join: linha sem premissa casada chega com nulo em vez de
    -- desaparecer da conta. O casamento é 100% hoje, e o dia em que deixar de
    -- ser eu quero ver o buraco no denominador, não a linha sumindo.
    pa.acesas
  from nascimento n
  join futebol.fact_fixtures f on f.fixture_id = n.fixture_id
  left join futebol.vw_premissas_acesas pa
    on pa.fixture_id = n.fixture_id
   and pa.market = n.market
   and pa.outcome = n.outcome
   and pa.line_value is not distinct from n.line_value
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
  'Foto de nascimento das oportunidades publicadas no período, com o placar do jogo e as premissas acesas. Insumo do placar da metodologia. Restrita a sócio: devolve o board inteiro, inclusive mercado oculto.';
