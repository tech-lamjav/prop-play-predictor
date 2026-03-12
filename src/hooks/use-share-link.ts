import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ShareLinkFilters {
  status: string[];
  sport: string[];
  league: string[];
  betting_market: string[];
  searchQuery: string;
  dateFrom: string;
  dateTo: string;
  selectedTags: string[];
}

function mapFiltersToPayload(filters: ShareLinkFilters) {
  return {
    status: filters.status,
    sports: filters.sport,
    leagues: filters.league,
    markets: filters.betting_market,
    tags: filters.selectedTags,
    date_from: filters.dateFrom || null,
    date_to: filters.dateTo || null,
    search: filters.searchQuery || '',
  };
}

async function createShareLink(filters: ShareLinkFilters): Promise<{ token: string; url: string }> {
  const payload = mapFiltersToPayload(filters);
  const { data, error } = await supabase.functions.invoke('share-create', {
    body: { filters: payload },
  });

  if (error) {
    throw new Error(error.message || 'Falha ao gerar link');
  }

  if (!data?.token || !data?.url) {
    throw new Error(data?.error || 'Resposta inválida do servidor');
  }

  return { token: data.token, url: data.url };
}

export function useShareLink() {
  const mutation = useMutation({
    mutationFn: createShareLink,
  });

  return {
    generateLink: mutation.mutateAsync,
    isLoading: mutation.isPending,
    shareUrl: mutation.data?.url ?? null,
    error: mutation.error,
    reset: mutation.reset,
  };
}
