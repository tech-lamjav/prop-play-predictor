-- Add cashout fields to bets table

ALTER TABLE bets 
ADD COLUMN cashout_amount DECIMAL(10,2),
ADD COLUMN cashout_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN cashout_odds DECIMAL(10,2),
ADD COLUMN is_cashout BOOLEAN DEFAULT FALSE;

-- Add comment to explain the fields
COMMENT ON COLUMN bets.cashout_amount IS 'Amount received from cashout';
COMMENT ON COLUMN bets.cashout_date IS 'Date when cashout was made';
COMMENT ON COLUMN bets.cashout_odds IS 'Odds at the time of cashout';
COMMENT ON COLUMN bets.is_cashout IS 'Whether this bet was cashed out';

-- Update the status enum to include cashout
-- Note: This would require recreating the table in production, 
-- but for now we'll handle it in the application logic
