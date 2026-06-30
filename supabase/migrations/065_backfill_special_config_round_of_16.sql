-- ============================================================
-- Backfill: round_of_16 (Oitavas) explícito no special_predictions_config
-- ============================================================
-- Contexto: o default do schema (037) só tinha
--   {finalist, round_of_32, semifinalist, quarterfinalist}.
-- A migration 053 adicionou a fase round_of_16 como tipo de palpite, mas NÃO
-- a incluiu no default do config nem fez backfill. Com a chave ausente, admin
-- e jogador divergiam ao resolver o default:
--   - Admin   (`!!config[type]`)         → undefined = OFF  (toggle desligado)
--   - Jogador (`config[type] !== false`) → undefined = ON   (card renderiza)
-- Resultado: a Oitavas aparecia pro jogador mesmo o admin mostrando desligada.
--
-- O fix no front normaliza o config nos pontos de consumo (special-config.ts).
-- Esta migration alinha os DADOS: preenche round_of_16=true onde a chave falta
-- (preserva quem já desligou explicitamente) e atualiza o default da coluna
-- para bolões novos nascerem com a chave.
-- ============================================================

-- 1) Bolões existentes: adiciona round_of_16=true só onde a chave está ausente.
UPDATE public.boloes
SET special_predictions_config =
      jsonb_build_object('round_of_16', true) || special_predictions_config
WHERE NOT (special_predictions_config ? 'round_of_16');

-- 2) Default da coluna para bolões novos (inclui round_of_16).
ALTER TABLE public.boloes
  ALTER COLUMN special_predictions_config SET DEFAULT
    '{"finalist": true, "round_of_16": true, "round_of_32": true, "semifinalist": true, "quarterfinalist": true}'::jsonb;
