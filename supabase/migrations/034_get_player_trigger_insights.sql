-- ============================================================
-- get_player_trigger_insights
-- Busca os insights de gatilho para um jogador backup:
-- retorna as linhas dos LÍDERES que estão lesionados e apontam
-- esse jogador como seu substituto direto.
--
-- Contexto: o dado vive na linha do líder (is_leader_with_injury=true),
-- não na linha do backup. Esta RPC inverte a busca corretamente.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_player_trigger_insights(p_player_name text)
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
  FROM bigquery.dim_stat_player dsp
  JOIN bigquery.dim_players dp ON dp.player_id = dsp.player_id
  WHERE dsp.is_leader_with_injury = true
    AND dsp.next_available_player_name = p_player_name
    AND dsp.next_player_stats_when_leader_out IS NOT NULL
    AND dsp.next_player_stats_when_leader_out > 0;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_player_trigger_insights(text) TO authenticated, anon;
