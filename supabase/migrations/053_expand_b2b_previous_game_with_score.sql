-- Migration: expand get_b2b_previous_game_box_score com info do jogo de ontem
-- Adiciona: previous_team_score, previous_opponent_score (placar de ontem),
-- previous_home_away (Casa/Fora) e previous_game_datetime_brasilia.
-- Necessário pro Alerta de B2B renderizar score, hora e leitura de viagem
-- na tela /game/:gameId após o rebrand.

DROP FUNCTION IF EXISTS public.get_b2b_previous_game_box_score(bigint, bigint);

CREATE OR REPLACE FUNCTION public.get_b2b_previous_game_box_score(p_game_id bigint, p_team_id bigint)
RETURNS TABLE(
  player_id bigint,
  player_name text,
  player_position text,
  rating_stars bigint,
  minutes double precision,
  points double precision,
  rebounds double precision,
  assists double precision,
  plus_minus double precision,
  previous_game_id bigint,
  previous_game_date date,
  previous_opponent text,
  previous_team_score double precision,
  previous_opponent_score double precision,
  previous_home_away text,
  previous_game_datetime_brasilia text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_prev_game_id bigint;
  v_prev_game_date date;
  v_prev_opponent text;
  v_prev_team_score double precision;
  v_prev_opp_score double precision;
  v_prev_home_away text;
  v_prev_game_dt text;
  v_current_game_date date;
  v_team_was_home boolean;
BEGIN
  SELECT g.game_date INTO v_current_game_date
  FROM nba_mart.ft_games g
  WHERE g.game_id = p_game_id
  LIMIT 1;

  IF v_current_game_date IS NULL THEN RETURN; END IF;

  SELECT
    g.game_id,
    g.game_date,
    CASE WHEN g.home_team_id = p_team_id THEN g.visitor_team_abbreviation ELSE g.home_team_abbreviation END,
    CASE WHEN g.home_team_id = p_team_id THEN g.home_team_score::float8 ELSE g.visitor_team_score::float8 END,
    CASE WHEN g.home_team_id = p_team_id THEN g.visitor_team_score::float8 ELSE g.home_team_score::float8 END,
    g.home_team_id = p_team_id,
    g.game_datetime_brasilia::text
  INTO
    v_prev_game_id, v_prev_game_date, v_prev_opponent,
    v_prev_team_score, v_prev_opp_score, v_team_was_home, v_prev_game_dt
  FROM nba_mart.ft_games g
  WHERE (g.home_team_id = p_team_id OR g.visitor_team_id = p_team_id)
    AND g.game_date < v_current_game_date
    AND g.winner_team_id IS NOT NULL
  ORDER BY g.game_date DESC
  LIMIT 1;

  IF v_prev_game_id IS NULL THEN RETURN; END IF;

  v_prev_home_away := CASE WHEN v_team_was_home THEN 'Casa' ELSE 'Fora' END;

  RETURN QUERY
  SELECT
    bs.player_id, bs.player_name,
    COALESCE(dp."position", '') AS player_position,
    COALESCE(pr.max_stars, 0) AS rating_stars,
    bs.minutes::float8, bs.points::float8, bs.rebounds::float8, bs.assists::float8,
    bs.plus_minus::float8 AS plus_minus,
    v_prev_game_id, v_prev_game_date, v_prev_opponent,
    v_prev_team_score, v_prev_opp_score, v_prev_home_away, v_prev_game_dt
  FROM public.get_game_box_score(v_prev_game_id) bs
  LEFT JOIN nba_mart.dim_players dp ON bs.player_id = dp.player_id
  LEFT JOIN (
    SELECT sp.player_id, MAX(sp.rating_stars) AS max_stars
    FROM nba_mart.dim_stat_player sp
    GROUP BY sp.player_id
  ) pr ON bs.player_id = pr.player_id
  WHERE bs.home_away = v_prev_home_away
  ORDER BY bs.minutes DESC NULLS LAST;
END; $function$;
