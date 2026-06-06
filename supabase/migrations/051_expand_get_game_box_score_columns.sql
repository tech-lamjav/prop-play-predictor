-- Migration: expand get_game_box_score com colunas que faltavam
-- Adiciona: player_position (de dim_players), offensive_rebounds, defensive_rebounds,
-- fg_pct (de player_field_goal_percentage), ft_pct (de player_free_throw_percentage),
-- plus_minus (de player_plus_minus).
-- Necessário pra o Box Score completo na tela /game/:gameId após o rebrand.

DROP FUNCTION IF EXISTS public.get_game_box_score(bigint);

CREATE OR REPLACE FUNCTION public.get_game_box_score(p_game_id bigint)
RETURNS TABLE(
  player_id bigint,
  player_name text,
  player_position text,
  home_away text,
  minutes numeric,
  points numeric,
  rebounds numeric,
  offensive_rebounds numeric,
  defensive_rebounds numeric,
  assists numeric,
  blocks numeric,
  steals numeric,
  threes numeric,
  turnovers numeric,
  fg_pct numeric,
  ft_pct numeric,
  plus_minus numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    s.player_id,
    p.player_name,
    p.position AS player_position,
    MAX(s.home_away) AS home_away,
    MAX(CASE WHEN s.stat_type = 'player_minutes'                  THEN s.stat_value END)::numeric AS minutes,
    MAX(CASE WHEN s.stat_type = 'player_points'                   THEN s.stat_value END)::numeric AS points,
    MAX(CASE WHEN s.stat_type = 'player_rebounds'                 THEN s.stat_value END)::numeric AS rebounds,
    MAX(CASE WHEN s.stat_type = 'player_offensive_rebounds'       THEN s.stat_value END)::numeric AS offensive_rebounds,
    MAX(CASE WHEN s.stat_type = 'player_defensive_rebounds'       THEN s.stat_value END)::numeric AS defensive_rebounds,
    MAX(CASE WHEN s.stat_type = 'player_assists'                  THEN s.stat_value END)::numeric AS assists,
    MAX(CASE WHEN s.stat_type = 'player_blocks'                   THEN s.stat_value END)::numeric AS blocks,
    MAX(CASE WHEN s.stat_type = 'player_steals'                   THEN s.stat_value END)::numeric AS steals,
    MAX(CASE WHEN s.stat_type = 'player_threes'                   THEN s.stat_value END)::numeric AS threes,
    MAX(CASE WHEN s.stat_type = 'player_turnovers'                THEN s.stat_value END)::numeric AS turnovers,
    MAX(CASE WHEN s.stat_type = 'player_field_goal_percentage'    THEN s.stat_value END)::numeric AS fg_pct,
    MAX(CASE WHEN s.stat_type = 'player_free_throw_percentage'    THEN s.stat_value END)::numeric AS ft_pct,
    MAX(CASE WHEN s.stat_type = 'player_plus_minus'               THEN s.stat_value END)::numeric AS plus_minus
  FROM nba_mart.ft_game_player_stats s
  JOIN nba_mart.dim_players p ON s.player_id = p.player_id
  WHERE s.game_id = p_game_id AND s.is_played = 'Jogou'
  GROUP BY s.player_id, p.player_name, p.position
  ORDER BY MAX(s.home_away), MAX(CASE WHEN s.stat_type = 'player_minutes' THEN s.stat_value END) DESC NULLS LAST;
END; $function$;
