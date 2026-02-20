-- Add per-product subscription metadata for Betinho and Analytics
-- Enables separate display of status and billing per product in Settings

ALTER TABLE users
ADD COLUMN IF NOT EXISTS betinho_subscription_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS betinho_subscription_cancel_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS betinho_subscription_cancel_at_period_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS analytics_subscription_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS analytics_subscription_cancel_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS analytics_subscription_cancel_at_period_end BOOLEAN DEFAULT FALSE;

-- Migrate existing generic metadata to product-specific (one-time)
UPDATE users
SET
  betinho_subscription_period_end = CASE WHEN subscription_product_type = 'betinho' THEN subscription_period_end ELSE betinho_subscription_period_end END,
  betinho_subscription_cancel_at = CASE WHEN subscription_product_type = 'betinho' THEN subscription_cancel_at ELSE betinho_subscription_cancel_at END,
  betinho_subscription_cancel_at_period_end = CASE WHEN subscription_product_type = 'betinho' THEN COALESCE(subscription_cancel_at_period_end, false) ELSE betinho_subscription_cancel_at_period_end END,
  analytics_subscription_period_end = CASE WHEN subscription_product_type = 'analytics' OR subscription_product_type = 'platform' THEN subscription_period_end ELSE analytics_subscription_period_end END,
  analytics_subscription_cancel_at = CASE WHEN subscription_product_type = 'analytics' OR subscription_product_type = 'platform' THEN subscription_cancel_at ELSE analytics_subscription_cancel_at END,
  analytics_subscription_cancel_at_period_end = CASE WHEN subscription_product_type = 'analytics' OR subscription_product_type = 'platform' THEN COALESCE(subscription_cancel_at_period_end, false) ELSE analytics_subscription_cancel_at_period_end END
WHERE subscription_period_end IS NOT NULL OR subscription_cancel_at IS NOT NULL;

COMMENT ON COLUMN users.betinho_subscription_period_end IS 'Betinho: end of current billing period';
COMMENT ON COLUMN users.analytics_subscription_period_end IS 'Analytics: end of current billing period';
