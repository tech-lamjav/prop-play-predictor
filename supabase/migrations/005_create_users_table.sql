-- Create users table for betting feature
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  whatsapp_number VARCHAR(20) UNIQUE,
  conversation_id VARCHAR(255), -- ID da conversa no Chatroot
  name VARCHAR(255),
  whatsapp_synced BOOLEAN DEFAULT FALSE,
  whatsapp_sync_token VARCHAR(255), -- Token temporário para sincronização
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_users_whatsapp_number ON users(whatsapp_number);
CREATE INDEX idx_users_conversation_id ON users(conversation_id);
CREATE INDEX idx_users_whatsapp_sync_token ON users(whatsapp_sync_token);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own data
CREATE POLICY "Users can only see their own data" ON users
  FOR ALL USING (auth.uid() = id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate WhatsApp sync token
CREATE OR REPLACE FUNCTION generate_whatsapp_sync_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to sync WhatsApp
CREATE OR REPLACE FUNCTION sync_whatsapp(
  user_id UUID,
  whatsapp_number TEXT,
  conversation_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  sync_token TEXT;
BEGIN
  -- Generate sync token
  sync_token := generate_whatsapp_sync_token();
  
  -- Update user with WhatsApp info
  UPDATE users 
  SET 
    whatsapp_number = sync_whatsapp.whatsapp_number,
    conversation_id = sync_whatsapp.conversation_id,
    whatsapp_synced = TRUE,
    whatsapp_sync_token = sync_token,
    updated_at = NOW()
  WHERE id = user_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION sync_whatsapp(UUID, TEXT, TEXT) TO authenticated;
