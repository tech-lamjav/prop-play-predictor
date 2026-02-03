import { useState, useEffect } from 'react';
import { useAuth } from './use-auth';
import { createClient } from '@/integrations/supabase/client';

export type SubscriptionStatus = 'free' | 'premium' | null;

export function useSubscription() {
  const { user } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!user?.id) {
        // Se não está logado, considera como free
        setSubscriptionStatus('free');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('analytics_subscription_status')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching subscription status:', error);
          setSubscriptionStatus('free');
        } else {
          const status = (data as any)?.analytics_subscription_status;
          setSubscriptionStatus(status === 'premium' ? 'premium' : 'free');
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        setSubscriptionStatus('free');
      } finally {
        setIsLoading(false);
      }
    };

    checkSubscriptionStatus();
  }, [user?.id, supabase]);

  const isPremium = subscriptionStatus === 'premium';
  const isFree = subscriptionStatus === 'free';

  return {
    subscriptionStatus,
    isPremium,
    isFree,
    isLoading,
  };
}
