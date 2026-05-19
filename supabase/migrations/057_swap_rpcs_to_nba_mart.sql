-- ============================================================
-- Fase 4 do PLANO_OTIMIZACAO_BQ_SUPABASE.md
-- ============================================================
-- Migra todas as RPCs do schema `bigquery.*` (foreign tables via FDW)
-- para `nba_mart.*` (tabelas nativas Postgres alimentadas pelo Cloud Run
-- sync-bq-to-postgres da Fase 2).
--
-- Coexistência intencional: o schema `bigquery` e o FDW NÃO são removidos
-- aqui. Drop limpo só na Fase 5, após 1 semana de validação.
--
-- Mudancas de tipo entre foreign tables e nba_mart que exigem cast nas RPCs:
--   - ft_games.home_team_score/visitor_team_score: FLOAT8 -> BIGINT
--   - dim_teams.conference_rank/next_opponent_conference_rank: FLOAT8 -> BIGINT
--   - ft_game_player_stats.line_value_most_recent: removida; agora vive em
--     nba_mart.dim_player_latest_line (Fase 1 do plano).
-- ============================================================

-- ============================================================
-- Cleanup: funções legadas da migration 004 (signatura INTEGER, schema
-- antigo com colunas id/name/games_played que nao existem em nba_mart)
-- ============================================================
DROP FUNCTION IF EXISTS public.get_players();
DROP FUNCTION IF EXISTS public.get_teams();
DROP FUNCTION IF EXISTS public.get_player_by_id(integer);

-- ============================================================
-- get_all_players
-- ============================================================
DROP FUNCTION IF EXISTS public.get_all_players();
CREATE FUNCTION public.get_all_players()
RETURNS TABLE (player_id bigint, player_name text, "position" text, team_id bigint,
  team_name text, team_abbreviation text, age bigint, last_game_text text,
  current_status text, rating_stars bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH player_ratings AS (
    SELECT p.player_id, MAX(p.rating_stars) AS max_stars
    FROM nba_mart.dim_stat_player p
    GROUP BY p.player_id
  )
  SELECT t.player_id, t.player_name, t."position", t.team_id, t.team_name, t.team_abbreviation,
    t.age, t.last_game_text, t.status AS current_status, COALESCE(pr.max_stars, 0) AS rating_stars
  FROM nba_mart.dim_players t
  LEFT JOIN player_ratings pr ON t.player_id = pr.player_id
  ORDER BY COALESCE(pr.max_stars, 0) DESC NULLS LAST, t.player_name ASC;
END; $$;

-- ============================================================
-- get_player_by_id
-- ============================================================
DROP FUNCTION IF EXISTS public.get_player_by_id(bigint);
CREATE FUNCTION public.get_player_by_id(p_player_id bigint)
RETURNS TABLE (player_id bigint, player_name text, "position" text, team_id bigint,
  team_name text, team_abbreviation text, age bigint, last_game_text text, current_status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT t.player_id, t.player_name, t."position", t.team_id, t.team_name,
    t.team_abbreviation, t.age, t.last_game_text, t.status AS current_status
  FROM nba_mart.dim_players t
  WHERE t.player_id = p_player_id
  LIMIT 1;
END; $$;

-- ============================================================
-- get_player_by_name
-- ============================================================
-- Nao referencia nba_mart diretamente (compoe via get_all_players),
-- mas e recriada por idempotencia.
DROP FUNCTION IF EXISTS public.get_player_by_name(text);
CREATE FUNCTION public.get_player_by_name(p_player_name text)
RETURNS TABLE (player_id bigint, player_name text, "position" text, team_id bigint,
  team_name text, team_abbreviation text, age bigint, last_game_text text,
  current_status text, rating_stars bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_search text;
BEGIN
  v_search := lower(replace(p_player_name, '-', ' '));

  RETURN QUERY
  SELECT p.player_id, p.player_name, p."position", p.team_id,
    p.team_name, p.team_abbreviation, p.age, p.last_game_text,
    p.current_status, p.rating_stars
  FROM public.get_all_players() p
  WHERE lower(p.player_name) = v_search
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT p.player_id, p.player_name, p."position", p.team_id,
      p.team_name, p.team_abbreviation, p.age, p.last_game_text,
      p.current_status, p.rating_stars
    FROM public.get_all_players() p
    WHERE lower(p.player_name) LIKE '%' || v_search || '%'
    LIMIT 1;
  END IF;
END; $$;

-- ============================================================
-- get_player_props
-- ============================================================
DROP FUNCTION IF EXISTS public.get_player_props(bigint);
CREATE FUNCTION public.get_player_props(p_player_id bigint)
RETURNS TABLE (player_id bigint, team_id bigint, stat_type text, rating_stars bigint,
  is_leader_with_injury boolean, is_available_backup boolean, stat_rank bigint,
  next_available_player_name text, next_player_stats_when_leader_out float8,
  next_player_stats_normal float8, loaded_at timestamp)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT t.player_id, t.team_id, t.stat_type, t.rating_stars, t.is_leader_with_injury,
    t.is_available_backup, t.stat_rank, t.next_available_player_name,
    t.next_player_stats_when_leader_out, t.next_player_stats_normal, t.loaded_at
  FROM nba_mart.dim_stat_player t
  WHERE t.player_id = p_player_id;
END; $$;

-- ============================================================
-- get_player_game_stats
-- ============================================================
-- Mudancas vs versao bigquery:
--   1. line_value_most_recent saiu de ft_game_player_stats e foi pra
--      dim_player_latest_line (LEFT JOIN por player_id + stat_type).
--   2. ft_games.home_team_score / visitor_team_score sao BIGINT em
--      nba_mart (eram FLOAT8 no FDW); cast pra float8 mantem signatura.
DROP FUNCTION IF EXISTS public.get_player_game_stats(bigint, int);
CREATE FUNCTION public.get_player_game_stats(p_player_id bigint, p_limit int DEFAULT 15)
RETURNS TABLE (
  player_id bigint, game_date date, game_id bigint, stat_type text,
  stat_value float8, "line" float8, line_most_recent float8, is_b2b_game boolean,
  stat_vs_line text, played_against text, home_away text, is_played text,
  player_team_score float8, opponent_score float8, game_won boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH last_n_games AS (
    SELECT t.game_id, MAX(t.game_date) AS game_date
    FROM nba_mart.ft_game_player_stats t
    WHERE t.player_id = p_player_id
    GROUP BY t.game_id
    ORDER BY MAX(t.game_date) DESC
    LIMIT p_limit
  )
  SELECT
    t.player_id,
    t.game_date,
    t.game_id,
    t.stat_type,
    t.stat_value,
    t.line_value AS "line",
    dpll.line_value_most_recent AS line_most_recent,
    t.is_b2b_game,
    t.stat_vs_line,
    t.played_against,
    t.home_away,
    t.is_played,
    CASE WHEN t.home_away = 'home' THEN g.home_team_score::float8 ELSE g.visitor_team_score::float8 END AS player_team_score,
    CASE WHEN t.home_away = 'home' THEN g.visitor_team_score::float8 ELSE g.home_team_score::float8 END AS opponent_score,
    CASE
      WHEN t.home_away = 'home' THEN g.home_team_score > g.visitor_team_score
      ELSE g.visitor_team_score > g.home_team_score
    END AS game_won
  FROM nba_mart.ft_game_player_stats t
  INNER JOIN last_n_games lng ON t.game_id = lng.game_id
  LEFT JOIN nba_mart.ft_games g ON t.game_id = g.game_id
  LEFT JOIN nba_mart.dim_player_latest_line dpll
    ON dpll.player_id = t.player_id AND dpll.stat_type = t.stat_type
  WHERE t.player_id = p_player_id
  ORDER BY t.game_date DESC, t.stat_type;
END; $$;

-- ============================================================
-- get_team_by_id
-- ============================================================
-- Preserva signatura da migration 033 (next_opponent_wins/losses).
-- Cast conference_rank pra float8 (era BIGINT no foreign table tambem,
-- mas signatura ja era float8).
DROP FUNCTION IF EXISTS public.get_team_by_id(bigint);
CREATE FUNCTION public.get_team_by_id(p_team_id bigint)
RETURNS TABLE (team_id bigint, team_name text, team_abbreviation text, conference text,
  team_city text, season bigint, conference_rank float8, wins bigint, losses bigint,
  team_last_five_games text, team_rating_rank bigint, team_offensive_rating_rank bigint,
  team_defensive_rating_rank bigint, next_opponent_id bigint, next_opponent_name text,
  next_opponent_abbreviation text, is_next_game_home boolean, next_opponent_team_last_five_games text,
  next_opponent_conference_rank float8, next_opponent_team_rating_rank bigint,
  next_opponent_team_offensive_rating_rank bigint, next_opponent_team_defensive_rating_rank bigint,
  team_injury_report_time_brasilia text, next_game_injury_report_time_brasilia text, loaded_at timestamp,
  next_opponent_wins bigint, next_opponent_losses bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT t.team_id, t.team_name, t.team_abbreviation, t.conference, t.team_city,
    t.season, t.conference_rank::float8, t.wins, t.losses, t.team_last_five_games,
    t.team_rating_rank, t.team_offensive_rating_rank, t.team_defensive_rating_rank,
    t.next_opponent_id, t.next_opponent_name, t.next_opponent_abbreviation,
    t.is_next_game_home, t.next_opponent_team_last_five_games,
    t.next_opponent_conference_rank::float8, t.next_opponent_team_rating_rank,
    t.next_opponent_team_offensive_rating_rank, t.next_opponent_team_defensive_rating_rank,
    t.team_injury_report_time_brasilia, t.next_game_injury_report_time_brasilia, t.loaded_at,
    opp.wins AS next_opponent_wins,
    opp.losses AS next_opponent_losses
  FROM nba_mart.dim_teams t
  LEFT JOIN nba_mart.dim_teams opp ON opp.team_id = t.next_opponent_id
  WHERE t.team_id = p_team_id
  LIMIT 1;
END; $$;

-- ============================================================
-- get_team_players
-- ============================================================
DROP FUNCTION IF EXISTS public.get_team_players(bigint);
CREATE FUNCTION public.get_team_players(p_team_id bigint)
RETURNS TABLE (player_id bigint, player_name text, "position" text, team_id bigint,
  age bigint, current_status text, rating_stars bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH player_ratings AS (
    SELECT p.player_id, MAX(p.rating_stars) AS max_stars
    FROM nba_mart.dim_stat_player p
    GROUP BY p.player_id
  )
  SELECT t.player_id, t.player_name, t."position", t.team_id, t.age, t.status AS current_status,
    COALESCE(pr.max_stars, 0) AS rating_stars
  FROM nba_mart.dim_players t
  LEFT JOIN player_ratings pr ON t.player_id = pr.player_id
  WHERE t.team_id = p_team_id
  ORDER BY COALESCE(pr.max_stars, 0) DESC NULLS LAST, t.player_name ASC;
END; $$;

-- ============================================================
-- get_games
-- ============================================================
-- ft_games.home_team_score / visitor_team_score viraram BIGINT em
-- nba_mart; cast pra float8 mantem signatura.
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
  SELECT g.game_id, g.game_date, g.game_datetime_brasilia, g.home_team_id, g.home_team_name, g.home_team_abbreviation,
    g.home_team_score::float8, g.visitor_team_id, g.visitor_team_name, g.visitor_team_abbreviation,
    g.visitor_team_score::float8, g.winner_team_id, g.loaded_at, g.home_team_is_b2b_game,
    g.visitor_team_is_b2b_game, g.home_team_is_next_game, g.visitor_team_is_next_game,
    ht.team_last_five_games AS home_team_last_five,
    vt.team_last_five_games AS visitor_team_last_five
  FROM nba_mart.ft_games g
  LEFT JOIN nba_mart.dim_teams ht ON g.home_team_abbreviation = ht.team_abbreviation
  LEFT JOIN nba_mart.dim_teams vt ON g.visitor_team_abbreviation = vt.team_abbreviation
  WHERE (p_game_date IS NULL OR g.game_date = p_game_date)
    AND (p_team_abbreviation IS NULL OR LOWER(g.home_team_abbreviation) = LOWER(p_team_abbreviation)
      OR LOWER(g.visitor_team_abbreviation) = LOWER(p_team_abbreviation))
  ORDER BY g.game_datetime_brasilia ASC NULLS LAST, g.home_team_name ASC;
END; $$;

-- ============================================================
-- get_player_shooting_zones
-- ============================================================
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
  RETURN QUERY
  SELECT t.player_id, t.player_name, t.corner_3_fga, t.corner_3_fgm, t.corner_3_fg_pct,
    t.left_corner_3_fga, t.left_corner_3_fgm, t.left_corner_3_fg_pct, t.right_corner_3_fga,
    t.right_corner_3_fgm, t.right_corner_3_fg_pct, t.above_the_break_3_fga, t.above_the_break_3_fgm,
    t.above_the_break_3_fg_pct, t.restricted_area_fga, t.restricted_area_fgm, t.restricted_area_fg_pct,
    t.in_the_paint_non_ra_fga, t.in_the_paint_non_ra_fgm, t.in_the_paint_non_ra_fg_pct,
    t.mid_range_fga, t.mid_range_fgm, t.mid_range_fg_pct, t.backcourt_fga, t.backcourt_fgm,
    t.backcourt_fg_pct, t.loaded_at
  FROM nba_mart.dim_player_shooting_by_zones t
  WHERE t.player_id = p_player_id;
END; $$;

-- ============================================================
-- get_player_dashboard_bundle
-- ============================================================
-- Nao referencia nba_mart direto; compõe os RPCs acima. Reescrito por
-- idempotencia. Performance herda automaticamente: cada subchamada que
-- antes era hop FDW (200ms-2s) agora e query local Postgres.
DROP FUNCTION IF EXISTS public.get_player_dashboard_bundle(bigint, int);
CREATE FUNCTION public.get_player_dashboard_bundle(
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

  SELECT *
  INTO v_team
  FROM public.get_team_by_id(v_player.team_id) t
  LIMIT 1;

  SELECT *
  INTO v_shooting
  FROM public.get_player_shooting_zones(p_player_id) sz
  LIMIT 1;

  RETURN jsonb_build_object(
    'player', to_jsonb(v_player),

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

-- ============================================================
-- get_game_box_score
-- ============================================================
DROP FUNCTION IF EXISTS public.get_game_box_score(bigint);
CREATE FUNCTION public.get_game_box_score(p_game_id bigint)
RETURNS TABLE (
  player_id bigint,
  player_name text,
  home_away text,
  minutes numeric,
  points numeric,
  rebounds numeric,
  assists numeric,
  blocks numeric,
  steals numeric,
  threes numeric,
  turnovers numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.player_id,
    p.player_name,
    MAX(s.home_away) AS home_away,
    MAX(CASE WHEN s.stat_type = 'player_minutes'   THEN s.stat_value END)::numeric AS minutes,
    MAX(CASE WHEN s.stat_type = 'player_points'    THEN s.stat_value END)::numeric AS points,
    MAX(CASE WHEN s.stat_type = 'player_rebounds'  THEN s.stat_value END)::numeric AS rebounds,
    MAX(CASE WHEN s.stat_type = 'player_assists'   THEN s.stat_value END)::numeric AS assists,
    MAX(CASE WHEN s.stat_type = 'player_blocks'    THEN s.stat_value END)::numeric AS blocks,
    MAX(CASE WHEN s.stat_type = 'player_steals'    THEN s.stat_value END)::numeric AS steals,
    MAX(CASE WHEN s.stat_type = 'player_threes'    THEN s.stat_value END)::numeric AS threes,
    MAX(CASE WHEN s.stat_type = 'player_turnovers' THEN s.stat_value END)::numeric AS turnovers
  FROM nba_mart.ft_game_player_stats s
  JOIN nba_mart.dim_players p ON s.player_id = p.player_id
  WHERE s.game_id = p_game_id
    AND s.is_played = 'Jogou'
  GROUP BY s.player_id, p.player_name
  ORDER BY MAX(s.home_away), MAX(CASE WHEN s.stat_type = 'player_minutes' THEN s.stat_value END) DESC NULLS LAST;
END; $$;

-- ============================================================
-- get_b2b_previous_game_box_score
-- ============================================================
-- Postgres nativo nao tem o problema de OR pushdown do FDW: trocar
-- UNION ALL por OR simples deixa o planner usar o index melhor.
DROP FUNCTION IF EXISTS public.get_b2b_previous_game_box_score(bigint, bigint);
CREATE FUNCTION public.get_b2b_previous_game_box_score(
  p_game_id bigint,
  p_team_id bigint
)
RETURNS TABLE (
  player_id bigint,
  player_name text,
  player_position text,
  rating_stars bigint,
  minutes float8,
  points float8,
  rebounds float8,
  assists float8,
  plus_minus float8,
  previous_game_id bigint,
  previous_game_date date,
  previous_opponent text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_previous_game_id bigint;
  v_previous_game_date date;
  v_previous_opponent text;
  v_current_game_date date;
  v_team_was_home boolean;
  v_team_home_away text;
BEGIN
  SELECT g.game_date INTO v_current_game_date
  FROM nba_mart.ft_games g
  WHERE g.game_id = p_game_id
  LIMIT 1;

  IF v_current_game_date IS NULL THEN RETURN; END IF;

  SELECT g.game_id, g.game_date,
    CASE WHEN g.home_team_id = p_team_id THEN g.visitor_team_abbreviation ELSE g.home_team_abbreviation END,
    g.home_team_id = p_team_id
  INTO v_previous_game_id, v_previous_game_date, v_previous_opponent, v_team_was_home
  FROM nba_mart.ft_games g
  WHERE (g.home_team_id = p_team_id OR g.visitor_team_id = p_team_id)
    AND g.game_date < v_current_game_date
    AND g.winner_team_id IS NOT NULL
  ORDER BY g.game_date DESC
  LIMIT 1;

  IF v_previous_game_id IS NULL THEN RETURN; END IF;

  v_team_home_away := CASE WHEN v_team_was_home THEN 'Casa' ELSE 'Fora' END;

  RETURN QUERY
  SELECT
    bs.player_id, bs.player_name,
    COALESCE(dp."position", '') AS player_position,
    COALESCE(pr.max_stars, 0) AS rating_stars,
    bs.minutes::float8, bs.points::float8, bs.rebounds::float8, bs.assists::float8,
    MAX(CASE WHEN s.stat_type = 'player_plus_minus' THEN s.stat_value END) AS plus_minus,
    v_previous_game_id, v_previous_game_date, v_previous_opponent
  FROM public.get_game_box_score(v_previous_game_id) bs
  LEFT JOIN nba_mart.dim_players dp ON bs.player_id = dp.player_id
  LEFT JOIN (
    SELECT sp.player_id, MAX(sp.rating_stars) AS max_stars
    FROM nba_mart.dim_stat_player sp
    GROUP BY sp.player_id
  ) pr ON bs.player_id = pr.player_id
  LEFT JOIN nba_mart.ft_game_player_stats s
    ON s.player_id = bs.player_id
    AND s.game_id = v_previous_game_id
    AND s.stat_type = 'player_plus_minus'
  WHERE bs.home_away = v_team_home_away
  GROUP BY bs.player_id, bs.player_name, dp."position", pr.max_stars, bs.minutes, bs.points, bs.rebounds, bs.assists
  ORDER BY bs.minutes DESC NULLS LAST;
END; $$;

-- ============================================================
-- get_player_trigger_insights
-- ============================================================
DROP FUNCTION IF EXISTS public.get_player_trigger_insights(text);
CREATE FUNCTION public.get_player_trigger_insights(p_player_name text)
RETURNS TABLE (
  player_id bigint,
  team_id bigint,
  stat_type text,
  rating_stars bigint,
  is_leader_with_injury boolean,
  is_available_backup boolean,
  stat_rank bigint,
  next_available_player_name text,
  next_player_stats_when_leader_out float8,
  next_player_stats_normal float8,
  loaded_at timestamp
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT
    dsp.player_id,
    dsp.team_id,
    dsp.stat_type,
    dsp.rating_stars,
    dsp.is_leader_with_injury,
    true::boolean AS is_available_backup,
    dsp.stat_rank,
    dp.player_name AS next_available_player_name,
    dsp.next_player_stats_when_leader_out,
    dsp.next_player_stats_normal,
    dsp.loaded_at
  FROM nba_mart.dim_stat_player dsp
  JOIN nba_mart.dim_players dp ON dp.player_id = dsp.player_id
  WHERE dsp.is_leader_with_injury = true
    AND dsp.next_available_player_name = p_player_name
    AND dsp.next_player_stats_when_leader_out IS NOT NULL
    AND dsp.next_player_stats_when_leader_out > 0;
END; $$;

-- ============================================================
-- Permissoes
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_all_players() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_by_id(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_by_name(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_props(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_game_stats(bigint, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_team_by_id(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_team_players(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_games(date, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_shooting_zones(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_dashboard_bundle(bigint, int) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_game_box_score(bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_b2b_previous_game_box_score(bigint, bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_player_trigger_insights(text) TO authenticated, anon;
