-- ============================================================
-- 111_futebol_alertas_publicacao — alertas Telegram ao publicar oportunidade
-- ============================================================
-- O daily (081) é um resumo editorial às 10h. Este fluxo é diferente: guarda
-- a PRIMEIRA publicação de cada Oportunidade e entrega um lote após o sync.
-- A identidade é fixture + mercado + saída + linha; mudança de odd/Score não
-- cria outro alerta, e reativação da mesma oportunidade também não.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.futebol_publication_alert_runtime (
  singleton     boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  initialized_at timestamptz NOT NULL DEFAULT now(),
  last_sync_at   timestamptz
);
COMMENT ON TABLE public.futebol_publication_alert_runtime IS
  'Estado do detector de publicações. O primeiro run só cria a base histórica para não disparar oportunidades que já estavam no painel.';
ALTER TABLE public.futebol_publication_alert_runtime ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.futebol_publication_alert_batches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_at    timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_futebol_publication_alert_batches_sync
  ON public.futebol_publication_alert_batches (sync_at DESC);
ALTER TABLE public.futebol_publication_alert_batches ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.futebol_publication_alerts (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                 uuid NOT NULL REFERENCES public.futebol_publication_alert_batches(id) ON DELETE CASCADE,
  opportunity_key          text NOT NULL UNIQUE,
  fixture_id               bigint NOT NULL,
  home_team_name           text NOT NULL,
  away_team_name           text NOT NULL,
  competition              text,
  kickoff_utc              timestamptz NOT NULL,
  market                   text NOT NULL,
  outcome                  text NOT NULL,
  line_value               double precision,
  best_odd                 numeric NOT NULL,
  score                    integer NOT NULL,
  faixa                    text NOT NULL,
  janela_usada             text,
  edge                     double precision,
  prob_justa_fechamento    double precision,
  evidencias               text[],
  detected_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_futebol_publication_alerts_batch
  ON public.futebol_publication_alerts (batch_id, score DESC);
COMMENT ON TABLE public.futebol_publication_alerts IS
  'Registro imutável da primeira publicação de cada Oportunidade no painel; fonte do alerta em tempo real e da fotografia dos números enviados.';
ALTER TABLE public.futebol_publication_alerts ENABLE ROW LEVEL SECURITY;

-- Um alerta pode reutilizar o mesmo pick criado pelo daily no mesmo dia. A
-- referência mantém o callback regbet existente sem criar outra família dele.
CREATE TABLE IF NOT EXISTS public.futebol_publication_alert_pick_refs (
  alert_id uuid PRIMARY KEY REFERENCES public.futebol_publication_alerts(id) ON DELETE CASCADE,
  pick_id  uuid NOT NULL REFERENCES public.daily_opportunity_picks(id) ON DELETE CASCADE
);
ALTER TABLE public.futebol_publication_alert_pick_refs ENABLE ROW LEVEL SECURITY;

-- O mesmo pick pode aparecer no resumo diário e no alerta em tempo real. A
-- origem acompanha o registro no Betinho para manter o funil mensurável.
ALTER TABLE public.stake_prompts
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'daily_opportunities'
  CHECK (source IN ('daily_opportunities', 'published_opportunities'));

CREATE TABLE IF NOT EXISTS public.futebol_publication_alert_deliveries (
  batch_id        uuid NOT NULL REFERENCES public.futebol_publication_alert_batches(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  chat_id         text NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'failed', 'sent', 'expired')),
  attempts        integer NOT NULL DEFAULT 0,
  attempt_id      uuid,
  claimed_at      timestamptz,
  last_attempt_at timestamptz,
  sent_at         timestamptz,
  last_error      text,
  PRIMARY KEY (batch_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_futebol_publication_alert_deliveries_pending
  ON public.futebol_publication_alert_deliveries (status, last_attempt_at);
COMMENT ON TABLE public.futebol_publication_alert_deliveries IS
  'Entrega por pessoa dos lotes de publicação. Uma reserva atômica impede dois crons de reenviar a mesma linha; falhas podem ser retomadas enquanto houver jogo pré-live.';
ALTER TABLE public.futebol_publication_alert_deliveries ENABLE ROW LEVEL SECURITY;

-- Cria um lote somente para oportunidades que ainda não estavam no ledger.
-- O advisory lock torna o polling idempotente mesmo se dois crons coincidirem.
CREATE OR REPLACE FUNCTION public.claim_futebol_publication_alert_batch(
  p_sync_at timestamptz,
  p_opportunities jsonb
)
RETURNS TABLE(batch_id uuid, alert_id uuid, opportunity_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_batch_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('futebol-publication-alerts'));

  WITH incoming AS (
    SELECT *
    FROM jsonb_to_recordset(p_opportunities) AS x(
      opportunity_key text,
      fixture_id bigint,
      home_team_name text,
      away_team_name text,
      competition text,
      kickoff_utc timestamptz,
      market text,
      outcome text,
      line_value double precision,
      best_odd numeric,
      score integer,
      faixa text,
      janela_usada text,
      edge double precision,
      prob_justa_fechamento double precision,
      evidencias text[]
    )
  )
  INSERT INTO public.futebol_publication_alert_batches (sync_at)
  SELECT p_sync_at
  WHERE EXISTS (
    SELECT 1 FROM incoming i
    WHERE NOT EXISTS (
      SELECT 1 FROM public.futebol_publication_alerts a
      WHERE a.opportunity_key = i.opportunity_key
    )
  )
  RETURNING id INTO v_batch_id;

  IF v_batch_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH incoming AS (
    SELECT *
    FROM jsonb_to_recordset(p_opportunities) AS x(
      opportunity_key text,
      fixture_id bigint,
      home_team_name text,
      away_team_name text,
      competition text,
      kickoff_utc timestamptz,
      market text,
      outcome text,
      line_value double precision,
      best_odd numeric,
      score integer,
      faixa text,
      janela_usada text,
      edge double precision,
      prob_justa_fechamento double precision,
      evidencias text[]
    )
  ), inserted AS (
    INSERT INTO public.futebol_publication_alerts (
      batch_id, opportunity_key, fixture_id, home_team_name, away_team_name,
      competition, kickoff_utc, market, outcome, line_value, best_odd, score,
      faixa, janela_usada, edge, prob_justa_fechamento, evidencias
    )
    SELECT v_batch_id, i.opportunity_key, i.fixture_id, i.home_team_name,
           i.away_team_name, i.competition, i.kickoff_utc, i.market,
           i.outcome, i.line_value, i.best_odd, i.score, i.faixa,
           i.janela_usada, i.edge, i.prob_justa_fechamento, i.evidencias
    FROM incoming i
    ON CONFLICT (opportunity_key) DO NOTHING
    RETURNING id, opportunity_key
  )
  SELECT v_batch_id, i.id, i.opportunity_key FROM inserted i;
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_futebol_publication_alert_batch(timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_futebol_publication_alert_batch(timestamptz, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.get_futebol_publication_alert_recipients()
RETURNS TABLE(user_id uuid, chat_id text, user_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT u.id, u.telegram_chat_id::text, u.name::text
  FROM public.users u
  WHERE u.telegram_chat_id IS NOT NULL
    AND (
      coalesce(u.futebol_subscription_status, 'free') = 'premium'
      OR (
        u.futebol_trial_started_at IS NOT NULL
        AND u.futebol_trial_started_at + interval '7 days' > now()
  )
    );
$function$;
REVOKE ALL ON FUNCTION public.get_futebol_publication_alert_recipients() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_futebol_publication_alert_recipients() TO service_role;

-- Reserva somente entregas que ainda podem ocorrer. O filtro de acesso é
-- reavaliado a cada tentativa; uma assinatura expirada não recebe retry.
-- Reserva atomica antes de chamar o Telegram. Assim dois crons concorrentes
-- nao enviam o mesmo lote. Reserva apos aceite do Telegram fica para
-- reconciliação manual, pois Telegram não oferece chave de idempotência.
CREATE OR REPLACE FUNCTION public.claim_futebol_publication_alert_deliveries()
RETURNS TABLE(batch_id uuid, user_id uuid, chat_id text, attempt_id uuid, opportunities jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- Sem item pre-live restante, a entrega deixa de ser pendencia operacional.
  UPDATE public.futebol_publication_alert_deliveries d
  SET status = 'expired', attempt_id = NULL, claimed_at = NULL
  WHERE d.status IN ('pending', 'failed', 'processing')
    AND NOT EXISTS (
      SELECT 1 FROM public.futebol_publication_alerts a
      WHERE a.batch_id = d.batch_id AND a.kickoff_utc > now()
    );

  RETURN QUERY
  WITH claimed AS (
    UPDATE public.futebol_publication_alert_deliveries d
    SET status = 'processing',
        attempts = d.attempts + 1,
        attempt_id = gen_random_uuid(),
        claimed_at = now(),
        last_attempt_at = now()
    FROM public.users u
    WHERE d.user_id = u.id
      AND d.status IN ('pending', 'failed')
      AND u.telegram_chat_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.futebol_publication_alerts a
        WHERE a.batch_id = d.batch_id AND a.kickoff_utc > now()
      )
      AND (
        coalesce(u.futebol_subscription_status, 'free') = 'premium'
        OR (
          u.futebol_trial_started_at IS NOT NULL
          AND u.futebol_trial_started_at + interval '7 days' > now()
        )
      )
    RETURNING d.batch_id, d.user_id, u.telegram_chat_id::text, d.attempt_id
  )
  SELECT c.batch_id,
         c.user_id,
         c.telegram_chat_id,
         c.attempt_id,
         jsonb_agg(
           jsonb_build_object(
             'alert_id', a.id,
             'fixture_id', a.fixture_id,
             'home_team_name', a.home_team_name,
             'away_team_name', a.away_team_name,
             'competition', a.competition,
             'kickoff_utc', a.kickoff_utc,
             'market', a.market,
             'outcome', a.outcome,
             'line_value', a.line_value,
             'best_odd', a.best_odd,
             'score', a.score,
             'faixa', a.faixa,
             'evidencias', a.evidencias
           ) ORDER BY a.score DESC
         )
  FROM claimed c
  JOIN public.futebol_publication_alerts a ON a.batch_id = c.batch_id
  WHERE a.kickoff_utc > now()
  GROUP BY c.batch_id, c.user_id, c.telegram_chat_id, c.attempt_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_futebol_publication_alert_deliveries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_futebol_publication_alert_deliveries() TO service_role;

-- Polling curto: o detector só envia quando encontra uma publicação ainda não
-- registrada; entre syncs ele apenas pode retentar uma entrega que falhou.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-published-opportunities') THEN
    PERFORM cron.unschedule('notify-published-opportunities');
  END IF;
END $$;

SELECT cron.schedule('notify-published-opportunities', '*/10 * * * *', $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_published_opportunities_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_opportunities_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
