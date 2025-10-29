-- Add cashout fields to bets table (fixing missing columns)

-- Check if columns exist before adding them
DO $$ 
BEGIN
    -- Add cashout_amount if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bets' AND column_name = 'cashout_amount'
    ) THEN
        ALTER TABLE bets ADD COLUMN cashout_amount DECIMAL(10,2);
    END IF;

    -- Add cashout_date if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bets' AND column_name = 'cashout_date'
    ) THEN
        ALTER TABLE bets ADD COLUMN cashout_date TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add cashout_odds if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bets' AND column_name = 'cashout_odds'
    ) THEN
        ALTER TABLE bets ADD COLUMN cashout_odds DECIMAL(10,2);
    END IF;

    -- Add is_cashout if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bets' AND column_name = 'is_cashout'
    ) THEN
        ALTER TABLE bets ADD COLUMN is_cashout BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add comments to explain the fields
COMMENT ON COLUMN bets.cashout_amount IS 'Amount received from cashout';
COMMENT ON COLUMN bets.cashout_date IS 'Date when cashout was made';
COMMENT ON COLUMN bets.cashout_odds IS 'Odds at the time of cashout';
COMMENT ON COLUMN bets.is_cashout IS 'Whether this bet was cashed out';

