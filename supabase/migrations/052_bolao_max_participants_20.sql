-- ============================================================
-- Bolão: subir max_participants do Free de 10 para 20
-- ============================================================
-- A migration 050 mudou só a função `join_bolao_by_code` (enforcement).
-- Mas a coluna `max_participants` da tabela `boloes` continuou com
-- default 10, e os bolões Free existentes também ficaram em 10.
--
-- O frontend lê `b.max_participants` direto pra mostrar "N/10" no card
-- da home — então sem este UPDATE, o usuário vê o limite errado mesmo
-- com o enforcement já aceitando até 20.
--
-- Premium continua em 9999 (setado pelo stripe-webhook no upgrade) —
-- não é tocado aqui.
-- ============================================================

-- 1) Default pra novos bolões: 20 (era 10)
ALTER TABLE public.boloes
  ALTER COLUMN max_participants SET DEFAULT 20;

-- 2) Atualiza bolões Free existentes que ainda estão em 10
UPDATE public.boloes
   SET max_participants = 20
 WHERE is_premium = false
   AND max_participants = 10;
