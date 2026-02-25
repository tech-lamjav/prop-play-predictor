-- Fix: Add subscription metadata columns if missing (e.g. when 027 wasn't applied)
-- Run this in Supabase SQL Editor if you get "column users.betinho_subscription_period_end does not exist"

ALTER TABLE users
ADD COLUMN IF NOT EXISTS betinho_subscription_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS betinho_subscription_cancel_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS betinho_subscription_cancel_at_period_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS analytics_subscription_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS analytics_subscription_cancel_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS analytics_subscription_cancel_at_period_end BOOLEAN DEFAULT FALSE;
