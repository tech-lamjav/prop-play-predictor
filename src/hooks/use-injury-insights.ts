import { useQuery } from '@tanstack/react-query';
import { injuryInsightsService } from '@/services/injury-insights.service';
import type { InjuryInsight, InjuryInsightFilters } from '@/services/injury-insights.service';

// Query Keys
export const injuryInsightsQueryKeys = {
  all: ['injury-insights'] as const,
  list: (filters?: InjuryInsightFilters) => [...injuryInsightsQueryKeys.all, 'list', filters] as const,
  byTeam: (team: string) => [...injuryInsightsQueryKeys.all, 'team', team] as const,
  byCategory: (category: string) => [...injuryInsightsQueryKeys.all, 'category', category] as const,
  highImpact: () => [...injuryInsightsQueryKeys.all, 'high-impact'] as const,
  recent: () => [...injuryInsightsQueryKeys.all, 'recent'] as const,
  summary: () => [...injuryInsightsQueryKeys.all, 'summary'] as const,
} as const;

// Hook for fetching all injury insights
export const useInjuryInsights = (filters?: InjuryInsightFilters) => {
  return useQuery({
    queryKey: injuryInsightsQueryKeys.list(filters),
    queryFn: () => injuryInsightsService.getInjuryInsights(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};

// Hook for fetching injury insights by team
export const useInjuryInsightsByTeam = (teamName: string) => {
  return useQuery({
    queryKey: injuryInsightsQueryKeys.byTeam(teamName),
    queryFn: () => injuryInsightsService.getInjuryInsightsByTeam(teamName),
    enabled: !!teamName,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

// Hook for fetching injury insights by category
export const useInjuryInsightsByCategory = (category: string) => {
  return useQuery({
    queryKey: injuryInsightsQueryKeys.byCategory(category),
    queryFn: () => injuryInsightsService.getInjuryInsightsByCategory(category),
    enabled: !!category,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

// Hook for fetching high-impact injuries
export const useHighImpactInjuries = () => {
  return useQuery({
    queryKey: injuryInsightsQueryKeys.highImpact(),
    queryFn: () => injuryInsightsService.getHighImpactInjuries(),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

// Hook for fetching recent injury insights
export const useRecentInjuryInsights = () => {
  return useQuery({
    queryKey: injuryInsightsQueryKeys.recent(),
    queryFn: () => injuryInsightsService.getRecentInjuryInsights(),
    staleTime: 1 * 60 * 1000, // 1 minute for recent data
    gcTime: 3 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });
};

// Hook for fetching injury insights summary
export const useInjuryInsightsSummary = () => {
  return useQuery({
    queryKey: injuryInsightsQueryKeys.summary(),
    queryFn: () => injuryInsightsService.getInjuryInsightsSummary(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });
};

// Hook for searching injury insights
export const useInjuryInsightsSearch = (searchTerm: string) => {
  return useQuery({
    queryKey: [...injuryInsightsQueryKeys.all, 'search', searchTerm],
    queryFn: async () => {
      const allInsights = await injuryInsightsService.getInjuryInsights();
      if (!allInsights.success || !allInsights.data) {
        return { success: false, data: [] };
      }

      const filtered = allInsights.data.filter(insight => 
        insight.teamName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        insight.injuredPlayer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        insight.nextPlayer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        insight.category.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return { success: true, data: filtered };
    },
    enabled: searchTerm.length > 0,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

// Hook for getting injury insights by impact level
export const useInjuryInsightsByImpact = (impact: 'high' | 'medium' | 'low') => {
  return useQuery({
    queryKey: [...injuryInsightsQueryKeys.all, 'impact', impact],
    queryFn: async () => {
      const allInsights = await injuryInsightsService.getInjuryInsights();
      if (!allInsights.success || !allInsights.data) {
        return { success: false, data: [] };
      }

      const filtered = allInsights.data.filter(insight => insight.impact === impact);
      return { success: true, data: filtered };
    },
    enabled: !!impact,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

// Hook for getting injury insights statistics
export const useInjuryInsightsStats = () => {
  const summary = useInjuryInsightsSummary();
  
  if (!summary.data?.data) {
    return {
      isLoading: summary.isLoading,
      error: summary.error,
      stats: null,
    };
  }

  const { byTeam, byCategory, byImpact, total } = summary.data.data;

  // Calculate additional statistics
  const stats = {
    total,
    byTeam,
    byCategory,
    byImpact,
    topTeams: Object.entries(byTeam)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5),
    topCategories: Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5),
    impactDistribution: {
      high: byImpact.high || 0,
      medium: byImpact.medium || 0,
      low: byImpact.low || 0,
    },
    highImpactPercentage: total > 0 ? ((byImpact.high || 0) / total) * 100 : 0,
  };

  return {
    isLoading: summary.isLoading,
    error: summary.error,
    stats,
  };
};





















