-- Migration: create_fdw_dim_team_shooting_zone_defense
-- Creates foreign table for BigQuery dim_team_shooting_zone_defense
-- 5 zones x 4 metrics (fg_pct, fga, fgm, fg_pct_rank) + 4 identification cols + audit.
--
-- Source: Mateus created this mart with what each team CONCEDES per shooting zone
-- (opponent shooting profile when playing AGAINST this team). 30 rows per season.
--
-- Used in: matchup overlay no ShootingZonesCard do jogador — cruza
-- "jogador acerta X% no mid-range" com "adversario cede Y% (#rank)".

DROP FOREIGN TABLE IF EXISTS bigquery.dim_team_shooting_zone_defense;

CREATE FOREIGN TABLE bigquery.dim_team_shooting_zone_defense (
  team_id           bigint,
  team_name         text,
  team_abbreviation text,
  season            bigint,

  -- Restricted Area
  opp_restricted_area_fg_pct       double precision,
  opp_restricted_area_fga          double precision,
  opp_restricted_area_fgm          double precision,
  opp_restricted_area_fg_pct_rank  bigint,

  -- In the Paint (Non-RA)
  opp_in_the_paint_non_ra_fg_pct       double precision,
  opp_in_the_paint_non_ra_fga          double precision,
  opp_in_the_paint_non_ra_fgm          double precision,
  opp_in_the_paint_non_ra_fg_pct_rank  bigint,

  -- Mid-Range
  opp_mid_range_fg_pct       double precision,
  opp_mid_range_fga          double precision,
  opp_mid_range_fgm          double precision,
  opp_mid_range_fg_pct_rank  bigint,

  -- Corner 3 (left + right combinados)
  opp_corner_3_fg_pct       double precision,
  opp_corner_3_fga          double precision,
  opp_corner_3_fgm          double precision,
  opp_corner_3_fg_pct_rank  bigint,

  -- Above the Break 3
  opp_above_the_break_3_fg_pct       double precision,
  opp_above_the_break_3_fga          double precision,
  opp_above_the_break_3_fgm          double precision,
  opp_above_the_break_3_fg_pct_rank  bigint,

  loaded_at timestamp
)
SERVER bigquery_wrapper_server
OPTIONS (
  table 'dim_team_shooting_zone_defense',
  location 'us-east1'
);
