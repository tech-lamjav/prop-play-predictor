import { useQuery } from '@tanstack/react-query';
import { nbaDataService, DailyOpportunity } from '@/services/nba-data.service';

interface PlayerStarsMap {
  map: Map<number, number>;
}

async function fetchAnalise360Data(): Promise<{
  opportunities: DailyOpportunity[];
  playerStarsMap: Map<number, number>;
}> {
  const [opportunities, players] = await Promise.all([
    nbaDataService.getDailyOpportunities(),
    nbaDataService.getAllPlayers(),
  ]);
  const playerStarsMap = new Map<number, number>();
  players.forEach(p => playerStarsMap.set(p.player_id, p.rating_stars ?? 0));
  return { opportunities, playerStarsMap };
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
