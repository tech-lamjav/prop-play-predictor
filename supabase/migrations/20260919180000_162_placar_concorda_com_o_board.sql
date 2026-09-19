-- ============================================================================
-- 162 — o placar dos sócios usa a mesma foto de nascimento que o board
-- ============================================================================
-- A 161 mudou a vantagem de publicação do board e do detalhe do jogo: ela passou
-- a ser a da primeira versão VISÍVEL de cada oportunidade, e não a da primeira
-- que existe no snapshot. O placar dos sócios ficou para trás, e por isso as
-- duas telas voltaram a discordar — do jeito que a #436 já tinha corrigido uma
-- vez, e pelo mesmo motivo.
--
-- No caso que originou a 161 (jogo 1557408, Brentford +0,5):
--
--   · board e detalhe, depois da 161 ....... −1,94%, aparece
--   · placar dos sócios, sem esta migration . −2,96%, não aparece
--
-- −2,96% é a vantagem de 12/09, quando o handicap ainda estava fora da vitrine e
-- ninguém podia ver aquela linha. −1,94% é a de 16/09, quando ela apareceu de
-- verdade e foi enviada no daily.
--
-- ## O que muda
--
-- O PREÇO — `best_odd` e `edge` — passa a vir da primeira versão VISÍVEL, com
-- queda para a primeira de todas quando não houve nenhuma. A regra de
-- visibilidade é a mesma da 161, verbatim.
--
-- ⚠️ POR QUE QUEDA, E NÃO NULO. No board, a linha que nunca esteve visível some,
-- e é o que se quer. Aqui não: o placar devolve o board INTEIRO, mercado oculto
-- incluído, porque é com ele que se decide religar um mercado — foi assim que o
-- handicap voltou. Se a linha sumisse da RPC, o botão "Só a vitrine" desligado
-- não teria mais como trazê-la, e o painel perderia justamente o que ele existe
-- para mostrar. Decisão do PM em 19/09/2026.
--
-- Então aqui a regra de visibilidade decide QUAL PREÇO, e não QUEM ENTRA. Quem
-- entra continua sendo decidido no front, por `soAVitrine` — que agora recebe o
-- preço certo e passa a concordar com o board.
--
-- ## A identidade não se mexe
--
-- `nascimento` continua sendo a primeira versão de todas, e continua dirigindo a
-- consulta. Nenhuma linha entra ou sai desta RPC por causa desta migration: só
-- muda o número que algumas delas carregam.
--
-- A nota e a data também não se mexem. A ADR 0003 diz por quê, e vale igual: a
-- escala da nota mudou entre `legacy` e `contexto_v1`, e a data acompanha a nota
-- porque é ela que diz em que escala a nota foi calculada.
--
-- ## ⚠️ O recorte de período passou a ter UM dono
--
-- O CTE novo precisa saber sobre quais chaves trabalhar, e a resposta é "as que
-- o período já selecionou". Para isso o filtro de data saiu do `where` final e
-- virou o CTE `selecionadas`, que agora é a relação que dirige o select.
--
-- Isso NÃO é enfeite de organização: a alternativa era o CTE novo varrer o
-- snapshot inteiro, que é uma segunda passada completa na mesma tabela onde o
-- painel acabou de medir 4,4 segundos e HTTP 500 numa janela de 30 dias (ver o
-- cabeçalho de `historyWindow`, em `src/utils/futebol-history.ts`). E escrever o
-- filtro de data em dois lugares seria a outra forma de errar: duas metades da
-- mesma regra em pontos diferentes já foi o defeito da #471.
--
-- ⚠️ ESTA MIGRATION NÃO RODOU CONTRA UM POSTGRES. Só tem teste de texto, como as
-- irmãs dela. O plano PRECISA ser medido antes do merge:
--
--   explain (analyze, buffers)
--   select * from public.get_futebol_oportunidades_publicadas(
--     current_date - 30, current_date);
--   -- compare com a mesma consulta na develop; o que não pode acontecer é a
--   -- varredura do snapshot dobrar.
--
-- ## Conferência depois de aplicar
--
--   select p.edge as placar, v.edge_publicacao as board, p.edge = v.edge_publicacao as concordam
--     from public.get_futebol_oportunidades_publicadas(current_date - 30, current_date) p
--     join public.get_futebol_value_history(current_date - 30, current_date) v
--       on v.fixture_id = p.fixture_id and v.market = p.market
--      and v.outcome = p.outcome and v.line_value is not distinct from p.line_value
--    where p.market = 'asian_handicap'
--      and p.edge is distinct from v.edge_publicacao;
--   -- espera ZERO linhas: as duas telas passam a dizer o mesmo número.
--
-- ⚠️ `create or replace`: o `returns table(...)` não muda, só o corpo. Derrubar
-- aqui jogaria fora os grants por nada.
--
-- ⚠️ O `scripts/futebol-roi.mjs` muda JUNTO, e a ADR 0003 é quem obriga: o placar
-- segue o script, e mudar um lado sem o outro faz a tela e o terminal darem
-- números diferentes. A guarda é `placar-foto-de-nascimento.test.ts`.
-- ============================================================================

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
    -- IDENTIDADE, e o preço de reserva. A primeira versão de todas, sem filtro
    -- de versão: "apareceu na tela" não tem versão de metodologia, e preço não
    -- mudou de escala (migration 148).
    select distinct on (h.opportunity_key)
      h.opportunity_key, h.fixture_id, h.market, h.outcome, h.line_value,
      h.best_odd, h.edge
    from futebol.fact_value_opportunities_hist h
    order by h.opportunity_key, h.dbt_valid_from asc, h.dbt_scd_id asc
  ),
  nota as (
    -- COM filtro: a nota `legacy` veio de outro método, e somar as duas inventa
    -- uma série que nunca existiu. A DATA fica aqui porque é ela que diz em que
    -- escala esta NOTA foi calculada.
    select distinct on (h.opportunity_key)
      h.opportunity_key, h.score, h.faixa, h.score_versao,
      h.pts_premissas, h.penalidades, h.premissas_sem_dado,
      h.modelo_api_concorda, h.linha_sharp_confirma,
      h.pen_odd_outlier, h.pen_poucas_casas, h.pen_odd_longshot, h.pen_odd_juice,
      h.dbt_valid_from
    from futebol.fact_value_opportunities_hist h
    where h.score_versao = 'contexto_v1'
    order by h.opportunity_key, h.dbt_valid_from asc, h.dbt_scd_id asc
  ),
  selecionadas as (
    -- O RECORTE DE PERÍODO, em um lugar só, e a relação que dirige o select.
    --
    -- O dia é o de Brasília nos dois eixos, como em toda data que o produto
    -- mostra. Em UTC, jogo das 21h de sábado cairia no domingo.
    --
    -- Junção INTERNA com a nota: quem nunca teve versão `contexto_v1` continua
    -- fora, como antes da 148. A amostra não muda.
    select n.opportunity_key, n.fixture_id, n.market, n.outcome, n.line_value,
           n.best_odd, n.edge,
           t.score, t.faixa, t.score_versao,
           t.pts_premissas, t.penalidades, t.premissas_sem_dado,
           t.modelo_api_concorda, t.linha_sharp_confirma,
           t.pen_odd_outlier, t.pen_poucas_casas, t.pen_odd_longshot, t.pen_odd_juice,
           t.dbt_valid_from,
           f.competition, f.home_team_name, f.away_team_name,
           f.kickoff_utc, f.status_short, f.goals_home, f.goals_away
    from nascimento n
    join nota t on t.opportunity_key = n.opportunity_key
    join futebol.fact_fixtures f on f.fixture_id = n.fixture_id
    where (f.kickoff_utc at time zone 'UTC' at time zone 'America/Sao_Paulo')::date
            between p_de and p_ate
       or (t.dbt_valid_from at time zone 'UTC' at time zone 'America/Sao_Paulo')::date
            between p_de and p_ate
  ),
  janelas as (
    -- A JANELA EM QUE CADA VERSÃO PÔDE SER VISTA. Mesma regra da 161, verbatim.
    --
    -- Uma versão do snapshot não é um instante: ela vale de `dbt_valid_from` até
    -- `dbt_valid_to`. Perguntar se ela estava visível NO NASCIMENTO é a pergunta
    -- errada — a versão do Brentford +0,5 nasceu em 15/09 com o handicap ainda
    -- fora da vitrine, e ficou viva até 16/09 06h04, visível E acima do limiar
    -- desde a volta do mercado, que é quando o assinante a viu.
    --
    -- `fim` é o fim da vida da versão, encurtado pela vigência do limiar quando
    -- a vantagem NÃO passa nele: antes da vigência não havia limiar para
    -- esconder coisa nenhuma.
    --
    -- ⚠️ RESTRITO ÀS CHAVES DO PERÍODO. Sem o `in`, este CTE varre o snapshot
    -- inteiro uma segunda vez.
    select h.opportunity_key, h.edge, h.best_odd, h.dbt_valid_from, h.dbt_scd_id,
           (mo.oculto_desde at time zone 'UTC') as escondido_de,
           (mo.oculto_ate   at time zone 'UTC') as escondido_ate,
           least(
             coalesce(h.dbt_valid_to, 'infinity'::timestamp),
             case when lv.market is null or h.edge > lv.limiar::double precision
                  then 'infinity'::timestamp
                  else (lv.vigente_desde at time zone 'UTC') end
           ) as fim
    from futebol.fact_value_opportunities_hist h
    left join public.futebol_mercados_ocultos mo on mo.market = h.market
    left join public.futebol_limiar_valor lv on lv.market = h.market
    where h.opportunity_key in (select s.opportunity_key from selecionadas s)
  ),
  estreia as (
    -- A ESTREIA: a primeira versão visível. Pode não existir, e aí o `left join`
    -- lá embaixo devolve nulo e o preço cai para o da primeira de todas.
    select distinct on (j.opportunity_key)
      j.opportunity_key, j.edge, j.best_odd
    from janelas j
    -- A janela não pode ser vazia...
    where j.dbt_valid_from < j.fim
      -- ...e precisa cruzar algum trecho em que o mercado estava na vitrine: ou
      -- ela começa antes de o mercado sair, ou ela ainda estava viva quando ele
      -- voltou. Sem linha na vitrine, o mercado nunca saiu.
      and (j.escondido_de is null
           or j.dbt_valid_from < j.escondido_de
           or (j.escondido_ate is not null and j.fim > j.escondido_ate))
    order by j.opportunity_key, j.dbt_valid_from asc, j.dbt_scd_id asc
  )
  select
    s.opportunity_key,
    s.fixture_id,
    s.competition,
    s.home_team_name,
    s.away_team_name,
    s.kickoff_utc,
    s.status_short,
    s.goals_home::int,
    s.goals_away::int,
    s.dbt_valid_from,
    s.market,
    s.outcome,
    s.line_value,
    -- O PREÇO DA ESTREIA, caindo para o da primeira de todas quando a linha
    -- nunca esteve visível. É este `coalesce` que faz o placar concordar com o
    -- board sem que nenhuma linha suma do painel.
    coalesce(e.best_odd, s.best_odd),
    coalesce(e.edge, s.edge),
    s.score::int,
    s.faixa,
    s.score_versao,
    s.pts_premissas::int,
    s.penalidades::int,
    s.premissas_sem_dado::int,
    s.modelo_api_concorda,
    s.linha_sharp_confirma,
    s.pen_odd_outlier,
    s.pen_poucas_casas,
    s.pen_odd_longshot,
    s.pen_odd_juice,
    -- Left join, e não join: linha sem premissa casada chega com nulo em vez de
    -- desaparecer da conta. O casamento é 100% hoje, e o dia em que deixar de
    -- ser eu quero ver o buraco no denominador, não a linha sumindo.
    pa.acesas
  from selecionadas s
  left join estreia e on e.opportunity_key = s.opportunity_key
  left join futebol.vw_premissas_acesas pa
    on pa.fixture_id = s.fixture_id
   and pa.market = s.market
   and pa.outcome = s.outcome
   and pa.line_value is not distinct from s.line_value
  order by s.kickoff_utc desc, s.score desc;
end;
$function$;

comment on function public.get_futebol_oportunidades_publicadas(date, date) is
  'Foto de nascimento das oportunidades publicadas no periodo, com o placar do jogo e as premissas acesas. O PRECO vem da primeira versao VISIVEL (migration 162), caindo para a primeira de todas quando nunca houve versao visivel; a nota e a data vem da primeira contexto_v1 (migration 148). Insumo do placar da metodologia. Restrita a socio: devolve o board inteiro, inclusive mercado oculto.';
