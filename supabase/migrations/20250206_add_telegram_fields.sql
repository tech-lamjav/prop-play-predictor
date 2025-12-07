-- Add Telegram channel fields to existing users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS telegram_user_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_username TEXT,
  ADD COLUMN IF NOT EXISTS telegram_phone TEXT,
  ADD COLUMN IF NOT EXISTS telegram_synced BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS telegram_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS telegram_sync_source TEXT;

CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON users(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_users_telegram_phone ON users(telegram_phone);

-- Optional channel tagging for reporting
ALTER TABLE message_queue ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS channel TEXT;

