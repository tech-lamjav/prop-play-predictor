import { useCallback, useMemo } from 'react';
import { useAsync } from './use-async';
import { 
  nbaDataService, 
  Player, 
  GamePlayerStats, 
  PropPlayer, 
  TeamPlayer, 
  Team, 
  PlayerShootingZones 
} from '@/services/nba-data.service';

export interface PlayerData {
  player: Player;
  gameStats: GamePlayerStats[];
  propPlayers: PropPlayer[];
  teammates: TeamPlayer[];
  teamData: Team;
  shootingZones: PlayerShootingZones | null;
}

export interface UsePlayerDataOptions {
  playerName: string | undefined;
  gameStatsLimit?: number;
}

export interface UsePlayerDataReturn {
  player: Player | null;
  gameStats: GamePlayerStats[];
  propPlayers: PropPlayer[];
  teammates: TeamPlayer[];
  teamData: Team | null;
  shootingZones: PlayerShootingZones | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  reset: () => void;
}

/**
 * Hook for loading all player dashboard data with automatic cleanup.
 * Loads player info, game stats, props, teammates, team data, and shooting zones in parallel.
 */
export function usePlayerData({ 
  playerName, 
  gameStatsLimit = 10 
}: UsePlayerDataOptions): UsePlayerDataReturn {
  const asyncFn = useCallback(async (signal?: AbortSignal): Promise<PlayerData> => {
    if (!playerName) {
      throw new Error('Player name is required');
    }

    // Get player by name
    let playerData: Player | null;
    try {
      playerData = await nbaDataService.getPlayerByName(playerName);
    } catch (error: any) {
      // Re-throw service errors (they already have proper messages)
      if (error?.message?.includes('service unavailable') || error?.message?.includes('Database service')) {
        throw error;
      }
      // For other errors, treat as player not found
      playerData = null;
    }
    
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }
    
    if (!playerData) {
      throw new Error(`Player "${playerName.replace(/-/g, ' ')}" not found`);
    }

    // Load all data in parallel
    const results = await Promise.allSettled([
      nbaDataService.getPlayerGameStats(playerData.player_id, gameStatsLimit),
      nbaDataService.getPlayerProps(playerData.player_id),
      nbaDataService.getTeamPlayers(playerData.team_id),
      nbaDataService.getTeamById(playerData.team_id),
      nbaDataService.getPlayerShootingZones(playerData.player_id),
    ]);

    // Check if request was aborted before processing results
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }

    // Extract results with error handling
    const gameStats = results[0].status === 'fulfilled' ? results[0].value : [];
    const propPlayers = results[1].status === 'fulfilled' ? results[1].value : [];
    const teammates = results[2].status === 'fulfilled' ? results[2].value : [];
    const teamData = results[3].status === 'fulfilled' ? results[3].value : null;
    const shootingZones = results[4].status === 'fulfilled' ? results[4].value : null;

    // Log errors for debugging but don't fail the entire request
    if (results[0].status === 'rejected') {
      console.error('Error loading game stats:', results[0].reason);
    }
    if (results[1].status === 'rejected') {
      console.error('Error loading prop data:', results[1].reason);
    }
    if (results[2].status === 'rejected') {
      console.error('Error loading teammates:', results[2].reason);
    }
    if (results[3].status === 'rejected') {
      console.error('Error loading team data:', results[3].reason);
    }
    if (results[4].status === 'rejected') {
      console.error('Error loading shooting zones:', results[4].reason);
    }

    return {
      player: playerData,
      gameStats,
      propPlayers,
      teammates,
      teamData: teamData || null,
      shootingZones,
    };
  }, [playerName, gameStatsLimit]);

  const { data, loading, error, execute, reset } = useAsync<PlayerData>({
    asyncFn,
    immediate: !!playerName,
    dependencies: [playerName, gameStatsLimit],
  });

  const refetch = useCallback(async () => {
    await execute();
  }, [execute]);

  // Extract individual pieces of data
  const player = data?.player || null;
  const gameStats = data?.gameStats || [];
  const propPlayers = data?.propPlayers || [];
  const teammates = data?.teammates || [];
  const teamData = data?.teamData || null;
  const shootingZones = data?.shootingZones || null;

  return {
    player,
    gameStats,
    propPlayers,
    teammates,
    teamData,
    shootingZones,
    loading,
    error,
    refetch,
    reset,
  };
}

