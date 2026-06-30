-- ============================================================
-- 073_kickoff_telegram_notifications — aviso de kickoff no Telegram do dono
-- ============================================================
-- Opt-in do dono do bolão: no início de cada jogo, ele recebe no SEU Telegram os
-- palpites de todos os membros (placar + quem cada um acha que avança no mata-mata
-- + campeão). Ninguém além do dono recebe. Reusa o linking de Telegram que já
-- existe (users.telegram_chat_id).
--
-- Econômico: o cron roda só nos minutos :00 e :30 (os kickoffs da Copa são
-- "redondos"), e a função sai na hora quando não há jogo começando.
--
-- PRÉ-REQUISITO POR AMBIENTE (rodar uma vez via SQL, igual ao 048):
--   vault.create_secret('<x-cron-secret>', 'notify_kickoff_cron_secret', ...);
--   vault.create_secret('<url da função>', 'notify_kickoff_url', ...);
--   E os secrets da função (TELEGRAM_BOT_TOKEN, CRON_SECRET) no painel.
-- ============================================================

ALTER TABLE public.boloes
  ADD COLUMN IF NOT EXISTS kickoff_notify_telegram boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.boloes.kickoff_notify_telegram IS
  'Opt-in do dono: avisar no Telegram dele quando cada jogo começa (palpites do bolão).';

-- Idempotência: (bolão, jogo) já notificado → não repete.
CREATE TABLE IF NOT EXISTS public.bolao_kickoff_notifications (
  bolao_id uuid    NOT NULL REFERENCES public.boloes(id)     ON DELETE CASCADE,
  match_id integer NOT NULL REFERENCES public.wc_matches(id) ON DELETE CASCADE,
  sent_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bolao_id, match_id)
);
COMMENT ON TABLE public.bolao_kickoff_notifications IS
  'Idempotência do aviso de kickoff: registra (bolão, jogo) já notificado.';

-- ── RPC: pares (bolão, jogo) a notificar AGORA ──────────────
-- Jogo começou na última janela (~40 min), bolão com opt-in, dono com Telegram,
-- e ainda não notificado. A janela > intervalo do cron (30 min) garante que um
-- run perdido seja coberto no próximo, sem duplicar (idempotência cuida disso).
CREATE OR REPLACE FUNCTION public.get_due_kickoff_notifications()
RETURNS TABLE(
  bolao_id uuid, bolao_name text, match_id integer, owner_chat_id text,
  stage text, home_team text, away_team text,
  home_team_code text, away_team_code text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT b.id, b.name, m.id, u.telegram_chat_id,
         m.stage, m.home_team, m.away_team, m.home_team_code, m.away_team_code
  FROM wc_matches m
  JOIN boloes b ON b.kickoff_notify_telegram = true
  JOIN users  u ON u.id = b.owner_id AND u.telegram_chat_id IS NOT NULL
  WHERE (m.match_date + m.match_time_brasilia) AT TIME ZONE 'America/Sao_Paulo'
          BETWEEN now() - interval '40 minutes' AND now() + interval '2 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM bolao_kickoff_notifications n
      WHERE n.bolao_id = b.id AND n.match_id = m.id
    );
$function$;

-- ── RPC: palpites de cada membro do bolão pra um jogo ───────
-- Placar + campeão de cada um + (mata-mata) quem ele acha que avança neste jogo.
CREATE OR REPLACE FUNCTION public.get_bolao_match_picks(p_bolao_id uuid, p_match_id integer)
RETURNS TABLE(
  user_name text,
  predicted_home integer, predicted_away integer,
  champion_code text, advance_code text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_home text; v_away text;
BEGIN
  SELECT home_team_code, away_team_code INTO v_home, v_away FROM wc_matches WHERE id = p_match_id;
  RETURN QUERY
  SELECT u.name,
         bp.predicted_home_score, bp.predicted_away_score,
         champ.predicted_team_code,
         adv.predicted_team_code
  FROM bolao_members bm
  JOIN users u ON u.id = bm.user_id
  LEFT JOIN bolao_predictions bp
    ON bp.bolao_id = bm.bolao_id AND bp.user_id = bm.user_id AND bp.match_id = p_match_id
  LEFT JOIN bolao_special_predictions champ
    ON champ.bolao_id = bm.bolao_id AND champ.user_id = bm.user_id
   AND champ.prediction_type = 'champion'
  LEFT JOIN LATERAL (
    SELECT sp.predicted_team_code
    FROM bolao_special_predictions sp
    WHERE sp.bolao_id = bm.bolao_id AND sp.user_id = bm.user_id
      AND sp.prediction_type IN ('round_of_16','quarterfinalist','semifinalist','finalist')
      AND sp.predicted_team_code IN (v_home, v_away)
    LIMIT 1
  ) adv ON true
  WHERE bm.bolao_id = p_bolao_id
  ORDER BY u.name;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_due_kickoff_notifications()            TO service_role;
GRANT EXECUTE ON FUNCTION public.get_bolao_match_picks(uuid, integer)        TO service_role;

-- ── Cron: roda nos minutos :00 e :30 (kickoffs são redondos) ─
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-kickoff') THEN
    PERFORM cron.unschedule('notify-kickoff');
  END IF;
END $$;

SELECT cron.schedule('notify-kickoff', '0,30 * * * *', $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_kickoff_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_kickoff_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$job$);
