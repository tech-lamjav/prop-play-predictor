-- Migration: replace_get_daily_opportunities_with_loaded_at
-- Recreates get_daily_opportunities RPC with:
--   1. loaded_at column in the output (from dim_daily_opportunities FDW)
--   2. Timezone-safe date logic: MIN(game_date) from unfinished games in ±1 day window
-- Depends on: 039_add_loaded_at_to_dim_daily_opportunities.sql
--
-- Applied to staging (kpbjuplcwiyrymafhehz) and production (lavclmlvvfzkblrstojd)

CREATE OR REPLACE FUNCTION public.get_daily_opportunities(p_game_date date DEFAULT NULL::date)
RETURNS TABLE(
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_target_date date;
BEGIN
  IF p_game_date IS NOT NULL THEN
    v_target_date := p_game_date;
  ELSE
    -- Timezone-safe: find the earliest game_date from unfinished games
    -- within a ±1 day window instead of relying on CURRENT_DATE (UTC)
    SELECT MIN(g.game_date) INTO v_target_date
    FROM bigquery.ft_games g
    WHERE g.winner_team_id IS NULL
      AND g.game_date >= CURRENT_DATE - INTERVAL '1 day'
      AND g.game_date <= CURRENT_DATE + INTERVAL '1 day';

    -- Fallback: use dim_daily_opportunities if no unfinished games found
    IF v_target_date IS NULL THEN
      SELECT MIN(d.game_date) INTO v_target_date
      FROM bigquery.dim_daily_opportunities d
      WHERE d.game_date >= CURRENT_DATE - INTERVAL '1 day';
    END IF;

    -- Last resort: use CURRENT_DATE
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
  FROM bigquery.dim_daily_opportunities d
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

-- Grant execute to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.get_daily_opportunities(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_opportunities(date) TO anon;
