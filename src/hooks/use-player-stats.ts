import { useState, useEffect, useCallback } from 'react';
import { playerStatsService, type PlayerAnalysis, type StatComparison, type PlayerStatsFilters } from '@/services/player-stats.service';
import { propBettingService, type PropBettingAnalysis, type PropBettingFilters } from '@/services/prop-betting.service';

export interface UsePlayerStatsOptions {
  playerId?: string;
  team?: string;
  autoFetch?: boolean;
  refreshInterval?: number;
}

export interface UsePlayerStatsReturn {
  // Data
  playerAnalysis: PlayerAnalysis | null;
  recentGames: any[];
  bettingLines: any[];
  teamLineup: any[];
  upcomingGames: any[];
  
  // Loading states
  isLoading: boolean;
  isAnalyzing: boolean;
  isRefreshing: boolean;
  
  // Error states
  error: string | null;
  
  // Actions
  fetchPlayerAnalysis: (playerId: string) => Promise<void>;
  fetchRecentGames: (playerId: string, games?: number) => Promise<void>;
  fetchBettingLines: (playerId: string) => Promise<void>;
  fetchTeamLineup: (teamId: string, gameDate?: string) => Promise<void>;
  fetchUpcomingGames: (team?: string, days?: number) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export const usePlayerStats = (options: UsePlayerStatsOptions = {}): UsePlayerStatsReturn => {
  const {
    playerId,
    team,
    autoFetch = true,
    refreshInterval
  } = options;

  // State
  const [playerAnalysis, setPlayerAnalysis] = useState<PlayerAnalysis | null>(null);
  const [recentGames, setRecentGames] = useState<any[]>([]);
  const [bettingLines, setBettingLines] = useState<any[]>([]);
  const [teamLineup, setTeamLineup] = useState<any[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch player analysis
  const fetchPlayerAnalysis = useCallback(async (playerId: string) => {
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const { data, error: analysisError } = await playerStatsService.getPlayerAnalysis(playerId);
      
      if (analysisError) {
        setError(analysisError);
        return;
      }
      
      setPlayerAnalysis(data);
    } catch (err) {
      setError('Failed to fetch player analysis');
      console.error('Error fetching player analysis:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // Fetch recent games
  const fetchRecentGames = useCallback(async (playerId: string, games: number = 10) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: gamesError } = await playerStatsService.getPlayerRecentGames(playerId, games);
      
      if (gamesError) {
        setError(gamesError);
        return;
      }
      
      setRecentGames(data);
    } catch (err) {
      setError('Failed to fetch recent games');
      console.error('Error fetching recent games:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch betting lines
  const fetchBettingLines = useCallback(async (playerId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: linesError } = await playerStatsService.getCurrentBettingLines(playerId);
      
      if (linesError) {
        setError(linesError);
        return;
      }
      
      setBettingLines(data);
    } catch (err) {
      setError('Failed to fetch betting lines');
      console.error('Error fetching betting lines:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch team lineup
  const fetchTeamLineup = useCallback(async (teamId: string, gameDate?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: lineupError } = await playerStatsService.getTeamLineup(teamId, gameDate);
      
      if (lineupError) {
        setError(lineupError);
        return;
      }
      
      setTeamLineup(data);
    } catch (err) {
      setError('Failed to fetch team lineup');
      console.error('Error fetching team lineup:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch upcoming games
  const fetchUpcomingGames = useCallback(async (team?: string, days: number = 7) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: gamesError } = await playerStatsService.getUpcomingGames(team, days);
      
      if (gamesError) {
        setError(gamesError);
        return;
      }
      
      setUpcomingGames(data);
    } catch (err) {
      setError('Failed to fetch upcoming games');
      console.error('Error fetching upcoming games:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh all data
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    
    try {
      const promises: Promise<any>[] = [];
      
      if (playerId) {
        promises.push(fetchPlayerAnalysis(playerId));
        promises.push(fetchRecentGames(playerId));
        promises.push(fetchBettingLines(playerId));
      }
      
      if (team) {
        promises.push(fetchTeamLineup(team));
        promises.push(fetchUpcomingGames(team));
      }
      
      await Promise.all(promises);
    } catch (err) {
      setError('Failed to refresh data');
      console.error('Error refreshing data:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [playerId, team, fetchPlayerAnalysis, fetchRecentGames, fetchBettingLines, fetchTeamLineup, fetchUpcomingGames]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (!autoFetch) return;

    const fetchData = async () => {
      if (playerId) {
        await Promise.all([
          fetchPlayerAnalysis(playerId),
          fetchRecentGames(playerId),
          fetchBettingLines(playerId)
        ]);
      }
      
      if (team) {
        await Promise.all([
          fetchTeamLineup(team),
          fetchUpcomingGames(team)
        ]);
      }
    };

    fetchData();
  }, [playerId, team, autoFetch, fetchPlayerAnalysis, fetchRecentGames, fetchBettingLines, fetchTeamLineup, fetchUpcomingGames]);

  // Set up refresh interval
  useEffect(() => {
    if (!refreshInterval || !autoFetch) return;

    const interval = setInterval(() => {
      refresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, autoFetch, refresh]);

  return {
    // Data
    playerAnalysis,
    recentGames,
    bettingLines,
    teamLineup,
    upcomingGames,
    
    // Loading states
    isLoading,
    isAnalyzing,
    isRefreshing,
    
    // Error states
    error,
    
    // Actions
    fetchPlayerAnalysis,
    fetchRecentGames,
    fetchBettingLines,
    fetchTeamLineup,
    fetchUpcomingGames,
    refresh,
    clearError
  };
};

// Hook for stat comparisons
export const useStatComparison = (playerId: string, statType: string) => {
  const [comparison, setComparison] = useState<StatComparison | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(async () => {
    if (!playerId || !statType) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: comparisonError } = await playerStatsService.getStatComparison(playerId, statType);
      
      if (comparisonError) {
        setError(comparisonError);
        return;
      }
      
      setComparison(data);
    } catch (err) {
      setError('Failed to fetch stat comparison');
      console.error('Error fetching stat comparison:', err);
    } finally {
      setIsLoading(false);
    }
  }, [playerId, statType]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  return {
    comparison,
    isLoading,
    error,
    refetch: fetchComparison
  };
};

// Hook for team data
export const useTeamData = (teamId: string) => {
  const [lineup, setLineup] = useState<any[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamData = useCallback(async () => {
    if (!teamId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [lineupResult, gamesResult] = await Promise.all([
        playerStatsService.getTeamLineup(teamId),
        playerStatsService.getUpcomingGames(teamId)
      ]);

      if (lineupResult.error) {
        setError(lineupResult.error);
        return;
      }

      if (gamesResult.error) {
        setError(gamesResult.error);
        return;
      }

      setLineup(lineupResult.data);
      setUpcomingGames(gamesResult.data);
    } catch (err) {
      setError('Failed to fetch team data');
      console.error('Error fetching team data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  return {
    lineup,
    upcomingGames,
    isLoading,
    error,
    refetch: fetchTeamData
  };
};

// Hook for prop betting analysis
export const usePropBetting = (playerId: string) => {
  const [propAnalysis, setPropAnalysis] = useState<PropBettingAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPropAnalysis = useCallback(async () => {
    if (!playerId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: analysisError } = await propBettingService.getPlayerPropAnalysis(parseInt(playerId));
      
      if (analysisError) {
        setError(analysisError);
        return;
      }
      
      setPropAnalysis(data);
    } catch (err) {
      setError('Failed to fetch prop betting analysis');
      console.error('Error fetching prop betting analysis:', err);
    } finally {
      setIsLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    fetchPropAnalysis();
  }, [fetchPropAnalysis]);

  return {
    propAnalysis,
    isLoading,
    error,
    refetch: fetchPropAnalysis
  };
};

// Hook for top prop opportunities
export const useTopPropOpportunities = (filters: PropBettingFilters = {}) => {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOpportunities = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: opportunitiesError } = await propBettingService.getTopPropOpportunities(filters);
      
      if (opportunitiesError) {
        setError(opportunitiesError);
        return;
      }
      
      setOpportunities(data);
    } catch (err) {
      setError('Failed to fetch prop opportunities');
      console.error('Error fetching prop opportunities:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  return {
    opportunities,
    isLoading,
    error,
    refetch: fetchOpportunities
  };
};

// Hook for prop trends
export const usePropTrends = (statType?: string, days: number = 30) => {
  const [trends, setTrends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: trendsError } = await propBettingService.getPropTrends(statType, days);
      
      if (trendsError) {
        setError(trendsError);
        return;
      }
      
      setTrends(data);
    } catch (err) {
      setError('Failed to fetch prop trends');
      console.error('Error fetching prop trends:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statType, days]);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  return {
    trends,
    isLoading,
    error,
    refetch: fetchTrends
  };
};
