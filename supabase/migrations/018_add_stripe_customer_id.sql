-- Add stripe_customer_id field to users table
-- This stores the Stripe customer ID for each user to support Accounts V2

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

-- Add comment explaining the field
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for this user. Required for Accounts V2 checkout sessions.';

