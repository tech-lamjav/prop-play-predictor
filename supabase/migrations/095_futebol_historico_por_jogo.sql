-- ============================================================
-- 095_futebol_historico_por_jogo — os jogos que produzem a média
-- ============================================================
-- Contexto: a 094 entregou a MÉDIA que embasa cada premissa ("somados, sofrem 3,0
-- gols por jogo"). Na revisão de UI o usuário pediu o passo seguinte: mostrar os
-- jogos que produziram essa média, para a conclusão ("as defesas dos dois lados são
-- frágeis") poder ser conferida em vez de aceita.
--
-- Esta RPC devolve, por lado do confronto, UMA LINHA POR JOGO já encerrado do time
-- na MESMA competição e temporada do jogo em questão, antes dele. O recorte é o
-- mesmo de fact_team_season_stats, que é a fonte da média: se fosse outro, o
-- gráfico desmentiria o número que ele deveria explicar.
--
-- Traz também o expected_goals do jogo, de fact_fixture_stats. É o que destrava as
-- premissas de chance de gol (xg_combinado_alto, xg_baixo_combinado,
-- superioridade_xg), que até aqui apareciam na tela sem número nenhum. Cobertura
-- medida no dev em 04/08/2026: 1.518 de 1.668 linhas de 2026 encerradas (91%). Onde
-- falta, vem NULL e a tela não desenha, em vez de inventar.
--
-- NÃO resolve: ritmo_alto, historico_over/under, linha_subindo/descendo e
-- sem_rodizio. Os flags vêm dos modelos dbt do Matheus (int_futebol_premissas_*
-- guarda só o boolean) e o critério não está neste repo. Os insumos de ritmo
-- existem em fact_fixture_stats (total_shots, corner_kicks, ball_possession), mas
-- publicar um número nosso como se fosse o da premissa seria fingir auditoria.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_futebol_fixture_historico(bigint, integer);

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_historico(
  p_fixture_id bigint,
  p_max integer DEFAULT 40
)
RETURNS TABLE(
  side            text,
  team_id         bigint,
  team_name       text,
  past_fixture_id bigint,
  data            date,
  ordem           bigint,
  em_casa         boolean,
  adversario      text,
  adversario_id   bigint,
  gols_pro        integer,
  gols_contra     integer,
  total_gols      integer,
  ambos_marcaram  boolean,
  sem_sofrer      boolean,
  sem_marcar      boolean,
  xg              double precision,
  xg_contra       double precision,
  resultado       text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  with alvo as (
    select f.fixture_id, f.competition, f.season, f.kickoff_utc,
           f.home_team_id, f.home_team_name, f.away_team_id, f.away_team_name
    from futebol.fact_fixtures f
    where f.fixture_id = p_fixture_id
  ),
  lados as (
    select 'home'::text as side, a.home_team_id as team_id, a.home_team_name as team_name, a.* from alvo a
    union all
    select 'away'::text, a.away_team_id, a.away_team_name, a.* from alvo a
  ),
  jogos as (
    select l.side, l.team_id, l.team_name,
           f.fixture_id as past_fixture_id,
           -- Dia em BRT, igual ao resto do produto: date_utc joga o jogo noturno
           -- para o dia seguinte.
           (f.kickoff_utc at time zone 'UTC' at time zone 'America/Sao_Paulo')::date as data,
           (f.home_team_id = l.team_id) as em_casa,
           case when f.home_team_id = l.team_id then f.away_team_name else f.home_team_name end as adversario,
           -- O id do adversário existe para a tela poder desenhar o escudo dele
           -- embaixo da barra: o gráfico vira "contra quem foi", não só "quanto foi".
           case when f.home_team_id = l.team_id then f.away_team_id else f.home_team_id end as adversario_id,
           (case when f.home_team_id = l.team_id then f.goals_home else f.goals_away end)::integer as gols_pro,
           (case when f.home_team_id = l.team_id then f.goals_away else f.goals_home end)::integer as gols_contra
    from lados l
    join futebol.fact_fixtures f
      on f.competition = l.competition
     and f.season = l.season
     and f.status_short in ('FT', 'AET', 'PEN')
     and f.kickoff_utc < l.kickoff_utc
     and (f.home_team_id = l.team_id or f.away_team_id = l.team_id)
     and f.goals_home is not null
     and f.goals_away is not null
  ),
  recentes as (
    select j.*, row_number() over (partition by j.side order by j.data desc, j.past_fixture_id desc) as rn
    from jogos j
  ),
  janela as (
    select r.*, row_number() over (partition by r.side order by r.data asc, r.past_fixture_id asc) as ordem
    from recentes r
    where r.rn <= greatest(p_max, 1)
  )
  select w.side,
         w.team_id,
         w.team_name,
         w.past_fixture_id,
         w.data,
         w.ordem,
         w.em_casa,
         w.adversario,
         w.adversario_id,
         w.gols_pro,
         w.gols_contra,
         (w.gols_pro + w.gols_contra)::integer as total_gols,
         (w.gols_pro > 0 and w.gols_contra > 0) as ambos_marcaram,
         (w.gols_contra = 0) as sem_sofrer,
         (w.gols_pro = 0) as sem_marcar,
         s.expected_goals as xg,
         sa.expected_goals as xg_contra,
         case when w.gols_pro > w.gols_contra then 'V'
              when w.gols_pro = w.gols_contra then 'E'
              else 'D' end as resultado
  from janela w
  left join futebol.fact_fixture_stats s
         on s.fixture_id = w.past_fixture_id and s.team_id = w.team_id
  left join futebol.fact_fixture_stats sa
         on sa.fixture_id = w.past_fixture_id and sa.team_id <> w.team_id
  order by w.side, w.ordem;
$$;

COMMENT ON FUNCTION public.get_futebol_fixture_historico(bigint, integer) IS
  'Jogo a jogo dos dois times na competição/temporada do confronto, para auditar a média que embasa cada premissa. Inclui expected_goals quando existe.';

GRANT EXECUTE ON FUNCTION public.get_futebol_fixture_historico(bigint, integer) TO anon, authenticated, service_role;
