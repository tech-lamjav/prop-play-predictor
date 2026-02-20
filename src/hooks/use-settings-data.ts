import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../integrations/supabase/client';
import { useAuth } from './use-auth';

export interface UserProfile {
  name: string | null;
  email: string;
  whatsapp_number: string | null;
  created_at: string;
}

export interface UserProfileUpdate {
  name?: string | null;
  email?: string;
  whatsapp_number?: string | null;
}

export interface ProductSubscription {
  status: 'free' | 'premium';
  periodEnd: string | null;
  cancelAt: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface SubscriptionDetails {
  betinho: ProductSubscription;
  analytics: ProductSubscription;
  hasStripeCustomer: boolean;
}

/**
 * Unified hook for Settings page: single query for profile + subscription.
 * Reduces roundtrips and avoids blocking the whole page.
 */
export function useSettingsData() {
  const { user } = useAuth();
  const supabase = createClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('users')
        .select(
          'name, email, whatsapp_number, created_at, betinho_subscription_status, analytics_subscription_status, stripe_customer_id, betinho_subscription_period_end, analytics_subscription_period_end, betinho_subscription_cancel_at, analytics_subscription_cancel_at, betinho_subscription_cancel_at_period_end, analytics_subscription_cancel_at_period_end'
        )
        .eq('id', user.id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      const row = data as Record<string, unknown>;

      if (data) {
        setProfile({
          name: (row.name as string) ?? null,
          email: (row.email as string) ?? '',
          whatsapp_number: (row.whatsapp_number as string) ?? null,
          created_at: (row.created_at as string) ?? '',
        });

        const betinhoStatus = (row.betinho_subscription_status as string) === 'premium' ? 'premium' : 'free';
        const analyticsStatus = (row.analytics_subscription_status as string) === 'premium' ? 'premium' : 'free';

        setSubscription({
          betinho: {
            status: betinhoStatus,
            periodEnd: (row.betinho_subscription_period_end as string) ?? null,
            cancelAt: (row.betinho_subscription_cancel_at as string) ?? null,
            cancelAtPeriodEnd: (row.betinho_subscription_cancel_at_period_end as boolean) ?? false,
          },
          analytics: {
            status: analyticsStatus,
            periodEnd: (row.analytics_subscription_period_end as string) ?? null,
            cancelAt: (row.analytics_subscription_cancel_at as string) ?? null,
            cancelAtPeriodEnd: (row.analytics_subscription_cancel_at_period_end as boolean) ?? false,
          },
          hasStripeCustomer: !!(row.stripe_customer_id as string),
        });
      } else {
        setProfile(null);
        setSubscription(null);
      }
    } catch (err) {
      console.error('Error fetching settings data:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
      setProfile(null);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const updateProfile = async (input: UserProfileUpdate): Promise<boolean> => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.email !== undefined) updates.email = input.email;
      if (input.whatsapp_number !== undefined) updates.whatsapp_number = input.whatsapp_number;

      if (Object.keys(updates).length === 0) {
        setIsSaving(false);
        return true;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      setProfile((prev) =>
        prev ? { ...prev, ...updates } : null
      );

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar alterações');
      console.error('Error updating profile:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    profile,
    subscription,
    isLoading,
    isSaving,
    error,
    updateProfile,
    refetch: fetchAll,
  };
}
