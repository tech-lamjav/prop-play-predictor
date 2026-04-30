-- Migration: create_rpc_get_player_passing_season
-- RPC que retorna o perfil de passing/playmaking do jogador na temporada
-- a partir de dim_player_passing_stats. Usado no dashboard pra mostrar
-- potential_ast (season) ao lado da Media da Temporada no grafico.
--
-- Foreign table eh declarada em dim_player_passing_stats (criada ad-hoc
-- via Supabase console — Victor mencionou em 04-23 mas nao tem migration
-- versionada. Nao recriamos aqui pra nao quebrar o que ja funciona).
--
-- balldontlie nao expoe potential_ast game-by-game (so season). Pra trend
-- de game-by-game, usar ft_game_player_passing_stats com proxy passes/sec_ast.

DROP FUNCTION IF EXISTS public.get_player_passing_season(bigint);

CREATE FUNCTION public.get_player_passing_season(p_player_id bigint)
RETURNS TABLE(
  player_id           bigint,
  season              bigint,
  games_played        bigint,
  ast                 double precision,
  potential_ast       double precision,
  potential_ast_rank  bigint,
  passes_made         double precision,
  secondary_ast       double precision,
  ft_ast              double precision,
  ast_to_pass_pct     double precision
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.player_id,
    p.season,
    p.games_played,
    p.ast,
    p.potential_ast,
    p.potential_ast_rank,
    p.passes_made,
    p.secondary_ast,
    p.ft_ast,
    p.ast_to_pass_pct
  FROM bigquery.dim_player_passing_stats p
  WHERE p.player_id = p_player_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_passing_season(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_passing_season(bigint) TO anon;
