-- Migration: create_fdw_dim_team_playtypes
-- Creates foreign table for BigQuery dim_team_playtypes (10 play types per team with PPP/rank/percentile)
-- Source: Mateus created this mart with offensive play type efficiency per team.
-- NOTE: Current data is OFFENSIVE (how team attacks), not DEFENSIVE (how team defends each play type).
-- Bug flagged to Mateus: rankings are inverted (rank #1 = worst PPP, should be best).

DROP FOREIGN TABLE IF EXISTS bigquery.dim_team_playtypes;

CREATE FOREIGN TABLE bigquery.dim_team_playtypes (
  team_id bigint, team_name text, team_abbreviation text, season bigint,
  iso_ppp double precision, iso_poss_pct double precision, iso_efg_pct double precision, iso_percentile double precision, iso_ppp_rank bigint,
  spotup_ppp double precision, spotup_poss_pct double precision, spotup_efg_pct double precision, spotup_percentile double precision, spotup_ppp_rank bigint,
  pnr_bh_ppp double precision, pnr_bh_poss_pct double precision, pnr_bh_efg_pct double precision, pnr_bh_percentile double precision, pnr_bh_ppp_rank bigint,
  pnr_rm_ppp double precision, pnr_rm_poss_pct double precision, pnr_rm_efg_pct double precision, pnr_rm_percentile double precision, pnr_rm_ppp_rank bigint,
  postup_ppp double precision, postup_poss_pct double precision, postup_efg_pct double precision, postup_percentile double precision, postup_ppp_rank bigint,
  transition_ppp double precision, transition_poss_pct double precision, transition_efg_pct double precision, transition_percentile double precision, transition_ppp_rank bigint,
  handoff_ppp double precision, handoff_poss_pct double precision, handoff_efg_pct double precision, handoff_percentile double precision, handoff_ppp_rank bigint,
  cut_ppp double precision, cut_poss_pct double precision, cut_efg_pct double precision, cut_percentile double precision, cut_ppp_rank bigint,
  offscreen_ppp double precision, offscreen_poss_pct double precision, offscreen_efg_pct double precision, offscreen_percentile double precision, offscreen_ppp_rank bigint,
  putback_ppp double precision, putback_poss_pct double precision, putback_efg_pct double precision, putback_percentile double precision, putback_ppp_rank bigint,
  loaded_at timestamp
)
SERVER bigquery_wrapper_server
OPTIONS (
  table 'dim_team_playtypes',
  location 'us-east1'
);
