-- Preferência independente dos alertas em tempo real. Ela nunca é alterada por
-- mudança de plano: acesso inativo interrompe a entrega, mas preserva a escolha
-- para quando o usuário voltar a ter acesso ao Futebol.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS futebol_publication_alerts_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.futebol_publication_alerts_enabled IS
  'Preferência do usuário para receber no Telegram alertas de oportunidades publicadas em tempo real.';

-- A escolha entra já na criação do lote. Assim reativar depois não reenvia
-- oportunidades que já tinham sido publicadas.
CREATE OR REPLACE FUNCTION public.get_futebol_publication_alert_recipients()
RETURNS TABLE(user_id uuid, chat_id text, user_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT u.id, u.telegram_chat_id::text, u.name::text
  FROM public.users u
  WHERE u.telegram_chat_id IS NOT NULL
    AND coalesce(u.futebol_publication_alerts_enabled, true) = true
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

-- Reconfere a preferência quando a entrega é reservada. Pausar no site ou no
-- Telegram vale imediatamente inclusive para lotes que já estavam na fila.
CREATE OR REPLACE FUNCTION public.claim_futebol_publication_alert_deliveries()
RETURNS TABLE(batch_id uuid, user_id uuid, chat_id text, attempt_id uuid, opportunities jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
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
      AND coalesce(u.futebol_publication_alerts_enabled, true) = true
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
