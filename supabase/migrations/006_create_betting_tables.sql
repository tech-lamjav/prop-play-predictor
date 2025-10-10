-- Create betting tables for the betting feature

-- Table for bets
CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bet_type VARCHAR(50) NOT NULL, -- 'single', 'multiple', 'system', etc.
  sport VARCHAR(50) NOT NULL, -- 'football', 'basketball', 'tennis', etc.
  league VARCHAR(100), -- 'Premier League', 'NBA', etc.
  match_description TEXT, -- 'Manchester United vs Liverpool'
  bet_description TEXT NOT NULL, -- 'Over 2.5 goals'
  odds DECIMAL(10,2) NOT NULL,
  stake_amount DECIMAL(10,2) NOT NULL,
  potential_return DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'won', 'lost', 'void'
  bet_date TIMESTAMP WITH TIME ZONE NOT NULL,
  match_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  raw_input TEXT, -- Input original do usuário
  processed_data JSONB -- Dados estruturados pela LLM
);

-- Table for bet legs (for multiple bets)
CREATE TABLE bet_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID REFERENCES bets(id) ON DELETE CASCADE,
  leg_number INTEGER NOT NULL,
  sport VARCHAR(50) NOT NULL,
  match_description TEXT NOT NULL,
  bet_description TEXT NOT NULL,
  odds DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for message queue (Sistema de Filas)
CREATE TABLE message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  message_type VARCHAR(20) NOT NULL, -- 'text', 'audio', 'image'
  content TEXT, -- Para texto
  media_url TEXT, -- Para áudio/imagem
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  processing_attempts INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_bets_bet_date ON bets(bet_date);
CREATE INDEX idx_bets_sport ON bets(sport);

CREATE INDEX idx_bet_legs_bet_id ON bet_legs(bet_id);
CREATE INDEX idx_bet_legs_status ON bet_legs(status);

CREATE INDEX idx_message_queue_user_id ON message_queue(user_id);
CREATE INDEX idx_message_queue_status ON message_queue(status);
CREATE INDEX idx_message_queue_created_at ON message_queue(created_at);

-- Enable RLS
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only see their own bets" ON bets
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only see their own bet legs" ON bet_legs
  FOR ALL USING (auth.uid() = (SELECT user_id FROM bets WHERE id = bet_id));

CREATE POLICY "Users can only see their own messages" ON message_queue
  FOR ALL USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_bets_updated_at
  BEFORE UPDATE ON bets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to add message to queue
CREATE OR REPLACE FUNCTION add_message_to_queue(
  p_user_id UUID,
  p_message_type VARCHAR(20),
  p_content TEXT DEFAULT NULL,
  p_media_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  message_id UUID;
BEGIN
  INSERT INTO message_queue (user_id, message_type, content, media_url)
  VALUES (p_user_id, p_message_type, p_content, p_media_url)
  RETURNING id INTO message_id;
  
  RETURN message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending messages
CREATE OR REPLACE FUNCTION get_pending_messages(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  message_type VARCHAR(20),
  content TEXT,
  media_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mq.id,
    mq.user_id,
    mq.message_type,
    mq.content,
    mq.media_url,
    mq.created_at
  FROM message_queue mq
  WHERE mq.status = 'pending'
  ORDER BY mq.created_at ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update message status
CREATE OR REPLACE FUNCTION update_message_status(
  p_message_id UUID,
  p_status VARCHAR(20),
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE message_queue 
  SET 
    status = p_status,
    error_message = p_error_message,
    processed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE processed_at END,
    processing_attempts = processing_attempts + 1
  WHERE id = p_message_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION add_message_to_queue(UUID, VARCHAR(20), TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_messages(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION update_message_status(UUID, VARCHAR(20), TEXT) TO authenticated;
