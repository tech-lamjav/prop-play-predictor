-- Add subscription metadata fields for displaying plan status, validity and next billing in Settings
-- These are populated by the Stripe webhook on subscription events

ALTER TABLE users
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_cancel_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS subscription_product_type VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id);

COMMENT ON COLUMN users.stripe_subscription_id IS 'Stripe subscription ID for the active subscription';
COMMENT ON COLUMN users.subscription_period_end IS 'End of current billing period (next charge date)';
COMMENT ON COLUMN users.subscription_cancel_at IS 'When subscription will be canceled (if cancel_at_period_end)';
COMMENT ON COLUMN users.subscription_cancel_at_period_end IS 'True if subscription cancels at end of period';
COMMENT ON COLUMN users.subscription_product_type IS 'Product type: betinho or analytics';
