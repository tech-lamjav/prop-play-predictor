-- ============================================================
-- 089_message_runs — telemetria dos carteiros (Onda 4 da revisão)
-- ============================================================
-- Espelho do collector_runs (082) pras funções de MENSAGEM: cada execução de
-- notify-settlement / notify-opportunities / notify-weekly-summary grava um
-- resumo (candidatos, enviados, erros). Antes, os erros voltavam num JSON de
-- cron que ninguém lê — um 429 do Telegram numa segunda-feira passaria batido.
--
-- Quem CONSOME é o ops-healthcheck (088): 3 runs consecutivos com ok=false
-- numa função → entra na DM diária do admin. Um ponto único de alerta.
--
-- Regra de registro (anti-ruído): settlement só loga run com candidato ou
-- falha (roda 96x/dia, maioria vazia); daily/weekly logam todo run de envio
-- (baixa frequência, e o "dia de silêncio" é informação); mode=report NUNCA
-- loga (ensaio não é operação).
CREATE TABLE IF NOT EXISTS public.message_runs (
  id         bigserial PRIMARY KEY,
  fn         text NOT NULL,               -- 'notify-settlement' | 'notify-opportunities' | 'notify-weekly-summary'
  ran_at     timestamptz NOT NULL DEFAULT now(),
  candidates integer,
  sent       integer,
  errors     jsonb,                       -- array de mensagens de erro (null = nenhum)
  ok         boolean NOT NULL
);
COMMENT ON TABLE public.message_runs IS
  'Resumo de cada execução das funções de mensagem do Betinho. Consumido pelo ops-healthcheck (alerta após falhas consecutivas).';
CREATE INDEX IF NOT EXISTS idx_message_runs_fn_ran ON public.message_runs (fn, ran_at DESC);
ALTER TABLE public.message_runs ENABLE ROW LEVEL SECURITY;
-- sem policy: só service_role
