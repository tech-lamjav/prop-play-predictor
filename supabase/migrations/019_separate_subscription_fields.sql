-- Separate subscription fields for multi-product support
-- This migration adds separate subscription status fields for Betinho and Analytics products
-- while maintaining backward compatibility with the existing subscription_status field

-- Add betinho_subscription_status field
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS betinho_subscription_status VARCHAR(50) DEFAULT 'free';

-- Add analytics_subscription_status field
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS analytics_subscription_status VARCHAR(50) DEFAULT 'free';

-- Migrate existing subscription_status data to betinho_subscription_status
-- This assumes all existing premium subscriptions are for Betinho
UPDATE users 
SET betinho_subscription_status = COALESCE(subscription_status, 'free')
WHERE betinho_subscription_status = 'free' OR betinho_subscription_status IS NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_betinho_subscription_status 
ON users(betinho_subscription_status);

CREATE INDEX IF NOT EXISTS idx_users_analytics_subscription_status 
ON users(analytics_subscription_status);

-- Add comments explaining the fields
COMMENT ON COLUMN users.betinho_subscription_status IS 
  'Subscription status for Betinho product. Values: free, premium. Used to check daily bet limits.';

COMMENT ON COLUMN users.analytics_subscription_status IS 
  'Subscription status for Analytics Platform product. Values: free, premium. Used for future analytics features.';

-- Note: subscription_status field is kept for backward compatibility
-- It can be removed in a future migration after all code is updated

