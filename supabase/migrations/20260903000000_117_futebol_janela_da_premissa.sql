-- ============================================================
-- 117_futebol_janela_da_premissa — o histórico mede o que o modelo mede
-- ============================================================
-- A 095 devolvia os jogos do time na MESMA competição e temporada do confronto, e
-- o comentário dela dizia por quê: "o recorte é o mesmo de fact_team_season_stats,
-- que é a fonte da média: se fosse outro, o gráfico desmentiria o número que ele
-- deveria explicar."
--
-- O raciocínio estava certo e a âncora estava errada. O gráfico foi alinhado ao
-- PERFIL DE TEMPORADA, que nunca foi o insumo de premissa nenhuma. O modelo mede
-- outra coisa: os últimos jogos do time em QUALQUER competição, point-in-time por
-- partida (int_futebol_premissas_ou, vars default `todas` + `ultimos_10`).
--
-- Resultado: nenhum número da tela era o número que acendeu a premissa. Daí saem
-- os defeitos da spec #349 — "defesas firmes" mostrando 2,3 no subtítulo e 2,4 no
-- card, e o gráfico anunciando "Flamengo em casa, 11 jogos" embaixo de um critério
-- que não olha mando nenhum.
--
-- Esta migration troca a âncora: o histórico passa a medir a JANELA DA PREMISSA.
-- O gráfico volta a explicar o número — só que agora o número certo.
--
-- ⚠️ NÃO reintroduzir o filtro de competição e temporada. Ele parece uma correção
-- óbvia para quem vê jogos de campeonatos diferentes no mesmo gráfico, e é
-- exatamente o que o modelo faz. Se um dia o modelo passar a recortar por
-- competição, este é o lugar de acompanhar — não o contrário.
--
-- O corte point-in-time continua: só partidas encerradas antes do apito da
-- partida analisada. Sem ele o gráfico veria o futuro.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_futebol_fixture_historico(bigint, integer);

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_historico(
  p_fixture_id bigint,
  -- Quantos jogos por lado a consulta BUSCA. Não confundir com a janela da
  -- premissa: quem recorta a janela é o critério, no front, porque ela varia por
  -- premissa (as médias olham 10, as contagens olham menos).
  p_max integer DEFAULT 40
)
RETURNS TABLE(
  side            text,
  team_id         bigint,
  team_name       text,
  past_fixture_id bigint,
  data            date,
  ordem           bigint,
  -- O jogo passado é da MESMA competição do confronto analisado?
  --
  -- A consulta devolve jogos de qualquer competição, e o front recorta de novo
  -- nas premissas cujo critério ainda mede uma competição só. Vem como booleano,
  -- e não como o nome da competição, porque quem compara é aqui: a consulta já
  -- conhece o confronto, e a tela teria de carregar esse dado por três
  -- componentes só para refazer a mesma comparação (#352).
  mesma_competicao boolean,
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
           (f.competition = l.competition and f.season = l.season) as mesma_competicao,
           (f.home_team_id = l.team_id) as em_casa,
           case when f.home_team_id = l.team_id then f.away_team_name else f.home_team_name end as adversario,
           -- O id do adversário existe para a tela poder desenhar o escudo dele
           -- embaixo da barra: o gráfico vira "contra quem foi", não só "quanto foi".
           case when f.home_team_id = l.team_id then f.away_team_id else f.home_team_id end as adversario_id,
           (case when f.home_team_id = l.team_id then f.goals_home else f.goals_away end)::integer as gols_pro,
           (case when f.home_team_id = l.team_id then f.goals_away else f.goals_home end)::integer as gols_contra
    from lados l
    join futebol.fact_fixtures f
     on f.status_short in ('FT', 'AET', 'PEN')
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
         w.mesma_competicao,
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
  'Jogo a jogo dos dois times na JANELA DA PREMISSA — últimos jogos em qualquer competição, antes do apito —, para auditar o insumo que acende cada premissa. Inclui expected_goals quando existe. Não filtra por competição nem temporada de propósito: ver 117.';

grant execute on function public.get_futebol_fixture_historico(bigint, integer) to anon, authenticated, service_role;
