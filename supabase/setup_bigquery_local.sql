-- ============================================
-- SETUP BIGQUERY FDW LOCAL - PASSO A PASSO
-- ============================================
-- 
-- QUANDO USAR: Após cada "supabase start" limpo (sem backup)
-- 
-- COMO USAR:
-- 1. Copie e cole cada seção separadamente no SQL Editor (http://127.0.0.1:54323)
-- 2. Execute na ordem: PASSO 1 → PASSO 2 → PASSO 3 → PASSO 4 → PASSO 5
-- 3. O PASSO 2 retorna um UUID - copie e substitua no PASSO 3
--
-- ============================================


-- ============================================
-- PASSO 1: CRIAR EXTENSÃO E FOREIGN DATA WRAPPER
-- ============================================
-- Execute primeiro para criar a infraestrutura necessária

CREATE EXTENSION IF NOT EXISTS wrappers WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS bigquery;

-- IMPORTANTE: O handler é "big_query_fdw_handler" (com underscores)
CREATE FOREIGN DATA WRAPPER bigquery_wrapper
  HANDLER big_query_fdw_handler
  VALIDATOR big_query_fdw_validator;


-- ============================================
-- PASSO 2: CRIAR SECRET COM SERVICE ACCOUNT KEY
-- ============================================
-- Execute e COPIE o UUID retornado para usar no PASSO 3
-- 
-- IMPORTANTE: Substitua o JSON abaixo pela sua service account key do GCP
-- O JSON deve estar no formato exato do arquivo .json baixado do GCP

-- IMPORTANTE: Cole aqui o JSON completo da sua service account key do GCP
-- Baixe o arquivo .json do GCP Console e cole o conteúdo abaixo
SELECT vault.create_secret(
  $json${
  "type": "service_account",
  "project_id": "SEU-PROJECT-ID",
  "private_key_id": "SEU-PRIVATE-KEY-ID",
  "private_key": "-----BEGIN PRIVATE KEY-----\nSUA-PRIVATE-KEY-AQUI\n-----END PRIVATE KEY-----\n",
  "client_email": "sua-service-account@seu-project.iam.gserviceaccount.com",
  "client_id": "SEU-CLIENT-ID",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/sua-service-account%40seu-project.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}$json$,
  'bigquery_sa_key',
  'Service account key for BigQuery'
);

-- RESULTADO ESPERADO: [{"create_secret": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}]
-- COPIE O UUID ACIMA e substitua no PASSO 3


-- ============================================
-- PASSO 3: CRIAR SERVER E FOREIGN TABLES
-- ============================================
-- IMPORTANTE: Substitua 'SEU-UUID-AQUI' pelo UUID do PASSO 2

CREATE SERVER bigquery_server
  FOREIGN DATA WRAPPER bigquery_wrapper
  OPTIONS (
    sa_key_id 'SEU-UUID-AQUI',  -- <-- SUBSTITUA PELO UUID DO PASSO 2
    project_id 'smartbetting-dados',
    dataset_id 'nba'
  );

CREATE USER MAPPING FOR postgres SERVER bigquery_server OPTIONS (user 'public');

-- Foreign Tables
CREATE FOREIGN TABLE bigquery.dim_players (
  player_id bigint, player_name text, "position" text, team_id bigint,
  team_name text, team_abbreviation text, age bigint, last_game_text text,
  status text, loaded_at timestamp
) SERVER bigquery_server OPTIONS (table 'dim_players', location 'us-east1');

CREATE FOREIGN TABLE bigquery.dim_stat_player (
  player_id bigint, team_id bigint, stat_type text, rating_stars bigint,
  is_leader_with_injury boolean, is_available_backup boolean, stat_rank bigint,
  next_available_player_name text, next_player_stats_when_leader_out float8,
  next_player_stats_normal float8, loaded_at timestamp
) SERVER bigquery_server OPTIONS (table 'dim_stat_player', location 'us-east1');

CREATE FOREIGN TABLE bigquery.dim_teams (
  team_id bigint, team_name text, team_abbreviation text, conference text,
  team_city text, season bigint, conference_rank bigint, wins bigint, losses bigint,
  team_last_five_games text, team_rating_rank bigint, team_offensive_rating_rank bigint,
  team_defensive_rating_rank bigint, next_opponent_id bigint, next_opponent_name text,
  next_opponent_abbreviation text, is_next_game_home boolean,
  next_opponent_team_last_five_games text, next_opponent_conference_rank bigint,
  next_opponent_team_rating_rank bigint, next_opponent_team_offensive_rating_rank bigint,
  next_opponent_team_defensive_rating_rank bigint, team_injury_report_time_brasilia text,
  next_game_injury_report_time_brasilia text, loaded_at timestamp
) SERVER bigquery_server OPTIONS (table 'dim_teams', location 'us-east1');

CREATE FOREIGN TABLE bigquery.ft_game_player_stats (
  player_id bigint, game_date date, game_id bigint, stat_type text,
  stat_value float8, line_value float8, line_value_most_recent float8,
  is_b2b_game boolean, stat_vs_line text, played_against text, home_away text, is_played text
) SERVER bigquery_server OPTIONS (table 'ft_game_player_stats', location 'us-east1');

CREATE FOREIGN TABLE bigquery.ft_games (
  game_id bigint, game_date date, home_team_id bigint, home_team_name text,
  home_team_abbreviation text, home_team_score float8, visitor_team_id bigint,
  visitor_team_name text, visitor_team_abbreviation text, visitor_team_score float8,
  winner_team_id bigint, loaded_at timestamp, home_team_is_b2b_game boolean,
  visitor_team_is_b2b_game boolean, home_team_is_next_game boolean,
  visitor_team_is_next_game boolean, game_datetime_brasilia timestamp
) SERVER bigquery_server OPTIONS (table 'ft_games', location 'us-east1');

CREATE FOREIGN TABLE bigquery.dim_player_shooting_by_zones (
  player_id bigint, player_name text, corner_3_fga float8, corner_3_fgm float8,
  corner_3_fg_pct float8, left_corner_3_fga float8, left_corner_3_fgm float8,
  left_corner_3_fg_pct float8, right_corner_3_fga float8, right_corner_3_fgm float8,
  right_corner_3_fg_pct float8, above_the_break_3_fga float8, above_the_break_3_fgm float8,
  above_the_break_3_fg_pct float8, restricted_area_fga float8, restricted_area_fgm float8,
  restricted_area_fg_pct float8, in_the_paint_non_ra_fga float8, in_the_paint_non_ra_fgm float8,
  in_the_paint_non_ra_fg_pct float8, mid_range_fga float8, mid_range_fgm float8,
  mid_range_fg_pct float8, backcourt_fga float8, backcourt_fgm float8,
  backcourt_fg_pct float8, loaded_at timestamp
) SERVER bigquery_server OPTIONS (table 'dim_player_shooting_by_zones', location 'us-east1');


-- ============================================
-- PASSO 4: TESTAR CONEXÃO
-- ============================================
-- Deve retornar 526 (ou similar)

SELECT COUNT(*) FROM bigquery.dim_players;


-- ============================================
-- PASSO 5: CRIAR RPC FUNCTIONS
-- ============================================
-- Funções usadas pelo frontend para acessar os dados

DROP FUNCTION IF EXISTS public.get_all_players();
CREATE FUNCTION public.get_all_players()
RETURNS TABLE (player_id bigint, player_name text, "position" text, team_id bigint,
  team_name text, team_abbreviation text, age bigint, last_game_text text,
  current_status text, rating_stars bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH player_ratings AS (
    SELECT p.player_id, MAX(p.rating_stars) as max_stars FROM bigquery.dim_stat_player p GROUP BY p.player_id
  )
  SELECT t.player_id, t.player_name, t."position", t.team_id, t.team_name, t.team_abbreviation,
    t.age, t.last_game_text, t.status as current_status, COALESCE(pr.max_stars, 0) as rating_stars
  FROM bigquery.dim_players t LEFT JOIN player_ratings pr ON t.player_id = pr.player_id
  ORDER BY COALESCE(pr.max_stars, 0) DESC NULLS LAST, t.player_name ASC;
END; $$;

DROP FUNCTION IF EXISTS public.get_player_by_id(bigint);
CREATE FUNCTION public.get_player_by_id(p_player_id bigint)
RETURNS TABLE (player_id bigint, player_name text, "position" text, team_id bigint,
  team_name text, team_abbreviation text, age bigint, last_game_text text, current_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY SELECT t.player_id, t.player_name, t."position", t.team_id, t.team_name,
    t.team_abbreviation, t.age, t.last_game_text, t.status as current_status
  FROM bigquery.dim_players t WHERE t.player_id = p_player_id LIMIT 1;
END; $$;

DROP FUNCTION IF EXISTS public.get_player_props(bigint);
CREATE FUNCTION public.get_player_props(p_player_id bigint)
RETURNS TABLE (player_id bigint, team_id bigint, stat_type text, rating_stars bigint,
  is_leader_with_injury boolean, is_available_backup boolean, stat_rank bigint,
  next_available_player_name text, next_player_stats_when_leader_out float8,
  next_player_stats_normal float8, loaded_at timestamp)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY SELECT t.player_id, t.team_id, t.stat_type, t.rating_stars, t.is_leader_with_injury,
    t.is_available_backup, t.stat_rank, t.next_available_player_name,
    t.next_player_stats_when_leader_out, t.next_player_stats_normal, t.loaded_at
  FROM bigquery.dim_stat_player t WHERE t.player_id = p_player_id;
END; $$;

DROP FUNCTION IF EXISTS public.get_player_game_stats(bigint, int);
CREATE FUNCTION public.get_player_game_stats(p_player_id bigint, p_limit int DEFAULT 15)
RETURNS TABLE (player_id bigint, game_date date, game_id bigint, stat_type text,
  stat_value float8, "line" float8, line_most_recent float8, is_b2b_game boolean, stat_vs_line text,
  played_against text, home_away text, is_played text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH last_n_games AS (
    SELECT t.game_id, MAX(t.game_date) as game_date FROM bigquery.ft_game_player_stats t
    WHERE t.player_id = p_player_id GROUP BY t.game_id ORDER BY MAX(t.game_date) DESC LIMIT p_limit
  )
  SELECT t.player_id, t.game_date, t.game_id, t.stat_type, t.stat_value, t.line_value as "line",
    t.line_value_most_recent as line_most_recent, t.is_b2b_game, t.stat_vs_line, t.played_against, t.home_away, t.is_played
  FROM bigquery.ft_game_player_stats t INNER JOIN last_n_games lng ON t.game_id = lng.game_id
  WHERE t.player_id = p_player_id ORDER BY t.game_date DESC, t.stat_type;
END; $$;

DROP FUNCTION IF EXISTS public.get_team_by_id(bigint);
CREATE FUNCTION public.get_team_by_id(p_team_id bigint)
RETURNS TABLE (team_id bigint, team_name text, team_abbreviation text, conference text,
  team_city text, season bigint, conference_rank float8, wins bigint, losses bigint,
  team_last_five_games text, team_rating_rank bigint, team_offensive_rating_rank bigint,
  team_defensive_rating_rank bigint, next_opponent_id bigint, next_opponent_name text,
  next_opponent_abbreviation text, is_next_game_home boolean, next_opponent_team_last_five_games text,
  next_opponent_conference_rank float8, next_opponent_team_rating_rank bigint,
  next_opponent_team_offensive_rating_rank bigint, next_opponent_team_defensive_rating_rank bigint,
  team_injury_report_time_brasilia text, next_game_injury_report_time_brasilia text, loaded_at timestamp)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY SELECT t.team_id, t.team_name, t.team_abbreviation, t.conference, t.team_city,
    t.season, t.conference_rank::float8, t.wins, t.losses, t.team_last_five_games, t.team_rating_rank,
    t.team_offensive_rating_rank, t.team_defensive_rating_rank, t.next_opponent_id, t.next_opponent_name,
    t.next_opponent_abbreviation, t.is_next_game_home, t.next_opponent_team_last_five_games,
    t.next_opponent_conference_rank::float8, t.next_opponent_team_rating_rank,
    t.next_opponent_team_offensive_rating_rank, t.next_opponent_team_defensive_rating_rank,
    t.team_injury_report_time_brasilia, t.next_game_injury_report_time_brasilia, t.loaded_at
  FROM bigquery.dim_teams t WHERE t.team_id = p_team_id LIMIT 1;
END; $$;

DROP FUNCTION IF EXISTS public.get_team_players(bigint);
CREATE FUNCTION public.get_team_players(p_team_id bigint)
RETURNS TABLE (player_id bigint, player_name text, "position" text, team_id bigint,
  age bigint, current_status text, rating_stars bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH player_ratings AS (
    SELECT p.player_id, MAX(p.rating_stars) as max_stars FROM bigquery.dim_stat_player p GROUP BY p.player_id
  )
  SELECT t.player_id, t.player_name, t."position", t.team_id, t.age, t.status as current_status,
    COALESCE(pr.max_stars, 0) as rating_stars
  FROM bigquery.dim_players t LEFT JOIN player_ratings pr ON t.player_id = pr.player_id
  WHERE t.team_id = p_team_id ORDER BY COALESCE(pr.max_stars, 0) DESC NULLS LAST, t.player_name ASC;
END; $$;

DROP FUNCTION IF EXISTS public.get_games(date, text);
CREATE FUNCTION public.get_games(p_game_date date DEFAULT NULL, p_team_abbreviation text DEFAULT NULL)
RETURNS TABLE (game_id bigint, game_date date, game_datetime_brasilia timestamp, home_team_id bigint, home_team_name text,
  home_team_abbreviation text, home_team_score float8, visitor_team_id bigint, visitor_team_name text,
  visitor_team_abbreviation text, visitor_team_score float8, winner_team_id bigint, loaded_at timestamp,
  home_team_is_b2b_game boolean, visitor_team_is_b2b_game boolean, home_team_is_next_game boolean,
  visitor_team_is_next_game boolean, home_team_last_five text, visitor_team_last_five text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH latest_teams AS (
    SELECT DISTINCT ON (t.team_abbreviation)
      t.team_id, t.team_abbreviation, t.team_last_five_games
    FROM bigquery.dim_teams t
    ORDER BY t.team_abbreviation, t.loaded_at DESC NULLS LAST
  )
  SELECT g.game_id, g.game_date, g.game_datetime_brasilia, g.home_team_id, g.home_team_name, g.home_team_abbreviation,
    g.home_team_score, g.visitor_team_id, g.visitor_team_name, g.visitor_team_abbreviation,
    g.visitor_team_score, g.winner_team_id, g.loaded_at, g.home_team_is_b2b_game,
    g.visitor_team_is_b2b_game, g.home_team_is_next_game, g.visitor_team_is_next_game,
    ht.team_last_five_games as home_team_last_five,
    vt.team_last_five_games as visitor_team_last_five
  FROM bigquery.ft_games g
  LEFT JOIN latest_teams ht ON g.home_team_abbreviation = ht.team_abbreviation
  LEFT JOIN latest_teams vt ON g.visitor_team_abbreviation = vt.team_abbreviation
  WHERE (p_game_date IS NULL OR g.game_date = p_game_date)
    AND (p_team_abbreviation IS NULL OR LOWER(g.home_team_abbreviation) = LOWER(p_team_abbreviation)
      OR LOWER(g.visitor_team_abbreviation) = LOWER(p_team_abbreviation))
  ORDER BY g.game_datetime_brasilia ASC NULLS LAST, g.home_team_name ASC;
END; $$;

DROP FUNCTION IF EXISTS public.get_player_shooting_zones(bigint);
CREATE FUNCTION public.get_player_shooting_zones(p_player_id bigint)
RETURNS TABLE (player_id bigint, player_name text, corner_3_fga float8, corner_3_fgm float8,
  corner_3_fg_pct float8, left_corner_3_fga float8, left_corner_3_fgm float8, left_corner_3_fg_pct float8,
  right_corner_3_fga float8, right_corner_3_fgm float8, right_corner_3_fg_pct float8,
  above_the_break_3_fga float8, above_the_break_3_fgm float8, above_the_break_3_fg_pct float8,
  restricted_area_fga float8, restricted_area_fgm float8, restricted_area_fg_pct float8,
  in_the_paint_non_ra_fga float8, in_the_paint_non_ra_fgm float8, in_the_paint_non_ra_fg_pct float8,
  mid_range_fga float8, mid_range_fgm float8, mid_range_fg_pct float8, backcourt_fga float8,
  backcourt_fgm float8, backcourt_fg_pct float8, loaded_at timestamp)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY SELECT t.player_id, t.player_name, t.corner_3_fga, t.corner_3_fgm, t.corner_3_fg_pct,
    t.left_corner_3_fga, t.left_corner_3_fgm, t.left_corner_3_fg_pct, t.right_corner_3_fga,
    t.right_corner_3_fgm, t.right_corner_3_fg_pct, t.above_the_break_3_fga, t.above_the_break_3_fgm,
    t.above_the_break_3_fg_pct, t.restricted_area_fga, t.restricted_area_fgm, t.restricted_area_fg_pct,
    t.in_the_paint_non_ra_fga, t.in_the_paint_non_ra_fgm, t.in_the_paint_non_ra_fg_pct,
    t.mid_range_fga, t.mid_range_fgm, t.mid_range_fg_pct, t.backcourt_fga, t.backcourt_fgm,
    t.backcourt_fg_pct, t.loaded_at
  FROM bigquery.dim_player_shooting_by_zones t WHERE t.player_id = p_player_id;
END; $$;

DROP FUNCTION IF EXISTS public.get_player_dashboard_bundle(bigint, int);
CREATE OR REPLACE FUNCTION public.get_player_dashboard_bundle(
  p_player_id bigint,
  p_games_limit int DEFAULT 40
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_player RECORD;
  v_team RECORD;
  v_shooting RECORD;
BEGIN
  -- Player base
  SELECT *
  INTO v_player
  FROM public.get_all_players() p
  WHERE p.player_id = p_player_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'player', NULL,
      'game_stats', '[]'::jsonb,
      'prop_players', '[]'::jsonb,
      'team', NULL,
      'teammates', '[]'::jsonb,
      'shooting_zones', NULL
    );
  END IF;

  -- Team
  SELECT *
  INTO v_team
  FROM public.get_team_by_id(v_player.team_id) t
  LIMIT 1;

  -- Shooting zones
  SELECT *
  INTO v_shooting
  FROM public.get_player_shooting_zones(p_player_id) sz
  LIMIT 1;

  RETURN jsonb_build_object(
    'player', to_jsonb(v_player),

    -- Só os stat types usados no dashboard (reduz payload)
    'game_stats',
      COALESCE(
        (
          SELECT jsonb_agg(to_jsonb(gs) ORDER BY gs.game_date DESC, gs.stat_type)
          FROM public.get_player_game_stats(p_player_id, p_games_limit) gs
          WHERE gs.stat_type IN (
            'player_points',
            'player_assists',
            'player_rebounds',
            'player_points_rebounds_assists',
            'player_points_assists',
            'player_rebounds_assists'
          )
        ),
        '[]'::jsonb
      ),

    'prop_players',
      COALESCE(
        (
          SELECT jsonb_agg(to_jsonb(pp) ORDER BY pp.rating_stars DESC, pp.stat_rank ASC)
          FROM public.get_player_props(p_player_id) pp
          WHERE pp.stat_type IN (
            'player_points',
            'player_assists',
            'player_rebounds',
            'player_points_rebounds_assists',
            'player_points_assists',
            'player_rebounds_assists'
          )
        ),
        '[]'::jsonb
      ),

    'team', to_jsonb(v_team),

    -- Tira o próprio jogador e limita teammates
    'teammates',
      COALESCE(
        (
          SELECT jsonb_agg(to_jsonb(tp))
          FROM (
            SELECT *
            FROM public.get_team_players(v_player.team_id) tp
            WHERE tp.player_id <> p_player_id
            ORDER BY tp.rating_stars DESC NULLS LAST, tp.player_name ASC
            LIMIT 12
          ) tp
        ),
        '[]'::jsonb
      ),

    'shooting_zones', to_jsonb(v_shooting)
  );
END;
$$;

-- Permissões para acesso via API
GRANT EXECUTE ON FUNCTION public.get_all_players() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_by_id(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_props(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_game_stats(bigint, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_team_by_id(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_team_players(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_games(date, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_shooting_zones(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_dashboard_bundle(bigint, int) TO authenticated, anon;


-- ============================================
-- PASSO 6: TESTE FINAL
-- ============================================
-- Deve retornar jogadores com seus dados

SELECT * FROM public.get_all_players() LIMIT 3;

-- Teste do bundle do dashboard (substitua 219 por um player_id válido da sua base se necessário)
SELECT public.get_player_dashboard_bundle(219, 40);


-- ============================================
-- TROUBLESHOOTING
-- ============================================
--
-- ERRO: "foreign-data wrapper bigquery_wrapper does not exist"
--   → Rode o PASSO 1 primeiro
--
-- ERRO: "duplicate key value violates unique constraint secrets_name_idx"
--   → Já existe um secret. Rode: DELETE FROM vault.secrets WHERE name = 'bigquery_sa_key';
--
-- ERRO: "Invalid service account authenticator"
--   → O JSON da service account está errado. Verifique se copiou corretamente.
--
-- ERRO: "required option table is not specified"
--   → As foreign tables não foram criadas corretamente. Rode o PASSO 3 novamente.
--
-- PARA LIMPAR TUDO E RECOMEÇAR:
--   DROP SERVER IF EXISTS bigquery_server CASCADE;
--   DROP FOREIGN DATA WRAPPER IF EXISTS bigquery_wrapper CASCADE;
--   DELETE FROM vault.secrets WHERE name = 'bigquery_sa_key';
