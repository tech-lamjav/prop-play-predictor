-- Migration: add_loaded_at_to_dim_daily_opportunities
-- Adds loaded_at timestamp column to the BigQuery foreign table dim_daily_opportunities
-- Used to display "Atualizado às HH:MM (Horário de Brasília)" in the Picks header
--
-- Note: ALTER FOREIGN TABLE ... ADD COLUMN is not supported in PostgreSQL.
-- The foreign table must be dropped and recreated with the new column.
-- This migration recreates the full table definition with loaded_at appended.
--
-- Applied to staging (kpbjuplcwiyrymafhehz) and production (lavclmlvvfzkblrstojd)

DROP FOREIGN TABLE IF EXISTS bigquery.dim_daily_opportunities;

CREATE FOREIGN TABLE bigquery.dim_daily_opportunities (
  game_id                   bigint,
  game_date                 date,
  game_time                 text,
  home_team_abbr            text,
  visitor_team_abbr         text,
  trigger_player_id         bigint,
  trigger_name              text,
  trigger_status            text,
  trigger_team_abbr         text,
  trigger_team_id           bigint,
  trigger_days_out          bigint,
  trigger_freshness         text,
  trigger_participation_pct double precision,
  is_b2b                    boolean,
  fatigue_level             text,
  backup_player_id          bigint,
  backup_player_name        text,
  stat_type                 text,
  avg_com                   double precision,
  avg_sem                   double precision,
  stddev_sem                double precision,
  cv_sem                    double precision,
  gap                       double precision,
  gap_pct                   double precision,
  jogos_com                 bigint,
  jogos_sem                 bigint,
  line_value                double precision,
  gap_vs_line               double precision,
  gap_vs_line_pct           double precision,
  signal                    text,
  score                     bigint,
  score_base                bigint,
  score_label               text,
  opponent_abbr             text,
  opponent_def_rank         bigint,
  opponent_off_rank         bigint,
  is_home                   boolean,
  rating_stars              bigint,
  spread                    double precision,
  blowout_deflator          double precision,
  loaded_at                 timestamp without time zone
)
SERVER bigquery_wrapper_server
OPTIONS (
  table 'dim_daily_opportunities',
  location 'us-east1'
);
