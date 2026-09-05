-- ============================================================================
-- Futebol (Value Bet) — DDL de PRODUÇÃO  (deploy manual, NÃO é migration)
-- ----------------------------------------------------------------------------
-- Arquitetura NOVA (igual ao nba_mart): o schema `futebol` é populado pelo
-- Cloud Run sync  `sync-bq-to-postgres?sport=futebol`  (BQ list_rows + COPY,
-- sem custo de scan). NÃO usa mais o FDW BigQuery — o loader antigo era o
-- `wrappers`/`bq_futebol`/`futebol.sync_all()`/pg_cron, removido no §TEARDOWN.
--
-- Aplicar via execute_sql / SQL editor: primeiro no DEV, validar o sync, depois
-- no PROD (ver docs/futebol-prod-deploy.md). As 21 tabelas são espelho ESCALAR
-- dos marts BQ `smartbetting-dados.futebol` (colunas REPEATED/RECORD — coverage,
-- evidencias/avisos — são puladas pelo sync; as RPCs reconstroem evidências dos
-- booleans das int_futebol_premissas_*). Gerado do estado dev (kpbjuplcwiyrymafhehz).
--
-- Tabelas sincronizadas (22): dim_leagues, dim_teams, fact_fixtures, fact_fixture_stats, fact_fixture_events, fact_fixture_lineups, fact_fixture_lineups_players, fact_fixture_player_stats, fact_h2h, fact_injuries_snapshot, fact_standings_snapshot, fact_team_season_stats, fact_odds_snapshot, fact_predictions_api, int_futebol_odds_devig, int_futebol_premissas_1x2, int_futebol_premissas_ou, int_futebol_premissas_ah, int_futebol_premissas_btts, int_futebol_premissas_dc, fact_value_opportunities, fact_value_opportunities_hist
-- ============================================================================

-- Não validar corpo das funções no CREATE (ordem-robusto; valida em runtime).
set check_function_bodies = off;

-- ── 1. Schema ────────────────────────────────────────────────────────────────
create schema if not exists futebol;

-- ── 2. Tabelas nativas (espelho escalar do BQ; populadas pelo Cloud Run sync) ──
-- DROP+CREATE garante o shape (substitui as tabelas estreitas do FDW no dev; no
-- prod greenfield o drop é no-op). Os DADOS vêm do sync, não deste arquivo.
drop table if exists futebol.dim_leagues cascade;
create table futebol.dim_leagues (
  "league_id" bigint,
  "season_year" bigint,
  "league_name" text,
  "league_type" text,
  "country_name" text,
  "country_code" text,
  "league_logo_url" text,
  "country_flag_url" text,
  "season_start" date,
  "season_end" date,
  "season_current" boolean,
  "extracted_at" timestamp,
  "dbt_loaded_at" timestamp
);

drop table if exists futebol.dim_teams cascade;
create table futebol.dim_teams (
  "team_id" bigint,
  "team_name" text,
  "team_code" text,
  "team_country" text,
  "team_founded_year" bigint,
  "national" boolean,
  "team_logo_url" text,
  "extracted_at" timestamp,
  "dbt_loaded_at" timestamp
);

drop table if exists futebol.fact_fixtures cascade;
create table futebol.fact_fixtures (
  "fixture_id" bigint,
  "competition" text,
  "competition_id" bigint,
  "season" bigint,
  "round" text,
  "date_utc" date,
  "kickoff_utc" timestamp,
  "timestamp_unix" bigint,
  "timezone" text,
  "status_long" text,
  "status_short" text,
  "status_elapsed" bigint,
  "referee" text,
  "venue_id" bigint,
  "venue_name" text,
  "venue_city" text,
  "home_team_id" bigint,
  "home_team_name" text,
  "home_team_winner" boolean,
  "away_team_id" bigint,
  "away_team_name" text,
  "away_team_winner" boolean,
  "goals_home" bigint,
  "goals_away" bigint,
  "score_halftime_home" bigint,
  "score_halftime_away" bigint,
  "score_fulltime_home" bigint,
  "score_fulltime_away" bigint,
  "score_extratime_home" text,
  "score_extratime_away" text,
  "score_penalty_home" text,
  "score_penalty_away" text,
  "extracted_at" timestamp,
  "dbt_loaded_at" timestamp
);

drop table if exists futebol.fact_fixture_stats cascade;
create table futebol.fact_fixture_stats (
  "fixture_id" bigint,
  "competition" text,
  "competition_id" bigint,
  "season" bigint,
  "date_utc" date,
  "team_id" bigint,
  "team_name" text,
  "team_side" text,
  "shots_on_goal" bigint,
  "shots_off_goal" bigint,
  "total_shots" bigint,
  "blocked_shots" bigint,
  "shots_insidebox" bigint,
  "shots_outsidebox" bigint,
  "fouls" bigint,
  "corner_kicks" bigint,
  "offsides" bigint,
  "ball_possession" bigint,
  "yellow_cards" bigint,
  "red_cards" bigint,
  "goalkeeper_saves" bigint,
  "total_passes" bigint,
  "passes_accurate" bigint,
  "passes_pct" bigint,
  "expected_goals" double precision,
  "goals_prevented" double precision,
  "extracted_at" timestamp,
  "dbt_loaded_at" timestamp
);

drop table if exists futebol.fact_fixture_events cascade;
create table futebol.fact_fixture_events (
  "fixture_id" bigint,
  "competition" text,
  "competition_id" bigint,
  "season" bigint,
  "date_utc" date,
  "event_order" bigint,
  "minute" bigint,
  "minute_extra" bigint,
  "team_id" bigint,
  "team_name" text,
  "team_side" text,
  "player_id" bigint,
  "player_name" text,
  "assist_player_id" bigint,
  "assist_player_name" text,
  "event_type" text,
  "event_detail" text,
  "event_comments" text,
  "extracted_at" timestamp,
  "dbt_loaded_at" timestamp
);

drop table if exists futebol.fact_fixture_lineups cascade;
create table futebol.fact_fixture_lineups (
  "fixture_id" bigint,
  "competition" text,
  "competition_id" bigint,
  "season" bigint,
  "date_utc" date,
  "team_id" bigint,
  "team_name" text,
  "team_side" text,
  "formation" text,
  "coach_id" bigint,
  "coach_name" text,
  "lineup_phase" text,
  "extracted_at" timestamp,
  "dbt_loaded_at" timestamp
);

drop table if exists futebol.fact_fixture_lineups_players cascade;
create table futebol.fact_fixture_lineups_players (
  "fixture_id" bigint,
  "competition" text,
  "competition_id" bigint,
  "season" bigint,
  "date_utc" date,
  "team_id" bigint,
  "team_name" text,
  "team_side" text,
  "is_starter" boolean,
  "player_slot" bigint,
  "player_id" bigint,
  "player_name" text,
  "shirt_number" bigint,
  "position" text,
  "grid" text,
  "lineup_phase" text,
  "extracted_at" timestamp,
  "dbt_loaded_at" timestamp
);

drop table if exists futebol.fact_fixture_player_stats cascade;
create table futebol.fact_fixture_player_stats (
  "fixture_id" bigint,
  "competition" text,
  "competition_id" bigint,
  "season" bigint,
  "date_utc" date,
  "team_id" bigint,
  "team_name" text,
  "team_side" text,
  "player_id" bigint,
  "player_name" text,
  "position" text,
  "shirt_number" bigint,
  "minutes" bigint,
  "rating" double precision,
  "is_captain" boolean,
  "is_substitute" boolean,
  "shots_total" bigint,
  "shots_on" bigint,
  "goals_total" bigint,
  "goals_conceded" bigint,
  "assists" bigint,
  "saves" bigint,
  "offsides" bigint,
  "passes_total" bigint,
  "passes_key" bigint,
  "passes_accuracy" bigint,
  "tackles_total" bigint,
  "tackles_blocks" bigint,
  "interceptions" bigint,
  "duels_total" bigint,
  "duels_won" bigint,
  "dribbles_attempts" bigint,
  "dribbles_success" bigint,
  "dribbles_past" bigint,
  "fouls_drawn" bigint,
  "fouls_committed" bigint,
  "yellow_cards" bigint,
  "red_cards" bigint,
  "penalty_won" bigint,
  "penalty_committed" bigint,
  "penalty_scored" bigint,
  "penalty_missed" bigint,
  "penalty_saved" bigint,
  "extracted_at" timestamp,
  "dbt_loaded_at" timestamp
);

drop table if exists futebol.fact_h2h cascade;
create table futebol.fact_h2h (
  "h2h_pair_key" text,
  "fixture_id" bigint,
  "competition" text,
  "competition_id" bigint,
  "season" bigint,
  "round" text,
  "date_utc" date,
  "kickoff_utc" timestamp,
  "timestamp_unix" bigint,
  "timezone" text,
  "status_long" text,
  "status_short" text,
  "status_elapsed" bigint,
  "referee" text,
  "venue_id" bigint,
  "venue_name" text,
  "venue_city" text,
  "home_team_id" bigint,
  "home_team_name" text,
  "home_team_winner" boolean,
  "away_team_id" bigint,
  "away_team_name" text,
  "away_team_winner" boolean,
  "goals_home" bigint,
  "goals_away" bigint,
  "score_halftime_home" bigint,
  "score_halftime_away" bigint,
  "score_fulltime_home" bigint,
  "score_fulltime_away" bigint,
  "score_extratime_home" text,
  "score_extratime_away" text,
  "score_penalty_home" text,
  "score_penalty_away" text,
  "extracted_at" timestamp,
  "dbt_loaded_at" timestamp
);

drop table if exists futebol.fact_injuries_snapshot cascade;
create table futebol.fact_injuries_snapshot (
  "competition" text,
  "league_id" bigint,
  "season" bigint,
  "snapshot_date" date,
  "team_id" bigint,
  "team_name" text,
  "team_logo" text,
  "player_id" bigint,
  "player_name" text,
  "player_photo" text,
  "fixture_id" bigint,
  "fixture_date" timestamp,
  "injury_type" text,
  "injury_reason" text,
  "extracted_at" timestamp,
  "dbt_loaded_at" timestamp
);

drop table if exists futebol.fact_standings_snapshot cascade;
create table futebol.fact_standings_snapshot (
  "competition" text,
  "league_id" bigint,
  "season" bigint,
  "snapshot_date" date,
  "team_id" bigint,
  "team_name" text,
  "team_logo" text,
  "rank" bigint,
  "points" bigint,
  "goals_diff" bigint,
  "group_name" text,
  "form" text,
  "rank_status" text,
  "rank_description" text,
  "standings_updated_at" timestamp,
  "played_total" bigint,
  "wins_total" bigint,
  "draws_total" bigint,
  "loses_total" bigint,
  "goals_for_total" bigint,
  "goals_against_total" bigint,
  "played_home" bigint,
  "wins_home" bigint,
  "draws_home" bigint,
  "loses_home" bigint,
  "goals_for_home" bigint,
  "goals_against_home" bigint,
  "played_away" bigint,
  "wins_away" bigint,
  "draws_away" bigint,
  "loses_away" bigint,
  "goals_for_away" bigint,
  "goals_against_away" bigint,
  "extracted_at" timestamp,
  "dbt_loaded_at" timestamp
);

drop table if exists futebol.fact_team_season_stats cascade;
create table futebol.fact_team_season_stats (
  "team_id" bigint,
  "team_name" text,
  "competition" text,
  "competition_id" bigint,
  "season" bigint,
  "snapshot_date" date,
  "form" text,
  "played_home" bigint,
  "played_away" bigint,
  "played_total" bigint,
  "wins_home" bigint,
  "wins_away" bigint,
  "wins_total" bigint,
  "draws_home" bigint,
  "draws_away" bigint,
  "draws_total" bigint,
  "loses_home" bigint,
  "loses_away" bigint,
  "loses_total" bigint,
  "goals_for_home" bigint,
  "goals_for_away" bigint,
  "goals_for_total" bigint,
  "goals_for_avg_home" double precision,
  "goals_for_avg_away" double precision,
  "goals_for_avg_total" double precision,
  "goals_against_home" bigint,
  "goals_against_away" bigint,
  "goals_against_total" bigint,
  "goals_against_avg_home" double precision,
  "goals_against_avg_away" double precision,
  "goals_against_avg_total" double precision,
  "clean_sheet_home" bigint,
  "clean_sheet_away" bigint,
  "clean_sheet_total" bigint,
  "failed_to_score_home" bigint,
  "failed_to_score_away" bigint,
  "failed_to_score_total" bigint,
  "biggest_streak_wins" bigint,
  "biggest_streak_draws" bigint,
  "biggest_streak_loses" bigint,
  "biggest_win_home" text,
  "biggest_win_away" text,
  "biggest_lose_home" text,
  "biggest_lose_away" text,
  "biggest_goals_for_home" bigint,
  "biggest_goals_for_away" bigint,
  "biggest_goals_against_home" bigint,
  "biggest_goals_against_away" bigint,
  "penalty_scored_total" bigint,
  "penalty_scored_pct" double precision,
  "penalty_missed_total" bigint,
  "penalty_missed_pct" double precision,
  "penalty_total" bigint,
  "extracted_at" timestamp,
  "dbt_loaded_at" timestamp
);

drop table if exists futebol.fact_odds_snapshot cascade;
create table futebol.fact_odds_snapshot (
  "competition" text,
  "league_id" bigint,
  "season" bigint,
  "fixture_id" bigint,
  "kickoff_utc" timestamp,
  "collection_window" text,
  "collection_timestamp" timestamp,
  "collection_date" date,
  "minutes_to_kickoff" bigint,
  "bookmaker_id" bigint,
  "bookmaker_name" text,
  "market_id" bigint,
  "market_name" text,
  "outcome_label" text,
  "outcome_side" text,
  "line_value" double precision,
  "odd_decimal" double precision,
  "api_update" timestamp,
  "extracted_at" timestamp,
  "dbt_loaded_at" timestamp
);

drop table if exists futebol.fact_predictions_api cascade;
create table futebol.fact_predictions_api (
  "competition" text,
  "league_id" bigint,
  "season" bigint,
  "fixture_id" bigint,
  "kickoff_utc" timestamp,
  "collection_window" text,
  "collection_timestamp" timestamp,
  "collection_date" date,
  "minutes_to_kickoff" bigint,
  "predicted_winner_team_id" bigint,
  "predicted_winner_name" text,
  "predicted_winner_comment" text,
  "predicted_win_or_draw" boolean,
  "predicted_under_over" double precision,
  "predicted_goals_home" double precision,
  "predicted_goals_away" double precision,
  "advice" text,
  "prob_home_pct" double precision,
  "prob_draw_pct" double precision,
  "prob_away_pct" double precision,
  "comparison_form_home" double precision,
  "comparison_form_away" double precision,
  "comparison_att_home" double precision,
  "comparison_att_away" double precision,
  "comparison_def_home" double precision,
  "comparison_def_away" double precision,
  "comparison_poisson_home" double precision,
  "comparison_poisson_away" double precision,
  "comparison_h2h_home" double precision,
  "comparison_h2h_away" double precision,
  "comparison_goals_home" double precision,
  "comparison_goals_away" double precision,
  "comparison_total_home" double precision,
  "comparison_total_away" double precision,
  "extracted_at" timestamp,
  "dbt_loaded_at" timestamp
);

drop table if exists futebol.int_futebol_odds_devig cascade;
create table futebol.int_futebol_odds_devig (
  "fixture_id" bigint,
  "competition" text,
  "season" bigint,
  "market_id" bigint,
  "outcome_side" text,
  "line_value" double precision,
  "janela_usada" text,
  "best_odd" double precision,
  "best_book" text,
  "avg_odd" double precision,
  "avg_odd_ex_best" double precision,
  "n_casas" bigint,
  "prob_justa_fechamento" double precision,
  "booksum_fechamento" double precision,
  "pin_n_outcomes" bigint,
  "n_outcomes_valor" bigint,
  "valor_fonte" text,
  "edge" double precision,
  "pts_valor" bigint,
  "pen_odd_outlier" boolean,
  "pen_poucas_casas" boolean,
  "pen_odd_longshot" boolean,
  "pen_odd_juice" boolean,
  "penalidades_globais_pts" bigint,
  "linha_sharp_confirma" boolean,
  "dbt_loaded_at" timestamp
);

drop table if exists futebol.int_futebol_premissas_1x2 cascade;
create table futebol.int_futebol_premissas_1x2 (
  "fixture_id" bigint,
  "competition" text,
  "season" bigint,
  "outcome" text,
  "forca_mismatch" boolean,
  "superioridade_xg" boolean,
  "mando" boolean,
  "pts_mando" bigint,
  "desfalque_adversario" boolean,
  "superioridade_tabela" boolean,
  "forma" boolean,
  "h2h_favoravel" boolean,
  "pick_empate" boolean,
  "desfalque_proprio" boolean,
  "s_missing" bigint,
  "pts_premissas" bigint,
  "penalidades_1x2_pts" bigint,
  "dbt_loaded_at" timestamp,
  "premissas_sem_dado" bigint
);

drop table if exists futebol.int_futebol_premissas_ou cascade;
create table futebol.int_futebol_premissas_ou (
  "fixture_id" bigint,
  "competition" text,
  "season" bigint,
  "outcome" text,
  "line_value" double precision,
  "ataque_combinado" boolean,
  "defesas_vazaveis" boolean,
  "xg_combinado_alto" boolean,
  "ritmo_alto" boolean,
  "ambos_vazam" boolean,
  "historico_over" boolean,
  "defesas_firmes" boolean,
  "clean_sheets_altos" boolean,
  "xg_baixo_combinado" boolean,
  "ataques_fracos" boolean,
  "historico_under" boolean,
  "linha_extrema" boolean,
  "pts_premissas" bigint,
  "penalidades_ou_pts" bigint,
  "dbt_loaded_at" timestamp,
  "premissas_sem_dado" bigint
);

drop table if exists futebol.int_futebol_premissas_ah cascade;
create table futebol.int_futebol_premissas_ah (
  "fixture_id" bigint,
  "competition" text,
  "season" bigint,
  "outcome" text,
  "line_value" double precision,
  "side_handicap" double precision,
  "is_favorito" boolean,
  "is_azarao" boolean,
  "supremacia" boolean,
  "tende_golear" boolean,
  "adversario_fragil_fora" boolean,
  "mando_forte" boolean,
  "sem_rodizio" boolean,
  "raramente_perde_por_2" boolean,
  "defesa_fora_solida" boolean,
  "favorito_irregular" boolean,
  "handicap_alto" boolean,
  "pts_premissas" bigint,
  "penalidades_ah_pts" bigint,
  "dbt_loaded_at" timestamp,
  "premissas_sem_dado" bigint
);

drop table if exists futebol.int_futebol_premissas_btts cascade;
create table futebol.int_futebol_premissas_btts (
  "fixture_id" bigint,
  "competition" text,
  "season" bigint,
  "outcome" text,
  "ambos_marcam" boolean,
  "ataque_dos_dois" boolean,
  "defesas_vazaveis" boolean,
  "historico_btts" boolean,
  "defesa_forte" boolean,
  "ataque_trava" boolean,
  "historico_seco" boolean,
  "pts_premissas" bigint,
  "penalidades_btts_pts" bigint,
  "dbt_loaded_at" timestamp,
  "premissas_sem_dado" bigint
);

drop table if exists futebol.int_futebol_premissas_dc cascade;
create table futebol.int_futebol_premissas_dc (
  "fixture_id" bigint,
  "competition" text,
  "season" bigint,
  "outcome" text,
  "lado_coberto_forte" boolean,
  "equilibrio_defensivo" boolean,
  "adversario_limitado" boolean,
  "invicto_recente" boolean,
  "pts_premissas" bigint,
  "penalidades_dc_pts" bigint,
  "dbt_loaded_at" timestamp,
  "premissas_sem_dado" bigint
);

drop table if exists futebol.fact_value_opportunities cascade;
create table futebol.fact_value_opportunities (
  "fixture_id" bigint,
  "market" text,
  "outcome" text,
  "line_value" double precision,
  "competition" text,
  "season" bigint,
  "edge" double precision,
  "pts_valor" bigint,
  "pts_premissas" bigint,
  "pts_corroboracao" bigint,
  "penalidades" bigint,
  "score" bigint,
  "faixa" text,
  "best_odd" double precision,
  "best_book" text,
  "avg_odd" double precision,
  "n_casas" bigint,
  "prob_justa_fechamento" double precision,
  "valor_fonte" text,
  "janela_usada" text,
  "penalidades_globais_pts" bigint,
  "penalidades_especificas_pts" bigint,
  "modelo_api_concorda" boolean,
  "linha_sharp_confirma" boolean,
  "pin_n_outcomes" bigint,
  "is_half_line" boolean,
  "dbt_loaded_at" timestamp,
  "premissas_sem_dado" bigint,
  -- AE#87 (19/08/2026): as 4 flags de penalidade publicadas pelo mart, para a
  -- RPC ler em vez de rederivar do int_futebol_odds_devig (issue #267)
  "pen_odd_outlier" boolean,
  "pen_poucas_casas" boolean,
  "pen_odd_longshot" boolean,
  "pen_odd_juice" boolean,
  -- Escala do Score (spec #301): legacy ou contexto_v1. Nunca nulo.
  -- No fim de proposito: a migration 112 entra por alter table add column, que
  -- acrescenta no fim, e as duas provisoes precisam ter a mesma ordem de coluna.
  "score_versao" text not null default 'legacy'
);

-- ── 2a. Infra do sync: estado incremental (o Cloud Run sync lê/escreve aqui) ──
-- IF NOT EXISTS de propósito: guarda o watermark do último sync — não dropar.
create table if not exists futebol._sync_state (
  "table_name" text primary key,
  "last_synced_bq_modified_time" timestamptz,
  "last_synced_at" timestamptz
);

-- Histórico append-only (dbt snapshot, strategy=check) de fact_value_opportunities —
-- preserva o pick de t24h/t1h mesmo depois que o mart (full-refresh) sobrescreve com t15m.
drop table if exists futebol.fact_value_opportunities_hist cascade;
create table futebol.fact_value_opportunities_hist (
  "opportunity_key" text,
  "fixture_id" bigint,
  "market" text,
  "outcome" text,
  "line_value" double precision,
  "competition" text,
  "season" bigint,
  "edge" double precision,
  "pts_valor" bigint,
  "pts_premissas" bigint,
  "pts_corroboracao" bigint,
  "penalidades" bigint,
  "score" bigint,
  "faixa" text,
  "best_odd" double precision,
  "best_book" text,
  "avg_odd" double precision,
  "n_casas" bigint,
  "prob_justa_fechamento" double precision,
  "valor_fonte" text,
  "janela_usada" text,
  "penalidades_globais_pts" bigint,
  "penalidades_especificas_pts" bigint,
  "modelo_api_concorda" boolean,
  "linha_sharp_confirma" boolean,
  "pin_n_outcomes" bigint,
  "is_half_line" boolean,
  "dbt_loaded_at" timestamp,
  "dbt_scd_id" text,
  "dbt_updated_at" timestamp,
  "dbt_valid_from" timestamp,
  "dbt_valid_to" timestamp,
  "premissas_sem_dado" bigint,
  -- AE#87 (19/08/2026): as 4 flags de penalidade publicadas pelo mart, para a
  -- RPC ler em vez de rederivar do int_futebol_odds_devig (issue #267)
  "pen_odd_outlier" boolean,
  "pen_poucas_casas" boolean,
  "pen_odd_longshot" boolean,
  "pen_odd_juice" boolean,
  -- Escala do Score (spec #301): legacy ou contexto_v1. Nunca nulo.
  -- No fim de proposito: a migration 112 entra por alter table add column, que
  -- acrescenta no fim, e as duas provisoes precisam ter a mesma ordem de coluna.
  "score_versao" text not null default 'legacy'
);

-- ── 2b. Lockdown RPC-only (espelha nba_mart): acesso só via RPCs security definer
revoke all on schema futebol from anon, authenticated;
revoke all on all tables in schema futebol from anon, authenticated;

-- ── 3. Índices (performance das RPCs) ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS dim_teams_team_id_idx ON futebol.dim_teams USING btree (team_id);
CREATE INDEX IF NOT EXISTS fact_fixture_events_fixture_id_idx ON futebol.fact_fixture_events USING btree (fixture_id);
CREATE INDEX IF NOT EXISTS fact_fixture_lineups_fixture_id_idx ON futebol.fact_fixture_lineups USING btree (fixture_id);
CREATE INDEX IF NOT EXISTS fact_fixture_lineups_players_fixture_id_idx ON futebol.fact_fixture_lineups_players USING btree (fixture_id);
CREATE INDEX IF NOT EXISTS fact_fixture_player_stats_fixture_id_idx ON futebol.fact_fixture_player_stats USING btree (fixture_id);
CREATE INDEX IF NOT EXISTS fact_fixture_stats_fixture_id_idx ON futebol.fact_fixture_stats USING btree (fixture_id);
CREATE INDEX IF NOT EXISTS fact_fixtures_away_team_id_idx ON futebol.fact_fixtures USING btree (away_team_id);
CREATE INDEX IF NOT EXISTS fact_fixtures_competition_season_round_idx ON futebol.fact_fixtures USING btree (competition, season, round);
CREATE INDEX IF NOT EXISTS fact_fixtures_fixture_id_idx ON futebol.fact_fixtures USING btree (fixture_id);
CREATE INDEX IF NOT EXISTS fact_fixtures_home_team_id_idx ON futebol.fact_fixtures USING btree (home_team_id);
-- Janela de data das RPCs de histórico (migration 102): a tabela não tinha
-- índice em kickoff_utc e o planner varria as 10,5k linhas. Medido: a seleção
-- PIT de 30 dias caiu de 85 ms para 6,3 ms.
CREATE INDEX IF NOT EXISTS fact_fixtures_kickoff_utc_idx ON futebol.fact_fixtures USING btree (kickoff_utc);
CREATE INDEX IF NOT EXISTS fact_h2h_h2h_pair_key_idx ON futebol.fact_h2h USING btree (h2h_pair_key);
CREATE INDEX IF NOT EXISTS fact_injuries_snapshot_fixture_id_idx ON futebol.fact_injuries_snapshot USING btree (fixture_id);
CREATE INDEX IF NOT EXISTS fact_odds_snapshot_fixture_id_idx ON futebol.fact_odds_snapshot USING btree (fixture_id);
CREATE INDEX IF NOT EXISTS fact_odds_snapshot_fixture_id_market_name_outcome_label_idx ON futebol.fact_odds_snapshot USING btree (fixture_id, market_name, outcome_label);
CREATE INDEX IF NOT EXISTS fact_predictions_api_fixture_id_idx ON futebol.fact_predictions_api USING btree (fixture_id);
CREATE INDEX IF NOT EXISTS fact_standings_snapshot_competition_season_snapshot_date_idx ON futebol.fact_standings_snapshot USING btree (competition, season, snapshot_date);
CREATE INDEX IF NOT EXISTS fact_standings_snapshot_team_id_idx ON futebol.fact_standings_snapshot USING btree (team_id);
CREATE INDEX IF NOT EXISTS fact_team_season_stats_team_id_competition_season_idx ON futebol.fact_team_season_stats USING btree (team_id, competition, season);
CREATE INDEX IF NOT EXISTS fact_value_opportunities_fixture_id_idx ON futebol.fact_value_opportunities USING btree (fixture_id);
CREATE INDEX IF NOT EXISTS fact_value_opportunities_hist_fixture_id_idx ON futebol.fact_value_opportunities_hist USING btree (fixture_id);
CREATE INDEX IF NOT EXISTS fact_value_opportunities_hist_opportunity_key_idx ON futebol.fact_value_opportunities_hist USING btree (opportunity_key);
CREATE INDEX IF NOT EXISTS int_futebol_premissas_1x2_fixture_id_outcome_idx ON futebol.int_futebol_premissas_1x2 USING btree (fixture_id, outcome);
CREATE INDEX IF NOT EXISTS int_futebol_premissas_ou_fixture_id_outcome_line_value_idx ON futebol.int_futebol_premissas_ou USING btree (fixture_id, outcome, line_value);

-- ── 4. Helper(s) das RPCs (security definer) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public._futebol_team_form(p_team_id bigint, p_competition text, p_season bigint, p_before date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v jsonb;
begin
  select jsonb_agg(jsonb_build_object(
           'fixture_id', g.fixture_id, 'date_utc', g.date_utc, 'opponent', g.opponent,
           'side', g.side, 'goals_for', g.gf, 'goals_against', g.ga, 'result', g.result
         ) order by g.date_utc desc) into v
  from (
    select f.fixture_id, f.date_utc, f.away_team_name as opponent, 'home' as side,
           f.goals_home as gf, f.goals_away as ga,
           case when f.goals_home > f.goals_away then 'W'
                when f.goals_home = f.goals_away then 'D' else 'L' end as result
    from futebol.fact_fixtures f
    where f.competition = p_competition and f.season = p_season and f.status_short = 'FT'
      and f.date_utc < p_before and f.home_team_id = p_team_id
    union all
    select f.fixture_id, f.date_utc, f.home_team_name as opponent, 'away' as side,
           f.goals_away as gf, f.goals_home as ga,
           case when f.goals_away > f.goals_home then 'W'
                when f.goals_away = f.goals_home then 'D' else 'L' end as result
    from futebol.fact_fixtures f
    where f.competition = p_competition and f.season = p_season and f.status_short = 'FT'
      and f.date_utc < p_before and f.away_team_id = p_team_id
    order by date_utc desc
    limit 5
  ) g;
  return coalesce(v, '[]'::jsonb);
end; $function$

;

-- ── 5. RPCs public.get_futebol_* (security definer; leem futebol.*) ───────────
CREATE OR REPLACE FUNCTION public.get_futebol_access()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_started timestamptz;
  v_status text;
  v_trial_days int := 7;
  v_ends timestamptz;
  v_days_left int;
begin
  -- Deslogado: bloqueado, CTA pra criar conta
  if v_uid is null then
    return jsonb_build_object('state','anon','unlocked',false,'days_left',null,'trial_ends_at',null);
  end if;

  select u.futebol_trial_started_at, coalesce(u.futebol_subscription_status,'free')
    into v_started, v_status
  from public.users u where u.id = v_uid;

  -- Assinante do Futebol: liberado
  if v_status = 'premium' then
    return jsonb_build_object('state','subscribed','unlocked',true,'days_left',null,'trial_ends_at',null);
  end if;

  -- 1º acesso: começa o relógio agora (idempotente)
  if v_started is null then
    update public.users set futebol_trial_started_at = now() where id = v_uid;
    v_started := now();
  end if;

  v_ends := v_started + make_interval(days => v_trial_days);
  v_days_left := greatest(0, ceil(extract(epoch from (v_ends - now())) / 86400.0)::int);

  if now() < v_ends then
    return jsonb_build_object('state','trial','unlocked',true,'days_left',v_days_left,'trial_ends_at',v_ends);
  else
    return jsonb_build_object('state','expired','unlocked',false,'days_left',0,'trial_ends_at',v_ends);
  end if;
end $function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_detail(p_fixture_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return jsonb_build_object(
    'fixture', (
      select to_jsonb(x) from (
        select f.fixture_id, f.competition, f.season, f.round, f.date_utc, f.kickoff_utc,
               f.status_short, f.status_long, f.status_elapsed, f.venue_name, f.venue_city,
               f.home_team_id, f.home_team_name, f.away_team_id, f.away_team_name,
               f.goals_home, f.goals_away, f.score_halftime_home, f.score_halftime_away
        from futebol.fact_fixtures f where f.fixture_id = p_fixture_id limit 1
      ) x
    ),
    'stats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_side', s.team_side, 'team_id', s.team_id, 'team_name', s.team_name,
        'shots_on_goal', s.shots_on_goal, 'shots_off_goal', s.shots_off_goal, 'total_shots', s.total_shots,
        'blocked_shots', s.blocked_shots, 'shots_insidebox', s.shots_insidebox, 'shots_outsidebox', s.shots_outsidebox,
        'fouls', s.fouls, 'corner_kicks', s.corner_kicks, 'offsides', s.offsides,
        'ball_possession', s.ball_possession, 'yellow_cards', s.yellow_cards, 'red_cards', s.red_cards,
        'goalkeeper_saves', s.goalkeeper_saves, 'total_passes', s.total_passes, 'passes_accurate', s.passes_accurate,
        'passes_pct', s.passes_pct, 'expected_goals', s.expected_goals, 'goals_prevented', s.goals_prevented
      ) order by (s.team_side = 'home') desc)
      from futebol.fact_fixture_stats s where s.fixture_id = p_fixture_id
    ), '[]'::jsonb)
  );
end; $function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_extras(p_fixture_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_fix record;
  v_fase_times text;
  v_fase_jogadores text;
begin
  select f.* into v_fix from futebol.fact_fixtures f where f.fixture_id = p_fixture_id limit 1;
  if not found then return jsonb_build_object('events', '[]'::jsonb); end if;

  select case
           when v_fix.kickoff_utc <= (now() at time zone 'UTC')
                and count(*) filter (where lineup_phase = 'real') > 0 then 'real'
           when count(*) filter (where lineup_phase = 'confirmed') > 0 then 'confirmed'
           else 'real' end
    into v_fase_times
    from futebol.fact_fixture_lineups where fixture_id = p_fixture_id;

  select case
           when v_fix.kickoff_utc <= (now() at time zone 'UTC')
                and count(*) filter (where lineup_phase = 'real') > 0 then 'real'
           when count(*) filter (where lineup_phase = 'confirmed') > 0 then 'confirmed'
           else 'real' end
    into v_fase_jogadores
    from futebol.fact_fixture_lineups_players where fixture_id = p_fixture_id;

  return jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'minute', e.minute, 'minute_extra', e.minute_extra, 'team_side', e.team_side,
        'team_name', e.team_name, 'player_name', e.player_name, 'assist_player_name', e.assist_player_name,
        'event_type', e.event_type, 'event_detail', e.event_detail
      ) order by e.minute nulls last, e.event_order)
      from futebol.fact_fixture_events e where e.fixture_id = p_fixture_id
    ), '[]'::jsonb),
    'player_stats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id', p.player_id, 'team_side', p.team_side, 'player_name', p.player_name,
        'minutes', p.minutes, 'rating', p.rating, 'goals', p.goals_total, 'assists', p.assists,
        'shots_total', p.shots_total, 'shots_on', p.shots_on, 'passes_key', p.passes_key,
        'tackles_total', p.tackles_total, 'is_substitute', p.is_substitute
      ))
      from futebol.fact_fixture_player_stats p where p.fixture_id = p_fixture_id
    ), '[]'::jsonb),
    'form_home', public._futebol_team_form(v_fix.home_team_id, v_fix.competition, v_fix.season, v_fix.date_utc),
    'form_away', public._futebol_team_form(v_fix.away_team_id, v_fix.competition, v_fix.season, v_fix.date_utc),
    -- migrations 098 e 103. A C1 do analytics-engineering faz a escalação
    -- `confirmed` (anunciada antes do apito) e a `real` (registro pós-jogo)
    -- COEXISTIREM. Sem filtro de fase, cada time e cada jogador apareceriam
    -- duas vezes: o front pega a formação com `.find()` sobre array sem ordem e
    -- passaria a sortear entre as duas, podendo virar entre dois carregamentos
    -- da mesma página, e o campinho desenharia cada jogador duplicado.
    --
    -- A escolha é por TEMPO, não por existência (103): depois do apito vale
    -- quem entrou em campo. A regra por existência que a 098 trouxe
    -- ("se houver qualquer linha confirmed, use confirmed") vira a tela inteira
    -- com base numa linha só, e a `confirmed` é justamente a que chega
    -- incompleta: medido no dev, 2,0 jogadores por jogo contra 46,5 da `real`.
    --
    -- As duas tabelas decidem SEPARADAS de propósito: elas divergem no dado, e
    -- forçar uma fase comum esvaziaria uma das duas.
    'lineups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', l.team_id, 'team_name', l.team_name, 'team_side', l.team_side,
        'formation', l.formation, 'coach_name', l.coach_name, 'lineup_phase', l.lineup_phase
      ) order by l.team_side) from (
        select team_id, team_name, team_side, formation, coach_name, lineup_phase
        from futebol.fact_fixture_lineups
        where fixture_id = p_fixture_id and lineup_phase = v_fase_times
      ) l
    ), '[]'::jsonb),
    'lineup_players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', lp.team_id, 'team_side', lp.team_side, 'is_starter', lp.is_starter,
        'player_slot', lp.player_slot, 'player_id', lp.player_id, 'player_name', lp.player_name,
        'shirt_number', lp.shirt_number, 'position', lp.position, 'grid', lp.grid,
        'lineup_phase', lp.lineup_phase
      ) order by lp.team_side, lp.is_starter desc nulls last, lp.player_slot) from (
        select team_id, team_side, is_starter, player_slot, player_id, player_name, shirt_number, position, grid, lineup_phase
        from futebol.fact_fixture_lineups_players
        where fixture_id = p_fixture_id and lineup_phase = v_fase_jogadores
      ) lp
    ), '[]'::jsonb)
  );
end; $function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_injuries(p_fixture_id bigint)
 RETURNS TABLE(team_id bigint, player_id bigint, player_name text, injury_type text, injury_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return query
  select distinct on (i.player_id) i.team_id, i.player_id, i.player_name, i.injury_type, i.injury_reason
  from futebol.fact_injuries_snapshot i
  where i.fixture_id = p_fixture_id
  order by i.player_id, i.snapshot_date desc;
end; $function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_odds(p_fixture_id bigint)
 RETURNS TABLE(market_key text, market_label text, outcome_label text, outcome_order integer, line double precision, pinnacle_odd double precision, avg_odd double precision, best_odd double precision, best_book text, n_books integer, pin_open double precision, pin_close double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return query
  with base as (
    select o.market_name, o.outcome_label, o.bookmaker_name, o.collection_window, o.odd_decimal, o.line_value
    from futebol.fact_odds_snapshot o
    where o.fixture_id = p_fixture_id
      and ( o.market_name = 'Match Winner'
         or o.market_name = 'Both Teams Score'
         or o.market_name = 'Double Chance'
         or (o.market_name = 'Goals Over/Under' and o.outcome_label in
             ('Over 0.5','Under 0.5','Over 1.5','Under 1.5','Over 2.5','Under 2.5','Over 3.5','Under 3.5','Over 4.5','Under 4.5'))
         or (o.market_name = 'Asian Handicap' and abs(o.line_value - trunc(o.line_value)) = 0.5 and abs(o.line_value) <= 2.5) )
  ),
  -- migration 097: a janela `daily` (>24h até 7d) entrou em 07/08 e caía no
  -- `else`, empatando com `t24h`. Com empate o DISTINCT ON desempata sozinho e
  -- pode virar entre duas chamadas, sem mudança de dado. Medido no PRD em
  -- 10/08: 27.066 chaves empatadas em 25 fixtures.
  win_rank as ( select *, case when collection_window='t15m' then 4 when collection_window='t1h' then 3 when collection_window='t24h' then 2 when collection_window='daily' then 1 else 0 end wr from base ),
  cur_pick as (
    select distinct on (b.market_name, b.outcome_label, b.bookmaker_name)
      b.market_name, b.outcome_label, b.bookmaker_name, b.odd_decimal, b.line_value
    from win_rank b
    order by b.market_name, b.outcome_label, b.bookmaker_name, b.wr desc
  ),
  agg as (
    select c.market_name, c.outcome_label, max(c.line_value) line_value,
      count(distinct c.bookmaker_name)::int n_books, avg(c.odd_decimal) avg_odd
    from cur_pick c group by c.market_name, c.outcome_label
  ),
  best_bk as (
    select distinct on (c.market_name, c.outcome_label)
      c.market_name, c.outcome_label, c.bookmaker_name best_book, c.odd_decimal best_odd
    from cur_pick c order by c.market_name, c.outcome_label, c.odd_decimal desc
  ),
  pin as (
    select b.market_name, b.outcome_label,
      max(b.odd_decimal) filter (where b.collection_window='t24h') t24,
      max(b.odd_decimal) filter (where b.collection_window='t1h')  t1,
      max(b.odd_decimal) filter (where b.collection_window='t15m') t15
    from base b where b.bookmaker_name = 'Pinnacle'
    group by b.market_name, b.outcome_label
  )
  select
    case a.market_name when 'Match Winner' then 'match_winner'
      when 'Goals Over/Under' then 'over_under'
      when 'Both Teams Score' then 'btts'
      when 'Double Chance' then 'double_chance'
      when 'Asian Handicap' then 'asian_handicap' end,
    a.market_name, a.outcome_label,
    case when a.outcome_label in ('Home','Yes','Home/Draw') or a.outcome_label like 'Over %' or a.outcome_label like 'Home %' then 1
         when a.outcome_label in ('Draw','No','Home/Away') or a.outcome_label like 'Under %' or a.outcome_label like 'Away %' then 2 else 3 end,
    case when a.market_name in ('Goals Over/Under','Asian Handicap') then a.line_value else null end,
    coalesce(p.t15, p.t1, p.t24), a.avg_odd,
    bb.best_odd, bb.best_book, a.n_books, p.t24, coalesce(p.t15, p.t1)
  from agg a
  join best_bk bb on bb.market_name = a.market_name and bb.outcome_label = a.outcome_label
  left join pin p on p.market_name = a.market_name and p.outcome_label = a.outcome_label
  where (a.market_name <> 'Asian Handicap' or a.n_books >= 3)
  order by 1, 5 nulls first, 4;
end $function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_prediction(p_fixture_id bigint)
 RETURNS TABLE(has_prediction boolean, predicted_winner_name text, advice text, prob_home_pct double precision, prob_draw_pct double precision, prob_away_pct double precision, cmp_form_home double precision, cmp_form_away double precision, cmp_att_home double precision, cmp_att_away double precision, cmp_def_home double precision, cmp_def_away double precision, cmp_poisson_home double precision, cmp_poisson_away double precision, cmp_h2h_home double precision, cmp_h2h_away double precision, cmp_goals_home double precision, cmp_goals_away double precision, cmp_total_home double precision, cmp_total_away double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return query
  select
    (p.advice is not null and p.advice <> 'No predictions available'
       and not (p.prob_home_pct = 33 and p.prob_draw_pct = 33 and p.prob_away_pct = 33)) as has_prediction,
    p.predicted_winner_name, p.advice, p.prob_home_pct, p.prob_draw_pct, p.prob_away_pct,
    p.comparison_form_home, p.comparison_form_away,
    p.comparison_att_home, p.comparison_att_away,
    p.comparison_def_home, p.comparison_def_away,
    p.comparison_poisson_home, p.comparison_poisson_away,
    p.comparison_h2h_home, p.comparison_h2h_away,
    p.comparison_goals_home, p.comparison_goals_away,
    p.comparison_total_home, p.comparison_total_away
  from futebol.fact_predictions_api p
  where p.fixture_id = p_fixture_id
  order by p.collection_window desc nulls last
  limit 1;
end $function$

;

-- ── Copy das premissas (migration 106) ──────────────────────────────────────
-- ── A copy das premissas, uma vez só ────────────────────────────────────────
-- Antes desta tabela, o texto de cada premissa existia em DUAS fontes
-- independentes: o catálogo do app (`src/utils/futebol-premissas.ts`), que serve a
-- tela, e a cascata de `case when` dentro destas três RPCs, que serve a DM do
-- Telegram. Medido em 20/08: de 36 premissas presentes nas duas, 27 tinham TEXTO
-- DIFERENTE. Ninguém viu porque nada comparava as duas.
--
-- E a cascata era a TERCEIRA cópia verbatim de si mesma, como o comentário da
-- migration 102 já registrava: "mercado novo agora mexe em três RPCs".
--
-- Agora o catálogo do app é a fonte, esta tabela é a projeção dele no banco, e a
-- guarda `futebol-copy-paridade.test.ts` quebra o PR quando os dois se afastam.
create table if not exists public.futebol_premissa_copy (
  tipo   text    not null check (tipo in ('evidencia', 'contra', 'aviso')),
  market text    not null,
  slug   text    not null,
  -- 'any' é o texto neutro; 'home'/'away' só existem onde a frase muda de verdade.
  mando  text    not null check (mando in ('any', 'home', 'away')),
  -- Posição na fila. É o que conserta o defeito de origem: a DM mostra o PRIMEIRO
  -- item do array, e a ordem da cascata era a ordem em que ela foi escrita. No
  -- azarão do handicap, 12.736 linhas mostravam a premissa de 3 pontos tendo a de
  -- 10 pontos disponível.
  ordem  integer not null,
  texto  text    not null,
  primary key (tipo, market, slug, mando)
);

-- RLS ligada e SEM policy, de propósito: nada acessa esta tabela direto. As três
-- RPCs são SECURITY DEFINER e leem como dono, então a ausência de policy é o que
-- garante que ninguém leia por fora.
alter table public.futebol_premissa_copy enable row level security;

-- Travessão é proibido em copy visível (régua do produto), e cinco dos oito avisos
-- nasceram com um. A regra vira constraint porque regra que depende de alguém ler
-- não é regra.
alter table public.futebol_premissa_copy drop constraint if exists futebol_premissa_copy_sem_travessao;
alter table public.futebol_premissa_copy add  constraint futebol_premissa_copy_sem_travessao
  check (texto not like '%' || chr(8212) || '%' and texto not like '%' || chr(8211) || '%');

-- Semente idempotente: a tabela é uma projeção do catálogo, então ela é reescrita
-- inteira em vez de sofrer upsert linha por linha. Assim premissa REMOVIDA do
-- catálogo também desaparece daqui.
delete from public.futebol_premissa_copy;
insert into public.futebol_premissa_copy (tipo, market, slug, mando, ordem, texto) values
  ('evidencia', 'goals_over_under', 'defesas_firmes', 'any', 1, 'Defesas firmes dos dois lados'),
  ('evidencia', 'goals_over_under', 'defesas_vazaveis', 'any', 2, 'Defesas frágeis dos dois lados'),
  ('evidencia', 'goals_over_under', 'ataque_combinado', 'any', 3, 'Os dois somam muitos gols'),
  ('evidencia', 'goals_over_under', 'xg_baixo_combinado', 'any', 4, 'Os dois criam pouca chance de gol'),
  ('evidencia', 'goals_over_under', 'xg_combinado_alto', 'any', 5, 'Os dois criam muita chance de gol'),
  ('evidencia', 'goals_over_under', 'clean_sheets_altos', 'any', 6, 'Os dois passam muitos jogos sem sofrer gol'),
  ('evidencia', 'goals_over_under', 'ataques_fracos', 'any', 7, 'Ataques fracos dos dois lados'),
  ('evidencia', 'goals_over_under', 'historico_under', 'any', 8, 'Histórico de jogo com poucos gols'),
  ('evidencia', 'goals_over_under', 'ambos_vazam', 'any', 9, 'Os dois sofrem gol quase todo jogo'),
  ('evidencia', 'goals_over_under', 'ritmo_alto', 'any', 10, 'Jogo de ritmo alto'),
  ('evidencia', 'goals_over_under', 'historico_over', 'any', 11, 'Histórico de jogo com muitos gols'),
  ('contra', 'goals_over_under', 'defesas_firmes', 'any', 1, 'A solidez das defesas não entrou como sinal a favor'),
  ('contra', 'goals_over_under', 'ataque_combinado', 'any', 2, 'O ataque dos dois times não entrou como sinal a favor'),
  ('contra', 'goals_over_under', 'xg_baixo_combinado', 'any', 3, 'O baixo volume de chances não entrou como sinal a favor'),
  ('contra', 'goals_over_under', 'xg_combinado_alto', 'any', 4, 'O alto volume de chances não entrou como sinal a favor'),
  ('contra', 'goals_over_under', 'clean_sheets_altos', 'any', 5, 'Os jogos sem sofrer gol não entraram como sinal a favor'),
  ('contra', 'goals_over_under', 'ritmo_alto', 'any', 6, 'O ritmo do jogo não entrou como sinal a favor'),
  ('aviso', 'goals_over_under', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'goals_over_under', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'goals_over_under', 'pen_poucas_casas', 'any', 3, 'Poucas casas cotando esse mercado'),
  ('aviso', 'goals_over_under', 'pen_odd_juice', 'any', 4, 'Odd baixa, retorno pequeno pro risco'),
  ('aviso', 'goals_over_under', 'linha_extrema', 'any', 5, 'Linha muito longe do normal'),
  ('evidencia', 'match_winner', 'forma', 'any', 1, 'Em boa fase, vem ganhando'),
  ('evidencia', 'match_winner', 'mando', 'any', 2, 'Mando relevante'),
  ('evidencia', 'match_winner', 'mando', 'home', 2, 'Manda bem em casa'),
  ('evidencia', 'match_winner', 'mando', 'away', 2, 'Vai bem fora de casa'),
  ('evidencia', 'match_winner', 'superioridade_tabela', 'any', 3, 'Bem à frente na tabela'),
  ('evidencia', 'match_winner', 'forca_mismatch', 'any', 4, 'Ataque forte contra defesa frágil do adversário'),
  ('evidencia', 'match_winner', 'superioridade_xg', 'any', 5, 'Cria mais chances de gol que o adversário'),
  ('evidencia', 'match_winner', 'h2h_favoravel', 'any', 6, 'Leva vantagem no histórico do confronto'),
  ('evidencia', 'match_winner', 'desfalque_adversario', 'any', 7, 'Adversário com desfalque de titular importante'),
  ('contra', 'match_winner', 'mando', 'home', 1, 'Em casa, o mando não entrou como sinal a favor'),
  ('contra', 'match_winner', 'mando', 'away', 1, 'Fora de casa, o mando não entrou como sinal a favor'),
  ('contra', 'match_winner', 'superioridade_tabela', 'any', 2, 'A posição na tabela não entrou como sinal a favor'),
  ('contra', 'match_winner', 'forca_mismatch', 'any', 3, 'O duelo entre ataque e defesa não entrou como sinal a favor'),
  ('aviso', 'match_winner', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'match_winner', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'match_winner', 'desfalque_proprio', 'any', 3, 'Time apostado com desfalque de titular importante'),
  ('aviso', 'match_winner', 'pen_poucas_casas', 'any', 4, 'Poucas casas cotando esse mercado'),
  ('aviso', 'match_winner', 'pen_odd_juice', 'any', 5, 'Odd baixa, retorno pequeno pro risco'),
  ('aviso', 'match_winner', 'pick_empate', 'any', 6, 'Empate é o resultado mais difícil de prever'),
  ('evidencia', 'asian_handicap', 'tende_golear', 'any', 1, 'Costuma ganhar por muitos gols'),
  ('evidencia', 'asian_handicap', 'supremacia', 'any', 2, 'Muito superior ao adversário'),
  ('evidencia', 'asian_handicap', 'defesa_fora_solida', 'any', 3, 'Defesa sólida jogando fora'),
  ('evidencia', 'asian_handicap', 'defesa_fora_solida', 'home', 3, 'Defesa sólida em casa'),
  ('evidencia', 'asian_handicap', 'sem_rodizio', 'any', 4, 'Deve entrar com força máxima'),
  ('evidencia', 'asian_handicap', 'raramente_perde_por_2', 'any', 5, 'Quando perde, perde apertado'),
  ('evidencia', 'asian_handicap', 'adversario_fragil_fora', 'any', 6, 'Adversário fraco fora de casa'),
  ('evidencia', 'asian_handicap', 'adversario_fragil_fora', 'away', 6, 'Adversário fraco em casa'),
  ('evidencia', 'asian_handicap', 'mando_forte', 'any', 7, 'Manda muito bem em casa'),
  ('evidencia', 'asian_handicap', 'mando_forte', 'away', 7, 'Vai muito bem fora de casa'),
  ('contra', 'asian_handicap', 'tende_golear', 'any', 1, 'A margem das vitórias não entrou como sinal a favor'),
  ('contra', 'asian_handicap', 'supremacia', 'any', 2, 'A superioridade sobre o adversário não entrou como sinal a favor'),
  ('contra', 'asian_handicap', 'defesa_fora_solida', 'any', 3, 'A solidez defensiva não entrou como sinal a favor'),
  ('contra', 'asian_handicap', 'defesa_fora_solida', 'home', 3, 'Em casa, a solidez defensiva não entrou como sinal a favor'),
  ('contra', 'asian_handicap', 'raramente_perde_por_2', 'any', 4, 'A margem das derrotas não entrou como sinal a favor'),
  ('aviso', 'asian_handicap', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'asian_handicap', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'asian_handicap', 'pen_poucas_casas', 'any', 3, 'Poucas casas cotando esse mercado'),
  ('aviso', 'asian_handicap', 'pen_odd_juice', 'any', 4, 'Odd baixa, retorno pequeno pro risco'),
  ('aviso', 'asian_handicap', 'handicap_alto', 'any', 5, 'Handicap muito alto'),
  ('evidencia', 'btts', 'ambos_marcam', 'any', 1, 'Os dois costumam marcar'),
  ('evidencia', 'btts', 'ataque_dos_dois', 'any', 2, 'Os dois atacam bem'),
  ('evidencia', 'btts', 'defesas_vazaveis', 'any', 3, 'Defesas frágeis dos dois lados'),
  ('evidencia', 'btts', 'defesa_forte', 'any', 4, 'Defesa forte de um dos lados'),
  ('evidencia', 'btts', 'ataque_trava', 'any', 5, 'Um dos ataques costuma passar em branco'),
  ('evidencia', 'btts', 'historico_btts', 'any', 6, 'Nos últimos jogos, os dois marcaram'),
  ('evidencia', 'btts', 'historico_seco', 'any', 7, 'Jogos recentes sem os dois marcarem'),
  ('contra', 'btts', 'ambos_marcam', 'any', 1, 'Os gols dos dois times não entraram como sinal a favor'),
  ('contra', 'btts', 'defesas_vazaveis', 'any', 2, 'A fragilidade das defesas não entrou como sinal a favor'),
  ('contra', 'btts', 'defesa_forte', 'any', 3, 'A força defensiva não entrou como sinal a favor'),
  ('contra', 'btts', 'ataque_trava', 'any', 4, 'A limitação ofensiva não entrou como sinal a favor'),
  ('aviso', 'btts', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'btts', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'btts', 'pen_poucas_casas', 'any', 3, 'Poucas casas cotando esse mercado'),
  ('aviso', 'btts', 'pen_odd_juice', 'any', 4, 'Odd baixa, retorno pequeno pro risco'),
  ('evidencia', 'double_chance', 'lado_coberto_forte', 'any', 1, 'O lado coberto é forte'),
  ('evidencia', 'double_chance', 'equilibrio_defensivo', 'any', 2, 'Equilíbrio defensivo'),
  ('evidencia', 'double_chance', 'adversario_limitado', 'any', 3, 'Adversário com campanha fraca'),
  ('evidencia', 'double_chance', 'invicto_recente', 'any', 4, 'Invicto nos últimos jogos'),
  ('contra', 'double_chance', 'lado_coberto_forte', 'any', 1, 'A força do lado coberto não entrou como sinal a favor'),
  ('contra', 'double_chance', 'adversario_limitado', 'any', 2, 'A campanha do adversário não entrou como sinal a favor'),
  ('aviso', 'double_chance', 'pen_odd_outlier', 'any', 1, 'Só uma casa paga essa odd, pode ser linha furada'),
  ('aviso', 'double_chance', 'pen_odd_longshot', 'any', 2, 'Odd alta de zebra, entra com cautela'),
  ('aviso', 'double_chance', 'pen_poucas_casas', 'any', 3, 'Poucas casas cotando esse mercado'),
  ('aviso', 'double_chance', 'pen_odd_juice', 'any', 4, 'Odd baixa, retorno pequeno pro risco');

-- ── Os dois helpers ─────────────────────────────────────────────────────────
-- Junta num objeto só tudo que pode acender numa linha, e resolve a precedência da
-- corroboração.
--
-- O nome da coluna booleana nas tabelas de premissa É o slug, então não existe
-- cascata de `case when` para escrever: as chaves do jsonb já são os slugs. É por
-- isso que a premissa nova passa a custar uma linha de semente e nada mais.
--
-- A corroboração é o único caso que não é "slug aceso vira texto": são dois sinais
-- e três frases (as duas individuais e uma combinada). As três chaves saem daqui
-- já resolvidas, e por vir DEPOIS no `||` elas vencem as do `v`.
create or replace function public.futebol_flags(
  p_v jsonb, p_p jsonb, p_o jsonb, p_ah jsonb, p_bt jsonb, p_dc jsonb
) returns jsonb
 language sql
 immutable
 set search_path to ''
as $function$
  select coalesce(p_v, '{}'::jsonb)
      || coalesce(p_p, '{}'::jsonb)
      || coalesce(p_o, '{}'::jsonb)
      || coalesce(p_ah, '{}'::jsonb)
      || coalesce(p_bt, '{}'::jsonb)
      || coalesce(p_dc, '{}'::jsonb)
      || jsonb_build_object(
           'corroboracao_ambos',
             coalesce((p_v->>'modelo_api_concorda')::boolean, false)
             and coalesce((p_v->>'linha_sharp_confirma')::boolean, false),
           'modelo_api_concorda',
             coalesce((p_v->>'modelo_api_concorda')::boolean, false)
             and not coalesce((p_v->>'linha_sharp_confirma')::boolean, false),
           'linha_sharp_confirma',
             coalesce((p_v->>'linha_sharp_confirma')::boolean, false)
             and not coalesce((p_v->>'modelo_api_concorda')::boolean, false)
         )
$function$;

-- Traduz as flags acesas para a copy, na ordem certa.
--
-- `contra` procura 'false' em vez de 'true', e é por isso que NULL não gera contra:
-- em jsonb um booleano nulo vira null, que não casa com 'false'. É o mesmo
-- comportamento do `not coalesce(x, true)` que a cascata usava, e continua honrando
-- a ADR 0003 (dado faltante diagnostica, não elimina).
--
-- O `distinct on` com o desempate pelo mando escolhe a variante específica quando
-- ela existe e cai no texto neutro quando não existe.
create or replace function public.futebol_copy(
  p_tipo text, p_market text, p_mando text, p_flags jsonb
) returns text[]
 language sql
 stable
 set search_path to ''
as $function$
  select coalesce(array_agg(t.texto order by t.ordem), array[]::text[])
  from (
    select distinct on (c.slug) c.ordem, c.texto
    from public.futebol_premissa_copy c
    join jsonb_each_text(p_flags) f on f.key = c.slug
    where c.tipo = p_tipo
      and c.market = p_market
      and c.mando in ('any', coalesce(p_mando, 'any'))
      and f.value = case when p_tipo = 'contra' then 'false' else 'true' end
    order by c.slug, (c.mando <> 'any') desc
  ) t
$function$;

grant execute on function public.futebol_flags(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to anon, authenticated, service_role;
grant execute on function public.futebol_copy(text, text, text, jsonb) to anon, authenticated, service_role;

-- O retorno tabular mudou na virada do Score de contexto, e o Postgres recusa
-- `create or replace` que altere o RETURNS TABLE. Derruba antes de recriar.
drop function if exists public.get_futebol_fixture_value(bigint);
CREATE OR REPLACE FUNCTION public.get_futebol_fixture_value(p_fixture_id bigint)
 returns table(market text, outcome text, outcome_order integer, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_premissas integer, penalidades integer, penalidades_especificas_pts integer, score integer, faixa text, score_versao text, modelo_api_concorda boolean, linha_sharp_confirma boolean, evidencias text[], avisos text[], contras text[], premissas_sem_dado integer)
 language sql
 security definer
 set search_path to ''
as $function$
  -- migration 101: kickoff no futuro lê o board; kickoff já passado lê a FOTO DO
  -- APITO no snapshot. migration 105: os avisos leem as colunas pen_* do mart.
  with v_src as (
    select fixture_id, market, outcome, line_value, competition, season, edge,
           pts_premissas, penalidades, score, faixa, score_versao, best_odd, best_book,
           avg_odd, n_casas, prob_justa_fechamento, valor_fonte, janela_usada,
           penalidades_especificas_pts, modelo_api_concorda,
           linha_sharp_confirma, pin_n_outcomes, is_half_line, dbt_loaded_at, premissas_sem_dado,
           pen_odd_outlier, pen_poucas_casas, pen_odd_longshot, pen_odd_juice
    from futebol.fact_value_opportunities
    where fixture_id = p_fixture_id
      and exists (select 1 from futebol.fact_fixtures fx
                   where fx.fixture_id = p_fixture_id and fx.kickoff_utc > (now() at time zone 'UTC'))
    union all
    select fixture_id, market, outcome, line_value, competition, season, edge,
           pts_premissas, penalidades, score, faixa, score_versao, best_odd, best_book,
           avg_odd, n_casas, prob_justa_fechamento, valor_fonte, janela_usada,
           penalidades_especificas_pts, modelo_api_concorda,
           linha_sharp_confirma, pin_n_outcomes, is_half_line, dbt_loaded_at, premissas_sem_dado,
           pen_odd_outlier, pen_poucas_casas, pen_odd_longshot, pen_odd_juice
    from futebol.fact_value_opportunities_hist h
    where h.fixture_id = p_fixture_id
      and exists (select 1 from futebol.fact_fixtures fx
                   where fx.fixture_id = p_fixture_id
                     and fx.kickoff_utc <= (now() at time zone 'UTC')
                     and h.dbt_valid_from <= fx.kickoff_utc
                     and (h.dbt_valid_to is null or fx.kickoff_utc < h.dbt_valid_to))
  )
  select v.market, v.outcome,
    (case when v.market = 'match_winner'
          then (case v.outcome when 'Home' then 1 when 'Draw' then 2 else 3 end)
          when v.market = 'goals_over_under'
          then (coalesce(v.line_value,0)*10 + case when v.outcome='Over' then 1 else 2 end)::int
          when v.market = 'asian_handicap'
          then (1000 + (case v.outcome when 'Home' then 0 else 500 end) + (coalesce(v.line_value,0)*10))::int
          when v.market = 'btts'
          then (2000 + case when v.outcome in ('Yes') then 0 else 1 end)
          when v.market = 'double_chance'
          then (3000 + case v.outcome when '1X' then 1 else 2 end)
          else 0 end),
    v.line_value, v.edge, v.best_odd, v.best_book, v.avg_odd, v.n_casas::int, v.janela_usada, v.prob_justa_fechamento,
    v.pts_premissas::int, v.penalidades::int,
    v.penalidades_especificas_pts::int, v.score::int, v.faixa, v.score_versao,
    v.modelo_api_concorda, v.linha_sharp_confirma,
    public.futebol_copy('evidencia', v.market, case v.outcome when 'Home' then 'home' when 'Away' then 'away' else 'any' end, public.futebol_flags(to_jsonb(v), to_jsonb(p), to_jsonb(o), to_jsonb(ah), to_jsonb(bt), to_jsonb(dc))),
    public.futebol_copy('aviso', v.market, case v.outcome when 'Home' then 'home' when 'Away' then 'away' else 'any' end, public.futebol_flags(to_jsonb(v), to_jsonb(p), to_jsonb(o), to_jsonb(ah), to_jsonb(bt), to_jsonb(dc))),
    (public.futebol_copy('contra', v.market, case v.outcome when 'Home' then 'home' when 'Away' then 'away' else 'any' end, public.futebol_flags(to_jsonb(v), to_jsonb(p), to_jsonb(o), to_jsonb(ah), to_jsonb(bt), to_jsonb(dc))))[1:3],
    v.premissas_sem_dado::int
  from v_src v
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  where v.fixture_id = p_fixture_id
  order by (case v.market when 'match_winner' then 1 when 'goals_over_under' then 2 when 'asian_handicap' then 3 when 'btts' then 4 when 'double_chance' then 5 else 9 end), 3;
$function$;

CREATE OR REPLACE FUNCTION public.get_futebol_fixtures(p_competition text, p_season bigint, p_round text DEFAULT NULL::text)
 RETURNS TABLE(fixture_id bigint, round text, kickoff_utc timestamp without time zone, date_utc date, status_short text, status_long text, home_team_id bigint, home_team_name text, home_team_logo text, away_team_id bigint, away_team_name text, away_team_logo text, goals_home bigint, goals_away bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return query
  select f.fixture_id, f.round, f.kickoff_utc, f.date_utc,
    f.status_short, f.status_long,
    f.home_team_id, f.home_team_name, ht.team_logo_url,
    f.away_team_id, f.away_team_name, at2.team_logo_url,
    f.goals_home, f.goals_away
  from futebol.fact_fixtures f
  left join futebol.dim_teams ht on ht.team_id = f.home_team_id
  left join futebol.dim_teams at2 on at2.team_id = f.away_team_id
  where f.competition = p_competition
    and f.season = p_season
    and (p_round is null or f.round = p_round)
  order by f.kickoff_utc asc nulls last, f.fixture_id;
end; $function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_h2h(p_home_id bigint, p_away_id bigint)
 RETURNS TABLE(fixture_id bigint, date_utc date, competition text, season bigint, home_team_name text, away_team_name text, goals_home bigint, goals_away bigint, winner_team_id bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_key text := least(p_home_id, p_away_id)::text || '-' || greatest(p_home_id, p_away_id)::text;
begin
  return query
  select h.fixture_id, h.date_utc, h.competition, h.season,
         h.home_team_name, h.away_team_name, h.goals_home, h.goals_away,
         (case when h.home_team_winner then h.home_team_id
               when h.away_team_winner then h.away_team_id
               else null end)::bigint as winner_team_id
  from futebol.fact_h2h h
  where h.h2h_pair_key = v_key and h.status_short in ('FT','AET','PEN')
  order by h.date_utc desc;
end; $function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_leaders(p_competition text, p_season bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return jsonb_build_object(
    'scorers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id', s.player_id, 'player_name', s.player_name, 'team_name', s.team_name, 'goals', s.goals
      ) order by s.goals desc, s.player_name)
      from (
        select e.player_id, max(e.player_name) as player_name, max(e.team_name) as team_name, count(*)::bigint as goals
        from futebol.fact_fixture_events e
        where e.competition = p_competition and e.season = p_season
          and e.event_type = 'Goal' and (e.event_detail is null or e.event_detail <> 'Own Goal')
          and e.player_id is not null
        group by e.player_id
        order by count(*) desc
        limit 20
      ) s
    ), '[]'::jsonb),
    'cards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id', c.player_id, 'player_name', c.player_name, 'team_name', c.team_name,
        'yellow', c.yellow, 'red', c.red
      ) order by (c.yellow + c.red * 2) desc, c.player_name)
      from (
        select e.player_id, max(e.player_name) as player_name, max(e.team_name) as team_name,
          count(*) filter (where e.event_detail = 'Yellow Card')::bigint as yellow,
          count(*) filter (where e.event_detail = 'Red Card')::bigint as red
        from futebol.fact_fixture_events e
        where e.competition = p_competition and e.season = p_season and e.event_type = 'Card' and e.player_id is not null
        group by e.player_id
        order by (count(*) filter (where e.event_detail = 'Yellow Card') + count(*) filter (where e.event_detail = 'Red Card') * 2) desc
        limit 20
      ) c
    ), '[]'::jsonb)
  );
end; $function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_matchup_markets(p_home_id bigint, p_away_id bigint, p_competition text, p_season bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v jsonb;
begin
  select jsonb_object_agg(g.who, jsonb_build_object(
           'games', g.games, 'avg_gf', round(g.avg_gf, 2), 'avg_ga', round(g.avg_ga, 2),
           'over25_pct', round(g.over25 * 100), 'btts_pct', round(g.btts * 100)
         )) into v
  from (
    select mr.who,
      count(*) as games, avg(mr.gf::numeric) as avg_gf, avg(mr.ga::numeric) as avg_ga,
      avg((((mr.gf + mr.ga) >= 3))::int::numeric) as over25,
      avg(((mr.gf > 0 and mr.ga > 0))::int::numeric) as btts
    from (
      select 'home'::text as who, f.goals_home as gf, f.goals_away as ga from futebol.fact_fixtures f
        where f.competition = p_competition and f.season = p_season and f.status_short = 'FT' and f.home_team_id = p_home_id
      union all
      select 'home', f.goals_away, f.goals_home from futebol.fact_fixtures f
        where f.competition = p_competition and f.season = p_season and f.status_short = 'FT' and f.away_team_id = p_home_id
      union all
      select 'away', f.goals_home, f.goals_away from futebol.fact_fixtures f
        where f.competition = p_competition and f.season = p_season and f.status_short = 'FT' and f.home_team_id = p_away_id
      union all
      select 'away', f.goals_away, f.goals_home from futebol.fact_fixtures f
        where f.competition = p_competition and f.season = p_season and f.status_short = 'FT' and f.away_team_id = p_away_id
    ) mr
    group by mr.who
  ) g;
  return coalesce(v, '{}'::jsonb);
end; $function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_odds_board()
 RETURNS TABLE(fixture_id bigint, home_team_id bigint, away_team_id bigint, home_team_name text, away_team_name text, competition text, kickoff_utc timestamp without time zone, status_short text, market_key text, market_label text, outcome_label text, outcome_order integer, line double precision, pinnacle_odd double precision, avg_odd double precision, best_odd double precision, best_book text, n_books integer, pin_open double precision, pin_close double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return query
  with base as (
    select o.fixture_id, o.market_name, o.outcome_label, o.bookmaker_name, o.collection_window, o.odd_decimal, o.line_value
    from futebol.fact_odds_snapshot o
    where ( o.market_name = 'Match Winner'
         or o.market_name = 'Both Teams Score'
         or o.market_name = 'Double Chance'
         or (o.market_name = 'Goals Over/Under' and o.outcome_label in
             ('Over 0.5','Under 0.5','Over 1.5','Under 1.5','Over 2.5','Under 2.5','Over 3.5','Under 3.5','Over 4.5','Under 4.5')) )
  ),
  cur_pick as (
    select distinct on (b.fixture_id, b.market_name, b.outcome_label, b.bookmaker_name)
      b.fixture_id, b.market_name, b.outcome_label, b.bookmaker_name, b.odd_decimal, b.line_value
    from base b
    order by b.fixture_id, b.market_name, b.outcome_label, b.bookmaker_name,
             -- migration 097, mesmo conserto do get_futebol_fixture_odds.
             case when b.collection_window='t15m' then 4 when b.collection_window='t1h' then 3 when b.collection_window='t24h' then 2 when b.collection_window='daily' then 1 else 0 end desc
  ),
  agg as (
    select c.fixture_id, c.market_name, c.outcome_label, max(c.line_value) line_value,
      count(distinct c.bookmaker_name)::int n_books, avg(c.odd_decimal) avg_odd
    from cur_pick c group by c.fixture_id, c.market_name, c.outcome_label
  ),
  best_bk as (
    select distinct on (c.fixture_id, c.market_name, c.outcome_label)
      c.fixture_id, c.market_name, c.outcome_label, c.bookmaker_name best_book, c.odd_decimal best_odd
    from cur_pick c order by c.fixture_id, c.market_name, c.outcome_label, c.odd_decimal desc
  ),
  pin as (
    select b.fixture_id, b.market_name, b.outcome_label,
      max(b.odd_decimal) filter (where b.collection_window='t24h') t24,
      max(b.odd_decimal) filter (where b.collection_window='t1h')  t1,
      max(b.odd_decimal) filter (where b.collection_window='t15m') t15
    from base b where b.bookmaker_name = 'Pinnacle'
    group by b.fixture_id, b.market_name, b.outcome_label
  )
  select
    a.fixture_id, f.home_team_id, f.away_team_id, f.home_team_name, f.away_team_name,
    f.competition, f.kickoff_utc, f.status_short,
    case a.market_name when 'Match Winner' then 'match_winner'
      when 'Goals Over/Under' then 'over_under'
      when 'Both Teams Score' then 'btts'
      when 'Double Chance' then 'double_chance' end,
    a.market_name, a.outcome_label,
    case when a.outcome_label in ('Home','Yes','Home/Draw') or a.outcome_label like 'Over %' then 1
         when a.outcome_label in ('Draw','No','Home/Away') or a.outcome_label like 'Under %' then 2 else 3 end,
    case when a.market_name = 'Goals Over/Under' then a.line_value else null end,
    coalesce(p.t15, p.t1, p.t24), a.avg_odd,
    bb.best_odd, bb.best_book, a.n_books, p.t24, coalesce(p.t15, p.t1)
  from agg a
  join futebol.fact_fixtures f on f.fixture_id = a.fixture_id
  join best_bk bb on bb.fixture_id=a.fixture_id and bb.market_name=a.market_name and bb.outcome_label=a.outcome_label
  left join pin p on p.fixture_id=a.fixture_id and p.market_name=a.market_name and p.outcome_label=a.outcome_label
  order by a.fixture_id, 9, 13 nulls first, 12;
end $function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_standings(p_competition text, p_season bigint)
 RETURNS TABLE(team_id bigint, team_name text, team_logo text, played bigint, wins bigint, draws bigint, losses bigint, goals_for bigint, goals_against bigint, goal_diff bigint, points bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return query
  with rows_perspective as (
    select f.home_team_id as team_id, f.home_team_name as team_name,
           f.goals_home as gf, f.goals_away as ga
    from futebol.fact_fixtures f
    where f.competition = p_competition and f.season = p_season and f.status_short = 'FT'
    union all
    select f.away_team_id, f.away_team_name, f.goals_away, f.goals_home
    from futebol.fact_fixtures f
    where f.competition = p_competition and f.season = p_season and f.status_short = 'FT'
  ),
  agg as (
    select r.team_id, max(r.team_name) as team_name,
           count(*)::bigint as played,
           count(*) filter (where r.gf > r.ga)::bigint as wins,
           count(*) filter (where r.gf = r.ga)::bigint as draws,
           count(*) filter (where r.gf < r.ga)::bigint as losses,
           coalesce(sum(r.gf), 0)::bigint as goals_for,
           coalesce(sum(r.ga), 0)::bigint as goals_against
    from rows_perspective r
    where r.team_id is not null
    group by r.team_id
  )
  select a.team_id, a.team_name, dt.team_logo_url,
         a.played, a.wins, a.draws, a.losses,
         a.goals_for, a.goals_against, (a.goals_for - a.goals_against)::bigint as goal_diff,
         (a.wins * 3 + a.draws)::bigint as points
  from agg a
  left join futebol.dim_teams dt on dt.team_id = a.team_id
  order by points desc, goal_diff desc, a.goals_for desc, a.team_name asc;
end; $function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_standings_official(p_competition text, p_season bigint)
-- migration 096: ganhou `group_name`, sem o qual a tabela de fase de grupos
-- (Libertadores, Sul-Americana, Champions) vinha embaralhada num bloco só. Este
-- arquivo estava no formato PRÉ-096 e devolvia 12 colunas onde o front espera
-- 13 — mais uma da dívida da #250 achada no code review do PR #261.
 RETURNS TABLE(team_id bigint, team_name text, rank bigint, points bigint, played bigint, wins bigint, draws bigint, loses bigint, goals_for bigint, goals_against bigint, goals_diff bigint, rank_description text, group_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_date date;
begin
  select max(s.snapshot_date) into v_date
  from futebol.fact_standings_snapshot s
  where s.competition = p_competition and s.season = p_season;

  return query
  select s.team_id, s.team_name, s.rank, s.points,
         s.played_total, s.wins_total, s.draws_total, s.loses_total,
         s.goals_for_total, s.goals_against_total, s.goals_diff, s.rank_description,
         s.group_name
  from futebol.fact_standings_snapshot s
  where s.competition = p_competition and s.season = p_season and s.snapshot_date = v_date
  order by s.group_name, s.rank;
end; $function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_team_profile(p_team_id bigint, p_competition text, p_season bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_name text; v_logo text;
begin
  select dt.team_name, dt.team_logo_url into v_name, v_logo
  from futebol.dim_teams dt where dt.team_id = p_team_id limit 1;

  return jsonb_build_object(
    'team', jsonb_build_object('team_id', p_team_id, 'team_name', v_name, 'team_logo', v_logo),
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scope', coalesce(g.scope, 'geral'),
        'games', g.games, 'wins', g.wins, 'draws', g.draws, 'losses', g.losses,
        'avg_gf', round(g.avg_gf, 2), 'avg_ga', round(g.avg_ga, 2),
        'over25_pct', round(g.over25 * 100), 'btts_pct', round(g.btts * 100)
      ) order by (coalesce(g.scope, 'geral') = 'geral') desc, g.scope)
      from (
        select mr.scope,
          count(*) as games,
          count(*) filter (where mr.gf > mr.ga) as wins,
          count(*) filter (where mr.gf = mr.ga) as draws,
          count(*) filter (where mr.gf < mr.ga) as losses,
          avg(mr.gf::numeric) as avg_gf, avg(mr.ga::numeric) as avg_ga,
          avg((((mr.gf + mr.ga) >= 3))::int::numeric) as over25,
          avg(((mr.gf > 0 and mr.ga > 0))::int::numeric) as btts
        from (
          select 'casa'::text as scope, f.goals_home as gf, f.goals_away as ga
          from futebol.fact_fixtures f
          where f.competition = p_competition and f.season = p_season and f.status_short = 'FT' and f.home_team_id = p_team_id
          union all
          select 'fora'::text, f.goals_away, f.goals_home
          from futebol.fact_fixtures f
          where f.competition = p_competition and f.season = p_season and f.status_short = 'FT' and f.away_team_id = p_team_id
        ) mr
        group by grouping sets ((mr.scope), ())
      ) g
    ), '[]'::jsonb),
    'stats_avg', coalesce((
      with fx_tot as (
        select t.fixture_id, sum(t.expected_goals) as tot_xg
        from futebol.fact_fixture_stats t
        where t.competition = p_competition and t.season = p_season
        group by t.fixture_id
      )
      select jsonb_agg(jsonb_build_object(
        'scope', case when s.side is null then 'geral' when s.side = 'home' then 'casa' else 'fora' end,
        'games', s.games,
        'avg_possession', round(s.avg_poss, 1), 'avg_shots', round(s.avg_shots, 1),
        'avg_shots_on_goal', round(s.avg_sog, 1), 'avg_corners', round(s.avg_cor, 1),
        'avg_yellow', round(s.avg_yel, 2), 'avg_xg', round(s.avg_xg, 2),
        'avg_xg_against', round(s.avg_xga, 2)
      ) order by (s.side is null) desc, s.side)
      from (
        select fs.team_side as side,
          count(*) as games,
          avg(fs.ball_possession::numeric) as avg_poss, avg(fs.total_shots::numeric) as avg_shots,
          avg(fs.shots_on_goal::numeric) as avg_sog, avg(fs.corner_kicks::numeric) as avg_cor,
          avg(fs.yellow_cards::numeric) as avg_yel, avg(fs.expected_goals::numeric) as avg_xg,
          avg((fxt.tot_xg - fs.expected_goals)::numeric) as avg_xga
        from futebol.fact_fixture_stats fs
        join fx_tot fxt on fxt.fixture_id = fs.fixture_id
        where fs.team_id = p_team_id and fs.competition = p_competition and fs.season = p_season
        group by grouping sets ((fs.team_side), ())
      ) s
    ), '[]'::jsonb)
  );
end; $function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_team_season(p_team_id bigint, p_competition text, p_season bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_date date; v jsonb;
begin
  select max(t.snapshot_date) into v_date
  from futebol.fact_team_season_stats t
  where t.competition = p_competition and t.season = p_season;

  select jsonb_build_object(
    'form', t.form,
    'played_total', t.played_total, 'played_home', t.played_home, 'played_away', t.played_away,
    'wins_total', t.wins_total, 'wins_home', t.wins_home, 'wins_away', t.wins_away,
    'draws_total', t.draws_total, 'draws_home', t.draws_home, 'draws_away', t.draws_away,
    'loses_total', t.loses_total, 'loses_home', t.loses_home, 'loses_away', t.loses_away,
    'goals_for_avg_total', t.goals_for_avg_total, 'goals_for_avg_home', t.goals_for_avg_home, 'goals_for_avg_away', t.goals_for_avg_away,
    'goals_against_avg_total', t.goals_against_avg_total, 'goals_against_avg_home', t.goals_against_avg_home, 'goals_against_avg_away', t.goals_against_avg_away,
    'clean_sheet_total', t.clean_sheet_total, 'clean_sheet_home', t.clean_sheet_home, 'clean_sheet_away', t.clean_sheet_away,
    'failed_to_score_total', t.failed_to_score_total,
    'biggest_streak_wins', t.biggest_streak_wins, 'biggest_streak_loses', t.biggest_streak_loses,
    'penalty_total', t.penalty_total, 'penalty_scored_pct', t.penalty_scored_pct
  ) into v
  from futebol.fact_team_season_stats t
  where t.team_id = p_team_id and t.competition = p_competition and t.season = p_season and t.snapshot_date = v_date
  limit 1;

  return coalesce(v, '{}'::jsonb);
end; $function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_teams()
 RETURNS TABLE(team_id bigint, team_name text, team_logo_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return query
  select distinct on (t.team_id) t.team_id, t.team_name, t.team_logo_url
  from futebol.dim_teams t
  where t.team_logo_url is not null
  order by t.team_id;
end; $function$

;

-- O retorno tabular mudou na virada do Score de contexto, e o Postgres recusa
-- `create or replace` que altere o RETURNS TABLE. Derruba antes de recriar.
drop function if exists public.get_futebol_value_board();
CREATE OR REPLACE FUNCTION public.get_futebol_value_board()
 returns table(fixture_id bigint, home_team_id bigint, away_team_id bigint, home_team_name text, away_team_name text, competition text, kickoff_utc timestamp without time zone, status_short text, market text, outcome text, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_premissas integer, penalidades integer, score integer, faixa text, score_versao text, evidencias text[], premissas_sem_dado integer)
 language sql
 security definer
 set search_path to ''
as $function$
  select v.fixture_id, f.home_team_id, f.away_team_id, f.home_team_name, f.away_team_name,
    f.competition, f.kickoff_utc, f.status_short,
    v.market, v.outcome, v.line_value, v.edge, v.best_odd, v.best_book, v.avg_odd, v.n_casas::int, v.janela_usada, v.prob_justa_fechamento,
    v.pts_premissas::int, v.penalidades::int, v.score::int, v.faixa, v.score_versao,
    public.futebol_copy('evidencia', v.market, case v.outcome when 'Home' then 'home' when 'Away' then 'away' else 'any' end, public.futebol_flags(to_jsonb(v), to_jsonb(p), to_jsonb(o), to_jsonb(ah), to_jsonb(bt), to_jsonb(dc))),
    v.premissas_sem_dado::int
  from futebol.fact_value_opportunities v
  join futebol.fact_fixtures f on f.fixture_id = v.fixture_id
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  order by v.score desc, v.edge desc;
$function$;

-- ── 5b. Histórico point-in-time do board (ADR 0009, migrations 101 e 102) ────
-- O board é reconstruído inteiro a cada execução e não filtra data, então ler o
-- passado por ele mostra a nota RECALCULADA, não a que foi publicada. Medido no
-- PRD em 17/08: 121 linhas no board e 2 de jogo futuro, a mais antiga de 19/06;
-- 97% das versões do `_hist` nasceram DEPOIS do apito, em média 668h depois.
--
-- Aqui vem a oportunidade como foi publicada: a versão do snapshot viva no
-- apito. Decisões travadas:
--
--   · PIT estrito: dbt_valid_from <= kickoff < dbt_valid_to (nulo = aberta).
--     Chave sem versão viva no apito não aparece, não cai para a mais próxima.
--   · `kickoff < now()` obrigatório: sem ele, a versão aberta de um jogo FUTURO
--     satisfaz o predicado à toa e uma chave que já saiu do board voltaria à
--     tela como oportunidade viva. Medido no dev: 7 versões nessa situação.
--   · `DISTINCT ON (opportunity_key)` com desempate explícito, blindando o grão
--     caso o snapshot algum dia produza janelas sobrepostas.
--   · Janela em DIA DE BRASÍLIA, convertida uma vez (sargável): 21:30 BRT é
--     00:30 UTC do dia seguinte, horário de metade do calendário brasileiro.
--   · `RETURNS TABLE` espelha o de `get_futebol_value_board`, incluindo
--     `premissas_sem_dado`, para o front reaproveitar `FutebolValueBoardRow`.
--   · `get_futebol_value_board` NÃO é tocada.
--
-- Crédito: `kickoff < now()`, DISTINCT ON, janela sargável e o índice acima vêm
-- do PR #259 do Matheus, que implementou a mesma entrega em paralelo.
--
-- ⚠️ DÍVIDA: a cascata de `evidencias` abaixo é a TERCEIRA cópia verbatim (as
-- outras em `get_futebol_value_board` e `get_futebol_fixture_value`). Mercado
-- novo mexe em três RPCs. Extrair exige tocar nas três de uma vez.

-- O retorno tabular mudou na virada do Score de contexto, e o Postgres recusa
-- `create or replace` que altere o RETURNS TABLE. Derruba antes de recriar.
drop function if exists public.get_futebol_value_history(date, date);
CREATE OR REPLACE FUNCTION public.get_futebol_value_history(p_from date, p_to date)
 returns table(fixture_id bigint, home_team_id bigint, away_team_id bigint, home_team_name text, away_team_name text, competition text, kickoff_utc timestamp without time zone, status_short text, market text, outcome text, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_premissas integer, penalidades integer, score integer, faixa text, score_versao text, evidencias text[], premissas_sem_dado integer)
 language sql
 security definer
 set search_path to ''
as $function$
  with pit as (
    select distinct on (h.opportunity_key)
      h.fixture_id, h.market, h.outcome, h.line_value, h.edge,
      h.best_odd, h.best_book, h.avg_odd, h.n_casas, h.janela_usada,
      h.prob_justa_fechamento, h.pts_premissas,
      h.penalidades, h.score, h.faixa, h.score_versao,
      h.modelo_api_concorda, h.linha_sharp_confirma, h.premissas_sem_dado
    from futebol.fact_value_opportunities_hist h
    join futebol.fact_fixtures fx on fx.fixture_id = h.fixture_id
    where fx.kickoff_utc >= ((p_from::timestamp at time zone 'America/Sao_Paulo') at time zone 'UTC')
      and fx.kickoff_utc <  (((p_to + 1)::timestamp at time zone 'America/Sao_Paulo') at time zone 'UTC')
      and fx.kickoff_utc <  (now() at time zone 'UTC')
      and h.dbt_valid_from <= fx.kickoff_utc
      and (h.dbt_valid_to is null or fx.kickoff_utc < h.dbt_valid_to)
    order by h.opportunity_key, h.dbt_valid_from desc
  )
  select v.fixture_id, f.home_team_id, f.away_team_id, f.home_team_name, f.away_team_name,
    f.competition, f.kickoff_utc, f.status_short,
    v.market, v.outcome, v.line_value, v.edge, v.best_odd, v.best_book, v.avg_odd, v.n_casas::int, v.janela_usada, v.prob_justa_fechamento,
    v.pts_premissas::int, v.penalidades::int, v.score::int, v.faixa, v.score_versao,
    public.futebol_copy('evidencia', v.market, case v.outcome when 'Home' then 'home' when 'Away' then 'away' else 'any' end, public.futebol_flags(to_jsonb(v), to_jsonb(p), to_jsonb(o), to_jsonb(ah), to_jsonb(bt), to_jsonb(dc))),
    v.premissas_sem_dado::int
  from pit v
  join futebol.fact_fixtures f on f.fixture_id = v.fixture_id
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  order by f.kickoff_utc desc, v.score desc, v.edge desc;
$function$;

-- ── 5c. Agenda por dia, catálogo e detalhe do jogo (migrations 091 a 096) ────
-- ⚠️ Estas oito estavam FALTANDO neste arquivo, e é a dívida da #250 no seu
-- tamanho real: o catch-up anterior (PR #248) só cobriu as colunas novas, e as
-- funções que as migrations 091-096 criaram nunca entraram. Uma provisão nova a
-- partir deste arquivo subia um app cujo calendário, agenda, mapa de premissas e
-- números do jogo respondiam 404 — sem o parity check reclamar de nada, porque
-- ele confere TABELA e não FUNÇÃO.
--
-- Achado pelo code review do PR #261, não por incidente. A seção 8 no fim deste
-- arquivo passa a existir para que a próxima divergência apareça sozinha.

CREATE OR REPLACE FUNCTION public.futebol_dia_brt(p_kickoff_utc timestamp without time zone)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select (p_kickoff_utc at time zone 'UTC' at time zone 'America/Sao_Paulo')::date;
$function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_alerted_picks(p_day date DEFAULT NULL::date)
 RETURNS TABLE(game_day date, fixture_id bigint, market text, outcome text, line_value double precision, bet_description text, betting_market text, league text, match_description text, odds numeric, janela_usada text, score integer, faixa text, edge double precision, prob_justa_fechamento double precision, sent_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((p.match_date at time zone 'America/Sao_Paulo')::date, p.sent_date) as game_day,
         p.fixture_id, p.market, p.outcome, p.line_value,
         p.bet_description, p.betting_market, p.league, p.match_description, p.odds,
         p.janela_usada, p.score, p.faixa, p.edge, p.prob_justa_fechamento, p.created_at
  from public.daily_opportunity_picks p
  where p.sport = 'Futebol'
    and coalesce((p.match_date at time zone 'America/Sao_Paulo')::date, p.sent_date)
        >= (now() at time zone 'America/Sao_Paulo')::date - 90
    and (p_day is null
         or coalesce((p.match_date at time zone 'America/Sao_Paulo')::date, p.sent_date) = p_day)
  order by game_day, p.created_at;
$function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_competitions()
 RETURNS TABLE(competition text, season bigint, jogos bigint, primeiro date, ultimo date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select f.competition,
         f.season,
         count(*)                                  as jogos,
         min(public.futebol_dia_brt(f.kickoff_utc)) as primeiro,
         max(public.futebol_dia_brt(f.kickoff_utc)) as ultimo
  from futebol.fact_fixtures f
  where f.kickoff_utc is not null
  group by f.competition, f.season
  order by f.season desc, f.competition;
$function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_days(p_from date, p_to date)
 RETURNS TABLE(day_brt date, jogos bigint, ligas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.futebol_dia_brt(f.kickoff_utc) as day_brt,
         count(*)                              as jogos,
         count(distinct f.competition)         as ligas
  from futebol.fact_fixtures f
  where f.kickoff_utc is not null
    and public.futebol_dia_brt(f.kickoff_utc) between p_from and p_to
  group by 1
  order by 1;
$function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_fixtures_by_day(p_day date, p_competitions text[] DEFAULT NULL::text[])
 RETURNS TABLE(fixture_id bigint, competition text, season bigint, day_brt date, round text, kickoff_utc timestamp without time zone, date_utc date, status_short text, status_long text, home_team_id bigint, home_team_name text, home_team_logo text, away_team_id bigint, away_team_name text, away_team_logo text, goals_home bigint, goals_away bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select f.fixture_id, f.competition, f.season,
         public.futebol_dia_brt(f.kickoff_utc),
         f.round, f.kickoff_utc, f.date_utc,
         f.status_short, f.status_long,
         f.home_team_id, f.home_team_name, ht.team_logo_url,
         f.away_team_id, f.away_team_name, at2.team_logo_url,
         f.goals_home, f.goals_away
  from futebol.fact_fixtures f
  left join futebol.dim_teams ht  on ht.team_id  = f.home_team_id
  left join futebol.dim_teams at2 on at2.team_id = f.away_team_id
  where f.kickoff_utc is not null
    and public.futebol_dia_brt(f.kickoff_utc) = p_day
    and (p_competitions is null or f.competition = any(p_competitions))
  order by f.kickoff_utc, f.competition, f.fixture_id;
$function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_premissas(p_fixture_id bigint)
 RETURNS TABLE(market text, outcome text, line_value double precision, pts_premissas bigint, penalidades_pts bigint, acesas text[], apagadas text[], penalidades text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select 'match_winner'::text,
         p.outcome,
         null::double precision,
         p.pts_premissas,
         p.penalidades_1x2_pts,
         array_remove(array[
           case when p.forma                 then 'forma' end,
           case when p.mando                 then 'mando' end,
           case when p.superioridade_tabela  then 'superioridade_tabela' end,
           case when p.forca_mismatch        then 'forca_mismatch' end,
           case when p.superioridade_xg      then 'superioridade_xg' end,
           case when p.h2h_favoravel         then 'h2h_favoravel' end,
           case when p.desfalque_adversario  then 'desfalque_adversario' end
         ], null),
         array_remove(array[
           case when not p.forma                then 'forma' end,
           case when not p.mando                then 'mando' end,
           case when not p.superioridade_tabela then 'superioridade_tabela' end,
           case when not p.forca_mismatch       then 'forca_mismatch' end,
           case when not p.superioridade_xg     then 'superioridade_xg' end,
           case when not p.h2h_favoravel        then 'h2h_favoravel' end,
           case when not p.desfalque_adversario then 'desfalque_adversario' end
         ], null),
         array_remove(array[
           case when p.pick_empate       then 'pick_empate' end,
           case when p.desfalque_proprio then 'desfalque_proprio' end
         ], null)
  from futebol.int_futebol_premissas_1x2 p
  where p.fixture_id = p_fixture_id

  union all

  select 'goals_over_under'::text,
         p.outcome,
         p.line_value,
         p.pts_premissas,
         p.penalidades_ou_pts,
         array_remove(array[
           case when p.defesas_firmes      then 'defesas_firmes' end,
           case when p.defesas_vazaveis    then 'defesas_vazaveis' end,
           case when p.ataque_combinado    then 'ataque_combinado' end,
           case when p.xg_baixo_combinado  then 'xg_baixo_combinado' end,
           case when p.xg_combinado_alto   then 'xg_combinado_alto' end,
           case when p.clean_sheets_altos  then 'clean_sheets_altos' end,
           case when p.ataques_fracos      then 'ataques_fracos' end,
           case when p.historico_under     then 'historico_under' end,
           case when p.historico_over      then 'historico_over' end,
           case when p.ambos_vazam         then 'ambos_vazam' end,
           case when p.ritmo_alto          then 'ritmo_alto' end
         ], null),
         array_remove(array[
           case when not p.defesas_firmes     then 'defesas_firmes' end,
           case when not p.defesas_vazaveis   then 'defesas_vazaveis' end,
           case when not p.ataque_combinado   then 'ataque_combinado' end,
           case when not p.xg_baixo_combinado then 'xg_baixo_combinado' end,
           case when not p.xg_combinado_alto  then 'xg_combinado_alto' end,
           case when not p.clean_sheets_altos then 'clean_sheets_altos' end,
           case when not p.ataques_fracos     then 'ataques_fracos' end,
           case when not p.historico_under    then 'historico_under' end,
           case when not p.historico_over     then 'historico_over' end,
           case when not p.ambos_vazam        then 'ambos_vazam' end,
           case when not p.ritmo_alto         then 'ritmo_alto' end
         ], null),
         array_remove(array[
           case when p.linha_extrema then 'linha_extrema' end
         ], null)
  from futebol.int_futebol_premissas_ou p
  where p.fixture_id = p_fixture_id

  union all

  select 'asian_handicap'::text,
         p.outcome,
         p.line_value,
         p.pts_premissas,
         p.penalidades_ah_pts,
         array_remove(array[
           case when p.supremacia             then 'supremacia' end,
           case when p.tende_golear           then 'tende_golear' end,
           case when p.adversario_fragil_fora then 'adversario_fragil_fora' end,
           case when p.mando_forte            then 'mando_forte' end,
           case when p.sem_rodizio            then 'sem_rodizio' end,
           case when p.raramente_perde_por_2  then 'raramente_perde_por_2' end,
           case when p.defesa_fora_solida     then 'defesa_fora_solida' end
         ], null),
         array_remove(array[
           case when not p.supremacia             then 'supremacia' end,
           case when not p.tende_golear           then 'tende_golear' end,
           case when not p.adversario_fragil_fora then 'adversario_fragil_fora' end,
           case when not p.mando_forte            then 'mando_forte' end,
           case when not p.sem_rodizio            then 'sem_rodizio' end,
           case when not p.raramente_perde_por_2  then 'raramente_perde_por_2' end,
           case when not p.defesa_fora_solida     then 'defesa_fora_solida' end
         ], null),
         array_remove(array[
           case when p.favorito_irregular then 'favorito_irregular' end,
           case when p.handicap_alto      then 'handicap_alto' end
         ], null)
  from futebol.int_futebol_premissas_ah p
  where p.fixture_id = p_fixture_id

  union all

  select 'btts'::text,
         p.outcome,
         null::double precision,
         p.pts_premissas,
         p.penalidades_btts_pts,
         array_remove(array[
           case when p.ambos_marcam     then 'ambos_marcam' end,
           case when p.ataque_dos_dois  then 'ataque_dos_dois' end,
           case when p.defesas_vazaveis then 'defesas_vazaveis' end,
           case when p.historico_btts   then 'historico_btts' end,
           case when p.defesa_forte     then 'defesa_forte' end,
           case when p.ataque_trava     then 'ataque_trava' end,
           case when p.historico_seco   then 'historico_seco' end
         ], null),
         array_remove(array[
           case when not p.ambos_marcam     then 'ambos_marcam' end,
           case when not p.ataque_dos_dois  then 'ataque_dos_dois' end,
           case when not p.defesas_vazaveis then 'defesas_vazaveis' end,
           case when not p.historico_btts   then 'historico_btts' end,
           case when not p.defesa_forte     then 'defesa_forte' end,
           case when not p.ataque_trava     then 'ataque_trava' end,
           case when not p.historico_seco   then 'historico_seco' end
         ], null),
         '{}'::text[]
  from futebol.int_futebol_premissas_btts p
  where p.fixture_id = p_fixture_id

  union all

  select 'double_chance'::text,
         p.outcome,
         null::double precision,
         p.pts_premissas,
         p.penalidades_dc_pts,
         array_remove(array[
           case when p.lado_coberto_forte   then 'lado_coberto_forte' end,
           case when p.equilibrio_defensivo then 'equilibrio_defensivo' end,
           case when p.adversario_limitado  then 'adversario_limitado' end,
           case when p.invicto_recente      then 'invicto_recente' end
         ], null),
         array_remove(array[
           case when not p.lado_coberto_forte   then 'lado_coberto_forte' end,
           case when not p.equilibrio_defensivo then 'equilibrio_defensivo' end,
           case when not p.adversario_limitado  then 'adversario_limitado' end,
           case when not p.invicto_recente      then 'invicto_recente' end
         ], null),
         '{}'::text[]
  from futebol.int_futebol_premissas_dc p
  where p.fixture_id = p_fixture_id

  order by 1, 4 desc, 2, 3;
$function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_numeros(p_fixture_id bigint)
 RETURNS TABLE(side text, team_id bigint, team_name text, posicao bigint, pontos bigint, zona text, jogos bigint, jogos_casa bigint, jogos_fora bigint, v_casa bigint, e_casa bigint, d_casa bigint, v_fora bigint, e_fora bigint, d_fora bigint, gf_casa double precision, ga_casa double precision, gf_fora double precision, ga_fora double precision, gf_total double precision, ga_total double precision, clean_sheets bigint, sem_marcar bigint, forma text, h2h_jogos bigint, h2h_vitorias bigint, h2h_empates bigint, ate date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with jogo as (
    select f.fixture_id, f.competition, f.season, f.home_team_id, f.away_team_id
    from futebol.fact_fixtures f
    where f.fixture_id = p_fixture_id
  ),
  lados as (
    select 'home'::text as side, j.home_team_id as team_id, j.competition, j.season from jogo j
    union all
    select 'away'::text, j.away_team_id, j.competition, j.season from jogo j
  ),
  stats as (
    select distinct on (t.team_id, t.competition, t.season) t.*
    from futebol.fact_team_season_stats t
    join lados l on l.team_id = t.team_id and l.competition = t.competition and l.season = t.season
    order by t.team_id, t.competition, t.season, t.snapshot_date desc
  ),
  h2h as (
    select l.team_id,
           count(*) as jogos,
           count(*) filter (
             where (hh.home_team_id = l.team_id and hh.goals_home > hh.goals_away)
                or (hh.away_team_id = l.team_id and hh.goals_away > hh.goals_home)
           ) as vitorias,
           count(*) filter (where hh.goals_home = hh.goals_away) as empates
    from jogo j
    join futebol.fact_h2h hh
      on (hh.home_team_id = j.home_team_id and hh.away_team_id = j.away_team_id)
      or (hh.home_team_id = j.away_team_id and hh.away_team_id = j.home_team_id)
    join lados l on true
    where hh.goals_home is not null and hh.goals_away is not null
    group by l.team_id
  ),
  tabela as (
    select distinct on (s.team_id) s.team_id, s.rank_pos, s.pontos, s.zona
    from (
      select st.team_id,
             st."rank"::bigint          as rank_pos,
             st.points::bigint          as pontos,
             st.rank_description        as zona
      from jogo j,
           public.get_futebol_standings_official(j.competition, j.season) st
    ) s
    order by s.team_id
  )
  select l.side,
         l.team_id,
         coalesce(st.team_name, dt.team_name),
         tb.rank_pos,
         tb.pontos,
         tb.zona,
         st.played_total,
         st.played_home,
         st.played_away,
         st.wins_home,
         st.draws_home,
         st.loses_home,
         st.wins_away,
         st.draws_away,
         st.loses_away,
         st.goals_for_avg_home,
         st.goals_against_avg_home,
         st.goals_for_avg_away,
         st.goals_against_avg_away,
         st.goals_for_avg_total,
         st.goals_against_avg_total,
         st.clean_sheet_total,
         st.failed_to_score_total,
         st.form,
         hh.jogos,
         hh.vitorias,
         hh.empates,
         st.snapshot_date
  from lados l
  left join stats st on st.team_id = l.team_id
  left join tabela tb on tb.team_id = l.team_id
  left join h2h hh on hh.team_id = l.team_id
  left join futebol.dim_teams dt on dt.team_id = l.team_id
  order by l.side desc;
$function$

;

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_historico(p_fixture_id bigint, p_max integer DEFAULT 40)
 RETURNS TABLE(side text, team_id bigint, team_name text, past_fixture_id bigint, data date, ordem bigint, mesma_competicao boolean, em_casa boolean, adversario text, adversario_id bigint, gols_pro integer, gols_contra integer, total_gols integer, ambos_marcaram boolean, sem_sofrer boolean, sem_marcar boolean, xg double precision, xg_contra double precision, resultado text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with alvo as (
    select f.fixture_id, f.competition, f.season, f.kickoff_utc,
           f.home_team_id, f.home_team_name, f.away_team_id, f.away_team_name
    from futebol.fact_fixtures f
    where f.fixture_id = p_fixture_id
  ),
  lados as (
    select 'home'::text as side, a.home_team_id as team_id, a.home_team_name as team_name, a.* from alvo a
    union all
    select 'away'::text, a.away_team_id, a.away_team_name, a.* from alvo a
  ),
  jogos as (
    select l.side, l.team_id, l.team_name,
           f.fixture_id as past_fixture_id,
           (f.kickoff_utc at time zone 'UTC' at time zone 'America/Sao_Paulo')::date as data,
           (f.competition = l.competition and f.season = l.season) as mesma_competicao,
           (f.home_team_id = l.team_id) as em_casa,
           case when f.home_team_id = l.team_id then f.away_team_name else f.home_team_name end as adversario,
           case when f.home_team_id = l.team_id then f.away_team_id else f.home_team_id end as adversario_id,
           (case when f.home_team_id = l.team_id then f.goals_home else f.goals_away end)::integer as gols_pro,
           (case when f.home_team_id = l.team_id then f.goals_away else f.goals_home end)::integer as gols_contra
    from lados l
    -- Sem filtro de competição nem temporada: esta é a JANELA DA PREMISSA, e o
    -- modelo mede os últimos jogos do time em qualquer competição (#350).
    join futebol.fact_fixtures f
      on f.status_short in ('FT', 'AET', 'PEN')
     and f.kickoff_utc < l.kickoff_utc
     and (f.home_team_id = l.team_id or f.away_team_id = l.team_id)
     and f.goals_home is not null
     and f.goals_away is not null
  ),
  recentes as (
    select j.*, row_number() over (partition by j.side order by j.data desc, j.past_fixture_id desc) as rn
    from jogos j
  ),
  janela as (
    select r.*, row_number() over (partition by r.side order by r.data asc, r.past_fixture_id asc) as ordem
    from recentes r
    where r.rn <= greatest(p_max, 1)
  )
  select w.side,
         w.team_id,
         w.team_name,
         w.past_fixture_id,
         w.data,
         w.ordem,
         w.mesma_competicao,
         w.em_casa,
         w.adversario,
         w.adversario_id,
         w.gols_pro,
         w.gols_contra,
         (w.gols_pro + w.gols_contra)::integer as total_gols,
         (w.gols_pro > 0 and w.gols_contra > 0) as ambos_marcaram,
         (w.gols_contra = 0) as sem_sofrer,
         (w.gols_pro = 0) as sem_marcar,
         s.expected_goals as xg,
         sa.expected_goals as xg_contra,
         case when w.gols_pro > w.gols_contra then 'V'
              when w.gols_pro = w.gols_contra then 'E'
              else 'D' end as resultado
  from janela w
  left join futebol.fact_fixture_stats s
         on s.fixture_id = w.past_fixture_id and s.team_id = w.team_id
  left join futebol.fact_fixture_stats sa
         on sa.fixture_id = w.past_fixture_id and sa.team_id <> w.team_id
  order by w.side, w.ordem;
$function$

;

-- ── Cotações de referência (migration 20260826010945) ───────────────────────
-- Distingue linha sem cotação de candidata cotada que não passou pelo funil.
CREATE OR REPLACE FUNCTION public.get_futebol_fixture_quotes(p_fixture_id bigint)
RETURNS TABLE(
  market_key text, market_label text, outcome_label text, outcome_order integer,
  line double precision, pinnacle_odd double precision, avg_odd double precision,
  reference_odd double precision, best_odd double precision, best_book text,
  n_books integer, pin_open double precision, pin_close double precision
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  with base as (
    select o.market_name, o.outcome_label, o.bookmaker_name, o.collection_window,
           o.odd_decimal, o.line_value, f.kickoff_utc
    from futebol.fact_odds_snapshot o
    join futebol.fact_fixtures f on f.fixture_id = o.fixture_id
    where o.fixture_id = p_fixture_id
      and ( o.market_name = 'Match Winner'
         or o.market_name = 'Both Teams Score'
         or o.market_name = 'Double Chance'
         or (o.market_name = 'Goals Over/Under' and o.outcome_label in
             ('Over 0.5','Under 0.5','Over 1.5','Under 1.5','Over 2.5','Under 2.5',
              'Over 3.5','Under 3.5','Over 4.5','Under 4.5'))
         or (o.market_name = 'Asian Handicap'
             and abs(o.line_value - trunc(o.line_value)) = 0.5
             and abs(o.line_value) <= 2.5))
  ),
  ranked as (
    select b.*,
      case b.collection_window
        when 't15m' then 4 when 't1h' then 3 when 't24h' then 2
        when 'daily' then 1 else 0
      end as window_rank
    from base b
  ),
  chosen_window as (
    select market_name, outcome_label,
      case
        when max(kickoff_utc) <= (now() at time zone 'UTC') then coalesce(
          max(window_rank) filter (where collection_window = 't15m'),
          max(window_rank) filter (where collection_window = 't1h'),
          max(window_rank) filter (where collection_window = 't24h'),
          max(window_rank) filter (where collection_window = 'daily')
        )
        else max(window_rank)
      end as window_rank
    from ranked
    group by market_name, outcome_label
  ),
  current_quotes as (
    select distinct on (r.market_name, r.outcome_label, r.bookmaker_name)
      r.market_name, r.outcome_label, r.bookmaker_name, r.odd_decimal, r.line_value
    from ranked r
    join chosen_window w using (market_name, outcome_label, window_rank)
    order by r.market_name, r.outcome_label, r.bookmaker_name
  ),
  agg as (
    select c.market_name, c.outcome_label, max(c.line_value) as line_value,
      count(distinct c.bookmaker_name)::int as n_books,
      avg(c.odd_decimal) as avg_odd,
      percentile_disc(0.5) within group (order by c.odd_decimal) as reference_odd
    from current_quotes c
    group by c.market_name, c.outcome_label
  ),
  best_book as (
    select distinct on (c.market_name, c.outcome_label)
      c.market_name, c.outcome_label, c.bookmaker_name, c.odd_decimal
    from current_quotes c
    order by c.market_name, c.outcome_label, c.odd_decimal desc
  ),
  pinnacle as (
    select b.market_name, b.outcome_label,
      max(b.odd_decimal) filter (where b.collection_window='t24h') as t24,
      max(b.odd_decimal) filter (where b.collection_window='t1h') as t1,
      max(b.odd_decimal) filter (where b.collection_window='t15m') as t15
    from base b
    where b.bookmaker_name = 'Pinnacle'
    group by b.market_name, b.outcome_label
  )
  select
    case a.market_name
      when 'Match Winner' then 'match_winner'
      when 'Goals Over/Under' then 'over_under'
      when 'Both Teams Score' then 'btts'
      when 'Double Chance' then 'double_chance'
      when 'Asian Handicap' then 'asian_handicap'
    end,
    a.market_name,
    a.outcome_label,
    case
      when a.outcome_label in ('Home','Yes','Home/Draw')
        or a.outcome_label like 'Over %' or a.outcome_label like 'Home %' then 1
      when a.outcome_label in ('Draw','No','Home/Away')
        or a.outcome_label like 'Under %' or a.outcome_label like 'Away %' then 2
      else 3
    end,
    case when a.market_name in ('Goals Over/Under','Asian Handicap') then a.line_value end,
    coalesce(p.t15, p.t1, p.t24), a.avg_odd, a.reference_odd,
    bb.odd_decimal, bb.bookmaker_name, a.n_books, p.t24, coalesce(p.t15, p.t1)
  from agg a
  join best_book bb using (market_name, outcome_label)
  left join pinnacle p using (market_name, outcome_label)
  where a.market_name <> 'Asian Handicap' or a.n_books >= 3
  order by 1, 5 nulls first, 4;
$function$;

-- ── 5d. Contrato de motivos da leitura dos cinco mercados (migration 109) ────
-- O banco escolhe o grupo de cada motivo. A tela apenas renderiza o contrato,
-- sem converter uma premissa do lado oposto em uma frase "contra".
-- O retorno tabular mudou na virada do Score de contexto, e o Postgres recusa
-- `create or replace` que altere o RETURNS TABLE. Derruba antes de recriar.
drop function if exists public.get_futebol_fixture_reason_contract(bigint);
CREATE OR REPLACE FUNCTION public.get_futebol_fixture_reason_contract(p_fixture_id bigint)
returns table(
  market text,
  outcome text,
  line_value double precision,
  score integer,
  favor jsonb,
  contra jsonb
)
language sql
stable
security definer
set search_path to ''
as $function$
  with base as (
    select
      v.market, v.outcome, v.line_value, v.score,
      p.acesas, p.apagadas, p.penalidades as penalidades_ativas,
      case v.market
        when 'goals_over_under' then case v.outcome
          when 'Over' then array[
            'defesas_vazaveis', 'ataque_combinado', 'xg_combinado_alto',
            'ambos_vazam', 'ritmo_alto', 'historico_over'
          ]::text[]
          when 'Under' then array[
            'defesas_firmes', 'xg_baixo_combinado', 'clean_sheets_altos',
            'ataques_fracos', 'historico_under'
          ]::text[]
          else array[]::text[]
        end
        when 'match_winner' then case v.outcome
          when 'Home' then array[
            'forma', 'mando', 'superioridade_tabela', 'forca_mismatch',
            'superioridade_xg', 'h2h_favoravel', 'desfalque_adversario'
          ]::text[]
          when 'Away' then array[
            'forma', 'mando', 'superioridade_tabela', 'forca_mismatch',
            'superioridade_xg', 'h2h_favoravel', 'desfalque_adversario'
          ]::text[]
          else array[]::text[]
        end
        when 'asian_handicap' then case
          -- A linha é guardada na ótica do mandante. Para o visitante, o
          -- sinal representa a saída espelhada e precisa ser lido ao contrário.
          when (v.outcome = 'Home' and v.line_value < 0)
            or (v.outcome = 'Away' and v.line_value > 0) then array[
            'tende_golear', 'supremacia', 'sem_rodizio',
            'adversario_fragil_fora', 'mando_forte'
          ]::text[]
          when v.line_value <> 0 then array[
            'defesa_fora_solida', 'raramente_perde_por_2'
          ]::text[]
          else array[]::text[]
        end
        when 'btts' then case v.outcome
          when 'Yes' then array[
            'ambos_marcam', 'ataque_dos_dois', 'defesas_vazaveis', 'historico_btts'
          ]::text[]
          when 'No' then array[
            'defesa_forte', 'ataque_trava', 'historico_seco'
          ]::text[]
          else array[]::text[]
        end
        when 'double_chance' then array[
          'lado_coberto_forte', 'equilibrio_defensivo',
          'adversario_limitado', 'invicto_recente'
        ]::text[]
        else array[]::text[]
      end as aplicaveis
    from public.get_futebol_fixture_value(p_fixture_id) v
    join public.get_futebol_fixture_premissas(p_fixture_id) p
      on p.market = v.market
     and p.outcome = v.outcome
     and p.line_value is not distinct from v.line_value
  )
  select
    b.market,
    b.outcome,
    b.line_value,
    b.score,
    -- Sem o gate `pts_premissas > 0` que existia aqui. Ele era herança da nota
    -- antiga, em que a linha podia ser publicada só pelo preço e as premissas
    -- não contribuíam. No Score de contexto, premissa aplicável e acesa É
    -- contribuição por definição — e manter o gate deixaria A favor vazio numa
    -- linha legacy publicada pelo preço, entre esta migration e a troca do mart.
    coalesce((
      select jsonb_agg(jsonb_build_object('id', slug, 'tipo', 'premissa') order by slug)
      from unnest(b.acesas) slug
      where slug = any(b.aplicaveis)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', slug, 'tipo', 'premissa') order by slug)
      from unnest(b.apagadas) slug
      where slug = any(b.aplicaveis)
    ), '[]'::jsonb)
    || coalesce((
      select jsonb_agg(jsonb_build_object('id', slug, 'tipo', 'penalidade') order by slug)
      from unnest(b.penalidades_ativas) slug
      where slug <> 'favorito_irregular'
    ), '[]'::jsonb)
  from base b;
$function$;

-- ── 5e. Alertas de publicação no Telegram (migration 111) ───────────────────
-- São RPCs internas da Edge Function; não expor a anon/autenticated.
CREATE OR REPLACE FUNCTION public.claim_futebol_publication_alert_batch(
  p_sync_at timestamptz,
  p_opportunities jsonb
)
RETURNS TABLE(batch_id uuid, alert_id uuid, opportunity_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
-- Ver 118: a saída e a coluna têm o mesmo nome, e sem esta diretiva o alvo do
-- ON CONFLICT e o RETURNING abaixo ficam ambíguos — a função falhava em TODA
-- execução.
#variable_conflict use_column
DECLARE
  v_batch_id uuid;
BEGIN
  -- O advisory lock torna o polling idempotente mesmo se dois crons
  -- coincidirem: sem ele, duas execuções sobrepostas não enxergam as linhas
  -- ainda não commitadas uma da outra, criam dois lotes e mandam duas mensagens
  -- para o mesmo destinatário no mesmo minuto.
  PERFORM pg_advisory_xact_lock(hashtext('futebol-publication-alerts'));

  WITH incoming AS (
    SELECT *
    FROM jsonb_to_recordset(p_opportunities) AS x(
      opportunity_key text,
      fixture_id bigint,
      home_team_name text,
      away_team_name text,
      competition text,
      kickoff_utc timestamptz,
      market text,
      outcome text,
      line_value double precision,
      best_odd numeric,
      score integer,
      faixa text,
      score_versao text,
      janela_usada text,
      edge double precision,
      prob_justa_fechamento double precision,
      evidencias text[]
    )
  )
  INSERT INTO public.futebol_publication_alert_batches (sync_at)
  SELECT p_sync_at
  WHERE EXISTS (
    SELECT 1 FROM incoming i
    WHERE NOT EXISTS (
      SELECT 1 FROM public.futebol_publication_alerts a
      WHERE a.opportunity_key = i.opportunity_key
    )
  )
  RETURNING id INTO v_batch_id;

  IF v_batch_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH incoming AS (
    SELECT *
    FROM jsonb_to_recordset(p_opportunities) AS x(
      opportunity_key text,
      fixture_id bigint,
      home_team_name text,
      away_team_name text,
      competition text,
      kickoff_utc timestamptz,
      market text,
      outcome text,
      line_value double precision,
      best_odd numeric,
      score integer,
      faixa text,
      score_versao text,
      janela_usada text,
      edge double precision,
      prob_justa_fechamento double precision,
      evidencias text[]
    )
  ), inserted AS (
    INSERT INTO public.futebol_publication_alerts (
      batch_id, opportunity_key, fixture_id, home_team_name, away_team_name,
      competition, kickoff_utc, market, outcome, line_value, best_odd, score,
      faixa, score_versao, janela_usada, edge, prob_justa_fechamento, evidencias
    )
    SELECT v_batch_id, i.opportunity_key, i.fixture_id, i.home_team_name,
           i.away_team_name, i.competition, i.kickoff_utc, i.market,
           i.outcome, i.line_value, i.best_odd, i.score, i.faixa,
           -- Alerta antigo permanece legacy; o detector novo manda a escala.
           coalesce(i.score_versao, 'legacy'),
           i.janela_usada, i.edge, i.prob_justa_fechamento, i.evidencias
    FROM incoming i
    ON CONFLICT (opportunity_key) DO NOTHING
    RETURNING id, opportunity_key
  )
  SELECT v_batch_id, i.id, i.opportunity_key FROM inserted i;
END;
$function$;

alter table public.users add column if not exists futebol_trial_started_at timestamptz;
alter table public.users add column if not exists futebol_subscription_status text not null default 'free';
-- ⚠️ DÍVIDA: as tabelas da migration 111 (futebol_publication_alerts,
-- _batches, _deliveries e _pick_refs) nunca entraram neste arquivo, embora as
-- funções que as usam tenham entrado. Um ALTER TABLE aqui abortaria a provisão
-- inteira, porque check_function_bodies=off cobre corpo de função e não DDL de
-- tabela. A coluna score_versao é da migration 113; trazer as tabelas para cá é
-- a correção de verdade, e é o mesmo modo de falha da issue #250.

alter table public.users add column if not exists futebol_publication_alerts_enabled boolean not null default true;
alter table public.users add column if not exists futebol_publication_alerts_ack_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_futebol_publication_alert_recipients()
RETURNS TABLE(user_id uuid, chat_id text, user_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT u.id, u.telegram_chat_id::text, u.name::text
  FROM public.users u
  WHERE u.telegram_chat_id IS NOT NULL
    AND coalesce(u.futebol_publication_alerts_enabled, true) = true
    AND (
      coalesce(u.futebol_subscription_status, 'free') = 'premium'
      OR (
        u.futebol_trial_started_at IS NOT NULL
        AND u.futebol_trial_started_at + interval '7 days' > now()
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.claim_futebol_publication_alert_deliveries()
RETURNS TABLE(batch_id uuid, user_id uuid, chat_id text, attempt_id uuid, opportunities jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.futebol_publication_alert_deliveries d
  SET status = 'expired', attempt_id = NULL, claimed_at = NULL
  WHERE d.status IN ('pending', 'failed', 'processing')
    AND NOT EXISTS (
      SELECT 1 FROM public.futebol_publication_alerts a
      WHERE a.batch_id = d.batch_id AND a.kickoff_utc > now()
    );

  RETURN QUERY
  WITH claimed AS (
    UPDATE public.futebol_publication_alert_deliveries d
    SET status = 'processing', attempts = d.attempts + 1,
        attempt_id = gen_random_uuid(), claimed_at = now(), last_attempt_at = now()
    FROM public.users u
    WHERE d.user_id = u.id
      AND d.status IN ('pending', 'failed')
      AND u.telegram_chat_id IS NOT NULL
      AND coalesce(u.futebol_publication_alerts_enabled, true) = true
      AND EXISTS (
        SELECT 1 FROM public.futebol_publication_alerts a
        WHERE a.batch_id = d.batch_id AND a.kickoff_utc > now()
      )
      AND (
        coalesce(u.futebol_subscription_status, 'free') = 'premium'
        OR (u.futebol_trial_started_at IS NOT NULL
          AND u.futebol_trial_started_at + interval '7 days' > now())
      )
    RETURNING d.batch_id, d.user_id, u.telegram_chat_id::text, d.attempt_id
  )
  SELECT c.batch_id, c.user_id, c.telegram_chat_id, c.attempt_id,
    jsonb_agg(jsonb_build_object(
      'alert_id', a.id, 'fixture_id', a.fixture_id,
      'home_team_name', a.home_team_name, 'away_team_name', a.away_team_name,
      'competition', a.competition, 'kickoff_utc', a.kickoff_utc,
      'market', a.market, 'outcome', a.outcome, 'line_value', a.line_value,
      'best_odd', a.best_odd, 'score', a.score, 'faixa', a.faixa,
      'evidencias', a.evidencias
    ) ORDER BY a.score DESC)
  FROM claimed c
  JOIN public.futebol_publication_alerts a ON a.batch_id = c.batch_id
  WHERE a.kickoff_utc > now()
  GROUP BY c.batch_id, c.user_id, c.telegram_chat_id, c.attempt_id;
END;
$function$;

-- ── 6. Grants de execução (anon / authenticated / service_role) ──────────────
grant execute on function public._futebol_team_form(p_team_id bigint, p_competition text, p_season bigint, p_before date) to anon, authenticated, service_role;
grant execute on function public.get_futebol_access() to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_detail(p_fixture_id bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_extras(p_fixture_id bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_injuries(p_fixture_id bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_odds(p_fixture_id bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_quotes(p_fixture_id bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_prediction(p_fixture_id bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_value(p_fixture_id bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixtures(p_competition text, p_season bigint, p_round text) to anon, authenticated, service_role;
grant execute on function public.get_futebol_h2h(p_home_id bigint, p_away_id bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_leaders(p_competition text, p_season bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_matchup_markets(p_home_id bigint, p_away_id bigint, p_competition text, p_season bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_odds_board() to anon, authenticated, service_role;
grant execute on function public.get_futebol_standings(p_competition text, p_season bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_standings_official(p_competition text, p_season bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_team_profile(p_team_id bigint, p_competition text, p_season bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_team_season(p_team_id bigint, p_competition text, p_season bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_teams() to anon, authenticated, service_role;
grant execute on function public.get_futebol_value_board() to anon, authenticated, service_role;
grant execute on function public.get_futebol_value_history(p_from date, p_to date) to anon, authenticated, service_role;
-- As oito da seção 5c (migrations 091 a 096), que faltavam junto com as funções.
grant execute on function public.futebol_dia_brt(p_kickoff_utc timestamp without time zone) to anon, authenticated, service_role;
grant execute on function public.get_futebol_alerted_picks(p_day date) to anon, authenticated, service_role;
grant execute on function public.get_futebol_competitions() to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_days(p_from date, p_to date) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixtures_by_day(p_day date, p_competitions text[]) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_premissas(p_fixture_id bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_numeros(p_fixture_id bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_historico(p_fixture_id bigint, p_max integer) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_reason_contract(p_fixture_id bigint) to anon, authenticated, service_role;

-- ── "Disponível desde" no detalhe do jogo (migration 114, issue #300) ──────
-- ⚠️ A função devolve a corrida da ÚLTIMA versão que o snapshot tem, inclusive
-- de chave que já saiu do board. É de propósito: é o que faz o campo continuar
-- respondendo no jogo encerrado, cujo detalhe lê a foto do apito (migration
-- 101) — e o caso de aceite da issue é justamente um jogo de 25/08. Quem decide
-- se aquilo está publicado AGORA é get_futebol_fixture_value, e a tela só
-- escreve a frase quando as duas concordam.
--
-- Medido no dev em 29/08/2026: das 284 chaves do snapshot, 276 têm a última
-- versão fechada e 8 têm versão aberta; nenhuma das 8 está fora do board. Ou
-- seja, o snapshot fecha a linha quando a oportunidade sai, e por isso os
-- buracos existem — são 74 chaves com reativação. Sem esse fechamento não
-- haveria ilha nenhuma e o campo viraria o MIN da chave, que é a forma 1 de
-- mentir.

DROP FUNCTION IF EXISTS public.get_futebol_fixture_disponivel_desde(bigint);

CREATE FUNCTION public.get_futebol_fixture_disponivel_desde(p_fixture_id bigint)
RETURNS TABLE(
  market text,
  outcome text,
  line_value double precision,
  disponivel_desde timestamp without time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  -- Ilhas e buracos sobre as versões do snapshot. Versões contíguas
  -- (dbt_valid_to de uma = dbt_valid_from da seguinte) são ATUALIZAÇÃO da mesma
  -- disponibilidade; um buraco entre elas é REATIVAÇÃO, e reinicia o relógio.
  with versoes as (
    select
      h.opportunity_key,
      h.market,
      h.outcome,
      h.line_value,
      h.dbt_valid_from,
      lag(h.dbt_valid_to) over (
        partition by h.opportunity_key order by h.dbt_valid_from
      ) as fim_da_anterior
    from futebol.fact_value_opportunities_hist h
    join futebol.fact_fixtures fx on fx.fixture_id = h.fixture_id
    -- Só versões anteriores ao apito. O mart é full-refresh e continua
    -- reescrevendo o jogo depois de encerrado — medido: 97% das versões nascem
    -- DEPOIS do apito, em média 668h depois. Sem este corte, uma chave fechada
    -- e reaberta no dia seguinte faria a tela dizer "disponível desde" um
    -- horário posterior ao fim da partida.
    where h.fixture_id = p_fixture_id
      and h.dbt_valid_from < fx.kickoff_utc
  ), ilhas as (
    select
      v.*,
      -- Cada vez que o fim da versão anterior não encosta no início desta,
      -- começa uma ilha nova. A primeira versão sempre abre uma.
      count(*) filter (where v.fim_da_anterior is distinct from v.dbt_valid_from) over (
        partition by v.opportunity_key
        order by v.dbt_valid_from
        rows between unbounded preceding and current row
      ) as ilha
    from versoes v
  ), por_chave as (
    select distinct on (i.opportunity_key)
      i.opportunity_key,
      i.market,
      i.outcome,
      i.line_value,
      -- Início da ilha da versão MAIS RECENTE: a disponibilidade atual.
      min(i.dbt_valid_from) over (partition by i.opportunity_key, i.ilha) as inicio_da_ilha,
      -- Primeira versão que o snapshot tem desta chave, para detectar o caso 3.
      min(i.dbt_valid_from) over (partition by i.opportunity_key) as primeira_versao
    from ilhas i
    order by i.opportunity_key, i.dbt_valid_from desc
  )
  select
    c.market,
    c.outcome,
    c.line_value,
    -- Vazio quando a corrida atual começa na primeira versão que o snapshot tem
    -- E essa versão está na estreia dele: aí o horário é a data em que o
    -- snapshot passou a existir, não a hora em que a oportunidade foi publicada.
    -- Uma reativação POSTERIOR à estreia continua confiável, e por isso a
    -- comparação é com o início da ilha, não com a chave inteira.
    case
      when c.inicio_da_ilha = c.primeira_versao
       and c.primeira_versao < timestamp '2026-07-28 00:00:00'
      then null
      else c.inicio_da_ilha
    end
  from por_chave c
  order by c.market, c.outcome, c.line_value;
$function$;

GRANT EXECUTE ON FUNCTION public.get_futebol_fixture_disponivel_desde(bigint) TO anon, authenticated, service_role;

revoke all on function public.claim_futebol_publication_alert_batch(timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.claim_futebol_publication_alert_batch(timestamptz, jsonb) to service_role;
revoke all on function public.get_futebol_publication_alert_recipients() from public, anon, authenticated;
grant execute on function public.get_futebol_publication_alert_recipients() to service_role;
revoke all on function public.claim_futebol_publication_alert_deliveries() from public, anon, authenticated;
grant execute on function public.claim_futebol_publication_alert_deliveries() to service_role;

-- ── Vitrine do produto: mercado fora da tela (migration 116, issue #324) ────
-- Um mercado pode sair da VITRINE sem sair do BOARD: o backend continua
-- publicando e gravando no histórico, e só o que o assinante vê muda. Parar de
-- publicar pararia de medir, e é a medição que decide quando o mercado volta.
--
-- A lista mora aqui e não em constante porque são dois consumidores em runtimes
-- diferentes — o painel (browser) e as DMs do Telegram (edge functions, Deno) —
-- e devolver o mercado à tela tem de ser um UPDATE, não um release.
create table if not exists public.futebol_mercados_ocultos (
  market text primary key,
  -- A linha sobrevive a "oculto = false": ela é o registro de que o mercado JÁ
  -- esteve fora, e "oculto_desde" diz desde quando. É o que torna o antes/depois
  -- comparável quando ele voltar.
  oculto boolean not null default true,
  oculto_desde timestamptz not null default now(),
  motivo text not null
);

-- RLS ligada e SEM policy, no mesmo padrão da futebol_premissa_copy: nada lê a
-- tabela direto, só a RPC security definer abaixo.
alter table public.futebol_mercados_ocultos enable row level security;

comment on table public.futebol_mercados_ocultos is
  'Mercados retirados da vitrine do produto. Não é gate: o board continua publicando.';

create or replace function public.get_futebol_mercados_ocultos()
returns text[]
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select coalesce(array_agg(market order by market), array[]::text[])
    from public.futebol_mercados_ocultos
   where oculto;
$function$;

grant execute on function public.get_futebol_mercados_ocultos() to anon, authenticated, service_role;

-- A MESMA vitrine, com a data em que cada mercado saiu (migration 119). A data
-- é o que separa a linha que foi publicada e vista da que nunca esteve na
-- tela: sem ela o painel só sabia esconder o presente, e o histórico devolvia
-- o mercado escondido no dia seguinte.
--
-- Convive com a leitura acima em vez de substituí-la: as duas funções de
-- notificação só olham o board — presente e futuro, sempre depois do corte —
-- e para elas a lista de nomes basta.
create or replace function public.get_futebol_vitrine()
returns table (market text, oculto_desde timestamptz)
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select o.market, o.oculto_desde
    from public.futebol_mercados_ocultos o
   where o.oculto
   order by o.market;
$function$;

comment on function public.get_futebol_vitrine() is
  'Mercados fora da vitrine COM a data de corte. A data é o que separa a linha que foi publicada e vista da que nunca esteve na tela.';

grant execute on function public.get_futebol_vitrine() to anon, authenticated, service_role;

insert into public.futebol_mercados_ocultos (market, oculto, oculto_desde, motivo)
values (
  'asian_handicap',
  true,
  timestamptz '2026-09-01 00:00:00+00',
  'ROI -48,4 em 23 linhas publicadas (EP 16,5), contra +22,3 do Gols. Investigacao na B3 (ClickUp wdx6zev656). Decisao do PM em 31/08/2026, prop-play-predictor#324.'
)
on conflict (market) do nothing;

-- ── 7. Reverse trial (7 dias, sem cartão) — colunas no public.users ──────────
alter table public.users add column if not exists futebol_trial_started_at timestamptz;
alter table public.users add column if not exists futebol_subscription_status text not null default 'free';


-- ── 8. CHECAGEM DE DERIVA (rodar DEPOIS de aplicar, e sempre que desconfiar) ─
-- ----------------------------------------------------------------------------
-- Este arquivo já divergiu do banco onze vezes seguidas (migrations 091 a 103),
-- e nenhuma delas apareceu sozinha: o `check_schema_parity` do sync confere
-- TABELA, nunca FUNÇÃO, então uma RPC faltando passa verde e só quebra quando
-- alguém provisiona ambiente novo. A divergência da vez foi achada por code
-- review, e review não é processo.
--
-- FONTE DA VERDADE: o banco de DEV (kpbjuplcwiyrymafhehz). Este arquivo é um
-- retrato dele, não o contrário. Quem cria RPC nova numa migration é responsável
-- por trazê-la para cá no MESMO PR.
--
-- ⚠️ A GUARDA AUTOMÁTICA é `src/utils/shape-file-futebol.test.ts`, e ela roda
-- na suíte de testes, sem precisar de banco. Compara ARQUIVO contra ARQUIVO:
--
--   · toda função que alguma migration de `supabase/migrations/` cria tem que
--     existir aqui (foi o buraco de oito funções achado em 18/08)
--   · toda função declarada aqui tem que ter grant, e vice-versa
--   · o arquivo não pode ter BOM (um BOM aqui vira `syntax error at or near "ï"`
--     no psql, e já aconteceu)
--
-- Quem criar RPC nova numa migration e esquecer deste arquivo vai ver o teste
-- vermelho no próprio PR, com o nome da função e da migration que a criou.
--
-- As consultas abaixo são o complemento MANUAL, para conferir contra o banco
-- vivo o que a comparação de arquivos não alcança: corpo e assinatura reais.
-- Rodar depois de aplicar, e sempre que desconfiar.
/*
select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as no_banco,
       length(pg_get_functiondef(p.oid)) as tamanho
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'get_futebol%' or p.proname like '%futebol%')
order by 1;
*/
-- E esta devolve as ASSINATURAS, para pegar o caso mais traiçoeiro: a função
-- existe nos dois lados mas o RETURNS TABLE mudou (foi o que aconteceu com a
-- get_futebol_standings_official, que ficou sem `group_name` e devolvia 12
-- colunas onde o front esperava 13, sem erro nenhum, só coluna sumida na tela).
/*
select p.proname, pg_get_function_result(p.oid) as returns
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'get_futebol%'
order by 1;
*/

-- ============================================================================
-- §TEARDOWN do FDW BigQuery — rodar SÓ NO DEV, e SÓ depois de validar o sync novo
-- (parity OK + RPCs retornando dados). No PROD nunca existiu FDW de futebol: PULAR.
-- Descomente para executar:
-- ----------------------------------------------------------------------------
-- select cron.unschedule('futebol-sync-daily');           -- para o sync_all() horário
-- drop procedure if exists futebol.sync_all();             -- procedure do loader antigo
-- drop schema if exists bq_futebol cascade;                -- foreign tables do FDW
-- drop server if exists bigquery_server cascade;           -- server FDW BigQuery
-- -- delete from vault.secrets where name ilike '%bigquery%';   -- chave SA do BQ no Vault
-- -- drop extension if exists wrappers;   -- só se NENHUM outro FDW usar (NBA já dropou)
-- ============================================================================
