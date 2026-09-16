-- 20260917160000_148_placar_foto_de_nascimento
--
-- O placar e o histórico discordavam sobre qual é a foto de nascimento.
--
-- Duas telas respondiam "como esta oportunidade nasceu" olhando linhas
-- diferentes do snapshot:
--
--   · o PLACAR (esta RPC, migrations 133 e 134) filtrava
--     `score_versao = 'contexto_v1'` ANTES de pegar a primeira versão;
--   · o HISTÓRICO e o DETALHE DO JOGO (migration 146) pegam a primeira de todas.
--
-- Para uma oportunidade nascida antes do cutover de 03/09 e reavaliada depois,
-- o placar chamava de nascimento a primeira versão da metodologia nova, e o
-- histórico a primeira de todas. São linhas diferentes, com vantagens
-- diferentes — e desde a 146 essa vantagem decide o que aparece e o que some.
--
-- Quem está certo é o histórico: "apareceu na tela" não tem versão de
-- metodologia. A linha foi publicada com o preço que tinha, na régua que existia
-- no dia. Filtrar por versão ao responder isso é olhar o passado com a régua de
-- hoje.
--
-- ⚠️ MAS O FILTRO NÃO ERA BOBAGEM, e por isso ele não some: ele existe para NÃO
-- SOMAR DUAS ESCALAS DE NOTA. A nota mudou de escala entre `legacy` e
-- `contexto_v1`, e misturar as duas inventa uma série que nunca existiu.
--
-- A correção separa as duas perguntas em dois CTEs:
--
--   nascimento  sem filtro   -> identidade, PREÇO (`best_odd`, `edge`) e a DATA
--                               de nascimento. Preço não mudou de escala.
--   nota        com filtro   -> `score`, `faixa`, `score_versao`, pontos,
--                               penalidades e os sinalizadores. Escala importa.
--
-- ⚠️ JUNÇÃO INTERNA, de propósito: a linha que só existe em `legacy` continua
-- FORA da amostra, exatamente como hoje. Esta migration não muda QUEM entra no
-- placar, só de qual versão vem o preço e a data de quem já entrava. Trocar por
-- junção externa traria linha nova com nota nula, que a tela não espera e que a
-- issue não pediu.
--
-- ⚠️ CONSEQUÊNCIA DELIBERADA NA LEITURA POR FAIXA. `detectada_em` passa a ser a
-- data da primeira versão de todas, então ela anda PARA TRÁS nas linhas que
-- cruzam o cutover. O front decide "escala antiga" comparando essa data com o
-- instante da virada (`naEscalaAntiga`, em `placar-agregacao.ts`), e não pela
-- coluna de versão — então essas linhas passam a ficar fora da tabela POR FAIXA.
-- É o certo: elas foram publicadas sob a régua velha. E elas continuam em todas
-- as outras contas (ROI por mercado, campeonato, odd, premissa), que não
-- dependem da escala da nota.
--
-- ⚠️ DESEMPATE EXPLÍCITO no `distinct on`, que a 133 e a 134 não tinham: sem ele
-- a escolha entre duas versões do mesmo instante fica ao acaso do plano. É a
-- mesma correção que a revisão da 146 pediu lá.
--
-- Conferência depois de aplicar, na MESMA linha que cruza o cutover:
--
--   select o.opportunity_key, o.detectada_em, o.edge, o.score, o.score_versao
--     from public.get_futebol_oportunidades_publicadas(date '2026-09-01', date '2026-09-10') o
--    where o.opportunity_key in (
--      select h.opportunity_key
--        from futebol.fact_value_opportunities_hist h
--       group by h.opportunity_key
--      having min(h.dbt_valid_from) < timestamp '2026-09-04 14:35:00'
--         and max(h.score_versao) = 'contexto_v1'
--      limit 5
--    );
--   -- espera: `edge` e `detectada_em` iguais aos do histórico
--   -- (get_futebol_value_history no mesmo período), e `score_versao` contexto_v1

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
    -- SEM filtro de versão: identidade, preço e data de nascimento. "Apareceu na
    -- tela" não tem versão de metodologia, e preço não mudou de escala.
    select distinct on (h.opportunity_key)
      h.opportunity_key, h.fixture_id, h.market, h.outcome, h.line_value,
      h.best_odd, h.edge, h.dbt_valid_from
    from futebol.fact_value_opportunities_hist h
    order by h.opportunity_key, h.dbt_valid_from asc, h.dbt_scd_id asc
  ),
  nota as (
    -- COM filtro: a nota `legacy` veio de outro método, e somar as duas inventa
    -- uma série que nunca existiu.
    select distinct on (h.opportunity_key)
      h.opportunity_key, h.score, h.faixa, h.score_versao,
      h.pts_premissas, h.penalidades, h.premissas_sem_dado,
      h.modelo_api_concorda, h.linha_sharp_confirma,
      h.pen_odd_outlier, h.pen_poucas_casas, h.pen_odd_longshot, h.pen_odd_juice
    from futebol.fact_value_opportunities_hist h
    where h.score_versao = 'contexto_v1'
    order by h.opportunity_key, h.dbt_valid_from asc, h.dbt_scd_id asc
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
    t.score::int,
    t.faixa,
    t.score_versao,
    t.pts_premissas::int,
    t.penalidades::int,
    t.premissas_sem_dado::int,
    t.modelo_api_concorda,
    t.linha_sharp_confirma,
    t.pen_odd_outlier,
    t.pen_poucas_casas,
    t.pen_odd_longshot,
    t.pen_odd_juice,
    -- Left join, e não join: linha sem premissa casada chega com nulo em vez de
    -- desaparecer da conta. O casamento é 100% hoje, e o dia em que deixar de
    -- ser eu quero ver o buraco no denominador, não a linha sumindo.
    pa.acesas
  from nascimento n
  -- Junção INTERNA: quem nunca teve versão `contexto_v1` continua fora, como
  -- antes desta migration.
  join nota t on t.opportunity_key = n.opportunity_key
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
  order by f.kickoff_utc desc, t.score desc;
end;
$function$;

comment on function public.get_futebol_oportunidades_publicadas(date, date) is
  'Foto de nascimento das oportunidades publicadas no periodo, com o placar do jogo e as premissas acesas. Preco e data vem da primeira versao de todas; nota vem da primeira contexto_v1 (migration 148). Insumo do placar da metodologia. Restrita a socio.';
