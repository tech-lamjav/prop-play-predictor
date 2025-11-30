-- Create tags system for bets
-- Migration: 016_create_bet_tags_system.sql

-- Table for user-defined tags
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) NOT NULL, -- Hex color code (e.g., #00d4ff)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name) -- Prevent duplicate tag names per user
);

-- Junction table for bet-tag relationships
CREATE TABLE bet_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID REFERENCES bets(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bet_id, tag_id) -- Prevent duplicate tag assignments
);

-- Create indexes for performance
CREATE INDEX idx_tags_user_id ON tags(user_id);
CREATE INDEX idx_bet_tags_bet_id ON bet_tags(bet_id);
CREATE INDEX idx_bet_tags_tag_id ON bet_tags(tag_id);

-- Enable RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tags
CREATE POLICY "Users can manage their own tags" ON tags
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for bet_tags
CREATE POLICY "Users can manage tags on their own bets" ON bet_tags
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM bets WHERE id = bet_id)
  );

-- Function to get tags for a bet
CREATE OR REPLACE FUNCTION get_bet_tags(p_bet_id UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(50),
  color VARCHAR(7)
) AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.color
  FROM tags t
  INNER JOIN bet_tags bt ON bt.tag_id = t.id
  WHERE bt.bet_id = p_bet_id
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add tag to bet (with 10 tag limit)
CREATE OR REPLACE FUNCTION add_tag_to_bet(
  p_bet_id UUID,
  p_tag_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  tag_count INTEGER;
BEGIN
  -- Check current tag count for this bet
  SELECT COUNT(*) INTO tag_count
  FROM bet_tags
  WHERE bet_id = p_bet_id;
  
  -- Enforce 10 tag limit
  IF tag_count >= 10 THEN
    RAISE EXCEPTION 'Cannot add more than 10 tags to a bet';
  END IF;
  
  -- Insert the tag relationship
  INSERT INTO bet_tags (bet_id, tag_id)
  VALUES (p_bet_id, p_tag_id)
  ON CONFLICT (bet_id, tag_id) DO NOTHING;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove tag from bet
CREATE OR REPLACE FUNCTION remove_tag_from_bet(
  p_bet_id UUID,
  p_tag_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  DELETE FROM bet_tags
  WHERE bet_id = p_bet_id AND tag_id = p_tag_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_bet_tags(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_tag_to_bet(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_tag_from_bet(UUID, UUID) TO authenticated;
