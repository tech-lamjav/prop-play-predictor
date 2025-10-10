import { bigQueryService, type PlayerStats, type BettingLine } from './bigquery.service';
import { propBettingService, type PropBettingAnalysis } from './prop-betting.service';

export interface PlayerStatsFilters {
  playerId?: string;
  team?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface PlayerAnalysis {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  currentSeason: {
    points: number;
    assists: number;
    rebounds: number;
    efficiency: number;
  };
  recentTrends: {
    last5: Record<string, number>;
    last10: Record<string, number>;
    last15: Record<string, number>;
    last30: Record<string, number>;
  };
  vsOpponent: {
    team: string;
    averagePoints: number;
    gamesPlayed: number;
    lastMeeting: PlayerStats | null;
  };
  bettingLines: BettingLine[];
  recommendations: {
    overUnder: 'over' | 'under' | 'neutral';
    confidence: number;
    reasoning: string[];
  };
}

export interface StatComparison {
  stat: string;
  current: number;
  average: number;
  trend: 'up' | 'down' | 'stable';
  percentageChange: number;
}

export class PlayerStatsService {
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

  // Get comprehensive player analysis
  async getPlayerAnalysis(playerId: string): Promise<{ data: PlayerAnalysis | null; error: string | null }> {
    try {
      const cacheKey = this.getCacheKey('player_analysis', { playerId });
      const cached = this.getCachedData(cacheKey);
      if (cached) return { data: cached, error: null };

      // Fetch all required data in parallel
      const [
        seasonStats,
        recentGames,
        bettingLines,
        trendAnalysis
      ] = await Promise.all([
        this.getPlayerSeasonAverages(playerId),
        this.getPlayerRecentGames(playerId, 15),
        this.getCurrentBettingLines(playerId),
        this.getPlayerTrendAnalysis(playerId, 'points', [5, 10, 15, 30])
      ]);

      if (seasonStats.error || recentGames.error || bettingLines.error || trendAnalysis.error) {
        return { 
          data: null, 
          error: seasonStats.error || recentGames.error || bettingLines.error || trendAnalysis.error 
        };
      }

      const seasonData = seasonStats.data[0];
      const recentData = recentGames.data;
      const bettingData = bettingLines.data;
      const trendData = trendAnalysis.data;

      if (!seasonData || recentData.length === 0) {
        return { data: null, error: 'No data found for player' };
      }

      // Calculate recent trends
      const last5 = this.calculateAverages(recentData.slice(0, 5));
      const last10 = this.calculateAverages(recentData.slice(0, 10));
      const last15 = this.calculateAverages(recentData.slice(0, 15));
      const last30 = this.calculateAverages(recentData.slice(0, 30));

      // Get opponent analysis (using most recent game)
      const lastGame = recentData[0];
      const opponentTeam = await this.getOpponentTeam(playerId, lastGame.gameDate);
      const vsOpponentData = await this.getPlayerVsOpponentStats(playerId, opponentTeam, 5);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        seasonData,
        last5,
        bettingData,
        vsOpponentData.data
      );

      const analysis: PlayerAnalysis = {
        playerId,
        playerName: seasonData.playerName,
        team: seasonData.team,
        position: seasonData.position,
        currentSeason: {
          points: seasonData.points,
          assists: seasonData.assists,
          rebounds: seasonData.rebounds,
          efficiency: seasonData.efficiency
        },
        recentTrends: {
          last5,
          last10,
          last15,
          last30
        },
        vsOpponent: {
          team: opponentTeam,
          averagePoints: vsOpponentData.data.length > 0 
            ? vsOpponentData.data.reduce((sum, game) => sum + game.points, 0) / vsOpponentData.data.length
            : 0,
          gamesPlayed: vsOpponentData.data.length,
          lastMeeting: vsOpponentData.data[0] || null
        },
        bettingLines: bettingData,
        recommendations
      };

      this.setCachedData(cacheKey, analysis);
      return { data: analysis, error: null };

    } catch (error) {
      console.error('Error getting player analysis:', error);
      return { data: null, error: 'Failed to get player analysis' };
    }
  }

  // Get player season averages
  async getPlayerSeasonAverages(playerId: string, season?: string): Promise<{ data: PlayerStats[]; error: string | null }> {
    return bigQueryService.getPlayerSeasonAverages(playerId, season);
  }

  // Get player recent games
  async getPlayerRecentGames(playerId: string, games: number = 10): Promise<{ data: PlayerStats[]; error: string | null }> {
    return bigQueryService.getPlayerRecentGames(playerId, games);
  }

  // Get current betting lines for player
  async getCurrentBettingLines(playerId: string): Promise<{ data: BettingLine[]; error: string | null }> {
    return bigQueryService.getCurrentBettingLines(playerId);
  }

  // Get player trend analysis
  async getPlayerTrendAnalysis(
    playerId: string, 
    statType: string, 
    periods: number[] = [5, 10, 15, 30]
  ): Promise<{ data: Record<string, number>; error: string | null }> {
    return bigQueryService.getPlayerTrendAnalysis(playerId, statType, periods);
  }

  // Get player vs opponent stats
  async getPlayerVsOpponentStats(
    playerId: string, 
    opponentTeam: string, 
    games: number = 10
  ): Promise<{ data: PlayerStats[]; error: string | null }> {
    return bigQueryService.getPlayerVsOpponentStats(playerId, opponentTeam, games);
  }

  // Get stat comparison for dashboard
  async getStatComparison(
    playerId: string, 
    statType: string
  ): Promise<{ data: StatComparison | null; error: string | null }> {
    try {
      const [seasonData, trendData] = await Promise.all([
        this.getPlayerSeasonAverages(playerId),
        this.getPlayerTrendAnalysis(playerId, statType, [5, 10, 15, 30])
      ]);

      if (seasonData.error || trendData.error) {
        return { data: null, error: seasonData.error || trendData.error };
      }

      const current = seasonData.data[0]?.[statType as keyof PlayerStats] as number || 0;
      const last5 = trendData.data.l5 || 0;
      const last10 = trendData.data.l10 || 0;
      const average = (last5 + last10) / 2;

      const percentageChange = average > 0 ? ((current - average) / average) * 100 : 0;
      const trend = percentageChange > 5 ? 'up' : percentageChange < -5 ? 'down' : 'stable';

      return {
        data: {
          stat: statType,
          current,
          average,
          trend,
          percentageChange
        },
        error: null
      };
    } catch (error) {
      console.error('Error getting stat comparison:', error);
      return { data: null, error: 'Failed to get stat comparison' };
    }
  }

  // Get team lineup for specific game
  async getTeamLineup(teamId: string, gameDate?: string): Promise<{ data: any[]; error: string | null }> {
    return bigQueryService.getTeamLineup(teamId, gameDate);
  }

  // Get upcoming games
  async getUpcomingGames(team?: string, days: number = 7): Promise<{ data: any[]; error: string | null }> {
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    return bigQueryService.getGameSchedule(startDate, endDate, team);
  }

  // Private helper methods
  private calculateAverages(games: PlayerStats[]): Record<string, number> {
    if (games.length === 0) return {};

    const totals = games.reduce((acc, game) => ({
      points: acc.points + game.points,
      assists: acc.assists + game.assists,
      rebounds: acc.rebounds + game.rebounds,
      steals: acc.steals + game.steals,
      blocks: acc.blocks + game.blocks,
      turnovers: acc.turnovers + game.turnovers,
      fouls: acc.fouls + game.fouls,
      efficiency: acc.efficiency + game.efficiency
    }), {
      points: 0, assists: 0, rebounds: 0, steals: 0,
      blocks: 0, turnovers: 0, fouls: 0, efficiency: 0
    });

    const count = games.length;
    return {
      points: totals.points / count,
      assists: totals.assists / count,
      rebounds: totals.rebounds / count,
      steals: totals.steals / count,
      blocks: totals.blocks / count,
      turnovers: totals.turnovers / count,
      fouls: totals.fouls / count,
      efficiency: totals.efficiency / count
    };
  }

  private async getOpponentTeam(playerId: string, gameDate: string): Promise<string> {
    // This would need to be implemented based on your game schedule data
    // For now, returning a placeholder
    return 'Unknown';
  }

  private generateRecommendations(
    seasonData: PlayerStats,
    last5: Record<string, number>,
    bettingLines: BettingLine[],
    vsOpponentData: PlayerStats[]
  ): { overUnder: 'over' | 'under' | 'neutral'; confidence: number; reasoning: string[] } {
    const reasoning: string[] = [];
    let confidence = 0.5;
    let overUnder: 'over' | 'under' | 'neutral' = 'neutral';

    // Analyze recent form
    const recentPoints = last5.points || 0;
    const seasonPoints = seasonData.points || 0;
    
    if (recentPoints > seasonPoints * 1.1) {
      reasoning.push(`Recent form strong: ${recentPoints.toFixed(1)} PPG in last 5 games vs ${seasonPoints.toFixed(1)} season average`);
      confidence += 0.2;
      overUnder = 'over';
    } else if (recentPoints < seasonPoints * 0.9) {
      reasoning.push(`Recent form weak: ${recentPoints.toFixed(1)} PPG in last 5 games vs ${seasonPoints.toFixed(1)} season average`);
      confidence += 0.2;
      overUnder = 'under';
    }

    // Analyze vs opponent
    if (vsOpponentData.length > 0) {
      const vsOpponentAvg = vsOpponentData.reduce((sum, game) => sum + game.points, 0) / vsOpponentData.length;
      if (vsOpponentAvg > seasonPoints) {
        reasoning.push(`Performs well vs this opponent: ${vsOpponentAvg.toFixed(1)} PPG average`);
        confidence += 0.15;
        if (overUnder === 'neutral') overUnder = 'over';
      } else if (vsOpponentAvg < seasonPoints * 0.9) {
        reasoning.push(`Struggles vs this opponent: ${vsOpponentAvg.toFixed(1)} PPG average`);
        confidence += 0.15;
        if (overUnder === 'neutral') overUnder = 'under';
      }
    }

    // Analyze betting lines
    const pointsLine = bettingLines.find(line => line.statType === 'points');
    if (pointsLine) {
      const lineValue = pointsLine.line;
      if (recentPoints > lineValue * 1.05) {
        reasoning.push(`Recent average (${recentPoints.toFixed(1)}) well above line (${lineValue})`);
        confidence += 0.1;
        if (overUnder === 'neutral') overUnder = 'over';
      } else if (recentPoints < lineValue * 0.95) {
        reasoning.push(`Recent average (${recentPoints.toFixed(1)}) below line (${lineValue})`);
        confidence += 0.1;
        if (overUnder === 'neutral') overUnder = 'under';
      }
    }

    return {
      overUnder,
      confidence: Math.min(confidence, 0.95),
      reasoning
    };
  }

  // Get prop betting analysis for a player
  async getPlayerPropAnalysis(playerId: string): Promise<{ data: PropBettingAnalysis | null; error: string | null }> {
    return propBettingService.getPlayerPropAnalysis(parseInt(playerId));
  }

  // Get top prop betting opportunities
  async getTopPropOpportunities(filters: any = {}): Promise<{ data: any[]; error: string | null }> {
    return propBettingService.getTopPropOpportunities(filters);
  }

  // Get prop betting trends
  async getPropTrends(statType?: string, days: number = 30): Promise<{ data: any[]; error: string | null }> {
    return propBettingService.getPropTrends(statType, days);
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
    propBettingService.clearCache();
  }
}

// Export singleton instance
export const playerStatsService = new PlayerStatsService();
