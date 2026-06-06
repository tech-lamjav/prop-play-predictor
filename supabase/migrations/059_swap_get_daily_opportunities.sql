-- ============================================================
-- Follow-up da Fase 4: get_daily_opportunities
-- ============================================================
-- Essa RPC vivia em prod referenciando `bigquery.ft_games` e
-- `bigquery.dim_daily_opportunities`, mas nao estava em nenhuma migration
-- versionada — foi criada via dashboard ou SQL ad-hoc. A migration 057
-- nao tocou nela porque eu nao tinha conhecimento.
--
-- Frontend a usa via `src/services/nba-data.service.ts::getDailyOpportunities`.
-- Sem essa swap, com a 058 ja aplicada (Fase 5), a RPC retorna erro:
-- "schema bigquery does not exist".
--
-- Outras 7 RPCs orfas referenciando `bigquery.*` continuam existindo mas
-- nao sao chamadas por nenhum codigo no repo:
--   get_opponent_rankings, get_player_historical_stats,
--   get_player_passing_season, get_player_period_stats,
--   get_team_opp_shooting_zones, get_team_playtypes, get_teammate_impact_360
-- A maioria referencia tabelas BQ que NAO existem em nba_mart
-- (ft_game_player_stats_period, dim_team_playtypes, etc.). Quem precisar
-- delas no futuro tem que sincronizar essas tabelas e migrar as RPCs.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_daily_opportunities(date);
CREATE FUNCTION public.get_daily_opportunities(p_game_date date DEFAULT NULL)
RETURNS TABLE(
  game_id bigint, game_date date, game_time text,
  home_team_abbr text, visitor_team_abbr text,
  trigger_player_id bigint, trigger_name text, trigger_status text,
  trigger_team_abbr text, trigger_team_id bigint,
  trigger_days_out bigint, trigger_freshness text, trigger_participation_pct double precision,
  is_b2b boolean, fatigue_level text,
  backup_player_id bigint, backup_player_name text,
  stat_type text,
  avg_com double precision, avg_sem double precision,
  stddev_sem double precision, cv_sem double precision,
  gap double precision, gap_pct double precision,
  jogos_com bigint, jogos_sem bigint,
  line_value double precision, gap_vs_line double precision, gap_vs_line_pct double precision,
  signal text,
  score bigint, score_base bigint, score_label text,
  opponent_abbr text, opponent_def_rank bigint, opponent_off_rank bigint,
  is_home boolean, rating_stars bigint,
  spread double precision, blowout_deflator double precision,
  loaded_at timestamp without time zone
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_target_date date;
BEGIN
  IF p_game_date IS NOT NULL THEN
    v_target_date := p_game_date;
  ELSE
    SELECT MIN(g.game_date) INTO v_target_date
    FROM nba_mart.ft_games g
    WHERE g.winner_team_id IS NULL
      AND g.game_date >= CURRENT_DATE - INTERVAL '1 day'
      AND g.game_date <= CURRENT_DATE + INTERVAL '1 day';

    IF v_target_date IS NULL THEN
      SELECT MIN(d.game_date) INTO v_target_date
      FROM nba_mart.dim_daily_opportunities d
      WHERE d.game_date >= CURRENT_DATE - INTERVAL '1 day';
    END IF;

    IF v_target_date IS NULL THEN
      v_target_date := CURRENT_DATE;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    d.game_id, d.game_date, d.game_time,
    d.home_team_abbr, d.visitor_team_abbr,
    d.trigger_player_id, d.trigger_name, d.trigger_status,
    d.trigger_team_abbr, d.trigger_team_id,
    d.trigger_days_out, d.trigger_freshness, d.trigger_participation_pct,
    d.is_b2b, d.fatigue_level,
    d.backup_player_id, d.backup_player_name,
    d.stat_type,
    d.avg_com, d.avg_sem,
    d.stddev_sem, d.cv_sem,
    d.gap, d.gap_pct,
    d.jogos_com, d.jogos_sem,
    d.line_value, d.gap_vs_line, d.gap_vs_line_pct,
    d.signal,
    d.score, d.score_base, d.score_label,
    d.opponent_abbr, d.opponent_def_rank, d.opponent_off_rank,
    d.is_home, d.rating_stars,
    d.spread, d.blowout_deflator,
    d.loaded_at
  FROM nba_mart.dim_daily_opportunities d
  WHERE d.game_date = v_target_date
    AND d.stat_type != 'player_minutes'
    AND d.signal IS NOT NULL
    AND d.score >= 60
    AND (d.trigger_days_out IS NULL OR d.trigger_days_out <= 7)
    AND (d.trigger_participation_pct IS NULL OR d.trigger_participation_pct >= 0.5)
    AND d.trigger_status NOT IN ('Out For Season')
    AND d.gap >= 1.0
    AND d.rating_stars IS NOT NULL AND d.rating_stars >= 1
  ORDER BY d.score DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_opportunities(date) TO authenticated, anon;
