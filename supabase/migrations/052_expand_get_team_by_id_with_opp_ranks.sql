-- Migration: expand get_team_by_id com next_opponent_opp_*_rank
-- Adiciona ranks defensivos do adversário no próximo jogo: pts/reb/ast/3p%/garrafão/def_rating.
-- Esses fields já existiam em dim_teams; o RPC apenas não expunha.
-- Necessário pro card "Ângulo do confronto" na tela /game/:gameId.

DROP FUNCTION IF EXISTS public.get_team_by_id(bigint);

CREATE OR REPLACE FUNCTION public.get_team_by_id(p_team_id bigint)
RETURNS TABLE(
  team_id bigint,
  team_name text,
  team_abbreviation text,
  conference text,
  team_city text,
  season bigint,
  conference_rank double precision,
  wins bigint,
  losses bigint,
  team_last_five_games text,
  team_rating_rank bigint,
  team_offensive_rating_rank bigint,
  team_defensive_rating_rank bigint,
  next_opponent_id bigint,
  next_opponent_name text,
  next_opponent_abbreviation text,
  is_next_game_home boolean,
  next_opponent_team_last_five_games text,
  next_opponent_conference_rank double precision,
  next_opponent_team_rating_rank bigint,
  next_opponent_team_offensive_rating_rank bigint,
  next_opponent_team_defensive_rating_rank bigint,
  next_opponent_opp_pts_rank bigint,
  next_opponent_opp_reb_rank bigint,
  next_opponent_opp_ast_rank bigint,
  next_opponent_opp_fg3_pct_rank bigint,
  next_opponent_def_rating_rank bigint,
  next_opponent_opp_pts_paint_rank bigint,
  team_injury_report_time_brasilia text,
  next_game_injury_report_time_brasilia text,
  loaded_at timestamp without time zone,
  next_opponent_wins bigint,
  next_opponent_losses bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    t.team_id, t.team_name, t.team_abbreviation, t.conference, t.team_city,
    t.season, t.conference_rank::float8, t.wins, t.losses, t.team_last_five_games,
    t.team_rating_rank, t.team_offensive_rating_rank, t.team_defensive_rating_rank,
    t.next_opponent_id, t.next_opponent_name, t.next_opponent_abbreviation,
    t.is_next_game_home, t.next_opponent_team_last_five_games,
    t.next_opponent_conference_rank::float8, t.next_opponent_team_rating_rank,
    t.next_opponent_team_offensive_rating_rank, t.next_opponent_team_defensive_rating_rank,
    t.next_opponent_opp_pts_rank, t.next_opponent_opp_reb_rank,
    t.next_opponent_opp_ast_rank, t.next_opponent_opp_fg3_pct_rank,
    t.next_opponent_def_rating_rank, t.next_opponent_opp_pts_paint_rank,
    t.team_injury_report_time_brasilia, t.next_game_injury_report_time_brasilia, t.loaded_at,
    opp.wins AS next_opponent_wins,
    opp.losses AS next_opponent_losses
  FROM nba_mart.dim_teams t
  LEFT JOIN nba_mart.dim_teams opp ON opp.team_id = t.next_opponent_id
  WHERE t.team_id = p_team_id
  LIMIT 1;
END; $function$;
