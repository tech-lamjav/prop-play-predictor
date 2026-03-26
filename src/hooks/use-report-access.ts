import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/integrations/supabase/client';

const QUERY_KEY = ['report_access'] as const;
const TRIAL_DAYS = 7;

interface ReportAccessData {
  created_at: string | null;
  analytics_subscription_status: string | null;
  betinho_subscription_status: string | null;
  has_report_access: boolean | null;
}

function checkAccess(data: ReportAccessData): { hasAccess: boolean; reason: 'trial' | 'premium' | 'manual' | null } {
  // 1. Manual flag
  if (data.has_report_access) {
    return { hasAccess: true, reason: 'manual' };
  }

  // 2. Premium (any subscription)
  if (data.analytics_subscription_status === 'premium' || data.betinho_subscription_status === 'premium') {
    return { hasAccess: true, reason: 'premium' };
  }

  // 3. Trial (signed up in the last N days)
  if (data.created_at) {
    const createdAt = new Date(data.created_at);
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays <= TRIAL_DAYS) {
      return { hasAccess: true, reason: 'trial' };
    }
  }

  return { hasAccess: false, reason: null };
}

async function fetchReportAccess(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('users')
    .select('created_at, analytics_subscription_status, betinho_subscription_status, has_report_access')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching report access:', error);
    return { hasAccess: false, reason: null } as const;
  }

  return checkAccess(data as ReportAccessData);
}

export function useReportAccess() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: [...QUERY_KEY, user?.id ?? ''],
    queryFn: () => fetchReportAccess(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    hasAccess: query.data?.hasAccess ?? false,
    reason: query.data?.reason ?? null,
    isLoading: query.isLoading,
  };
}
