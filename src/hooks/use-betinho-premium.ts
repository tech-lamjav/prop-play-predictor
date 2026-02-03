import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/integrations/supabase/client';

const QUERY_KEY = ['betinho_subscription'] as const;

async function fetchBetinhoStatus(userId: string): Promise<'free' | 'premium'> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('users')
    .select('betinho_subscription_status')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching Betinho subscription status:', error);
    return 'free';
  }
  const status = (data as { betinho_subscription_status?: string } | null)?.betinho_subscription_status;
  return status === 'premium' ? 'premium' : 'free';
}

export function useBetinhoPremium() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: [...QUERY_KEY, user?.id ?? ''],
    queryFn: () => fetchBetinhoStatus(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    isPremium: query.data === 'premium',
    isFree: query.data === 'free',
    isLoading: query.isLoading,
    isPending: query.isPending,
    data: query.data,
    refetch: query.refetch,
  };
}
