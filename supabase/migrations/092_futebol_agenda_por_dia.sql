-- ============================================================
-- 092_futebol_agenda_por_dia — agenda multi-liga por DIA (fuso BRT)
-- ============================================================
-- Contexto: a /futebol/jogos organiza tudo em campeonato → rodada → dia, o que
-- obriga o usuário a saber em qual competição está o jogo antes de achar o jogo.
-- "Rodada 21" também atravessa três datas, então "o que tem hoje" não tem
-- resposta naquela tela. Vamos inverter o eixo para dia → ligas → jogos.
--
-- Duas coisas impedem fazer isso só no front:
--
-- 1) CUSTO. Hoje o front usa get_futebol_fixtures (uma liga + temporada inteira)
--    e, para simular multi-liga, dispara UMA query por liga (useFutebolFixturesMulti).
--    São 8 chamadas de ~1,7s e ~161 KB cada, ou seja ~850 KB de JSON para desenhar
--    UM dia. O pior dia da temporada 2026 tem 29 jogos, o que caberia em ~12 KB.
--    E o custo cresce linear por liga nova, exatamente na direção contrária do
--    roadmap (vamos somar ligas).
--
-- 2) FUSO. O front agrupa por fact_fixtures.date_utc, que é data UTC. Jogo às
--    21:30 de quarta em Brasília é 00:30 de quinta em UTC, então cai no dia
--    seguinte na tela. São 288 dos 2.128 jogos de 2026 (13,5%), justamente os
--    noturnos, que é o horário que mais interessa ao apostador brasileiro.
--    A regra do dia passa a viver AQUI, em um lugar só, em vez de ser reimplementada
--    em cada tela (a /futebol já fazia certo, a /jogos não).
--
-- Também exponho `competition` e `season` nas linhas, que o get_futebol_fixtures
-- não devolve. Numa lista de uma liga só isso não fazia falta (o front sabia qual
-- era); numa lista multi-liga faz, porque o link do time é /futebol/time/:id?c=&s=.
-- ============================================================

-- ------------------------------------------------------------
-- Helper: o dia do jogo no fuso de Brasília.
-- IMMUTABLE de propósito: as três conversões abaixo são imutáveis
-- (timestamp → timestamptz → timestamp → date), nenhuma depende do TimeZone da
-- sessão. Isso mantém a porta aberta para índice de expressão se a tabela
-- crescer. Hoje ela tem ~6,6 mil linhas e 2,6 MB, então seq scan por dia é
-- barato e não vale criar índice que o pipeline do Mateus pode derrubar num
-- refresh.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.futebol_dia_brt(p_kickoff_utc timestamp without time zone)
RETURNS date
LANGUAGE sql IMMUTABLE
AS $function$
  select (p_kickoff_utc at time zone 'UTC' at time zone 'America/Sao_Paulo')::date;
$function$;

COMMENT ON FUNCTION public.futebol_dia_brt(timestamp without time zone) IS
  'Dia do jogo no fuso America/Sao_Paulo a partir do kickoff em UTC. Fonte única da regra de virada de dia da agenda de futebol: NÃO usar fact_fixtures.date_utc para agrupar por dia, ele é data UTC e joga jogo noturno brasileiro para o dia seguinte (288 de 2.128 jogos em 2026).';

-- ------------------------------------------------------------
-- 1) Jogos de UM dia, em todas as ligas (ou nas ligas pedidas).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_futebol_fixtures_by_day(
  p_day          date,
  p_competitions text[] DEFAULT NULL
)
RETURNS TABLE(
  fixture_id      bigint,
  competition     text,
  season          bigint,
  day_brt         date,
  round           text,
  kickoff_utc     timestamp without time zone,
  date_utc        date,
  status_short    text,
  status_long     text,
  home_team_id    bigint,
  home_team_name  text,
  home_team_logo  text,
  away_team_id    bigint,
  away_team_name  text,
  away_team_logo  text,
  goals_home      bigint,
  goals_away      bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select f.fixture_id, f.competition, f.season,
         public.futebol_dia_brt(f.kickoff_utc),
         f.round, f.kickoff_utc, f.date_utc,
         f.status_short, f.status_long,
         f.home_team_id, f.home_team_name, ht.team_logo_url,
         f.away_team_id, f.away_team_name, at2.team_logo_url,
         f.goals_home, f.goals_away
  from futebol.fact_fixtures f
  left join futebol.dim_teams ht  on ht.team_id  = f.home_team_id
  left join futebol.dim_teams at2 on at2.team_id = f.away_team_id
  where f.kickoff_utc is not null
    and public.futebol_dia_brt(f.kickoff_utc) = p_day
    and (p_competitions is null or f.competition = any(p_competitions))
  -- horário primeiro: numa agenda multi-liga o usuário lê a grade por hora, e o
  -- agrupamento por competição é feito no front sobre esta ordem.
  order by f.kickoff_utc, f.competition, f.fixture_id;
$function$;

COMMENT ON FUNCTION public.get_futebol_fixtures_by_day(date, text[]) IS
  'Jogos de um dia (fuso BRT) em todas as competições, ou só nas de p_competitions. Base da agenda da /futebol/jogos. Substitui o padrão de N chamadas de get_futebol_fixtures (uma por liga, temporada inteira) que custava ~850 KB para desenhar um dia.';

GRANT EXECUTE ON FUNCTION public.get_futebol_fixtures_by_day(date, text[]) TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 2) Quais dias têm jogo, para a régua de datas.
-- Serve para a navegação saber onde tem jogo e quantos, sem baixar jogo nenhum.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_futebol_fixture_days(
  p_from date,
  p_to   date
)
RETURNS TABLE(
  day_brt date,
  jogos   bigint,
  ligas   bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select public.futebol_dia_brt(f.kickoff_utc) as day_brt,
         count(*)                              as jogos,
         count(distinct f.competition)         as ligas
  from futebol.fact_fixtures f
  where f.kickoff_utc is not null
    and public.futebol_dia_brt(f.kickoff_utc) between p_from and p_to
  group by 1
  order by 1;
$function$;

COMMENT ON FUNCTION public.get_futebol_fixture_days(date, date) IS
  'Dias com jogo (fuso BRT) num intervalo, com contagem de jogos e de ligas. Alimenta a régua de datas da agenda sem trazer as linhas dos jogos.';

GRANT EXECUTE ON FUNCTION public.get_futebol_fixture_days(date, date) TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 3) Que competições e temporadas existem de fato no mart.
-- Hoje o front decide isso por lista fixa em src/utils/futebol-competitions.ts
-- (ALL_COMPETITIONS) e por um mapa fixo de temporadas por liga (SEASONS_BY_COMP).
-- Consequência real: a champions_league existe no mart com 76 jogos em 2026 e não
-- aparece em NENHUMA tela, apesar de o comentário daquele arquivo prometer que
-- liga nova aparece sozinha. Com esta RPC a lista fixa volta a ser só o que ela
-- diz ser: rótulo bonito e ordem de exibição.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_futebol_competitions()
RETURNS TABLE(
  competition text,
  season      bigint,
  jogos       bigint,
  primeiro    date,
  ultimo      date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  select f.competition,
         f.season,
         count(*)                                        as jogos,
         min(public.futebol_dia_brt(f.kickoff_utc))       as primeiro,
         max(public.futebol_dia_brt(f.kickoff_utc))       as ultimo
  from futebol.fact_fixtures f
  where f.kickoff_utc is not null
  group by f.competition, f.season
  order by f.season desc, f.competition;
$function$;

COMMENT ON FUNCTION public.get_futebol_competitions() IS
  'Competições e temporadas realmente presentes no mart, com contagem e janela de datas (BRT). Fonte de verdade do seletor de campeonatos e das temporadas disponíveis por liga, no lugar das listas fixas do front.';

GRANT EXECUTE ON FUNCTION public.get_futebol_competitions() TO anon, authenticated, service_role;
