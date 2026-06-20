import { useQuery } from '@tanstack/react-query';
import { nbaDataService, DailyOpportunity } from '@/services/nba-data.service';
import { MOCK_ANALISE360, isMockAnalise360 } from '@/mocks/analise360';

// Stats permitidas na Análise 360 — exibimos apenas as 4 principais
const ALLOWED_STATS = new Set([
  'player_points',
  'player_assists',
  'player_rebounds',
  'player_points_rebounds_assists',
]);

function filterStats(opps: DailyOpportunity[]): DailyOpportunity[] {
  return opps.filter(o => ALLOWED_STATS.has(o.stat_type));
}

async function fetchAnalise360Data(): Promise<{
  opportunities: DailyOpportunity[];
  playerStarsMap: Map<number, number>;
}> {
  // ?mock=1 funciona em qualquer ambiente (testes manuais com QA/PM)
  if (isMockAnalise360()) {
    return { ...MOCK_ANALISE360, opportunities: filterStats(MOCK_ANALISE360.opportunities) };
  }

  const [opportunities, players] = await Promise.all([
    nbaDataService.getDailyOpportunities(),
    nbaDataService.getAllPlayers(),
  ]);

  // Fallback automático só em dev — em prod, vazio = empty state real
  if (opportunities.length === 0 && import.meta.env.DEV) {
    return { ...MOCK_ANALISE360, opportunities: filterStats(MOCK_ANALISE360.opportunities) };
  }

  const playerStarsMap = new Map<number, number>();
  players.forEach(p => playerStarsMap.set(p.player_id, p.rating_stars ?? 0));
  return { opportunities: filterStats(opportunities), playerStarsMap };
}

export function useAnalise360Data() {
  return useQuery({
    queryKey: ['analise360', 'data'],
    queryFn: fetchAnalise360Data,
    staleTime: 2 * 60 * 1000,    // 2 min — data is fresh
    gcTime: 10 * 60 * 1000,      // 10 min — keep in cache
    refetchOnWindowFocus: false,
  });
}
