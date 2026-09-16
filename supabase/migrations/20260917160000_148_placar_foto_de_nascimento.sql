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
-- no dia.
--
-- ⚠️ MAS O FILTRO NÃO ERA BOBAGEM, e por isso ele não some: ele existe para NÃO
-- SOMAR DUAS ESCALAS DE NOTA. A nota mudou de escala entre `legacy` e
-- `contexto_v1`, e misturar as duas inventa uma série que nunca existiu.
--
-- A correção separa as duas perguntas em dois CTEs, e SÓ O PREÇO muda de lado:
--
--   nascimento  sem filtro   -> identidade e PREÇO (`best_odd`, `edge`).
--                               Preço não mudou de escala.
--   nota        com filtro   -> `score`, `faixa`, `score_versao`, pontos,
--                               penalidades, sinalizadores E A DATA.
--
-- ⚠️ A DATA FICA NA NOTA, DE PROPÓSITO, e isso é o oposto do que a primeira
-- versão desta migration fazia. `detectada_em` alimenta três decisões do front
-- que NÃO são sobre preço:
--
--   · `naEscalaAntiga` (placar-agregacao.ts) tira da tabela POR FAIXA as linhas
--     anteriores à virada do denominador. A nota exibida aqui é, por construção,
--     a da primeira versão `contexto_v1` — ela É comparável. Datá-la pelo
--     nascimento faria a tela esconder uma nota que está na escala certa;
--   · o eixo "por detecção" do período (placar-periodo.ts);
--   · o recorte da vitrine e a vigência do corte de valor (placar-vitrine.ts).
--
-- Mover a data mexia nos três de uma vez, e mudava QUEM entra no placar pelo
-- segundo braço do filtro de período. A issue pede que a VANTAGEM concorde com o
-- histórico; é só ela que muda de lado.
--
-- ⚠️ A LINHA FICA DE DUAS FONTES, e isso é a decisão, não um descuido: o `edge`
-- vem de um registro do snapshot e a nota de outro. É o que a issue pede — preço
-- e nota respondem perguntas diferentes, e só a nota tem problema de escala.
-- Quem consultar esta RPC esperando uma linha de um registro só vai se enganar.
--
-- ⚠️ O SCRIPT DE TERMINAL MUDA JUNTO. `scripts/futebol-roi.mjs` é a referência
-- do ROI e o ADR 0003 diz que o placar segue o script. Mudar só um lado faria
-- voltar a existir dois números de nascimento, agora entre a tela e o terminal.
--
-- ⚠️ DESEMPATE EXPLÍCITO no `distinct on`, que a 133 e a 134 não tinham: sem ele
-- a escolha entre duas versões do mesmo instante fica ao acaso do plano. É a
-- mesma correção que a revisão da 146 pediu lá.
--
-- ⚠️ SEM revoke e grant, ao contrário da 133, 134, 145 e 147. `create or
-- replace` PRESERVA a ACL, e a lista de colunas de retorno não muda — então não
-- há DROP, e não há permissão para repor. Repetir os grants aqui seria inofensivo
-- e mentiria sobre haver algo a restaurar.
--
-- Conferência depois de aplicar, comparando as duas telas na MESMA linha:
--
--   with cutover as (
--     select h.opportunity_key
--       from futebol.fact_value_opportunities_hist h
--      group by h.opportunity_key
--     having bool_or(h.score_versao = 'legacy')
--        and bool_or(h.score_versao = 'contexto_v1')
--   )
--   select o.opportunity_key, o.edge as placar, v.edge_publicacao as historico,
--          o.edge = v.edge_publicacao as concordam
--     from public.get_futebol_oportunidades_publicadas(date '2026-08-25', date '2026-09-20') o
--     join cutover c on c.opportunity_key = o.opportunity_key
--     join public.get_futebol_value_history(date '2026-08-25', date '2026-09-20') v
--       on v.fixture_id = o.fixture_id and v.market = o.market
--      and v.outcome = o.outcome and v.line_value is not distinct from o.line_value;
--   -- espera `concordam` verdadeiro em todas, e `score_versao` contexto_v1

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
    -- SEM filtro de versão: identidade e PREÇO. "Apareceu na tela" não tem
    -- versão de metodologia, e preço não mudou de escala (migration 148).
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
    t.dbt_valid_from,
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
  -- antes desta migration. A amostra não muda; muda de onde vem o preço dela.
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
     or (t.dbt_valid_from at time zone 'UTC' at time zone 'America/Sao_Paulo')::date
          between p_de and p_ate
  order by f.kickoff_utc desc, t.score desc;
end;
$function$;

comment on function public.get_futebol_oportunidades_publicadas(date, date) is
  'Foto de nascimento das oportunidades publicadas no periodo, com o placar do jogo e as premissas acesas. O PRECO vem da primeira versao de todas; a nota e a data vem da primeira contexto_v1 (migration 148). Insumo do placar da metodologia. Restrita a socio: devolve o board inteiro, inclusive mercado oculto.';
