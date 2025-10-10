import { bigQueryService, type DimPropPlayer, type DimPlayerStatLinePerf, type FtPlayerStatOverLine } from './bigquery.service';

export interface PropBettingAnalysis {
  playerId: number;
  playerName: string;
  team: string;
  position: string;
  currentStatus: string;
  propData: {
    statType: string;
    statValue: number;
    line: number | null;
    delta: number | null;
    statRank: number;
    teamAvgStat: number;
    teamStddevStat: number;
    zscore: number;
    ratingStars: number;
    isLeaderWithInjury: boolean;
    isAvailableBackup: boolean;
  }[];
  performanceData: {
    statType: string;
    overLines: number;
    totals: number;
    percOverLine: number;
    gameNumbers: string;
  }[];
  recentGames: {
    gameDate: string;
    statType: string;
    statValue: number;
    line: number | null;
    statVsLine: string | null;
    playedAgainst: string;
    isB2bGame: boolean;
    homeAway: string;
  }[];
  recommendations: {
    statType: string;
    recommendation: 'over' | 'under' | 'neutral';
    confidence: number;
    reasoning: string[];
  }[];
}

export interface PropBettingFilters {
  playerId?: number;
  teamId?: number;
  statType?: string;
  minRating?: number;
  hasLine?: boolean;
  isLeaderWithInjury?: boolean;
  isAvailableBackup?: boolean;
}

export class PropBettingService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private getCacheKey(prefix: string, params: any): string {
    return `${prefix}_${JSON.stringify(params)}`;
  }

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Get comprehensive prop betting analysis for a player
  async getPlayerPropAnalysis(playerId: number): Promise<{ data: PropBettingAnalysis | null; error: string | null }> {
    try {
      const cacheKey = this.getCacheKey('player_prop_analysis', { playerId });
      const cached = this.getCachedData(cacheKey);
      if (cached) return { data: cached, error: null };

      // Fetch all required data in parallel
      const [playerData, propData, performanceData, recentGames] = await Promise.all([
        this.getPlayerBasicInfo(playerId),
        bigQueryService.getPlayerPropData(playerId.toString()),
        bigQueryService.getPlayerLinePerformance(playerId.toString()),
        this.getPlayerRecentPropGames(playerId)
      ]);

      if (playerData.error || propData.error || performanceData.error || recentGames.error) {
        return { 
          data: null, 
          error: playerData.error || propData.error || performanceData.error || recentGames.error 
        };
      }

      const player = playerData.data[0];
      if (!player) {
        return { data: null, error: 'Player not found' };
      }

      // Generate recommendations for each stat type
      const recommendations = this.generatePropRecommendations(
        propData.data || [],
        performanceData.data || [],
        recentGames.data || []
      );

      const analysis: PropBettingAnalysis = {
        playerId,
        playerName: player.name,
        team: player.team_name,
        position: player.position,
        currentStatus: player.current_status,
        propData: (propData.data || []).map(prop => ({
          statType: prop.stat_type,
          statValue: prop.stat_value,
          line: prop.line,
          delta: prop.delta,
          statRank: prop.stat_rank,
          teamAvgStat: prop.team_avg_stat,
          teamStddevStat: prop.team_stddev_stat,
          zscore: prop.zscore,
          ratingStars: prop.rating_stars,
          isLeaderWithInjury: prop.is_leader_with_injury,
          isAvailableBackup: prop.is_available_backup
        })),
        performanceData: (performanceData.data || []).map(perf => ({
          statType: perf.stat_type,
          overLines: perf.over_lines,
          totals: perf.totals,
          percOverLine: perf.perc_over_line,
          gameNumbers: perf.game_numbers
        })),
        recentGames: (recentGames.data || []).map(game => ({
          gameDate: game.game_date,
          statType: game.stat_type,
          statValue: game.stat_value,
          line: game.line,
          statVsLine: game.stat_vs_line,
          playedAgainst: game.played_against,
          isB2bGame: game.is_b2b_game,
          homeAway: game.home_away
        })),
        recommendations
      };

      this.setCachedData(cacheKey, analysis);
      return { data: analysis, error: null };

    } catch (error) {
      console.error('Error getting player prop analysis:', error);
      return { data: null, error: 'Failed to get player prop analysis' };
    }
  }

  // Get players with best prop betting opportunities
  async getTopPropOpportunities(filters: PropBettingFilters = {}): Promise<{ data: any[]; error: string | null }> {
    try {
      const cacheKey = this.getCacheKey('top_prop_opportunities', filters);
      const cached = this.getCachedData(cacheKey);
      if (cached) return { data: cached, error: null };

      let query = `
        SELECT 
          p.player_id,
          d.name as player_name,
          d.team_name,
          d.position,
          d.current_status,
          p.stat_type,
          p.stat_value,
          p.line,
          p.delta,
          p.stat_rank,
          p.zscore,
          p.rating_stars,
          p.is_leader_with_injury,
          p.is_available_backup,
          perf.perc_over_line,
          perf.over_lines,
          perf.totals
        FROM bigquery.dim_prop_player p
        JOIN bigquery.dim_players d ON p.player_id = d.id
        LEFT JOIN bigquery.dim_player_stat_line_perf perf ON p.player_id = perf.player_id AND p.stat_type = perf.stat_type
        WHERE 1=1
      `;

      const conditions: string[] = [];
      
      if (filters.playerId) conditions.push(`p.player_id = ${filters.playerId}`);
      if (filters.teamId) conditions.push(`p.team_id = ${filters.teamId}`);
      if (filters.statType) conditions.push(`p.stat_type = '${filters.statType}'`);
      if (filters.minRating) conditions.push(`p.rating_stars >= ${filters.minRating}`);
      if (filters.hasLine) conditions.push(`p.line IS NOT NULL`);
      if (filters.isLeaderWithInjury) conditions.push(`p.is_leader_with_injury = true`);
      if (filters.isAvailableBackup) conditions.push(`p.is_available_backup = true`);

      if (conditions.length > 0) {
        query += ` AND ${conditions.join(' AND ')}`;
      }

      query += ` ORDER BY p.rating_stars DESC, p.zscore DESC, p.stat_rank ASC`;

      const result = await bigQueryService.executeBigQueryQuery<any>(query);
      if (result.success && result.data) {
        this.setCachedData(cacheKey, result.data);
        return { data: result.data, error: null };
      }
      return { data: [], error: result.error || 'Failed to get prop opportunities' };

    } catch (error) {
      console.error('Error getting top prop opportunities:', error);
      return { data: [], error: 'Failed to get top prop opportunities' };
    }
  }

  // Get prop betting trends by stat type
  async getPropTrends(statType?: string, days: number = 30): Promise<{ data: any[]; error: string | null }> {
    try {
      const cacheKey = this.getCacheKey('prop_trends', { statType, days });
      const cached = this.getCachedData(cacheKey);
      if (cached) return { data: cached, error: null };

      const dateFilter = `AND game_date >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)`;
      const statFilter = statType ? `AND stat_type = '${statType}'` : '';

      const query = `
        SELECT 
          stat_type,
          COUNT(*) as total_games,
          AVG(stat_value) as avg_stat_value,
          AVG(CASE WHEN line IS NOT NULL THEN line END) as avg_line,
          SUM(CASE WHEN stat_vs_line = 'Over' THEN 1 ELSE 0 END) as over_hits,
          SUM(CASE WHEN stat_vs_line = 'Under' THEN 1 ELSE 0 END) as under_hits,
          SUM(CASE WHEN stat_vs_line IS NOT NULL THEN 1 ELSE 0 END) as games_with_line,
          AVG(CASE WHEN stat_vs_line IS NOT NULL THEN 
            CASE WHEN stat_vs_line = 'Over' THEN 1 ELSE 0 END 
          END) as over_percentage
        FROM bigquery.ft_player_stat_over_line
        WHERE 1=1 ${dateFilter} ${statFilter}
        GROUP BY stat_type
        ORDER BY total_games DESC
      `;

      const result = await bigQueryService.executeBigQueryQuery<any>(query);
      if (result.success && result.data) {
        this.setCachedData(cacheKey, result.data);
        return { data: result.data, error: null };
      }
      return { data: [], error: result.error || 'Failed to get prop trends' };

    } catch (error) {
      console.error('Error getting prop trends:', error);
      return { data: [], error: 'Failed to get prop trends' };
    }
  }

  // Private helper methods
  private async getPlayerBasicInfo(playerId: number): Promise<{ data: any[]; error: string | null }> {
    const query = `
      SELECT id, name, team_name, position, current_status
      FROM bigquery.dim_players
      WHERE id = ${playerId}
    `;
    return bigQueryService.executeBigQueryQuery<any>(query);
  }

  private async getPlayerRecentPropGames(playerId: number, limit: number = 10): Promise<{ data: any[]; error: string | null }> {
    const query = `
      SELECT *
      FROM bigquery.ft_player_stat_over_line
      WHERE player_id = ${playerId}
      ORDER BY game_date DESC
      LIMIT ${limit}
    `;
    return bigQueryService.executeBigQueryQuery<any>(query);
  }

  private generatePropRecommendations(
    propData: DimPropPlayer[],
    performanceData: DimPlayerStatLinePerf[],
    recentGames: any[]
  ): { statType: string; recommendation: 'over' | 'under' | 'neutral'; confidence: number; reasoning: string[] }[] {
    const recommendations: { statType: string; recommendation: 'over' | 'under' | 'neutral'; confidence: number; reasoning: string[] }[] = [];

    // Group data by stat type
    const statTypes = new Set([
      ...propData.map(p => p.stat_type),
      ...performanceData.map(p => p.stat_type),
      ...recentGames.map(g => g.stat_type)
    ]);

    for (const statType of statTypes) {
      const prop = propData.find(p => p.stat_type === statType);
      const perf = performanceData.find(p => p.stat_type === statType);
      const recent = recentGames.filter(g => g.stat_type === statType);

      if (!prop) continue;

      const reasoning: string[] = [];
      let confidence = 0.5;
      let recommendation: 'over' | 'under' | 'neutral' = 'neutral';

      // Analyze z-score
      if (prop.zscore > 1) {
        reasoning.push(`Strong positive z-score (${prop.zscore.toFixed(2)}) indicates above-average performance`);
        confidence += 0.2;
        recommendation = 'over';
      } else if (prop.zscore < -1) {
        reasoning.push(`Negative z-score (${prop.zscore.toFixed(2)}) indicates below-average performance`);
        confidence += 0.2;
        recommendation = 'under';
      }

      // Analyze rating stars
      if (prop.rating_stars >= 4) {
        reasoning.push(`High rating (${prop.rating_stars} stars) suggests strong opportunity`);
        confidence += 0.15;
        if (recommendation === 'neutral') recommendation = 'over';
      } else if (prop.rating_stars <= 1) {
        reasoning.push(`Low rating (${prop.rating_stars} stars) suggests weak opportunity`);
        confidence += 0.15;
        if (recommendation === 'neutral') recommendation = 'under';
      }

      // Analyze historical performance
      if (perf) {
        if (perf.perc_over_line > 0.6) {
          reasoning.push(`Strong historical performance: ${(perf.perc_over_line * 100).toFixed(1)}% over rate`);
          confidence += 0.1;
          if (recommendation === 'neutral') recommendation = 'over';
        } else if (perf.perc_over_line < 0.4) {
          reasoning.push(`Weak historical performance: ${(perf.perc_over_line * 100).toFixed(1)}% over rate`);
          confidence += 0.1;
          if (recommendation === 'neutral') recommendation = 'under';
        }
      }

      // Analyze recent form
      if (recent.length > 0) {
        const recentAvg = recent.reduce((sum, game) => sum + game.stat_value, 0) / recent.length;
        const line = prop.line;
        if (line && recentAvg > line * 1.1) {
          reasoning.push(`Recent form strong: ${recentAvg.toFixed(1)} avg vs ${line} line`);
          confidence += 0.1;
          if (recommendation === 'neutral') recommendation = 'over';
        } else if (line && recentAvg < line * 0.9) {
          reasoning.push(`Recent form weak: ${recentAvg.toFixed(1)} avg vs ${line} line`);
          confidence += 0.1;
          if (recommendation === 'neutral') recommendation = 'under';
        }
      }

      // Analyze injury status
      if (prop.is_leader_with_injury) {
        reasoning.push('Player is leader with injury - backup opportunity');
        confidence += 0.1;
      }

      if (prop.is_available_backup) {
        reasoning.push('Player is available backup - potential increased role');
        confidence += 0.05;
      }

      recommendations.push({
        statType,
        recommendation,
        confidence: Math.min(confidence, 0.95),
        reasoning
      });
    }

    return recommendations;
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const propBettingService = new PropBettingService();
