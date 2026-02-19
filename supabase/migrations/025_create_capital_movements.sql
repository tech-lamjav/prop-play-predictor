-- Create capital movements table for aportes (deposits) and resgates (withdrawals)
-- Migration: 025_create_capital_movements.sql

CREATE TABLE capital_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  movement_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  description TEXT,
  source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'bankroll_edit')),
  affects_balance BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_capital_movements_user_id ON capital_movements(user_id);
CREATE INDEX idx_capital_movements_movement_date ON capital_movements(movement_date);
CREATE INDEX idx_capital_movements_user_date ON capital_movements(user_id, movement_date);

-- Enable RLS
ALTER TABLE capital_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policy: users can only manage their own capital movements
CREATE POLICY "Users can manage their own capital movements" ON capital_movements
  FOR ALL USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_capital_movements_updated_at
  BEFORE UPDATE ON capital_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE capital_movements IS 'Aportes (deposits) and resgates (withdrawals) for bankroll tracking. affects_balance=false for bankroll_edit entries to avoid double-counting.';
COMMENT ON COLUMN capital_movements.type IS 'deposit = aporte, withdrawal = resgate';
COMMENT ON COLUMN capital_movements.source IS 'manual = user-entered, bankroll_edit = auto-created when editing banca';
COMMENT ON COLUMN capital_movements.affects_balance IS 'When false (e.g. bankroll_edit), entry is informational only and does not add to balance calculation';
