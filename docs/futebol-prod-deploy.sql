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
-- Tabelas sincronizadas (21): dim_leagues, dim_teams, fact_fixtures, fact_fixture_stats, fact_fixture_events, fact_fixture_lineups, fact_fixture_lineups_players, fact_fixture_player_stats, fact_h2h, fact_injuries_snapshot, fact_standings_snapshot, fact_team_season_stats, fact_odds_snapshot, fact_predictions_api, int_futebol_odds_devig, int_futebol_premissas_1x2, int_futebol_premissas_ou, int_futebol_premissas_ah, int_futebol_premissas_btts, int_futebol_premissas_dc, fact_value_opportunities
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
  "dbt_loaded_at" timestamp
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
  "linha_subindo" boolean,
  "defesas_firmes" boolean,
  "clean_sheets_altos" boolean,
  "xg_baixo_combinado" boolean,
  "ataques_fracos" boolean,
  "historico_under" boolean,
  "linha_descendo" boolean,
  "linha_extrema" boolean,
  "pts_premissas" bigint,
  "penalidades_ou_pts" bigint,
  "dbt_loaded_at" timestamp
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
  "dbt_loaded_at" timestamp
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
  "dbt_loaded_at" timestamp
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
  "dbt_loaded_at" timestamp
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
  "dbt_loaded_at" timestamp
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
CREATE INDEX IF NOT EXISTS fact_h2h_h2h_pair_key_idx ON futebol.fact_h2h USING btree (h2h_pair_key);
CREATE INDEX IF NOT EXISTS fact_injuries_snapshot_fixture_id_idx ON futebol.fact_injuries_snapshot USING btree (fixture_id);
CREATE INDEX IF NOT EXISTS fact_odds_snapshot_fixture_id_idx ON futebol.fact_odds_snapshot USING btree (fixture_id);
CREATE INDEX IF NOT EXISTS fact_odds_snapshot_fixture_id_market_name_outcome_label_idx ON futebol.fact_odds_snapshot USING btree (fixture_id, market_name, outcome_label);
CREATE INDEX IF NOT EXISTS fact_predictions_api_fixture_id_idx ON futebol.fact_predictions_api USING btree (fixture_id);
CREATE INDEX IF NOT EXISTS fact_standings_snapshot_competition_season_snapshot_date_idx ON futebol.fact_standings_snapshot USING btree (competition, season, snapshot_date);
CREATE INDEX IF NOT EXISTS fact_standings_snapshot_team_id_idx ON futebol.fact_standings_snapshot USING btree (team_id);
CREATE INDEX IF NOT EXISTS fact_team_season_stats_team_id_competition_season_idx ON futebol.fact_team_season_stats USING btree (team_id, competition, season);
CREATE INDEX IF NOT EXISTS fact_value_opportunities_fixture_id_idx ON futebol.fact_value_opportunities USING btree (fixture_id);
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
declare v_fix record;
begin
  select f.* into v_fix from futebol.fact_fixtures f where f.fixture_id = p_fixture_id limit 1;
  if not found then return jsonb_build_object('events', '[]'::jsonb); end if;

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
    'lineups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', l.team_id, 'team_name', l.team_name, 'team_side', l.team_side,
        'formation', l.formation, 'coach_name', l.coach_name
      )) from (
        select team_id, team_name, team_side, formation, coach_name
        from futebol.fact_fixture_lineups where fixture_id = p_fixture_id
      ) l
    ), '[]'::jsonb),
    'lineup_players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'team_id', lp.team_id, 'team_side', lp.team_side, 'is_starter', lp.is_starter,
        'player_slot', lp.player_slot, 'player_id', lp.player_id, 'player_name', lp.player_name,
        'shirt_number', lp.shirt_number, 'position', lp.position, 'grid', lp.grid
      ) order by lp.team_side, lp.is_starter desc nulls last, lp.player_slot) from (
        select team_id, team_side, is_starter, player_slot, player_id, player_name, shirt_number, position, grid
        from futebol.fact_fixture_lineups_players where fixture_id = p_fixture_id
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
  win_rank as ( select *, case when collection_window='t15m' then 3 when collection_window='t1h' then 2 else 1 end wr from base ),
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

CREATE OR REPLACE FUNCTION public.get_futebol_fixture_value(p_fixture_id bigint)
 RETURNS TABLE(market text, outcome text, outcome_order integer, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_valor integer, pts_premissas integer, pts_corroboracao integer, penalidades integer, penalidades_globais_pts integer, penalidades_especificas_pts integer, score integer, faixa text, modelo_api_concorda boolean, linha_sharp_confirma boolean, evidencias text[], avisos text[], contras text[])
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with d as (
    select distinct on (fixture_id, outcome_side, line_value) fixture_id, outcome_side, line_value,
      pen_odd_outlier, pen_poucas_casas, pen_odd_longshot, pen_odd_juice
    from futebol.int_futebol_odds_devig order by fixture_id, outcome_side, line_value
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
    v.pts_valor::int, v.pts_premissas::int, v.pts_corroboracao::int, v.penalidades::int,
    v.penalidades_globais_pts::int, v.penalidades_especificas_pts::int, v.score::int, v.faixa,
    v.modelo_api_concorda, v.linha_sharp_confirma,
    array_remove(array[
      case when p.forca_mismatch then 'Ataque forte contra defesa frágil do adversário' end,
      case when p.superioridade_xg then 'Cria mais chances de gol do que o adversário' end,
      case when p.mando then (case v.outcome when 'Home' then 'Manda bem em casa' when 'Away' then 'Vai bem fora de casa' else 'Mando relevante' end) end,
      case when p.desfalque_adversario then 'Adversário com desfalque de titular importante' end,
      case when p.superioridade_tabela then 'Bem à frente na tabela' end,
      case when p.forma then 'Em boa fase (vitórias recentes)' end,
      case when p.h2h_favoravel then 'Histórico favorável no confronto direto' end
    ], null)
    || array_remove(array[
      case when o.ataque_combinado then 'Os dois somam muitos gols (casa + fora)' end,
      case when o.defesas_vazaveis then 'Defesas frágeis dos dois lados' end,
      case when o.xg_combinado_alto then 'Os dois criam muitas chances de gol' end,
      case when o.ritmo_alto then 'Jogo de ritmo alto (muitas finalizações)' end,
      case when o.ambos_vazam then 'Os dois sofrem gol quase todo jogo' end,
      case when o.historico_over then 'Últimos jogos goleadores' end,
      case when o.linha_subindo then 'Mercado puxando a linha pra cima' end,
      case when o.defesas_firmes then 'Defesas firmes dos dois lados' end,
      case when o.clean_sheets_altos then 'Os dois passam muitos jogos sem sofrer gol' end,
      case when o.xg_baixo_combinado then 'Os dois criam pouca coisa na frente' end,
      case when o.ataques_fracos then 'Ataque fraco (passam em branco com frequência)' end,
      case when o.historico_under then 'Últimos jogos truncados' end,
      case when o.linha_descendo then 'Mercado puxando a linha pra baixo' end
    ], null)
    || array_remove(array[
      case when ah.supremacia then 'Muito superior ao adversário' end,
      case when ah.tende_golear then 'Costuma vencer com boa diferença de gols' end,
      case when ah.adversario_fragil_fora then 'Adversário tem defesa frágil' end,
      case when ah.mando_forte then 'Manda muito bem em casa' end,
      case when ah.sem_rodizio then 'Deve entrar com força máxima' end,
      case when ah.raramente_perde_por_2 then 'Raramente perde por 2 gols ou mais' end,
      case when ah.defesa_fora_solida then 'Defesa sólida jogando fora' end,
      case when ah.favorito_irregular then 'O favorito não costuma golear' end
    ], null)
    || array_remove(array[
      case when bt.ambos_marcam then 'Os dois quase sempre marcam' end,
      case when bt.ataque_dos_dois then 'Os dois ataques vêm produzindo' end,
      case when bt.defesas_vazaveis then 'As duas defesas sofrem gol com frequência' end,
      case when bt.historico_btts then 'Nos últimos jogos, os dois marcaram' end,
      case when bt.defesa_forte then 'Uma das defesas segura bem o placar' end,
      case when bt.ataque_trava then 'Um dos ataques costuma passar em branco' end,
      case when bt.historico_seco then 'Jogos recentes sem os dois marcarem' end
    ], null)
    || array_remove(array[
      case when dc.lado_coberto_forte then 'O lado coberto é claramente o mais forte' end,
      case when dc.equilibrio_defensivo then 'Defesas parelhas — empate é desfecho plausível' end,
      case when dc.adversario_limitado then 'Adversário com campanha fraca' end,
      case when dc.invicto_recente then 'Vem sem perder nos últimos jogos' end
    ], null)
    || array_remove(array[
      case when v.modelo_api_concorda and v.linha_sharp_confirma then 'As principais casas e o modelo da API apontam o mesmo lado'
           when v.modelo_api_concorda then 'Modelo da API concorda com esse lado'
           when v.linha_sharp_confirma then 'As principais casas vêm baixando a odd desse lado' end
    ], null),
    array_remove(array[
      case when d.pen_odd_outlier then 'Só uma casa paga essa odd — pode ser linha furada' end,
      case when d.pen_poucas_casas then 'Poucas casas cotando esse mercado' end,
      case when d.pen_odd_longshot then 'Odd alta (zebra) — entra com cautela' end,
      case when d.pen_odd_juice and v.market <> 'double_chance' then 'Odd baixa — retorno pequeno pro risco' end,
      case when p.pick_empate then 'Empate é o resultado mais difícil de prever' end,
      case when p.desfalque_proprio then 'Time apostado com desfalque de titular importante' end,
      case when o.linha_extrema then 'Linha extrema — pouco confiável' end,
      case when ah.handicap_alto then 'Handicap alto (2,5+ gols) — raramente confiável' end
    ], null),
    (array_remove(array[
      case when not coalesce(p.forca_mismatch, true) then 'Sem vantagem clara de ataque × defesa' end,
      case when not coalesce(p.mando, true) and v.outcome <> 'Draw' then 'Mando não pesa a favor' end,
      case when not coalesce(p.superioridade_tabela, true) then 'Times equilibrados na tabela' end,
      case when v.outcome='Over' and not coalesce(o.ataque_combinado, true) then 'Os dois não somam tantos gols' end,
      case when v.outcome='Over' and not coalesce(o.ritmo_alto, true) then 'Jogo não costuma ser de ritmo alto' end,
      case when v.outcome='Over' and not coalesce(o.xg_combinado_alto, true) then 'O volume de chances não é tão alto' end,
      case when v.outcome='Under' and not coalesce(o.defesas_firmes, true) then 'As defesas não são tão firmes' end,
      case when v.outcome='Under' and not coalesce(o.clean_sheets_altos, true) then 'Não costumam segurar o placar zerado' end,
      case when v.outcome='Under' and not coalesce(o.xg_baixo_combinado, true) then 'Criam chances demais pra um jogo truncado' end,
      case when ah.is_favorito and not coalesce(ah.supremacia, true) then 'Não é tão superior assim ao adversário' end,
      case when ah.is_favorito and not coalesce(ah.tende_golear, true) then 'Nem sempre vence com boa diferença' end,
      case when ah.is_azarao and not coalesce(ah.raramente_perde_por_2, true) then 'Já levou goleada algumas vezes' end,
      case when ah.is_azarao and not coalesce(ah.defesa_fora_solida, true) then 'Defesa fora não é das mais sólidas' end,
      case when v.outcome='Yes' and not coalesce(bt.ambos_marcam, true) then 'Nem sempre os dois marcam' end,
      case when v.outcome='Yes' and not coalesce(bt.defesas_vazaveis, true) then 'As defesas não são tão vazadas' end,
      case when v.outcome='No' and not coalesce(bt.defesa_forte, true) then 'Nenhuma defesa é tão sólida' end,
      case when v.outcome='No' and not coalesce(bt.ataque_trava, true) then 'Os dois ataques costumam marcar' end,
      case when not coalesce(dc.lado_coberto_forte, true) then 'O lado coberto não é claramente o mais forte' end,
      case when not coalesce(dc.adversario_limitado, true) then 'Adversário não é tão limitado' end
    ], null))[1:3]
  from futebol.fact_value_opportunities v
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  left join d on d.fixture_id = v.fixture_id and d.outcome_side = v.outcome and d.line_value is not distinct from v.line_value
  where v.fixture_id = p_fixture_id
  order by (case v.market when 'match_winner' then 1 when 'goals_over_under' then 2 when 'asian_handicap' then 3 when 'btts' then 4 when 'double_chance' then 5 else 9 end), 3;
$function$

;

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
             case when b.collection_window='t15m' then 3 when b.collection_window='t1h' then 2 else 1 end desc
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
 RETURNS TABLE(team_id bigint, team_name text, rank bigint, points bigint, played bigint, wins bigint, draws bigint, loses bigint, goals_for bigint, goals_against bigint, goals_diff bigint, rank_description text)
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
         s.goals_for_total, s.goals_against_total, s.goals_diff, s.rank_description
  from futebol.fact_standings_snapshot s
  where s.competition = p_competition and s.season = p_season and s.snapshot_date = v_date
  order by s.rank;
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

CREATE OR REPLACE FUNCTION public.get_futebol_value_board()
 RETURNS TABLE(fixture_id bigint, home_team_id bigint, away_team_id bigint, home_team_name text, away_team_name text, competition text, kickoff_utc timestamp without time zone, status_short text, market text, outcome text, line_value double precision, edge double precision, best_odd double precision, best_book text, avg_odd double precision, n_casas integer, janela_usada text, prob_justa_fechamento double precision, pts_valor integer, pts_premissas integer, pts_corroboracao integer, penalidades integer, score integer, faixa text, evidencias text[])
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select v.fixture_id, f.home_team_id, f.away_team_id, f.home_team_name, f.away_team_name,
    f.competition, f.kickoff_utc, f.status_short,
    v.market, v.outcome, v.line_value, v.edge, v.best_odd, v.best_book, v.avg_odd, v.n_casas::int, v.janela_usada, v.prob_justa_fechamento,
    v.pts_valor::int, v.pts_premissas::int, v.pts_corroboracao::int, v.penalidades::int, v.score::int, v.faixa,
    array_remove(array[
      case when p.forca_mismatch then 'Ataque forte contra defesa frágil do adversário' end,
      case when p.superioridade_xg then 'Cria mais chances de gol do que o adversário' end,
      case when p.mando then (case v.outcome when 'Home' then 'Manda bem em casa' when 'Away' then 'Vai bem fora de casa' else 'Mando relevante' end) end,
      case when p.desfalque_adversario then 'Adversário com desfalque de titular importante' end,
      case when p.superioridade_tabela then 'Bem à frente na tabela' end,
      case when p.forma then 'Em boa fase (vitórias recentes)' end,
      case when p.h2h_favoravel then 'Histórico favorável no confronto direto' end
    ], null)
    || array_remove(array[
      case when o.ataque_combinado then 'Os dois somam muitos gols (casa + fora)' end,
      case when o.defesas_vazaveis then 'Defesas frágeis dos dois lados' end,
      case when o.xg_combinado_alto then 'Os dois criam muitas chances de gol' end,
      case when o.ritmo_alto then 'Jogo de ritmo alto (muitas finalizações)' end,
      case when o.ambos_vazam then 'Os dois sofrem gol quase todo jogo' end,
      case when o.historico_over then 'Últimos jogos goleadores' end,
      case when o.linha_subindo then 'Mercado puxando a linha pra cima' end,
      case when o.defesas_firmes then 'Defesas firmes dos dois lados' end,
      case when o.clean_sheets_altos then 'Os dois passam muitos jogos sem sofrer gol' end,
      case when o.xg_baixo_combinado then 'Os dois criam pouca coisa na frente' end,
      case when o.ataques_fracos then 'Ataque fraco (passam em branco com frequência)' end,
      case when o.historico_under then 'Últimos jogos truncados' end,
      case when o.linha_descendo then 'Mercado puxando a linha pra baixo' end
    ], null)
    || array_remove(array[
      case when ah.supremacia then 'Muito superior ao adversário' end,
      case when ah.tende_golear then 'Costuma vencer com boa diferença de gols' end,
      case when ah.adversario_fragil_fora then 'Adversário tem defesa frágil' end,
      case when ah.mando_forte then 'Manda muito bem em casa' end,
      case when ah.sem_rodizio then 'Deve entrar com força máxima' end,
      case when ah.raramente_perde_por_2 then 'Raramente perde por 2 gols ou mais' end,
      case when ah.defesa_fora_solida then 'Defesa sólida jogando fora' end,
      case when ah.favorito_irregular then 'O favorito não costuma golear' end
    ], null)
    || array_remove(array[
      case when bt.ambos_marcam then 'Os dois quase sempre marcam' end,
      case when bt.ataque_dos_dois then 'Os dois ataques vêm produzindo' end,
      case when bt.defesas_vazaveis then 'As duas defesas sofrem gol com frequência' end,
      case when bt.historico_btts then 'Nos últimos jogos, os dois marcaram' end,
      case when bt.defesa_forte then 'Uma das defesas segura bem o placar' end,
      case when bt.ataque_trava then 'Um dos ataques costuma passar em branco' end,
      case when bt.historico_seco then 'Jogos recentes sem os dois marcarem' end
    ], null)
    || array_remove(array[
      case when dc.lado_coberto_forte then 'O lado coberto é claramente o mais forte' end,
      case when dc.equilibrio_defensivo then 'Defesas parelhas — empate é desfecho plausível' end,
      case when dc.adversario_limitado then 'Adversário com campanha fraca' end,
      case when dc.invicto_recente then 'Vem sem perder nos últimos jogos' end
    ], null)
    || array_remove(array[
      case when v.modelo_api_concorda and v.linha_sharp_confirma then 'As principais casas e o modelo da API apontam o mesmo lado'
           when v.modelo_api_concorda then 'Modelo da API concorda com esse lado'
           when v.linha_sharp_confirma then 'As principais casas vêm baixando a odd desse lado' end
    ], null)
  from futebol.fact_value_opportunities v
  join futebol.fact_fixtures f on f.fixture_id = v.fixture_id
  left join futebol.int_futebol_premissas_1x2 p on v.market='match_winner' and p.fixture_id = v.fixture_id and p.outcome = v.outcome
  left join futebol.int_futebol_premissas_ou o on v.market='goals_over_under' and o.fixture_id = v.fixture_id and o.outcome = v.outcome and o.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_ah ah on v.market='asian_handicap' and ah.fixture_id = v.fixture_id and ah.outcome = v.outcome and ah.line_value is not distinct from v.line_value
  left join futebol.int_futebol_premissas_btts bt on v.market='btts' and bt.fixture_id = v.fixture_id and bt.outcome = v.outcome
  left join futebol.int_futebol_premissas_dc dc on v.market='double_chance' and dc.fixture_id = v.fixture_id and dc.outcome = v.outcome
  order by v.score desc, v.edge desc;
$function$

;

-- ── 6. Grants de execução (anon / authenticated / service_role) ──────────────
grant execute on function public._futebol_team_form(p_team_id bigint, p_competition text, p_season bigint, p_before date) to anon, authenticated, service_role;
grant execute on function public.get_futebol_access() to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_detail(p_fixture_id bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_extras(p_fixture_id bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_injuries(p_fixture_id bigint) to anon, authenticated, service_role;
grant execute on function public.get_futebol_fixture_odds(p_fixture_id bigint) to anon, authenticated, service_role;
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

-- ── 7. Reverse trial (7 dias, sem cartão) — colunas no public.users ──────────
alter table public.users add column if not exists futebol_trial_started_at timestamptz;
alter table public.users add column if not exists futebol_subscription_status text not null default 'free';


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
