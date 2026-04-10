import { useQuery } from '@tanstack/react-query';
import { nbaDataService, Game, Player, DailyOpportunity } from '@/services/nba-data.service';

const SAO_PAULO_TZ = 'America/Sao_Paulo';

function getSaoPauloTodayISO(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
}

interface HomeNBAData {
  games: Game[];
  players: Player[];
  opportunities: DailyOpportunity[];
  today: string;
}

async function fetchHomeNBAData(): Promise<HomeNBAData> {
  const today = getSaoPauloTodayISO();
  const [games, players, opportunities] = await Promise.all([
    nbaDataService.getGames({ gameDate: today }),
    nbaDataService.getAllPlayers(),
    nbaDataService.getDailyOpportunities().catch(() => [] as DailyOpportunity[]),
  ]);
  return { games, players, opportunities, today };
}

export function useHomeNBAData() {
  return useQuery({
    queryKey: ['homeNBA', 'data'],
    queryFn: fetchHomeNBAData,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
