-- Create referral system for Member Get Member feature
-- Migration: 017_create_referral_system.sql
-- Consolidated migration: includes logic from 018, 019, and 021

-- Add referral fields to users table
-- referred_by is VARCHAR(6) to store the referral code (not UUID)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(6) UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by VARCHAR(6);

-- Create indexes for referral lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by_code ON users(referred_by);

-- Create referrals table to track all referrals
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  referral_code VARCHAR(6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(referred_id) -- Each user can only be referred once
);

-- Create indexes for referrals table
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON referrals(created_at);

-- Enable RLS on referrals table
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can see their own referrals" ON referrals;
DROP POLICY IF EXISTS "Users can insert referrals where they are referred" ON referrals;

-- RLS Policy: Users can only see referrals they made or referrals where they were referred
CREATE POLICY "Users can see their own referrals" ON referrals
  FOR SELECT USING (
    auth.uid() = referrer_id OR auth.uid() = referred_id
  );

-- RLS Policy: Allow users to insert referrals where they are the referred user
-- This allows new users to register themselves as referred when signing up
CREATE POLICY "Users can insert referrals where they are referred" ON referrals
  FOR INSERT
  WITH CHECK (auth.uid() = referred_id);

-- Function to generate a unique 6-character referral code (A-Z, 0-9)
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS VARCHAR(6) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result VARCHAR(6) := '';
  i INTEGER;
  char_index INTEGER;
  code_exists BOOLEAN;
BEGIN
  -- Try up to 100 times to generate a unique code
  FOR i IN 1..100 LOOP
    result := '';
    -- Generate 6 random characters
    FOR j IN 1..6 LOOP
      char_index := floor(random() * length(chars) + 1)::INTEGER;
      result := result || substr(chars, char_index, 1);
    END LOOP;
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = result) INTO code_exists;
    
    -- If code doesn't exist, return it
    IF NOT code_exists THEN
      RETURN result;
    END IF;
  END LOOP;
  
  -- If we couldn't generate a unique code after 100 tries, raise an error
  RAISE EXCEPTION 'Could not generate unique referral code after 100 attempts';
END;
$$ LANGUAGE plpgsql;

-- Function to create a referral record
-- Updates referred_by with the referral code (VARCHAR(6)) instead of UUID
CREATE OR REPLACE FUNCTION create_referral(
  p_referrer_id UUID,
  p_referred_id UUID,
  p_referral_code VARCHAR(6)
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Insert referral record
  INSERT INTO referrals (referrer_id, referred_id, referral_code)
  VALUES (p_referrer_id, p_referred_id, p_referral_code);
  
  -- Update referred user's referred_by field with the code (VARCHAR(6))
  UPDATE users
  SET referred_by = p_referral_code
  WHERE id = p_referred_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's referrals (list of users they referred)
CREATE OR REPLACE FUNCTION get_user_referrals(p_user_id UUID)
RETURNS TABLE (
  referred_id UUID,
  referred_email VARCHAR(255),
  referred_name VARCHAR(255),
  referral_code VARCHAR(6),
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.referred_id,
    u.email,
    u.name,
    r.referral_code,
    r.created_at
  FROM referrals r
  INNER JOIN users u ON u.id = r.referred_id
  WHERE r.referrer_id = p_user_id
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get referral count for a user
CREATE OR REPLACE FUNCTION get_referral_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  count_result INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_result
  FROM referrals
  WHERE referrer_id = p_user_id;
  
  RETURN count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's referrals from users table (using referred_by field)
-- This function bypasses RLS to allow users to see who they referred
CREATE OR REPLACE FUNCTION get_user_referrals_from_users(p_user_id UUID)
RETURNS TABLE (
  referred_id UUID,
  referred_email VARCHAR(255),
  referred_name VARCHAR(255),
  referral_code VARCHAR(6),
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  user_referral_code VARCHAR(6);
BEGIN
  -- Get the referral code of the current user
  SELECT u.referral_code INTO user_referral_code
  FROM users u
  WHERE u.id = p_user_id;
  
  -- If user doesn't have a referral code, return empty
  IF user_referral_code IS NULL THEN
    RETURN;
  END IF;
  
  -- Return all users who were referred by this user's code and have premium subscription
  RETURN QUERY
  SELECT 
    u2.id,
    u2.email,
    u2.name,
    user_referral_code,
    u2.created_at
  FROM users u2
  WHERE u2.referred_by = user_referral_code
    AND u2.subscription_status = 'premium'
  ORDER BY u2.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to generate referral code when user is created
CREATE OR REPLACE FUNCTION generate_user_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code VARCHAR(6);
BEGIN
  -- Only generate code if it doesn't already exist
  IF NEW.referral_code IS NULL THEN
    new_code := generate_referral_code();
    NEW.referral_code := new_code;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate referral code
DROP TRIGGER IF EXISTS trigger_generate_referral_code ON users;
CREATE TRIGGER trigger_generate_referral_code
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION generate_user_referral_code();

-- Generate referral codes for existing users who don't have one
DO $$
DECLARE
  user_record RECORD;
  new_code VARCHAR(6);
BEGIN
  -- Loop through all users without referral codes
  FOR user_record IN 
    SELECT id FROM users WHERE referral_code IS NULL
  LOOP
    -- Use the existing generate_referral_code() function
    new_code := generate_referral_code();
    
    -- Update the user with the generated code
    UPDATE users 
    SET referral_code = new_code
    WHERE id = user_record.id;
  END LOOP;
END $$;

-- Verify all users have codes
DO $$
DECLARE
  users_without_codes INTEGER;
BEGIN
  SELECT COUNT(*) INTO users_without_codes
  FROM users
  WHERE referral_code IS NULL;
  
  IF users_without_codes > 0 THEN
    RAISE NOTICE 'Warning: % users still without referral codes. You may need to run this migration again.', users_without_codes;
  ELSE
    RAISE NOTICE 'Success: All users now have referral codes';
  END IF;
END $$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION generate_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION create_referral(UUID, UUID, VARCHAR(6)) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_referrals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_referral_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_referrals_from_users(UUID) TO authenticated;

-- Add comments
COMMENT ON COLUMN users.referral_code IS 'Código único de 6 caracteres para compartilhamento de indicação';
COMMENT ON COLUMN users.referred_by IS 'Código de referência usado no cadastro (VARCHAR(6))';
COMMENT ON TABLE referrals IS 'Registra todas as indicações feitas entre usuários';
COMMENT ON COLUMN referrals.referrer_id IS 'Usuário que fez a indicação';
COMMENT ON COLUMN referrals.referred_id IS 'Usuário que foi indicado';
COMMENT ON COLUMN referrals.referral_code IS 'Código usado na indicação';
