-- Add unit system fields to users table
-- This allows users to configure their betting unit system for better bankroll management

ALTER TABLE users 
ADD COLUMN unit_value NUMERIC(10,2) NULL,
ADD COLUMN unit_calculation_method VARCHAR(20) NULL CHECK (unit_calculation_method IN ('direct', 'division')),
ADD COLUMN bank_amount NUMERIC(10,2) NULL;

-- Add constraint: if unit_calculation_method is set, unit_value must be set
ALTER TABLE users
ADD CONSTRAINT check_unit_configuration 
CHECK (
  (unit_value IS NULL AND unit_calculation_method IS NULL AND bank_amount IS NULL) OR
  (unit_value IS NOT NULL AND unit_value > 0 AND unit_calculation_method IS NOT NULL)
);

-- Add constraint: if method is 'division', bank_amount should be set
ALTER TABLE users
ADD CONSTRAINT check_division_method 
CHECK (
  (unit_calculation_method != 'division') OR 
  (unit_calculation_method = 'division' AND bank_amount IS NOT NULL AND bank_amount > 0)
);

-- Add comments for documentation
COMMENT ON COLUMN users.unit_value IS 'Value of 1 unit in reais (R$). Calculated based on unit_calculation_method.';
COMMENT ON COLUMN users.unit_calculation_method IS 'Method used to calculate unit: direct (user provides unit value directly) or division (user provides bank amount and divisor).';
COMMENT ON COLUMN users.bank_amount IS 'Total bank amount used when calculation method is division. Optional for direct method.';

