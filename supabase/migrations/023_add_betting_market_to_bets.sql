-- Add betting_market column to bets table
-- Valores esperados: Múltipla, Money Line, Handicap, Over/Under, Dupla Chance, Ambas Marcam, ou vazio

ALTER TABLE bets
ADD COLUMN IF NOT EXISTS betting_market VARCHAR(100);

COMMENT ON COLUMN bets.betting_market IS 'Mercado da aposta: Múltipla, Money Line, Handicap, Over/Under, Dupla Chance, Ambas Marcam ou vazio';
