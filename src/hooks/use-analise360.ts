import { useQuery } from '@tanstack/react-query';
import { nbaDataService, DailyOpportunity } from '@/services/nba-data.service';

// Hook para a lista de triggers (usa daily opportunities para ter info de jogo)
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
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Hook para o detalhe de um trigger (usa nova tabela de impacto completo)
export function useTeammateImpact360(triggerPlayerId: number | null) {
  return useQuery({
    queryKey: ['teammate-impact-360', triggerPlayerId],
    queryFn: () => nbaDataService.getTeammateImpact360(triggerPlayerId!),
    enabled: triggerPlayerId != null,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
