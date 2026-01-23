-- Add betting_house field to bets table
-- Used to store the bookmaker/casa de apostas

ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS betting_house TEXT;

COMMENT ON COLUMN public.bets.betting_house IS 'Bookmaker / casa de apostas da bet';
