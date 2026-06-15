-- ============================================================
-- Follow-up da Fase 3: marts BI que ficaram de fora do sync FDW->Postgres
-- ============================================================
-- A migração 055 criou nba_mart com 9 tabelas, mas o dataset BQ `nba` tem
-- 15 marts `domain:bi`. Estas 6 nunca foram criadas no Postgres nem entraram
-- em MART_TABLES_ORDERED (data-engineering/src/config.py), então sumiram do
-- app quando o FDW foi dropado (migração 058):
--   dim_player_passing_stats, dim_team_opponent_stats, dim_team_playtypes,
--   dim_team_shooting_zone_defense, ft_game_player_passing_stats,
--   ft_game_player_stats_period
--
-- Schemas espelham EXATAMENTE smartbetting-dados.nba.* (bq show --schema).
-- O sync roda check_schema_parity (BQ vs PG) antes de qualquer COPY: qualquer
-- coluna/tipo divergente aborta o sync inteiro. Mapeamento canônico (idêntico
-- ao da 055 e ao _BQ/_PG_TYPE_TO_CANONICAL em src/sync/bq_to_postgres.py):
--   BQ INTEGER/INT64        -> PG BIGINT            (NÃO integer: vira INT32)
--   BQ FLOAT/FLOAT64        -> PG DOUBLE PRECISION  (NÃO numeric)
--   BQ BOOLEAN              -> PG BOOLEAN
--   BQ STRING               -> PG TEXT
--   BQ DATE                 -> PG DATE
--   BQ TIMESTAMP            -> PG TIMESTAMP (without tz)
--
-- PKs: grain confirmada única e não-nula no BQ em 2026-06-15 (n = distinct,
-- 0 nulls nas colunas-chave). ATENÇÃO: game_date é STRING (TEXT) em
-- ft_game_player_passing_stats e DATE em ft_game_player_stats_period.
--
-- Aplicar em PRD **e** DEV (cada Supabase tem seu próprio nba_mart; o sync
-- roda por ambiente). Depois: adicionar as 6 em MART_TABLES_ORDERED, redeploy
-- do Cloud Run sync-bq-to-postgres, e um run manual ?tables=<...> pra popular.
-- nba_mart NÃO é exposto via PostgREST (ver 055/056): leitura pelo app só via
-- RPCs SECURITY DEFINER em public — a serem criadas quando uma feature
-- consumir estas tabelas.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS nba_mart;

-- ============================================================
-- dim_player_passing_stats  (season-level passing/playmaking; grain player_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS nba_mart.dim_player_passing_stats (
  player_id               BIGINT PRIMARY KEY,
  player_name             TEXT,
  "position"              TEXT,
  team_id                 BIGINT,
  season                  BIGINT,
  games_played            BIGINT,
  minutes                 DOUBLE PRECISION,
  ast                     DOUBLE PRECISION,
  potential_ast           DOUBLE PRECISION,
  potential_ast_rank      BIGINT,
  passes_made             DOUBLE PRECISION,
  passes_received         DOUBLE PRECISION,
  secondary_ast           DOUBLE PRECISION,
  ft_ast                  DOUBLE PRECISION,
  ast_points_created      DOUBLE PRECISION,
  ast_adj                 DOUBLE PRECISION,
  ast_to_pass_pct         DOUBLE PRECISION,
  ast_to_pass_pct_adj     DOUBLE PRECISION,
  potential_ast_per_pass  DOUBLE PRECISION,
  ast_conversion_rate     DOUBLE PRECISION,
  loaded_at               TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dim_passing_team
  ON nba_mart.dim_player_passing_stats (team_id);

-- ============================================================
-- dim_team_opponent_stats  (defesa/rebote do time; grain team_id, season)
-- ============================================================
CREATE TABLE IF NOT EXISTS nba_mart.dim_team_opponent_stats (
  team_id                 BIGINT,
  team_name               TEXT,
  team_abbreviation       TEXT,
  season                  BIGINT,
  opp_pts                 DOUBLE PRECISION,
  opp_pts_rank            BIGINT,
  opp_reb                 DOUBLE PRECISION,
  opp_reb_rank            BIGINT,
  opp_oreb                DOUBLE PRECISION,
  opp_oreb_rank           BIGINT,
  opp_dreb                DOUBLE PRECISION,
  opp_dreb_rank           BIGINT,
  opp_ast                 DOUBLE PRECISION,
  opp_ast_rank            BIGINT,
  opp_fg_pct              DOUBLE PRECISION,
  opp_fg_pct_rank         BIGINT,
  opp_fg3_pct             DOUBLE PRECISION,
  opp_fg3_pct_rank        BIGINT,
  opp_stl                 DOUBLE PRECISION,
  opp_stl_rank            BIGINT,
  opp_blk                 DOUBLE PRECISION,
  opp_blk_rank            BIGINT,
  opp_tov                 DOUBLE PRECISION,
  opp_tov_rank            BIGINT,
  opp_fta                 DOUBLE PRECISION,
  opp_fta_rank            BIGINT,
  opp_ft_pct              DOUBLE PRECISION,
  opp_ft_pct_rank         BIGINT,
  def_rating              DOUBLE PRECISION,
  def_rating_rank         BIGINT,
  opp_pts_paint           DOUBLE PRECISION,
  opp_pts_paint_rank      BIGINT,
  opp_pts_2nd_chance      DOUBLE PRECISION,
  opp_pts_2nd_chance_rank BIGINT,
  opp_pts_off_tov         DOUBLE PRECISION,
  opp_pts_off_tov_rank    BIGINT,
  opp_pts_fb              DOUBLE PRECISION,
  opp_pts_fb_rank         BIGINT,
  dreb_pct                DOUBLE PRECISION,
  dreb_pct_rank           BIGINT,
  oreb_chance_pct         DOUBLE PRECISION,
  dreb_chance_pct         DOUBLE PRECISION,
  reb_chance_pct          DOUBLE PRECISION,
  oreb_chances            DOUBLE PRECISION,
  dreb_chances            DOUBLE PRECISION,
  oreb_contest_pct        DOUBLE PRECISION,
  dreb_contest_pct        DOUBLE PRECISION,
  avg_reb_dist            DOUBLE PRECISION,
  cs_fga                  DOUBLE PRECISION,
  cs_fga_frequency        DOUBLE PRECISION,
  cs_fg3a                 DOUBLE PRECISION,
  cs_fg3a_frequency       DOUBLE PRECISION,
  cs_fg_pct               DOUBLE PRECISION,
  cs_fg3_pct              DOUBLE PRECISION,
  cs_efg_pct              DOUBLE PRECISION,
  pullup_fga              DOUBLE PRECISION,
  pullup_fga_frequency    DOUBLE PRECISION,
  pullup_fg3a             DOUBLE PRECISION,
  pullup_fg3a_frequency   DOUBLE PRECISION,
  pullup_fg_pct           DOUBLE PRECISION,
  pullup_fg3_pct          DOUBLE PRECISION,
  pullup_efg_pct          DOUBLE PRECISION,
  def_rim_fga             DOUBLE PRECISION,
  def_rim_fgm             DOUBLE PRECISION,
  def_rim_fg_pct          DOUBLE PRECISION,
  def_rim_fg_pct_rank     BIGINT,
  loaded_at               TIMESTAMP,
  PRIMARY KEY (team_id, season)
);
CREATE INDEX IF NOT EXISTS idx_dim_opp_stats_abbr
  ON nba_mart.dim_team_opponent_stats (LOWER(team_abbreviation));

-- ============================================================
-- dim_team_playtypes  (10 play types ofensivos; grain team_id, season)
-- ============================================================
CREATE TABLE IF NOT EXISTS nba_mart.dim_team_playtypes (
  team_id                 BIGINT,
  team_name               TEXT,
  team_abbreviation       TEXT,
  season                  BIGINT,
  iso_ppp                 DOUBLE PRECISION,
  iso_poss_pct            DOUBLE PRECISION,
  iso_efg_pct             DOUBLE PRECISION,
  iso_percentile          DOUBLE PRECISION,
  iso_ppp_rank            BIGINT,
  spotup_ppp              DOUBLE PRECISION,
  spotup_poss_pct         DOUBLE PRECISION,
  spotup_efg_pct          DOUBLE PRECISION,
  spotup_percentile       DOUBLE PRECISION,
  spotup_ppp_rank         BIGINT,
  pnr_bh_ppp              DOUBLE PRECISION,
  pnr_bh_poss_pct         DOUBLE PRECISION,
  pnr_bh_efg_pct          DOUBLE PRECISION,
  pnr_bh_percentile       DOUBLE PRECISION,
  pnr_bh_ppp_rank         BIGINT,
  pnr_rm_ppp              DOUBLE PRECISION,
  pnr_rm_poss_pct         DOUBLE PRECISION,
  pnr_rm_efg_pct          DOUBLE PRECISION,
  pnr_rm_percentile       DOUBLE PRECISION,
  pnr_rm_ppp_rank         BIGINT,
  postup_ppp              DOUBLE PRECISION,
  postup_poss_pct         DOUBLE PRECISION,
  postup_efg_pct          DOUBLE PRECISION,
  postup_percentile       DOUBLE PRECISION,
  postup_ppp_rank         BIGINT,
  transition_ppp          DOUBLE PRECISION,
  transition_poss_pct     DOUBLE PRECISION,
  transition_efg_pct      DOUBLE PRECISION,
  transition_percentile   DOUBLE PRECISION,
  transition_ppp_rank     BIGINT,
  handoff_ppp             DOUBLE PRECISION,
  handoff_poss_pct        DOUBLE PRECISION,
  handoff_efg_pct         DOUBLE PRECISION,
  handoff_percentile      DOUBLE PRECISION,
  handoff_ppp_rank        BIGINT,
  cut_ppp                 DOUBLE PRECISION,
  cut_poss_pct            DOUBLE PRECISION,
  cut_efg_pct             DOUBLE PRECISION,
  cut_percentile          DOUBLE PRECISION,
  cut_ppp_rank            BIGINT,
  offscreen_ppp           DOUBLE PRECISION,
  offscreen_poss_pct      DOUBLE PRECISION,
  offscreen_efg_pct       DOUBLE PRECISION,
  offscreen_percentile    DOUBLE PRECISION,
  offscreen_ppp_rank      BIGINT,
  putback_ppp             DOUBLE PRECISION,
  putback_poss_pct        DOUBLE PRECISION,
  putback_efg_pct         DOUBLE PRECISION,
  putback_percentile      DOUBLE PRECISION,
  putback_ppp_rank        BIGINT,
  loaded_at               TIMESTAMP,
  PRIMARY KEY (team_id, season)
);
CREATE INDEX IF NOT EXISTS idx_dim_playtypes_abbr
  ON nba_mart.dim_team_playtypes (LOWER(team_abbreviation));

-- ============================================================
-- dim_team_shooting_zone_defense  (FG% cedido por zona; grain team_id, season)
-- ============================================================
CREATE TABLE IF NOT EXISTS nba_mart.dim_team_shooting_zone_defense (
  team_id                              BIGINT,
  team_name                            TEXT,
  team_abbreviation                    TEXT,
  season                               BIGINT,
  opp_restricted_area_fga              DOUBLE PRECISION,
  opp_restricted_area_fgm              DOUBLE PRECISION,
  opp_restricted_area_fg_pct           DOUBLE PRECISION,
  opp_restricted_area_fg_pct_rank      BIGINT,
  opp_in_the_paint_non_ra_fga          DOUBLE PRECISION,
  opp_in_the_paint_non_ra_fgm          DOUBLE PRECISION,
  opp_in_the_paint_non_ra_fg_pct       DOUBLE PRECISION,
  opp_in_the_paint_non_ra_fg_pct_rank  BIGINT,
  opp_mid_range_fga                    DOUBLE PRECISION,
  opp_mid_range_fgm                    DOUBLE PRECISION,
  opp_mid_range_fg_pct                 DOUBLE PRECISION,
  opp_mid_range_fg_pct_rank            BIGINT,
  opp_corner_3_fga                     DOUBLE PRECISION,
  opp_corner_3_fgm                     DOUBLE PRECISION,
  opp_corner_3_fg_pct                  DOUBLE PRECISION,
  opp_corner_3_fg_pct_rank             BIGINT,
  opp_left_corner_3_fga                DOUBLE PRECISION,
  opp_left_corner_3_fgm                DOUBLE PRECISION,
  opp_left_corner_3_fg_pct             DOUBLE PRECISION,
  opp_right_corner_3_fga               DOUBLE PRECISION,
  opp_right_corner_3_fgm               DOUBLE PRECISION,
  opp_right_corner_3_fg_pct            DOUBLE PRECISION,
  opp_above_the_break_3_fga            DOUBLE PRECISION,
  opp_above_the_break_3_fgm            DOUBLE PRECISION,
  opp_above_the_break_3_fg_pct         DOUBLE PRECISION,
  opp_above_the_break_3_fg_pct_rank    BIGINT,
  opp_backcourt_fga                    DOUBLE PRECISION,
  opp_backcourt_fgm                    DOUBLE PRECISION,
  opp_backcourt_fg_pct                 DOUBLE PRECISION,
  opp_lt_5ft_fga                       DOUBLE PRECISION,
  opp_lt_5ft_fgm                       DOUBLE PRECISION,
  opp_lt_5ft_fg_pct                    DOUBLE PRECISION,
  opp_lt_5ft_fg_pct_rank               BIGINT,
  opp_5_9ft_fga                        DOUBLE PRECISION,
  opp_5_9ft_fgm                        DOUBLE PRECISION,
  opp_5_9ft_fg_pct                     DOUBLE PRECISION,
  opp_5_9ft_fg_pct_rank                BIGINT,
  opp_10_14ft_fga                      DOUBLE PRECISION,
  opp_10_14ft_fgm                      DOUBLE PRECISION,
  opp_10_14ft_fg_pct                   DOUBLE PRECISION,
  opp_10_14ft_fg_pct_rank              BIGINT,
  opp_15_19ft_fga                      DOUBLE PRECISION,
  opp_15_19ft_fgm                      DOUBLE PRECISION,
  opp_15_19ft_fg_pct                   DOUBLE PRECISION,
  opp_15_19ft_fg_pct_rank              BIGINT,
  opp_20_24ft_fga                      DOUBLE PRECISION,
  opp_20_24ft_fgm                      DOUBLE PRECISION,
  opp_20_24ft_fg_pct                   DOUBLE PRECISION,
  opp_20_24ft_fg_pct_rank              BIGINT,
  opp_25_29ft_fga                      DOUBLE PRECISION,
  opp_25_29ft_fgm                      DOUBLE PRECISION,
  opp_25_29ft_fg_pct                   DOUBLE PRECISION,
  opp_25_29ft_fg_pct_rank              BIGINT,
  opp_30_34ft_fga                      DOUBLE PRECISION,
  opp_30_34ft_fgm                      DOUBLE PRECISION,
  opp_30_34ft_fg_pct                   DOUBLE PRECISION,
  opp_35_39ft_fga                      DOUBLE PRECISION,
  opp_35_39ft_fgm                      DOUBLE PRECISION,
  opp_35_39ft_fg_pct                   DOUBLE PRECISION,
  opp_40ft_fga                         DOUBLE PRECISION,
  opp_40ft_fgm                         DOUBLE PRECISION,
  opp_40ft_fg_pct                      DOUBLE PRECISION,
  loaded_at                            TIMESTAMP,
  PRIMARY KEY (team_id, season)
);
CREATE INDEX IF NOT EXISTS idx_dim_zone_def_abbr
  ON nba_mart.dim_team_shooting_zone_defense (LOWER(team_abbreviation));

-- ============================================================
-- ft_game_player_passing_stats  (passing game-by-game; grain player_id, game_id)
-- NOTA: game_date é STRING no BQ -> TEXT aqui (NÃO date).
-- ============================================================
CREATE TABLE IF NOT EXISTS nba_mart.ft_game_player_passing_stats (
  player_id               BIGINT NOT NULL,
  team_id                 BIGINT,
  game_id                 BIGINT NOT NULL,
  game_date               TEXT,
  season                  BIGINT,
  passes                  BIGINT,
  secondary_assists       BIGINT,
  free_throw_assists      BIGINT,
  screen_assists          BIGINT,
  screen_assist_points    BIGINT,
  assist_percentage       DOUBLE PRECISION,
  assist_ratio            DOUBLE PRECISION,
  assist_to_turnover      DOUBLE PRECISION,
  turnover_ratio          DOUBLE PRECISION,
  usage_percentage        DOUBLE PRECISION,
  touches                 BIGINT,
  possessions             BIGINT,
  extra_assists_per_pass  DOUBLE PRECISION,
  is_b2b_game             BOOLEAN,
  played_against          TEXT,
  home_away               TEXT,
  loaded_at               TIMESTAMP,
  PRIMARY KEY (player_id, game_id)
);
CREATE INDEX IF NOT EXISTS idx_fgpps_game
  ON nba_mart.ft_game_player_passing_stats (game_id);
CREATE INDEX IF NOT EXISTS idx_fgpps_player_date
  ON nba_mart.ft_game_player_passing_stats (player_id, game_date DESC);

-- ============================================================
-- ft_game_player_stats_period  (Q1/1H por jogo; grain player_id, game_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS nba_mart.ft_game_player_stats_period (
  player_id        BIGINT NOT NULL,
  game_date        DATE,
  game_id          BIGINT NOT NULL,
  q1_minutes       BIGINT,
  q1_points        BIGINT,
  q1_rebounds      BIGINT,
  q1_assists       BIGINT,
  h1_points        BIGINT,
  h1_rebounds      BIGINT,
  h1_assists       BIGINT,
  played_against   TEXT,
  home_away        TEXT,
  is_b2b_game      BOOLEAN,
  loaded_at        TIMESTAMP,
  PRIMARY KEY (player_id, game_id)
);
CREATE INDEX IF NOT EXISTS idx_fgpsp_game
  ON nba_mart.ft_game_player_stats_period (game_id);
CREATE INDEX IF NOT EXISTS idx_fgpsp_player_date
  ON nba_mart.ft_game_player_stats_period (player_id, game_date DESC);
