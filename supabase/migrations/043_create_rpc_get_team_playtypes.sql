-- Migration: create_rpc_get_team_playtypes
-- RPC that returns play type efficiency for a team from dim_team_playtypes.
-- Used by NextGamesCard "Tipos de jogada" collapsible section.
-- Depends on: 040_create_fdw_dim_team_playtypes.sql
--
-- NOTA: os campos *_ppp_rank vindos do BigQuery estao invertidos
-- (time com maior PPP aparece como rank 30). Ignoramos esses campos
-- e recalculamos os ranks aqui com RANK() OVER (ORDER BY ppp DESC NULLS LAST),
-- de modo que #1 = time com a MAIOR eficiencia (melhor ataque) naquele playtype.
-- Quando o Mateus corrigir a origem, pode-se simplificar voltando a selecionar t.*_ppp_rank.

DROP FUNCTION IF EXISTS public.get_team_playtypes(bigint);

CREATE FUNCTION public.get_team_playtypes(p_team_id bigint)
RETURNS TABLE(
  team_id bigint, team_name text, team_abbreviation text,
  iso_ppp double precision, iso_poss_pct double precision, iso_percentile double precision, iso_ppp_rank bigint,
  spotup_ppp double precision, spotup_poss_pct double precision, spotup_percentile double precision, spotup_ppp_rank bigint,
  pnr_bh_ppp double precision, pnr_bh_poss_pct double precision, pnr_bh_percentile double precision, pnr_bh_ppp_rank bigint,
  pnr_rm_ppp double precision, pnr_rm_poss_pct double precision, pnr_rm_percentile double precision, pnr_rm_ppp_rank bigint,
  postup_ppp double precision, postup_poss_pct double precision, postup_percentile double precision, postup_ppp_rank bigint,
  transition_ppp double precision, transition_poss_pct double precision, transition_percentile double precision, transition_ppp_rank bigint,
  handoff_ppp double precision, handoff_poss_pct double precision, handoff_percentile double precision, handoff_ppp_rank bigint,
  cut_ppp double precision, cut_poss_pct double precision, cut_percentile double precision, cut_ppp_rank bigint,
  offscreen_ppp double precision, offscreen_poss_pct double precision, offscreen_percentile double precision, offscreen_ppp_rank bigint,
  putback_ppp double precision, putback_poss_pct double precision, putback_percentile double precision, putback_ppp_rank bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      t.team_id, t.team_name, t.team_abbreviation,
      t.iso_ppp, t.iso_poss_pct, t.iso_percentile,
      RANK() OVER (ORDER BY t.iso_ppp DESC NULLS LAST)::bigint AS iso_ppp_rank,
      t.spotup_ppp, t.spotup_poss_pct, t.spotup_percentile,
      RANK() OVER (ORDER BY t.spotup_ppp DESC NULLS LAST)::bigint AS spotup_ppp_rank,
      t.pnr_bh_ppp, t.pnr_bh_poss_pct, t.pnr_bh_percentile,
      RANK() OVER (ORDER BY t.pnr_bh_ppp DESC NULLS LAST)::bigint AS pnr_bh_ppp_rank,
      t.pnr_rm_ppp, t.pnr_rm_poss_pct, t.pnr_rm_percentile,
      RANK() OVER (ORDER BY t.pnr_rm_ppp DESC NULLS LAST)::bigint AS pnr_rm_ppp_rank,
      t.postup_ppp, t.postup_poss_pct, t.postup_percentile,
      RANK() OVER (ORDER BY t.postup_ppp DESC NULLS LAST)::bigint AS postup_ppp_rank,
      t.transition_ppp, t.transition_poss_pct, t.transition_percentile,
      RANK() OVER (ORDER BY t.transition_ppp DESC NULLS LAST)::bigint AS transition_ppp_rank,
      t.handoff_ppp, t.handoff_poss_pct, t.handoff_percentile,
      RANK() OVER (ORDER BY t.handoff_ppp DESC NULLS LAST)::bigint AS handoff_ppp_rank,
      t.cut_ppp, t.cut_poss_pct, t.cut_percentile,
      RANK() OVER (ORDER BY t.cut_ppp DESC NULLS LAST)::bigint AS cut_ppp_rank,
      t.offscreen_ppp, t.offscreen_poss_pct, t.offscreen_percentile,
      RANK() OVER (ORDER BY t.offscreen_ppp DESC NULLS LAST)::bigint AS offscreen_ppp_rank,
      t.putback_ppp, t.putback_poss_pct, t.putback_percentile,
      RANK() OVER (ORDER BY t.putback_ppp DESC NULLS LAST)::bigint AS putback_ppp_rank
    FROM bigquery.dim_team_playtypes t
  )
  SELECT
    r.team_id, r.team_name, r.team_abbreviation,
    r.iso_ppp, r.iso_poss_pct, r.iso_percentile, r.iso_ppp_rank,
    r.spotup_ppp, r.spotup_poss_pct, r.spotup_percentile, r.spotup_ppp_rank,
    r.pnr_bh_ppp, r.pnr_bh_poss_pct, r.pnr_bh_percentile, r.pnr_bh_ppp_rank,
    r.pnr_rm_ppp, r.pnr_rm_poss_pct, r.pnr_rm_percentile, r.pnr_rm_ppp_rank,
    r.postup_ppp, r.postup_poss_pct, r.postup_percentile, r.postup_ppp_rank,
    r.transition_ppp, r.transition_poss_pct, r.transition_percentile, r.transition_ppp_rank,
    r.handoff_ppp, r.handoff_poss_pct, r.handoff_percentile, r.handoff_ppp_rank,
    r.cut_ppp, r.cut_poss_pct, r.cut_percentile, r.cut_ppp_rank,
    r.offscreen_ppp, r.offscreen_poss_pct, r.offscreen_percentile, r.offscreen_ppp_rank,
    r.putback_ppp, r.putback_poss_pct, r.putback_percentile, r.putback_ppp_rank
  FROM ranked r
  WHERE r.team_id = p_team_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_playtypes(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_playtypes(bigint) TO anon;
