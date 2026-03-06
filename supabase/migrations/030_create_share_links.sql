-- Create share_links table for bet sharing feature
-- Migration: 030_create_share_links.sql

CREATE TABLE share_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  filters_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON share_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON share_links FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_share_links_user_id ON share_links(user_id);
