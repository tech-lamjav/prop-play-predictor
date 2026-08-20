-- ============================================================
-- 094_futebol_numeros_do_jogo — o número que embasa cada premissa
-- ============================================================
-- Contexto: a 093 entregou QUAIS premissas acenderam. Na revisão de UI ficou claro
-- que isso não basta: "em boa fase, vem ganhando" sem número é adjetivo, não
-- análise. E premissa apagada sem número é pior ainda, porque não dá pra saber se
-- faltou pouco ou se não passou nem perto.
--
-- Esta RPC devolve, por lado do confronto, os números que sustentam (ou derrubam)
-- cada premissa:
--   forma                → a sequência de resultados
--   mando                → campanha em casa e fora, separada
--   forca_mismatch       → ataque de um contra defesa do outro, no mando certo
--   ataque_combinado     → gols marcados por jogo dos dois
--   defesas_*            → gols sofridos por jogo dos dois
--   clean_sheets_altos   → jogos sem sofrer gol
--   superioridade_tabela → posição e pontos
--
-- Fonte: futebol.fact_team_season_stats (médias já separadas por casa e fora, que é
-- o corte que importa: Palmeiras marca 1,70 em casa e o Vasco sofre 1,90 fora) mais
-- a classificação oficial.
--
-- `ate` devolve o snapshot_date de propósito: a tela precisa poder dizer "dados até
-- 27/07" em vez de fingir que o número é de hoje. O mesmo snapshot é o que a
-- premissa viu quando foi avaliada.
--
-- NÃO tem xG aqui: as premissas de xG (superioridade_xg, xg_combinado_alto,
-- xg_baixo_combinado) só têm valor por jogo em fact_fixture_stats, sem agregado de
-- temporada. Essas quatro continuam sem embasamento numérico até existir o agregado.
-- ============================================================

-- v2 (01/08, aplicada na mao no dev e nunca trazida de volta pro arquivo ate
-- 19/08, quando o primeiro `db push` real quebrou aqui): o select pulava as tres
-- colunas de h2h que a declaracao promete, e a coluna 25 devolvia `date` onde o
-- contrato diz `bigint`. Corpo abaixo = versao viva (shape file, mesma revisao).
CREATE OR REPLACE FUNCTION public.get_futebol_fixture_numeros(p_fixture_id bigint)
 RETURNS TABLE(side text, team_id bigint, team_name text, posicao bigint, pontos bigint, zona text, jogos bigint, jogos_casa bigint, jogos_fora bigint, v_casa bigint, e_casa bigint, d_casa bigint, v_fora bigint, e_fora bigint, d_fora bigint, gf_casa double precision, ga_casa double precision, gf_fora double precision, ga_fora double precision, gf_total double precision, ga_total double precision, clean_sheets bigint, sem_marcar bigint, forma text, h2h_jogos bigint, h2h_vitorias bigint, h2h_empates bigint, ate date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with jogo as (
    select f.fixture_id, f.competition, f.season, f.home_team_id, f.away_team_id
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
  'Números de temporada dos dois times de um jogo (campanha casa/fora separada, gols por jogo, clean sheets, forma) mais posição e pontos. Serve para EMBASAR cada premissa do mapa: sem o número, "em boa fase" é adjetivo. Devolve `ate` = snapshot_date para a tela declarar a data do dado em vez de fingir que é de hoje. Não cobre as premissas de xG: falta agregado de temporada.';

GRANT EXECUTE ON FUNCTION public.get_futebol_fixture_numeros(bigint) TO anon, authenticated, service_role;
