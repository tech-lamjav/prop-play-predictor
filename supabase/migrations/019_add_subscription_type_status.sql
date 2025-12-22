-- Add subscription type status fields to users table
-- This allows tracking individual subscription statuses for betinho and platform
-- Remove the old subscription_status column as it's no longer needed

-- Add new subscription type fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS subscription_betinho_status VARCHAR(20) DEFAULT 'free' 
  CHECK (subscription_betinho_status IN ('free', 'premium', 'disabled'));

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS subscription_platform_status VARCHAR(20) DEFAULT 'free' 
  CHECK (subscription_platform_status IN ('free', 'premium', 'disabled'));

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_subscription_betinho_status ON users(subscription_betinho_status);
CREATE INDEX IF NOT EXISTS idx_users_subscription_platform_status ON users(subscription_platform_status);

-- Add comments explaining the fields
COMMENT ON COLUMN users.subscription_betinho_status IS 'Betinho subscription status: free (no subscription), premium (active subscription), disabled (disabled for testing)';
COMMENT ON COLUMN users.subscription_platform_status IS 'Platform subscription status: free (no subscription), premium (active subscription), disabled (disabled for testing)';

-- Migrate existing data: if user had premium, set betinho_status to premium
UPDATE users 
SET subscription_betinho_status = CASE 
  WHEN subscription_status = 'premium' THEN 'premium' 
  ELSE 'free' 
END,
subscription_platform_status = 'free';

-- Drop the old subscription_status column and its index
DROP INDEX IF EXISTS idx_users_subscription_status;
ALTER TABLE users DROP COLUMN IF EXISTS subscription_status;

