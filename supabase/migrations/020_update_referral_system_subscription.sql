-- Update referral system function to use subscription_betinho_status
-- This function returns users who were referred and have betinho premium subscription

CREATE OR REPLACE FUNCTION get_referred_users(p_user_referral_code TEXT)
RETURNS TABLE (
  user_id UUID,
  user_email VARCHAR,
  user_name VARCHAR,
  referral_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u2.id as user_id,
    u2.email as user_email,
    u2.name as user_name,
    u2.user_referral_code as referral_code,
    u2.created_at
  FROM users u2
  WHERE u2.referred_by = p_user_referral_code
    AND u2.subscription_betinho_status = 'premium'
  ORDER BY u2.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

