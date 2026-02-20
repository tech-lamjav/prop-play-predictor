import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../integrations/supabase/client';
import { useAuth } from './use-auth';

export interface SubscriptionDetails {
  status: 'free' | 'premium';
  productType: string | null;
  periodEnd: string | null;
  cancelAt: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
}

/**
 * Hook to fetch subscription metadata for display in Settings.
 * Uses betinho_subscription_status as primary; includes period_end and cancel info.
 */
export function useSubscriptionDetails() {
  const { user } = useAuth();
  const supabase = createClient();
  const [details, setDetails] = useState<SubscriptionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDetails = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select(
          'betinho_subscription_status, analytics_subscription_status, stripe_customer_id, subscription_period_end, subscription_cancel_at, subscription_cancel_at_period_end, subscription_product_type'
        )
        .eq('id', user.id)
        .single();

      if (error) {
        throw error;
      }

      const betinhoStatus = (data as { betinho_subscription_status?: string })?.betinho_subscription_status;
      const analyticsStatus = (data as { analytics_subscription_status?: string })?.analytics_subscription_status;
      const status = betinhoStatus === 'premium' || analyticsStatus === 'premium' ? 'premium' : 'free';
      const productType = (data as { subscription_product_type?: string })?.subscription_product_type ?? null;
      const periodEnd = (data as { subscription_period_end?: string })?.subscription_period_end ?? null;
      const cancelAt = (data as { subscription_cancel_at?: string })?.subscription_cancel_at ?? null;
      const cancelAtPeriodEnd = (data as { subscription_cancel_at_period_end?: boolean })?.subscription_cancel_at_period_end ?? false;
      const hasStripeCustomer = !!(data as { stripe_customer_id?: string })?.stripe_customer_id;

      setDetails({
        status,
        productType,
        periodEnd,
        cancelAt,
        cancelAtPeriodEnd,
        hasStripeCustomer,
      });
    } catch (err) {
      console.error('Error fetching subscription details:', err);
      setDetails({
        status: 'free',
        productType: null,
        periodEnd: null,
        cancelAt: null,
        cancelAtPeriodEnd: false,
        hasStripeCustomer: false,
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  return {
    details,
    isLoading,
    refetch: fetchDetails,
  };
}
