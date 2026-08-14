-- ============================================================
-- 096_futebol_standings_grupo — a classificação sabendo dizer o grupo
-- ============================================================
-- Contexto: a tela de campeonato passou a abrir por fase. Em copa com fase de
-- grupos (Libertadores e Sul-Americana têm 8 grupos, Copa do Mundo tem 12), a
-- pergunta da fase de grupos é "como está o meu grupo", e a RPC devolvia a
-- classificação sem dizer a que grupo cada linha pertence: os 32 times da
-- Libertadores vinham numa lista só, com rank de 1 a 4 repetindo oito vezes.
--
-- A coluna JÁ EXISTE no mart (futebol.fact_standings_snapshot.group_name); era só
-- a assinatura da função que não a expunha. Valores conferidos no dev (2026):
-- 'Group A'..'Group H' na Libertadores e na Sul-Americana, 'Group A'..'Group L' na
-- Copa do Mundo, e o nome da liga ('Serie A', 'Premier League') em pontos
-- corridos, que é como a API marca quem não tem grupo.
--
-- DROP + CREATE porque o CREATE OR REPLACE não muda o tipo de retorno. Para quem
-- consome via PostgREST isso é compatível: coluna nova no fim, o front antigo
-- ignora. Mesmo corpo de antes, só com a coluna a mais.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_futebol_standings_official(text, bigint);

CREATE FUNCTION public.get_futebol_standings_official(p_competition text, p_season bigint)
RETURNS TABLE(
  team_id bigint,
  team_name text,
  rank bigint,
  points bigint,
  played bigint,
  wins bigint,
  draws bigint,
  loses bigint,
  goals_for bigint,
  goals_against bigint,
  goals_diff bigint,
  rank_description text,
  group_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare v_date date;
begin
  select max(s.snapshot_date) into v_date
  from futebol.fact_standings_snapshot s
  where s.competition = p_competition and s.season = p_season;

  return query
  select s.team_id, s.team_name, s.rank, s.points,
         s.played_total, s.wins_total, s.draws_total, s.loses_total,
         s.goals_for_total, s.goals_against_total, s.goals_diff, s.rank_description,
         s.group_name
  from futebol.fact_standings_snapshot s
  where s.competition = p_competition and s.season = p_season and s.snapshot_date = v_date
  order by s.group_name, s.rank;
end; $function$;

COMMENT ON FUNCTION public.get_futebol_standings_official(text, bigint) IS
  'Classificação oficial do último snapshot, agora com group_name para as competições de fase de grupos.';

GRANT EXECUTE ON FUNCTION public.get_futebol_standings_official(text, bigint) TO anon, authenticated, service_role;
