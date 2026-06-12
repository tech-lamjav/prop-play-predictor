-- Migration: create_fdw_ft_game_player_stats_period
-- Creates foreign table for BigQuery ft_game_player_stats_period (Q1/H1 stats)
-- Source: Mateus created this table in BigQuery with pivoted per-period columns
-- Structure differs from ft_game_player_stats: columns are pivoted (q1_points, q1_rebounds, q1_assists, q1_minutes, h1_points)
-- instead of normalized (stat_type/stat_value)
--
-- Applied to staging (kpbjuplcwiyrymafhehz) — needs to be applied to production (lavclmlvvfzkblrstojd)

DROP FOREIGN TABLE IF EXISTS bigquery.ft_game_player_stats_period;

CREATE FOREIGN TABLE bigquery.ft_game_player_stats_period (
  player_id      bigint,
  game_date      date,
  game_id        bigint,
  q1_minutes     bigint,
  q1_points      bigint,
  q1_rebounds    bigint,
  q1_assists     bigint,
  h1_points      bigint,
  played_against text,
  home_away      text,
  is_b2b_game    boolean,
  loaded_at      timestamp
)
SERVER bigquery_wrapper_server
OPTIONS (
  table 'ft_game_player_stats_period',
  location 'us-east1'
);
