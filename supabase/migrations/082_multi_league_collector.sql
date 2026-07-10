-- ============================================================
-- 082_multi_league_collector — coletor de placares multi-liga (F1)
-- ============================================================
-- Implementa o desenho aprovado pelo Kasuya na task wdx6zenqbv (parecer 08/07):
--
--   • fixtures genérica (multi-liga) com placar por período (halftime/fulltime/
--     extratime/penalty), status/elapsed, trigger de updated_at e índices
--   • leagues_config — quais ligas o coletor cobre (dado, não código)
--   • team_aliases — apelidos por ID de time (substitui o dicionário hardcoded
--     EN_ALIASES no futuro matching v2 do settlement — F2)
--   • collector_runs — telemetria de cada execução (a lacuna nº1 do parecer:
--     "o medo que gera é degradar em silêncio")
--   • 1 ÚNICO cron a cada 2 min cujo SQL só chama a função SE existe jogo em
--     janela (kickoff−10min < now < kickoff+3h) em liga habilitada — fora de
--     janela: zero invocação, zero request, zero custo
--   • 1 cron diário de calendário (04:00 BRT — 1 chamada por liga habilitada)
--
-- ESTRATÉGIA DE MIGRAÇÃO (dual-run, sem migrar histórico):
--   wc_matches NÃO é migrada (é do bolão; morre com a Copa em 19/07).
--   O coletor grava fixtures pra todas as ligas incl. Copa → ~10 dias de
--   paridade em staging → notify-settlement troca a leitura (F2) → pós-Copa,
--   aposentar ingest-wc-scores + cron 048.
--   futebol.fact_fixtures (sync do BQ) NÃO serve pro settlement: latência de
--   horas contra os ≤15min necessários — dono é o data-engineering.
--
-- PRÉ-REQUISITO POR AMBIENTE (rodar uma vez via SQL, igual 048/073/078):
--   vault.create_secret('<x-cron-secret>', 'ingest_fixtures_cron_secret', ...);
--   vault.create_secret('<url da função>', 'ingest_fixtures_url', ...);
-- ============================================================

-- ── Ligas cobertas: dado, não código ─────────────────────────
CREATE TABLE IF NOT EXISTS public.leagues_config (
  league_id integer NOT NULL,
  season    integer NOT NULL,
  name      text NOT NULL,
  enabled   boolean NOT NULL DEFAULT false,
  PRIMARY KEY (league_id, season)
);
COMMENT ON TABLE public.leagues_config IS
  'Ligas que o coletor multi-liga cobre. enabled=true entra no live poll e no calendário diário. IDs da API-Football.';

-- Seed: Copa (piloto/dual-run) + Ondas 1 e 2 da expansão. enabled=true só nas
-- que têm jogo AGORA; as demais viram true na data de retorno (datas nas tasks
-- das Ondas no ClickUp).
INSERT INTO public.leagues_config (league_id, season, name, enabled) VALUES
  (1,   2026, 'Copa do Mundo FIFA',        true),   -- até 19/07 (dual-run com ingest-wc-scores)
  (71,  2026, 'Brasileirão Série A',       true),   -- volta 16/07
  (72,  2026, 'Brasileirão Série B',       true),   -- não para
  (73,  2026, 'Copa do Brasil',            true),   -- volta 30/07-01/08
  (13,  2026, 'Copa Libertadores',         true),   -- volta 12/08 (odds antes)
  (2,   2026, 'UEFA Champions League',     false),  -- volta 16/09
  (39,  2026, 'Premier League (ENG)',      false),  -- volta 15/08
  (140, 2026, 'La Liga (ESP)',             false),  -- volta 15/08
  (11,  2026, 'Copa Sul-Americana',        false),  -- volta 15/07 → habilitar quando odds cobrirem
  (135, 2026, 'Serie A (ITA)',             false),  -- volta 22/08
  (78,  2026, 'Bundesliga (ALE)',          false),  -- volta 22/08
  (61,  2026, 'Ligue 1 (FRA)',             false),  -- volta 23/08
  (94,  2026, 'Primeira Liga (POR)',       false)   -- volta 08/08
ON CONFLICT (league_id, season) DO NOTHING;

-- ── Fixtures genérica (fonte do settlement multi-liga no F2) ─
CREATE TABLE IF NOT EXISTS public.fixtures (
  fixture_id     bigint PRIMARY KEY,          -- id da API-Football
  league_id      integer NOT NULL,
  season         integer NOT NULL,
  round          text,
  home_team_id   bigint,
  home_team      text NOT NULL,
  away_team_id   bigint,
  away_team      text NOT NULL,
  kickoff_utc    timestamptz NOT NULL,
  status_short   text,                        -- NS/1H/HT/2H/ET/P/FT/AET/PEN/PST/CANC...
  elapsed        integer,
  goals_home     integer,                     -- placar corrente/final (inclui prorrogação)
  goals_away     integer,
  halftime_home  integer,                     -- mercados de 1º tempo (futuro)
  halftime_away  integer,
  fulltime_home  integer,                     -- 90' — BASE DE LIQUIDAÇÃO
  fulltime_away  integer,
  extratime_home integer,
  extratime_away integer,
  penalty_home   integer,
  penalty_away   integer,
  winner         text,                        -- 'home' | 'away' | null (empate/indefinido)
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.fixtures IS
  'Placares multi-liga do coletor (edge function ingest-fixtures). Liquidação usa fulltime_* (90 min); goals_* inclui prorrogação.';
CREATE INDEX IF NOT EXISTS idx_fixtures_kickoff ON public.fixtures (kickoff_utc);
CREATE INDEX IF NOT EXISTS idx_fixtures_league  ON public.fixtures (league_id, season);
-- trigger de updated_at (função já existe desde a 005; wc_matches não tinha — parecer 2c)
DROP TRIGGER IF EXISTS update_fixtures_updated_at ON public.fixtures;
CREATE TRIGGER update_fixtures_updated_at
  BEFORE UPDATE ON public.fixtures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
-- sem policy: só service_role (settlement/edge); o front lê pelo schema futebol (DE)

-- ── Apelidos de time por ID (consumidor: matching v2 — F2) ───
CREATE TABLE IF NOT EXISTS public.team_aliases (
  api_team_id bigint NOT NULL,
  alias       text   NOT NULL,   -- normalizado (sem acento, minúsculas)
  PRIMARY KEY (api_team_id, alias)
);
COMMENT ON TABLE public.team_aliases IS
  'Apelidos/aliases por ID de time da API-Football (ex.: 85→"psg"). Substitui dicionários hardcoded no matching aposta↔jogo.';
ALTER TABLE public.team_aliases ENABLE ROW LEVEL SECURITY;

-- ── Telemetria do coletor (lacuna nº1 do parecer) ────────────
CREATE TABLE IF NOT EXISTS public.collector_runs (
  id              bigserial PRIMARY KEY,
  ran_at          timestamptz NOT NULL DEFAULT now(),
  mode            text NOT NULL,              -- 'live' | 'calendar'
  window_active   boolean,
  live_fixtures   integer,
  api_calls       integer,
  quota_remaining integer,                    -- header x-ratelimit-requests-remaining
  ok              boolean NOT NULL,
  error           text
);
COMMENT ON TABLE public.collector_runs IS
  'Cada execução do ingest-fixtures: chamadas feitas, quota restante do plano, sucesso/erro. Alerta admin após falhas consecutivas.';
CREATE INDEX IF NOT EXISTS idx_collector_runs_ran_at ON public.collector_runs (ran_at DESC);
ALTER TABLE public.collector_runs ENABLE ROW LEVEL SECURITY;

-- ── Cron 1: live poll a cada 2 min, com GATE SQL ─────────────
-- Fora de janela de jogo: o SELECT não chama net.http_post → zero invocação.
-- O gate lê a própria fixtures (populada pelo calendário diário).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ingest-fixtures-live') THEN
    PERFORM cron.unschedule('ingest-fixtures-live');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ingest-fixtures-calendar') THEN
    PERFORM cron.unschedule('ingest-fixtures-calendar');
  END IF;
END $$;

SELECT cron.schedule('ingest-fixtures-live', '*/2 * * * *', $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ingest_fixtures_url') || '?mode=live',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ingest_fixtures_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  WHERE EXISTS (
    SELECT 1
    FROM public.fixtures f
    JOIN public.leagues_config lc
      ON lc.league_id = f.league_id AND lc.season = f.season AND lc.enabled
    WHERE now() BETWEEN f.kickoff_utc - interval '10 minutes'
                    AND f.kickoff_utc + interval '3 hours'
      AND coalesce(f.status_short, 'NS') NOT IN ('FT','AET','PEN','CANC','ABD','AWD','WO','PST')
  );
$job$);

-- ── Cron 2: calendário diário às 07:00 UTC (04:00 BRT) ───────
-- 1 chamada por liga habilitada — pega jogos novos, remarcações e TBD→NS.
SELECT cron.schedule('ingest-fixtures-calendar', '0 7 * * *', $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ingest_fixtures_url') || '?mode=calendar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ingest_fixtures_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$job$);
