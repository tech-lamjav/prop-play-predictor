-- ============================================================
-- Fase 3 do PLANO_OTIMIZACAO_BQ_SUPABASE.md
-- ============================================================
-- Cria schema nba_mart com 9 tabelas espelhando os marts BigQuery
-- (smartbetting-dados.nba.*). Populadas pelo Cloud Run
-- sync-bq-to-postgres via TRUNCATE + COPY.
--
-- Schemas derivados dos modelos dbt em analytics-engineering/dbt_nba/
-- models/marts/. O sync faz check_schema_parity (BQ vs PG) antes de
-- qualquer TRUNCATE — qualquer drift aborta o sync sem corromper dado.
--
-- Mapeamento de tipos (canonico do sync):
--   BQ INT64/INTEGER         -> PG BIGINT
--   BQ FLOAT64/FLOAT/NUMERIC -> PG DOUBLE PRECISION
--   BQ BOOL                  -> PG BOOLEAN
--   BQ STRING                -> PG TEXT
--   BQ DATE                  -> PG DATE
--   BQ TIMESTAMP/DATETIME    -> PG TIMESTAMP (sem TZ; ambos viram
--                               canonical 'TIMESTAMP')
-- ============================================================

CREATE SCHEMA IF NOT EXISTS nba_mart;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- dim_teams
-- ============================================================
CREATE TABLE IF NOT EXISTS nba_mart.dim_teams (
  team_id                                       BIGINT PRIMARY KEY,
  team_name                                     TEXT,
  team_abbreviation                             TEXT,
  conference                                    TEXT,
  team_city                                     TEXT,
  season                                        BIGINT,
  conference_rank                               BIGINT,
  wins                                          BIGINT,
  losses                                        BIGINT,
  team_last_five_games                          TEXT,
  team_offensive_rating                         DOUBLE PRECISION,
  team_defensive_rating                         DOUBLE PRECISION,
  team_net_rating                               DOUBLE PRECISION,
  team_rating_rank                              BIGINT,
  team_offensive_rating_rank                    BIGINT,
  team_defensive_rating_rank                    BIGINT,
  next_opponent_id                              BIGINT,
  next_opponent_name                            TEXT,
  next_opponent_abbreviation                    TEXT,
  is_next_game_home                             BOOLEAN,
  next_opponent_team_last_five_games            TEXT,
  next_opponent_conference_rank                 BIGINT,
  next_opponent_team_offensive_rating           DOUBLE PRECISION,
  next_opponent_team_defensive_rating           DOUBLE PRECISION,
  next_opponent_team_net_rating                 DOUBLE PRECISION,
  next_opponent_team_rating_rank                BIGINT,
  next_opponent_team_offensive_rating_rank      BIGINT,
  next_opponent_team_defensive_rating_rank      BIGINT,
  next_opponent_opp_pts_rank                    BIGINT,
  next_opponent_opp_reb_rank                    BIGINT,
  next_opponent_opp_ast_rank                    BIGINT,
  next_opponent_opp_fg3_pct_rank                BIGINT,
  next_opponent_def_rating_rank                 BIGINT,
  next_opponent_opp_pts_paint_rank              BIGINT,
  team_injury_report_time_brasilia              TEXT,
  next_game_injury_report_time_brasilia         TEXT,
  loaded_at                                     TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dim_teams_abbr
  ON nba_mart.dim_teams (LOWER(team_abbreviation));

-- ============================================================
-- dim_players
-- ============================================================
CREATE TABLE IF NOT EXISTS nba_mart.dim_players (
  player_id          BIGINT PRIMARY KEY,
  player_name        TEXT,
  position           TEXT,
  team_id            BIGINT,
  team_name          TEXT,
  team_abbreviation  TEXT,
  age                BIGINT,
  last_game_text     TEXT,
  status             TEXT,
  description        TEXT,
  return_date        DATE,
  loaded_at          TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dim_players_team
  ON nba_mart.dim_players (team_id);
CREATE INDEX IF NOT EXISTS idx_dim_players_name_trgm
  ON nba_mart.dim_players USING GIN (LOWER(player_name) gin_trgm_ops);

-- ============================================================
-- dim_stat_player
-- ============================================================
CREATE TABLE IF NOT EXISTS nba_mart.dim_stat_player (
  player_id                          BIGINT,
  team_id                            BIGINT,
  stat_type                          TEXT,
  rating_stars                       BIGINT,
  is_leader_with_injury              BOOLEAN,
  is_available_backup                BOOLEAN,
  stat_rank                          BIGINT,
  next_available_player_name         TEXT,
  next_player_stats_when_leader_out  DOUBLE PRECISION,
  next_player_stats_normal           DOUBLE PRECISION,
  leader_injury_status               TEXT,
  loaded_at                          TIMESTAMP,
  PRIMARY KEY (player_id, stat_type)
);
CREATE INDEX IF NOT EXISTS idx_dim_stat_player_team
  ON nba_mart.dim_stat_player (team_id);

-- ============================================================
-- dim_player_shooting_by_zones
-- ============================================================
CREATE TABLE IF NOT EXISTS nba_mart.dim_player_shooting_by_zones (
  player_id                     BIGINT PRIMARY KEY,
  player_name                   TEXT,
  corner_3_fga                  DOUBLE PRECISION,
  corner_3_fgm                  DOUBLE PRECISION,
  corner_3_fg_pct               DOUBLE PRECISION,
  left_corner_3_fga             DOUBLE PRECISION,
  left_corner_3_fgm             DOUBLE PRECISION,
  left_corner_3_fg_pct          DOUBLE PRECISION,
  right_corner_3_fga            DOUBLE PRECISION,
  right_corner_3_fgm            DOUBLE PRECISION,
  right_corner_3_fg_pct         DOUBLE PRECISION,
  above_the_break_3_fga         DOUBLE PRECISION,
  above_the_break_3_fgm         DOUBLE PRECISION,
  above_the_break_3_fg_pct      DOUBLE PRECISION,
  restricted_area_fga           DOUBLE PRECISION,
  restricted_area_fgm           DOUBLE PRECISION,
  restricted_area_fg_pct        DOUBLE PRECISION,
  in_the_paint_non_ra_fga       DOUBLE PRECISION,
  in_the_paint_non_ra_fgm       DOUBLE PRECISION,
  in_the_paint_non_ra_fg_pct    DOUBLE PRECISION,
  mid_range_fga                 DOUBLE PRECISION,
  mid_range_fgm                 DOUBLE PRECISION,
  mid_range_fg_pct              DOUBLE PRECISION,
  backcourt_fga                 DOUBLE PRECISION,
  backcourt_fgm                 DOUBLE PRECISION,
  backcourt_fg_pct              DOUBLE PRECISION,
  loaded_at                     TIMESTAMP
);

-- ============================================================
-- dim_player_latest_line
-- ============================================================
-- Snapshot da linha mais recente publicada por (player_id, stat_type).
-- Substitui o CTE most_recent_line_value que vivia em ft_game_player_stats
-- (Fase 1 do plano; ver dbt_nba/models/marts/dim_player_latest_line.sql).
CREATE TABLE IF NOT EXISTS nba_mart.dim_player_latest_line (
  player_id               BIGINT,
  stat_type               TEXT,
  line_value_most_recent  DOUBLE PRECISION,
  loaded_at               TIMESTAMP,
  PRIMARY KEY (player_id, stat_type)
);

-- ============================================================
-- ft_games
-- ============================================================
CREATE TABLE IF NOT EXISTS nba_mart.ft_games (
  game_id                       BIGINT PRIMARY KEY,
  season                        BIGINT,
  game_date                     DATE,
  game_datetime_utc             TIMESTAMP,
  game_datetime_brasilia        TIMESTAMP,
  home_team_id                  BIGINT,
  home_team_name                TEXT,
  home_team_abbreviation        TEXT,
  home_team_score               BIGINT,
  visitor_team_id               BIGINT,
  visitor_team_name             TEXT,
  visitor_team_abbreviation     TEXT,
  visitor_team_score            BIGINT,
  winner_team_id                BIGINT,
  home_team_is_b2b_game         BOOLEAN,
  visitor_team_is_b2b_game      BOOLEAN,
  home_team_is_next_game        BOOLEAN,
  visitor_team_is_next_game     BOOLEAN,
  loaded_at                     TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ft_games_date
  ON nba_mart.ft_games (game_date DESC);
CREATE INDEX IF NOT EXISTS idx_ft_games_home_abbr
  ON nba_mart.ft_games (home_team_abbreviation);
CREATE INDEX IF NOT EXISTS idx_ft_games_visitor_abbr
  ON nba_mart.ft_games (visitor_team_abbreviation);

-- ============================================================
-- ft_game_player_stats
-- ============================================================
-- BQ: incremental, partition by game_date. PG: PK + indexes cobrem
-- os padroes de query (volume estimado <500k linhas).
CREATE TABLE IF NOT EXISTS nba_mart.ft_game_player_stats (
  player_id        BIGINT NOT NULL,
  game_date        DATE NOT NULL,
  game_id          BIGINT NOT NULL,
  stat_type        TEXT NOT NULL,
  stat_value       DOUBLE PRECISION,
  line_value       DOUBLE PRECISION,
  is_b2b_game      BOOLEAN,
  stat_vs_line     TEXT,
  played_against   TEXT,
  home_away        TEXT,
  is_played        TEXT,
  loaded_at        TIMESTAMP,
  PRIMARY KEY (player_id, game_id, stat_type)
);
CREATE INDEX IF NOT EXISTS idx_fgps_player_date
  ON nba_mart.ft_game_player_stats (player_id, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_fgps_game
  ON nba_mart.ft_game_player_stats (game_id);

-- ============================================================
-- dim_teammate_impact_360
-- ============================================================
-- COM vs SEM impact por (trigger, teammate, stat_type). UI Analise 360.
CREATE TABLE IF NOT EXISTS nba_mart.dim_teammate_impact_360 (
  trigger_player_id        BIGINT,
  trigger_name             TEXT,
  trigger_team_id          BIGINT,
  trigger_team_abbr        TEXT,
  trigger_status           TEXT,
  teammate_player_id       BIGINT,
  teammate_name            TEXT,
  teammate_position        TEXT,
  stat_type                TEXT,
  avg_com                  DOUBLE PRECISION,
  avg_sem                  DOUBLE PRECISION,
  stddev_sem               DOUBLE PRECISION,
  gap                      DOUBLE PRECISION,
  gap_pct                  DOUBLE PRECISION,
  jogos_com                BIGINT,
  jogos_sem                BIGINT,
  teammate_avg_minutes     DOUBLE PRECISION,
  loaded_at                TIMESTAMP,
  PRIMARY KEY (trigger_player_id, teammate_player_id, stat_type)
);

-- ============================================================
-- dim_daily_opportunities
-- ============================================================
-- game_time NAO eh timestamp: vem de FORMAT_DATETIME('%H:%M', ...)
-- em int_daily_triggers (BQ STRING -> PG TEXT).
CREATE TABLE IF NOT EXISTS nba_mart.dim_daily_opportunities (
  game_id                   BIGINT,
  game_date                 DATE,
  game_time                 TEXT,
  home_team_abbr            TEXT,
  visitor_team_abbr         TEXT,
  trigger_player_id         BIGINT,
  trigger_name              TEXT,
  trigger_status            TEXT,
  trigger_team_abbr         TEXT,
  trigger_team_id           BIGINT,
  trigger_days_out          BIGINT,
  trigger_freshness         TEXT,
  trigger_participation_pct DOUBLE PRECISION,
  is_b2b                    BOOLEAN,
  fatigue_level             TEXT,
  backup_player_id          BIGINT,
  backup_player_name        TEXT,
  stat_type                 TEXT,
  avg_com                   DOUBLE PRECISION,
  avg_sem                   DOUBLE PRECISION,
  stddev_sem                DOUBLE PRECISION,
  cv_sem                    DOUBLE PRECISION,
  gap                       DOUBLE PRECISION,
  gap_pct                   DOUBLE PRECISION,
  jogos_com                 BIGINT,
  jogos_sem                 BIGINT,
  line_value                DOUBLE PRECISION,
  gap_vs_line               DOUBLE PRECISION,
  gap_vs_line_pct           DOUBLE PRECISION,
  signal                    TEXT,
  score_base                BIGINT,
  score                     BIGINT,
  score_label               TEXT,
  opponent_abbr             TEXT,
  opponent_def_rank         BIGINT,
  opponent_off_rank         BIGINT,
  opponent_opp_pts_rank     BIGINT,
  opponent_opp_reb_rank     BIGINT,
  opponent_opp_ast_rank     BIGINT,
  opponent_opp_fg3_pct_rank BIGINT,
  is_home                   BOOLEAN,
  rating_stars              BIGINT,
  spread                    DOUBLE PRECISION,
  blowout_deflator          DOUBLE PRECISION,
  game_total                DOUBLE PRECISION,
  loaded_at                 TIMESTAMP,
  PRIMARY KEY (game_id, trigger_player_id, backup_player_id, stat_type)
);
CREATE INDEX IF NOT EXISTS idx_dim_opps_date
  ON nba_mart.dim_daily_opportunities (game_date DESC);
CREATE INDEX IF NOT EXISTS idx_dim_opps_score_high
  ON nba_mart.dim_daily_opportunities (score DESC)
  WHERE score >= 60;

-- ============================================================
-- Permissoes
-- ============================================================
-- Schema nba_mart NAO eh exposto via PostgREST. Sem GRANT pra anon/
-- authenticated => esses roles nao tem USAGE no schema => PostgREST
-- nao cria endpoints REST pra essas tabelas. Acesso pelo app vai
-- exclusivamente via RPCs em public, que sao SECURITY DEFINER e
-- rodam como postgres (dono), portanto leem nba_mart sem grant.
-- O Cloud Run sync conecta com role postgres, tambem nao depende de grant.
