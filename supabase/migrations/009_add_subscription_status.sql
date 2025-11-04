-- Add subscription_status field to users table
-- This allows enabling/disabling bet limits per user for testing
-- Also will be used later to check if user has paid subscription

ALTER TABLE users 
ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'free' CHECK (subscription_status IN ('free', 'premium', 'disabled'));

-- Add index for faster lookups
CREATE INDEX idx_users_subscription_status ON users(subscription_status);

-- Add comment explaining the field
COMMENT ON COLUMN users.subscription_status IS 'User subscription status: free (limit applies), premium (no limit), disabled (limit applies, can be used for testing)';

