-- ============================================================
-- 156_futebol_h2h_ancorado_no_apito — o confronto direto para de olhar o futuro
-- ============================================================
-- Contexto (#464): a evidência da premissa `h2h_favoravel` sai desta RPC, e a CTE
-- de confronto direto juntava `futebol.fact_h2h` SEM NENHUM filtro de data. Num
-- jogo já encerrado isso conta partidas que aconteceram DEPOIS dele.
--
-- Caso real conferido: Fluminense x Vasco, 11/08/2024. No dia existia 1 confronto
-- anterior. A tela mostra 10 — os outros nove vieram depois do apito.
--
-- Tamanho medido: reconstruindo o número da tela e comparando o veredito
-- resultante contra o booleano do mart, 15,9% de veredito trocado em 13.840
-- linhas. As premissas que têm gráfico de últimos jogos, que já são
-- point-in-time, ficam entre 0,1% e 1,6%.
--
-- O corte é `hh.kickoff_utc < j.kickoff_utc`, o MESMO padrão que a 117 já usa em
-- produção para a janela da premissa. Estritamente anterior, não "menor ou
-- igual": um confronto do mesmo instante é o próprio jogo.
--
-- Diferente da classificação (que virá em seguida e depende de haver foto da
-- época), esta âncora NÃO tem piso de data: `fact_h2h` guarda o apito de cada
-- confronto, então ela vale para o histórico inteiro já nesta entrega.
--
-- Efeito colateral desejado: onde não existe confronto anterior, `h2h_jogos` vem
-- zero, o construtor da evidência devolve nulo e a tela OMITE frase e barra em
-- vez de mostrar número de hoje. Nenhum ramo novo no front — o construtor já
-- exigia contagem maior que zero.
--
-- Único delta em relação ao corpo anterior: `kickoff_utc` entra na CTE `jogo`, e
-- a CTE `h2h` ganha o corte. O resto é idêntico.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_numeros(p_fixture_id bigint)
 RETURNS TABLE(side text, team_id bigint, team_name text, posicao bigint, pontos bigint, zona text, jogos bigint, jogos_casa bigint, jogos_fora bigint, v_casa bigint, e_casa bigint, d_casa bigint, v_fora bigint, e_fora bigint, d_fora bigint, gf_casa double precision, ga_casa double precision, gf_fora double precision, ga_fora double precision, gf_total double precision, ga_total double precision, clean_sheets bigint, sem_marcar bigint, forma text, h2h_jogos bigint, h2h_vitorias bigint, h2h_empates bigint, ate date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with jogo as (
    select f.fixture_id, f.competition, f.season, f.home_team_id, f.away_team_id, f.kickoff_utc
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
    select distinct on (s.team_id) s.team_id, s.rank_pos, s.pontos, s.zona
    from (
      select st.team_id,
             st."rank"::bigint          as rank_pos,
             st.points::bigint          as pontos,
             st.rank_description        as zona
      from jogo j,
           public.get_futebol_standings_official(j.competition, j.season) st
    ) s
    order by s.team_id
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
  'Números de temporada dos dois times de um jogo (campanha casa/fora separada, gols por jogo, clean sheets, forma) mais posição e pontos. Serve para EMBASAR cada premissa do mapa: sem o número, "em boa fase" é adjetivo. Devolve `ate` = snapshot_date para a tela declarar a data do dado em vez de fingir que é de hoje. O confronto direto é ancorado no apito (#464): só conta partida anterior a esta. Não cobre as premissas de xG: falta agregado de temporada.';

GRANT EXECUTE ON FUNCTION public.get_futebol_fixture_numeros(bigint) TO anon, authenticated, service_role;
