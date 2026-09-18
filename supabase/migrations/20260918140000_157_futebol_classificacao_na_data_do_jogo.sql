-- ============================================================
-- 157_futebol_classificacao_na_data_do_jogo — a tabela para de ser a de hoje
-- ============================================================
-- Contexto (#464): a CTE `tabela` desta RPC chamava
-- `public.get_futebol_standings_official`, que por dentro pega
-- `max(snapshot_date)` da competição e temporada — a foto de HOJE, sempre,
-- qualquer que seja a data do jogo.
--
-- Caso real conferido: Palmeiras x Sport, 06/04/2025. No dia, Palmeiras era 14º
-- e Sport 15º, e o modelo decidiu — corretamente — que `superioridade_tabela`
-- não acendia. A tela mostra Palmeiras em 2º com 76 pontos contra Sport em 20º
-- com 17. A frase é verdadeira e diz o OPOSTO do que o modelo decidiu.
--
-- Tamanho medido: 14,5% de veredito trocado em 19.608 linhas na
-- `superioridade_tabela`, e 15,0% em 50.880 na `supremacia` do handicap. Por
-- competição vai de 9,1% (Serie A ITA, Primeira Liga) a 28,0% (Champions).
--
-- ── Por que ler a tabela de fotos direto, e não mexer na função oficial ──
--
-- `get_futebol_standings_official` é compartilhada com a tela de campeonato e a
-- de time, que PRECISAM continuar mostrando a tabela atual. Dar a ela um
-- parâmetro de data, ou criar uma variante ancorada, resolveria — mas as duas
-- saídas mexem no passivo de funções com definidor de segurança que a #449 já
-- registra, e a segunda acrescenta mais uma. `fact_standings_snapshot` tem
-- posição, pontos e descrição de zona, que é exatamente o que esta CTE mapeia,
-- então ler dali não perde nada e não cria função nova.
--
-- Custo assumido e declarado: a lógica de escolher foto passa a existir em dois
-- lugares — o `max(snapshot_date)` dentro da função oficial, e o corte por data
-- aqui.
--
-- ── O corte ──
--
-- `st.snapshot_date < j.date_utc`, estritamente anterior. `snapshot_date` é
-- DATE, sem hora: não há como saber se uma foto datada do dia do jogo foi
-- tirada antes ou depois do apito, e uma foto de depois traz o resultado do
-- próprio jogo de volta. O preço é ficar no máximo uma rodada atrasado, que é
-- uma mentira muito menor do que uma temporada adiantado.
--
-- ── Onde não existe foto da época ──
--
-- O histórico de `fact_standings_snapshot` só começa em 11/06/2026. Para jogo
-- anterior a isso não há foto, nenhuma linha sai daqui, `posicao` e `pontos`
-- vêm nulos, e o construtor da evidência (que já exige posição dos DOIS lados)
-- devolve nulo. A tela OMITE frase e barra em vez de mostrar a tabela de hoje.
-- Isso vale também para `supremacia` (handicap) e `lado_coberto_forte` (dupla
-- chance), que delegam ao mesmo construtor.
--
-- Efeito colateral bom: a CTE antiga puxava a classificação INTEIRA do
-- campeonato e deixava o `left join` lá embaixo escolher os dois times. A nova
-- junta os lados dentro da consulta e lê duas linhas.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_numeros(p_fixture_id bigint)
 RETURNS TABLE(side text, team_id bigint, team_name text, posicao bigint, pontos bigint, zona text, jogos bigint, jogos_casa bigint, jogos_fora bigint, v_casa bigint, e_casa bigint, d_casa bigint, v_fora bigint, e_fora bigint, d_fora bigint, gf_casa double precision, ga_casa double precision, gf_fora double precision, ga_fora double precision, gf_total double precision, ga_total double precision, clean_sheets bigint, sem_marcar bigint, forma text, h2h_jogos bigint, h2h_vitorias bigint, h2h_empates bigint, ate date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with jogo as (
    select f.fixture_id, f.competition, f.season, f.home_team_id, f.away_team_id, f.kickoff_utc, f.date_utc
    from futebol.fact_fixtures f
    where f.fixture_id = p_fixture_id
  ),
  lados as (
    select 'home'::text as side, j.home_team_id as team_id, j.competition, j.season from jogo j
    union all
    select 'away'::text, j.away_team_id, j.competition, j.season from jogo j
  ),
  stats as (
    select distinct on (t.team_id, t.competition, t.season) t.*
    from futebol.fact_team_season_stats t
    join lados l on l.team_id = t.team_id and l.competition = t.competition and l.season = t.season
    order by t.team_id, t.competition, t.season, t.snapshot_date desc
  ),
  h2h as (
    select l.team_id,
           count(*) as jogos,
           count(*) filter (
             where (hh.home_team_id = l.team_id and hh.goals_home > hh.goals_away)
                or (hh.away_team_id = l.team_id and hh.goals_away > hh.goals_home)
           ) as vitorias,
           count(*) filter (where hh.goals_home = hh.goals_away) as empates
    from jogo j
    join futebol.fact_h2h hh
      on (hh.home_team_id = j.home_team_id and hh.away_team_id = j.away_team_id)
      or (hh.home_team_id = j.away_team_id and hh.away_team_id = j.home_team_id)
    join lados l on true
    where hh.goals_home is not null and hh.goals_away is not null
      -- A âncora (#464): só confronto que já tinha acontecido quando esta partida
      -- começou. Mesmo padrão da 117. Apito nulo derruba a linha, e a tela omite.
      and hh.kickoff_utc < j.kickoff_utc
    group by l.team_id
  ),
  tabela as (
    -- A foto mais recente ANTERIOR ao jogo, por time (#464). Sem foto da época,
    -- nenhuma linha: `posicao` vem nula e a tela omite em vez de mostrar hoje.
    select distinct on (s.team_id) s.team_id, s.rank_pos, s.pontos, s.zona
    from (
      select st.team_id,
             st."rank"::bigint          as rank_pos,
             st.points::bigint          as pontos,
             st.rank_description        as zona,
             st.snapshot_date
      from jogo j
      join futebol.fact_standings_snapshot st
        on st.competition = j.competition
       and st.season = j.season
       and st.snapshot_date < j.date_utc
      join lados l on l.team_id = st.team_id
    ) s
    order by s.team_id, s.snapshot_date desc
  )
  select l.side,
         l.team_id,
         coalesce(st.team_name, dt.team_name),
         tb.rank_pos,
         tb.pontos,
         tb.zona,
         st.played_total,
         st.played_home,
         st.played_away,
         st.wins_home,
         st.draws_home,
         st.loses_home,
         st.wins_away,
         st.draws_away,
         st.loses_away,
         st.goals_for_avg_home,
         st.goals_against_avg_home,
         st.goals_for_avg_away,
         st.goals_against_avg_away,
         st.goals_for_avg_total,
         st.goals_against_avg_total,
         st.clean_sheet_total,
         st.failed_to_score_total,
         st.form,
         hh.jogos,
         hh.vitorias,
         hh.empates,
         st.snapshot_date
  from lados l
  left join stats st on st.team_id = l.team_id
  left join tabela tb on tb.team_id = l.team_id
  left join h2h hh on hh.team_id = l.team_id
  left join futebol.dim_teams dt on dt.team_id = l.team_id
  order by l.side desc;
$function$;

COMMENT ON FUNCTION public.get_futebol_fixture_numeros(bigint) IS
  'Números de temporada dos dois times de um jogo (campanha casa/fora separada, gols por jogo, clean sheets, forma) mais posição e pontos. Serve para EMBASAR cada premissa do mapa: sem o número, "em boa fase" é adjetivo. Devolve `ate` = snapshot_date para a tela declarar a data do dado em vez de fingir que é de hoje. Confronto direto e classificação são ancorados na data do jogo (#464): só conta o que já tinha acontecido. Não cobre as premissas de xG: falta agregado de temporada.';

GRANT EXECUTE ON FUNCTION public.get_futebol_fixture_numeros(bigint) TO anon, authenticated, service_role;
