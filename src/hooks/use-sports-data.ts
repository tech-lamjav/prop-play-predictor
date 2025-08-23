import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sportsDataService } from '@/services/sports-data.service';
import type {
  Player,
  Game,
  PropBet,
  PropAnalysis,
  InjuryReport,
  ModelPerformance,
  PlayerFilters,
  GameFilters,
  PropFilters,
  ApiResponse,
  PaginatedResponse
} from '@/types/sports';

// Query Keys
export const queryKeys = {
  players: (filters?: PlayerFilters) => ['players', filters],
  player: (id: string) => ['player', id],
  games: (filters?: GameFilters) => ['games', filters],
  game: (id: string) => ['game', id],
  props: (filters?: PropFilters) => ['props', filters],
  analysis: (id: string) => ['analysis', id],
  injuries: (teamId?: string) => ['injuries', teamId],
  performance: (days: number) => ['performance', days],
} as const;

// Custom hook for players data
export const usePlayers = (filters?: PlayerFilters) => {
  return useQuery({
    queryKey: queryKeys.players(filters),
    queryFn: () => sportsDataService.getPlayers(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Custom hook for individual player data
export const usePlayer = (id: string) => {
  return useQuery({
    queryKey: queryKeys.player(id),
    queryFn: () => sportsDataService.getPlayerById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Custom hook for games data
export const useGames = (filters?: GameFilters) => {
  return useQuery({
    queryKey: queryKeys.games(filters),
    queryFn: () => sportsDataService.getGames(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes for games (more dynamic)
    gcTime: 5 * 60 * 1000,
  });
};

// Custom hook for individual game data
export const useGame = (id: string) => {
  return useQuery({
    queryKey: queryKeys.game(id),
    queryFn: () => sportsDataService.getGameById(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

// Custom hook for prop bets data
export const usePropBets = (filters?: PropFilters) => {
  return useQuery({
    queryKey: queryKeys.props(filters),
    queryFn: () => sportsDataService.getPropBets(filters),
    staleTime: 1 * 60 * 1000, // 1 minute for props (very dynamic)
    gcTime: 3 * 60 * 1000,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

// Custom hook for prop analysis
export const usePropAnalysis = (id: string) => {
  return useQuery({
    queryKey: queryKeys.analysis(id),
    queryFn: () => sportsDataService.getPropAnalysis(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Custom hook for injury reports
export const useInjuryReports = (teamId?: string) => {
  return useQuery({
    queryKey: queryKeys.injuries(teamId),
    queryFn: () => sportsDataService.getInjuryReports(teamId),
    staleTime: 10 * 60 * 1000, // 10 minutes for injuries
    gcTime: 20 * 60 * 1000,
  });
};

// Custom hook for model performance
export const useModelPerformance = (days: number = 30) => {
  return useQuery({
    queryKey: queryKeys.performance(days),
    queryFn: () => sportsDataService.getModelPerformance(days),
    staleTime: 30 * 60 * 1000, // 30 minutes for performance data
    gcTime: 60 * 60 * 1000,
  });
};

// Custom hook for real-time data updates
export const useRealTimeData = () => {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  // In a real implementation, you'd set up WebSocket or Server-Sent Events here
  useEffect(() => {
    // Placeholder for real-time connection setup
    const connectToRealTime = () => {
      // Implement your real-time connection logic here
      // This could be WebSocket, Server-Sent Events, or polling
      setIsConnected(true);
    };

    connectToRealTime();

    return () => {
      // Cleanup real-time connection
      setIsConnected(false);
    };
  }, []);

  // Function to manually refresh specific data
  const refreshData = useCallback((queryKey: string[]) => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient]);

  // Function to refresh all sports data
  const refreshAllData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['players'] });
    queryClient.invalidateQueries({ queryKey: ['games'] });
    queryClient.invalidateQueries({ queryKey: ['props'] });
    queryClient.invalidateQueries({ queryKey: ['injuries'] });
  }, [queryClient]);

  return {
    isConnected,
    refreshData,
    refreshAllData,
  };
};

// Custom hook for data synchronization
export const useDataSync = () => {
  const queryClient = useQueryClient();
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncData = useCallback(async () => {
    setIsSyncing(true);
    try {
      // Clear cache and refetch all data
      sportsDataService.clearCache();
      
      // Invalidate all queries to force refetch
      await queryClient.invalidateQueries();
      
      setLastSync(new Date());
    } catch (error) {
      console.error('Data sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [queryClient]);

  return {
    lastSync,
    isSyncing,
    syncData,
  };
};

// Custom hook for data export
export const useDataExport = () => {
  const [isExporting, setIsExporting] = useState(false);

  const exportData = useCallback(async (dataType: string, filters?: any) => {
    setIsExporting(true);
    try {
      // Implement data export logic here
      // This could export to CSV, JSON, or other formats
      console.log(`Exporting ${dataType} data with filters:`, filters);
      
      // Placeholder for actual export logic
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('Data export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    isExporting,
    exportData,
  };
};

// Custom hook for data validation
export const useDataValidation = () => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const validateData = useCallback(async (dataType: string, data: any) => {
    setIsValidating(true);
    setValidationErrors([]);
    
    try {
      // Implement data validation logic here
      const errors: string[] = [];
      
      // Example validation for players
      if (dataType === 'players' && Array.isArray(data)) {
        data.forEach((player: any, index: number) => {
          if (!player.name) errors.push(`Player ${index}: Missing name`);
          if (!player.team) errors.push(`Player ${index}: Missing team`);
          if (!player.position) errors.push(`Player ${index}: Missing position`);
        });
      }
      
      setValidationErrors(errors);
      return errors.length === 0;
    } catch (error) {
      console.error('Data validation failed:', error);
      return false;
    } finally {
      setIsValidating(false);
    }
  }, []);

  return {
    isValidating,
    validationErrors,
    validateData,
  };
};



