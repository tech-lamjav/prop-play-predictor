-- O cartão explicativo dos alertas de publicação aparece uma única vez. O
-- reconhecimento fica no banco (e não no navegador) para não voltar quando o
-- usuário troca de dispositivo.
--
-- Dispensar o cartão é uma ação de leitura: não altera
-- futebol_publication_alerts_enabled nem interrompe qualquer entrega.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS futebol_publication_alerts_ack_at timestamptz;

COMMENT ON COLUMN public.users.futebol_publication_alerts_ack_at IS
  'Momento em que o usuário dispensou o cartão explicativo dos alertas de oportunidades publicadas. Nulo significa que o cartão ainda não foi visto.';
