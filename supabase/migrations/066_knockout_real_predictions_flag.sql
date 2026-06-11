-- ============================================================
-- Flag: palpite de placar nos confrontos REAIS do mata-mata
-- ============================================================
-- Modo opcional do dono (default OFF). Quando ligado, substitui o funil de
-- projeção (escolher quais seleções avançam) por palpite de PLACAR nos jogos
-- reais do mata-mata, liberados conforme os confrontos se definem ao fim da
-- fase de grupos. O palpite de Campeão continua valendo nos dois modos.
--
-- O scoring já é stage-agnóstico (calculate_bolao_scores, migration 040), com
-- multiplicador por fase via weighted_stages — então não exige mudança aqui.
--
-- Os times reais de cada jogo do mata-mata são preenchidos no wc_matches por um
-- resolver server-side (próxima entrega, plugado na ingestão de scores), a
-- partir dos resultados reais dos grupos e dos vencedores de cada jogo.
-- ============================================================

ALTER TABLE public.boloes
  ADD COLUMN IF NOT EXISTS knockout_real_predictions_enabled boolean NOT NULL DEFAULT false;
