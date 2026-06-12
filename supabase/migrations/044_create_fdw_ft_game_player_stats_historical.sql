-- Migration: create_fdw_ft_game_player_stats_historical
-- Creates foreign table for BigQuery ft_game_player_stats_historical (3 seasons of game-by-game stats)
-- Source: Mateus created this table with 3 full seasons (2023, 2024, 2025) including Regular/Playoffs/Play-in.
-- ~83,000 records, pivoted structure (columns for each stat), no market lines.

DROP FOREIGN TABLE IF EXISTS bigquery.ft_game_player_stats_historical;

CREATE FOREIGN TABLE bigquery.ft_game_player_stats_historical (
  player_id bigint, team_id bigint, game_id bigint, game_date date,
  season bigint, season_type text,
  home_team_score bigint, home_team_id bigint, visitor_team_score bigint, visitor_team_id bigint, winner_team_id bigint,
  minutes bigint, points bigint, rebounds bigint, assists bigint, threes bigint,
  offensive_rebounds bigint, defensive_rebounds bigint, steals bigint, blocks bigint, turnovers bigint,
  field_goal_percentage double precision, free_throw_percentage double precision, plus_minus bigint,
  points_rebounds bigint, points_assists bigint, rebounds_assists bigint, points_rebounds_assists bigint,
  blocks_steals bigint, triple_double boolean, double_double boolean
)
SERVER bigquery_wrapper_server
OPTIONS (
  table 'ft_game_player_stats_historical',
  location 'us-east1'
);
