import { useQuery } from '@tanstack/react-query';

export interface ShareResolveBet {
  id: string;
  bet_date: string;
  sport: string;
  league: string | null;
  bet_description: string;
  odds: number;
  stake_amount: number;
  potential_return: number;
  status: string;
  cashout_amount: number | null;
  cashout_odds: number | null;
  is_cashout: boolean | null;
  bet_type: string;
  betting_market: string | null;
  bet_legs?: Array<{
    bet_id: string;
    leg_number: number;
    sport: string;
    match_description: string;
    bet_description: string;
    odds: number;
    status: string;
  }>;
}

export interface ShareResolveData {
  owner: { name: string };
  filters_snapshot: Record<string, unknown>;
  bets: ShareResolveBet[];
  total: number;
}

async function resolveShareToken(token: string): Promise<ShareResolveData> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const res = await fetch(`${supabaseUrl}/functions/v1/share-resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ token }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data?.error || 'Erro ao carregar') as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  if (data?.error) {
    const err = new Error(data.error) as Error & { status?: number };
    err.status = data.error === 'Link não encontrado' ? 404 : data.error === 'Este link expirou' ? 410 : 500;
    throw err;
  }

  if (!data?.owner || !Array.isArray(data?.bets)) {
    throw new Error('Resposta inválida');
  }

  return data as ShareResolveData;
}

export const shareResolveQueryKeys = {
  all: ['share-resolve'] as const,
  byToken: (token: string) => [...shareResolveQueryKeys.all, token] as const,
};

export function useShareResolve(token: string | undefined) {
  return useQuery({
    queryKey: shareResolveQueryKeys.byToken(token ?? ''),
    queryFn: () => resolveShareToken(token!),
    enabled: !!token,
    staleTime: 2 * 60 * 1000,
    retry: (failureCount, error) => {
      const err = error as Error & { status?: number };
      if (err?.status === 404 || err?.status === 410) return false;
      return failureCount < 2;
    },
  });
}
