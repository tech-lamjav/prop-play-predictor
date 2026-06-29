-- ============================================================
-- 074_wc_matches_winner — vencedor real do jogo (inclui pênaltis)
-- ============================================================
-- O placar (home_score/away_score) guarda o resultado FIFA (empate nos 120 quando
-- vai pra pênaltis). Mas pra "andar" o chaveamento e pontuar o "quem avança" a
-- gente precisa saber QUEM passou — incl. quando foi decidido nos pênaltis.
-- Esta coluna guarda o código do vencedor real; é preenchida pela ingestão
-- (ingest-wc-scores), que lê teams.home/away.winner da API-Sports.
-- ============================================================
ALTER TABLE public.wc_matches
  ADD COLUMN IF NOT EXISTS winner_team_code text;

COMMENT ON COLUMN public.wc_matches.winner_team_code IS
  'Vencedor real do jogo (inclui pênaltis). Alimenta a propagação do chaveamento e a pontuação do "quem avança".';
