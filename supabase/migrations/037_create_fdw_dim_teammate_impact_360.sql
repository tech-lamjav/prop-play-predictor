-- Migration: create_fdw_dim_teammate_impact_360
-- Creates foreign table for BigQuery dim_teammate_impact_360
-- Contains all teammates of a trigger player with impact stats (PTS/AST/REB)
-- Used by the Análise 360 mandala detail view
--
-- Applied to staging (kpbjuplcwiyrymafhehz) and production (lavclmlvvfzkblrstojd)

DROP FOREIGN TABLE IF EXISTS bigquery.dim_teammate_impact_360;

CREATE FOREIGN TABLE bigquery.dim_teammate_impact_360 (
  trigger_player_id    bigint,
  trigger_name         text,
  trigger_team_id      bigint,
  trigger_team_abbr    text,
  trigger_status       text,
  teammate_player_id   bigint,
  teammate_name        text,
  teammate_position    text,
  stat_type            text,
  avg_com              double precision,
  avg_sem              double precision,
  stddev_sem           double precision,
  gap                  double precision,
  gap_pct              double precision,
  jogos_com            bigint,
  jogos_sem            bigint,
  teammate_avg_minutes double precision
)
SERVER bigquery_wrapper_server
OPTIONS (
  table 'dim_teammate_impact_360',
  location 'us-east1'
);
