-- Migration: extend_fdw_period_h1_reb_ast
-- Re-creates bigquery.ft_game_player_stats_period including h1_rebounds and
-- h1_assists, which Mateus already added on the BigQuery side mas não estavam
-- expostos via FDW (foreign tables têm coluna explícita — não auto-descobrem).
--
-- Depende de: 037_create_fdw_ft_game_player_stats_period.sql (substitui).
-- Próxima migration (047) atualiza o RPC `get_player_period_stats` pra
-- expor os 2 novos stat_types.
--
-- Se essa migration falhar com erro tipo "column 'h1_rebounds' does not exist
-- in BigQuery", significa que Mateus NÃO coletou os dados — devolve a task
-- pra ele.

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
  h1_rebounds    bigint,
  h1_assists     bigint,
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
