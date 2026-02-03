import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/integrations/supabase/client';

interface PremiumRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export default function PremiumRoute({
  children,
  redirectTo = '/paywall',
}: PremiumRouteProps) {
  const { user, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const [subscriptionStatus, setSubscriptionStatus] = useState<'free' | 'premium' | null>(null);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user?.id) {
        setIsCheckingSubscription(false);
        return;
      }

      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .from('users')
          .select('betinho_subscription_status')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching Betinho subscription status:', error);
          setSubscriptionStatus('free');
        } else {
          const status = (data as { betinho_subscription_status?: string } | null)
            ?.betinho_subscription_status;
          setSubscriptionStatus(status === 'premium' ? 'premium' : 'free');
        }
      } catch (err) {
        console.error('Error checking subscription:', err);
        setSubscriptionStatus('free');
      } finally {
        setIsCheckingSubscription(false);
      }
    };

    checkSubscription();
  }, [user?.id]);

  if (authLoading || isCheckingSubscription) {
    return (
      <div className="min-h-screen bg-terminal-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-terminal-green" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (subscriptionStatus === 'free') {
    const from = location.pathname + location.search;
    const paywallUrl = from ? `${redirectTo}?from=${encodeURIComponent(from)}` : redirectTo;
    return <Navigate to={paywallUrl} replace />;
  }

  if (subscriptionStatus !== 'premium') {
    return (
      <div className="min-h-screen bg-terminal-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-terminal-green" />
      </div>
    );
  }

  return <>{children}</>;
}
