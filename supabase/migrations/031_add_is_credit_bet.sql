-- Add is_credit_bet field to bets table
-- Credit bets return only the profit (stake x (odds - 1)) instead of full return (stake x odds)
ALTER TABLE public.bets
ADD COLUMN IF NOT EXISTS is_credit_bet boolean NOT NULL DEFAULT false;
