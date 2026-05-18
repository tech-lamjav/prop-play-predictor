-- ============================================================
-- BOLÃO COPA 2026 — Schema baseline (3/5): RLS + policies
-- ============================================================
-- Habilita Row-Level Security em todas as tabelas + cria as 17
-- policies de acesso. Depende de get_user_bolao_ids() (036_6).
--
-- Política central: você só vê / muta o que pertence aos bolões em
-- que está como membro (ou aos bolões públicos / dos quais é dono).
-- ============================================================

-- ─── Enable RLS ─────────────────────────────────────────────
ALTER TABLE public.boloes                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bolao_members              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bolao_predictions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bolao_special_predictions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bolao_insights             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bolao_subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wc_matches                 ENABLE ROW LEVEL SECURITY;

-- ─── boloes ─────────────────────────────────────────────────
DROP POLICY IF EXISTS boloes_select ON public.boloes;
CREATE POLICY boloes_select ON public.boloes
  FOR SELECT USING (
    (is_public = true)
    OR (owner_id = auth.uid())
    OR (id IN (SELECT public.get_user_bolao_ids()))
  );

DROP POLICY IF EXISTS boloes_insert ON public.boloes;
CREATE POLICY boloes_insert ON public.boloes
  FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS boloes_update ON public.boloes;
CREATE POLICY boloes_update ON public.boloes
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS boloes_delete ON public.boloes;
CREATE POLICY boloes_delete ON public.boloes
  FOR DELETE USING (owner_id = auth.uid());

-- ─── bolao_members ──────────────────────────────────────────
DROP POLICY IF EXISTS bolao_members_select ON public.bolao_members;
CREATE POLICY bolao_members_select ON public.bolao_members
  FOR SELECT USING (bolao_id IN (SELECT public.get_user_bolao_ids()));

DROP POLICY IF EXISTS bolao_members_insert ON public.bolao_members;
CREATE POLICY bolao_members_insert ON public.bolao_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS bolao_members_delete ON public.bolao_members;
CREATE POLICY bolao_members_delete ON public.bolao_members
  FOR DELETE USING (user_id = auth.uid());

-- ─── bolao_predictions ──────────────────────────────────────
DROP POLICY IF EXISTS bolao_predictions_select ON public.bolao_predictions;
CREATE POLICY bolao_predictions_select ON public.bolao_predictions
  FOR SELECT USING (bolao_id IN (SELECT public.get_user_bolao_ids()));

DROP POLICY IF EXISTS bolao_predictions_insert ON public.bolao_predictions;
CREATE POLICY bolao_predictions_insert ON public.bolao_predictions
  FOR INSERT WITH CHECK (
    (user_id = auth.uid()) AND (bolao_id IN (SELECT public.get_user_bolao_ids()))
  );

DROP POLICY IF EXISTS bolao_predictions_update ON public.bolao_predictions;
CREATE POLICY bolao_predictions_update ON public.bolao_predictions
  FOR UPDATE USING (
    (user_id = auth.uid()) AND (bolao_id IN (SELECT public.get_user_bolao_ids()))
  );

-- ─── bolao_special_predictions ──────────────────────────────
DROP POLICY IF EXISTS bolao_special_predictions_select ON public.bolao_special_predictions;
CREATE POLICY bolao_special_predictions_select ON public.bolao_special_predictions
  FOR SELECT USING (bolao_id IN (SELECT public.get_user_bolao_ids()));

DROP POLICY IF EXISTS bolao_special_predictions_insert ON public.bolao_special_predictions;
CREATE POLICY bolao_special_predictions_insert ON public.bolao_special_predictions
  FOR INSERT WITH CHECK (
    (user_id = auth.uid()) AND (bolao_id IN (SELECT public.get_user_bolao_ids()))
  );

DROP POLICY IF EXISTS bolao_special_predictions_update ON public.bolao_special_predictions;
CREATE POLICY bolao_special_predictions_update ON public.bolao_special_predictions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS bolao_special_predictions_delete ON public.bolao_special_predictions;
CREATE POLICY bolao_special_predictions_delete ON public.bolao_special_predictions
  FOR DELETE USING (user_id = auth.uid());

-- ─── bolao_insights ─────────────────────────────────────────
-- Vê os próprios insights OU os insights públicos (sem user_id) dos
-- bolões em que é membro.
DROP POLICY IF EXISTS users_read_own_or_public_insights ON public.bolao_insights;
CREATE POLICY users_read_own_or_public_insights ON public.bolao_insights
  FOR SELECT USING (
    (user_id = auth.uid())
    OR (
      (user_id IS NULL)
      AND EXISTS (
        SELECT 1 FROM public.bolao_members bm
        WHERE bm.bolao_id = bolao_insights.bolao_id AND bm.user_id = auth.uid()
      )
    )
  );

-- ─── bolao_subscriptions ────────────────────────────────────
DROP POLICY IF EXISTS bolao_subscriptions_select ON public.bolao_subscriptions;
CREATE POLICY bolao_subscriptions_select ON public.bolao_subscriptions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS bolao_subscriptions_insert ON public.bolao_subscriptions;
CREATE POLICY bolao_subscriptions_insert ON public.bolao_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── wc_matches (publico) ───────────────────────────────────
DROP POLICY IF EXISTS wc_matches_select_public ON public.wc_matches;
CREATE POLICY wc_matches_select_public ON public.wc_matches
  FOR SELECT USING (true);
