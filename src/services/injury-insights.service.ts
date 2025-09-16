import { supabase } from '@/integrations/supabase/client';
import type { InjuryInsight, ApiResponse } from '@/types/sports';

export interface InjuryInsightFilters {
  team?: string;
  category?: string;
  impact?: 'high' | 'medium' | 'low';
  limit?: number;
}

export class InjuryInsightsService {
  private cache: Map<string, { data: InjuryInsight[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutes (injury data changes frequently)

  private async getCachedData(key: string): Promise<InjuryInsight[] | null> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: InjuryInsight[]): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Fetch injury insights from Supabase Edge Function
  async getInjuryInsights(filters?: InjuryInsightFilters): Promise<ApiResponse<InjuryInsight[]>> {
    try {
      const cacheKey = `injury_insights_${JSON.stringify(filters)}`;
      const cached = await this.getCachedData(cacheKey);
      if (cached) return { success: true, data: cached };

      // Call the Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('injury-insights', {
        body: filters,
      });

      if (error) {
        console.error('Error calling injury-insights function:', error);
        return { success: false, error: error.message };
      }

      if (data && data.success) {
        const insights = data.data as InjuryInsight[];
        this.setCachedData(cacheKey, insights);
        return { success: true, data: insights };
      } else {
        return { success: false, error: 'Failed to fetch injury insights' };
      }
    } catch (error) {
      console.error('Error fetching injury insights:', error);
      return { success: false, error: 'Failed to fetch injury insights' };
    }
  }

  // Get injury insights by team
  async getInjuryInsightsByTeam(teamName: string): Promise<ApiResponse<InjuryInsight[]>> {
    return this.getInjuryInsights({ team: teamName });
  }

  // Get injury insights by category
  async getInjuryInsightsByCategory(category: string): Promise<ApiResponse<InjuryInsight[]>> {
    return this.getInjuryInsights({ category: category as any });
  }

  // Get high-impact injury insights
  async getHighImpactInjuries(): Promise<ApiResponse<InjuryInsight[]>> {
    return this.getInjuryInsights({ impact: 'high' });
  }

  // Get recent injury insights (last 24 hours)
  async getRecentInjuryInsights(): Promise<ApiResponse<InjuryInsight[]>> {
    try {
      const cacheKey = 'recent_injury_insights';
      const cached = await this.getCachedData(cacheKey);
      if (cached) return { success: true, data: cached };

      const { data, error } = await supabase.functions.invoke('injury-insights', {
        body: { 
          limit: 50,
          recent: true 
        },
      });

      if (error) {
        console.error('Error calling injury-insights function:', error);
        return { success: false, error: error.message };
      }

      if (data && data.success) {
        const insights = data.data as InjuryInsight[];
        this.setCachedData(cacheKey, insights);
        return { success: true, data: insights };
      } else {
        return { success: false, error: 'Failed to fetch recent injury insights' };
      }
    } catch (error) {
      console.error('Error fetching recent injury insights:', error);
      return { success: false, error: 'Failed to fetch recent injury insights' };
    }
  }

  // Get injury insights summary for dashboard
  async getInjuryInsightsSummary(): Promise<ApiResponse<{
    total: number;
    byTeam: Record<string, number>;
    byCategory: Record<string, number>;
    byImpact: Record<string, number>;
    recent: InjuryInsight[];
  }>> {
    try {
      const cacheKey = 'injury_insights_summary';
      const cached = await this.getCachedData(cacheKey);
      if (cached) {
        const summary = this.createSummary(cached);
        return { success: true, data: summary };
      }

      const { data, error } = await supabase.functions.invoke('injury-insights', {
        body: { limit: 100 },
      });

      if (error) {
        console.error('Error calling injury-insights function:', error);
        return { success: false, error: error.message };
      }

      if (data && data.success) {
        const insights = data.data as InjuryInsight[];
        this.setCachedData(cacheKey, insights);
        const summary = this.createSummary(insights);
        return { success: true, data: summary };
      } else {
        return { success: false, error: 'Failed to fetch injury insights summary' };
      }
    } catch (error) {
      console.error('Error fetching injury insights summary:', error);
      return { success: false, error: 'Failed to fetch injury insights summary' };
    }
  }

  // Create summary from injury insights data
  private createSummary(insights: InjuryInsight[]) {
    const byTeam: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byImpact: Record<string, number> = {};

    insights.forEach(insight => {
      // Count by team
      byTeam[insight.teamName] = (byTeam[insight.teamName] || 0) + 1;
      
      // Count by category
      byCategory[insight.category] = (byCategory[insight.category] || 0) + 1;
      
      // Count by impact
      byImpact[insight.impact] = (byImpact[insight.impact] || 0) + 1;
    });

    // Get recent insights (last 10)
    const recent = insights
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    return {
      total: insights.length,
      byTeam,
      byCategory,
      byImpact,
      recent,
    };
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Clear cache by pattern
  clearCacheByPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const injuryInsightsService = new InjuryInsightsService();










