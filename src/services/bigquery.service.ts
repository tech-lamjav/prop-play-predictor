import { supabase } from '@/integrations/supabase/client';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Updated interfaces to match your actual BigQuery schemas
export interface PlayerStats {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  gameDate: string;
  points: number;
  assists: number;
  rebounds: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  minutesPlayed: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  plusMinus: number;
  efficiency: number;
}

export interface DimPlayer {
  id: number;
  name: string;
  position: string;
  team_id: number;
  team_name: string;
  team_abbreviation: string;
  age: number;
  games_played: number;
  minutes: number;
  last_game_text: string;
  last_games: string;
  current_status: string;
  conference_rank: number;
  team_rating_rank: number;
  team_offensive_rating_rank: number;
  team_defensive_rating_rank: number;
  next_opponent_id: number;
  next_opponent_name: string;
  next_opponent_abbreviation: string;
  next_opponent_last_games: string;
  next_opponent_conference_rank: number;
  next_opponent_team_rating_rank: number;
  next_opponent_team_offensive_rating_rank: number;
  next_opponent_team_defensive_rating_rank: number;
  loaded_at: string;
}

export interface DimPropPlayer {
  player_id: number;
  team_id: number;
  stat_type: string;
  stat_value: number;
  line: number | null;
  delta: number | null;
  stat_rank: number;
  team_avg_stat: number;
  team_stddev_stat: number;
  zscore: number;
  rating_stars: number;
  current_status: string | null;
  is_leader_with_injury: boolean;
  is_available_backup: boolean;
  next_available_id: number | null;
  next_player_stats_when_leader_out: number | null;
  next_player_stats_normal: number | null;
  loaded_at: string;
}

export interface DimPlayerStatLinePerf {
  player_id: number;
  stat_type: string;
  over_lines: number;
  totals: number;
  perc_over_line: number;
  game_numbers: string;
}

export interface FtPlayerStatOverLine {
  player_id: number;
  game_date: string;
  game_id: number;
  stat_type: string;
  stat_value: number;
  line: number | null;
  stat_vs_line: string | null;
  played_against: string;
  is_b2b_game: boolean;
  home_away: string;
}

export interface BettingLine {
  playerId: string;
  playerName: string;
  statType: string;
  line: number;
  overOdds: number;
  underOdds: number;
  gameDate: string;
  bookmaker: string;
  lastUpdated: string;
}

export class BigQueryService {
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

  // Get all players from dim_players table
  async getAllPlayers(): Promise<ApiResponse<Player[]>> {
    try {
      // Use raw SQL query through Supabase
      const { data, error } = await supabase.rpc('get_players');

      if (error) {
        console.error('Error fetching players:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data as Player[] };
    } catch (error) {
      console.error('Error fetching players:', error);
      return { success: false, error: 'Failed to fetch players' };
    }
  }

  // Get player season averages from dim_players
  async getPlayerSeasonAverages(playerId: string, season?: string): Promise<ApiResponse<PlayerStats[]>> {
    const cacheKey = this.getCacheKey('player_season_avg', { playerId, season });
    const cached = this.getCachedData(cacheKey);
    if (cached) return { success: true, data: cached };

    const query = `
      SELECT 
        id as playerId,
        name as playerName,
        team_name as team,
        position,
        '${season || 'current'}' as gameDate,
        minutes as minutesPlayed,
        games_played,
        current_status,
        team_rating_rank,
        team_offensive_rating_rank,
        team_defensive_rating_rank,
        next_opponent_name,
        next_opponent_abbreviation,
        loaded_at
      FROM bigquery.dim_players 
      WHERE id = ${parseInt(playerId)}
    `;
    
    const result = await this.executeBigQueryQuery<PlayerStats>(query);
    if (result.success && result.data) {
      this.setCachedData(cacheKey, result.data);
    }
    return result;
  }

  // Get player recent games from ft_player_stat_over_line
  async getPlayerRecentGames(playerId: string, games: number = 10): Promise<ApiResponse<PlayerStats[]>> {
    const cacheKey = this.getCacheKey('player_recent_games', { playerId, games });
    const cached = this.getCachedData(cacheKey);
    if (cached) return { success: true, data: cached };

    const query = `
      SELECT 
        f.player_id as playerId,
        d.name as playerName,
        d.team_name as team,
        d.position,
        f.game_date as gameDate,
        f.stat_value as points,
        f.stat_value as assists,
        f.stat_value as rebounds,
        0 as steals,
        0 as blocks,
        0 as turnovers,
        0 as fouls,
        0 as minutesPlayed,
        0 as fieldGoalsMade,
        0 as fieldGoalsAttempted,
        0 as threePointersMade,
        0 as threePointersAttempted,
        0 as freeThrowsMade,
        0 as freeThrowsAttempted,
        0 as plusMinus,
        0 as efficiency
      FROM bigquery.ft_player_stat_over_line f
      JOIN bigquery.dim_players d ON f.player_id = d.id
      WHERE f.player_id = ${parseInt(playerId)}
      ORDER BY f.game_date DESC
      LIMIT ${games}
    `;
    
    const result = await this.executeBigQueryQuery<PlayerStats>(query);
    if (result.success && result.data) {
      this.setCachedData(cacheKey, result.data);
    }
    return result;
  }

  // Get current betting lines from dim_prop_player
  async getCurrentBettingLines(playerId: string): Promise<ApiResponse<BettingLine[]>> {
    const cacheKey = this.getCacheKey('current_betting_lines', { playerId });
    const cached = this.getCachedData(cacheKey);
    if (cached) return { success: true, data: cached };

    const query = `
      SELECT 
        p.player_id as playerId,
        d.name as playerName,
        p.stat_type as statType,
        COALESCE(p.line, 0) as line,
        0 as overOdds,
        0 as underOdds,
        CURRENT_DATE() as gameDate,
        'Sportsbook' as bookmaker,
        p.loaded_at as lastUpdated
      FROM bigquery.dim_prop_player p
      JOIN bigquery.dim_players d ON p.player_id = d.id
      WHERE p.player_id = ${parseInt(playerId)}
        AND p.line IS NOT NULL
      ORDER BY p.loaded_at DESC
    `;
    
    const result = await this.executeBigQueryQuery<BettingLine>(query);
    if (result.success && result.data) {
      this.setCachedData(cacheKey, result.data);
    }
    return result;
  }

  // Get player trend analysis from ft_player_stat_over_line
  async getPlayerTrendAnalysis(
    playerId: string, 
    statType: string, 
    periods: number[] = [5, 10, 15, 30]
  ): Promise<ApiResponse<Record<string, number>>> {
    const cacheKey = this.getCacheKey('player_trend', { playerId, statType, periods });
    const cached = this.getCachedData(cacheKey);
    if (cached) return { success: true, data: cached };

    const periodQueries = periods.map(period => 
      `AVG(stat_value) OVER (ORDER BY game_date ROWS BETWEEN ${period - 1} PRECEDING AND CURRENT ROW) as l${period}`
    ).join(', ');

    const query = `
      SELECT 
        ${periodQueries}
      FROM bigquery.ft_player_stat_over_line
      WHERE player_id = ${parseInt(playerId)}
        AND stat_type = '${statType}'
      ORDER BY game_date DESC
      LIMIT 1
    `;

    const result = await this.executeBigQueryQuery<Record<string, number>>(query);
    if (result.success && result.data && result.data.length > 0) {
      this.setCachedData(cacheKey, result.data[0]);
      return { success: true, data: result.data[0] };
    }
    return { success: false, error: 'No trend data found' };
  }

  // Get player vs opponent stats
  async getPlayerVsOpponentStats(
    playerId: string, 
    opponentTeam: string, 
    games: number = 10
  ): Promise<ApiResponse<PlayerStats[]>> {
    const cacheKey = this.getCacheKey('player_vs_opponent', { playerId, opponentTeam, games });
    const cached = this.getCachedData(cacheKey);
    if (cached) return { success: true, data: cached };

    const query = `
      SELECT 
        f.player_id as playerId,
        d.name as playerName,
        d.team_name as team,
        d.position,
        f.game_date as gameDate,
        f.stat_value as points,
        f.stat_value as assists,
        f.stat_value as rebounds,
        0 as steals,
        0 as blocks,
        0 as turnovers,
        0 as fouls,
        0 as minutesPlayed,
        0 as fieldGoalsMade,
        0 as fieldGoalsAttempted,
        0 as threePointersMade,
        0 as threePointersAttempted,
        0 as freeThrowsMade,
        0 as freeThrowsAttempted,
        0 as plusMinus,
        0 as efficiency
      FROM bigquery.ft_player_stat_over_line f
      JOIN bigquery.dim_players d ON f.player_id = d.id
      WHERE f.player_id = ${parseInt(playerId)}
        AND f.played_against LIKE '%${opponentTeam}%'
      ORDER BY f.game_date DESC
      LIMIT ${games}
    `;
    
    const result = await this.executeBigQueryQuery<PlayerStats>(query);
    if (result.success && result.data) {
      this.setCachedData(cacheKey, result.data);
    }
    return result;
  }

  // Get team lineup from dim_players
  async getTeamLineup(teamId: string, gameDate?: string): Promise<ApiResponse<any[]>> {
    const cacheKey = this.getCacheKey('team_lineup', { teamId, gameDate });
    const cached = this.getCachedData(cacheKey);
    if (cached) return { success: true, data: cached };

    const query = `
      SELECT 
        id as playerId,
        name as playerName,
        position,
        current_status as status,
        team_name as teamName,
        team_id,
        minutes as averageMinutes,
        games_played
      FROM bigquery.dim_players
      WHERE team_id = ${parseInt(teamId)}
      ORDER BY position, name
    `;
    
    const result = await this.executeBigQueryQuery<any>(query);
    if (result.success && result.data) {
      this.setCachedData(cacheKey, result.data);
    }
    return result;
  }

  // Get upcoming games (placeholder - would need game schedule table)
  async getGameSchedule(startDate?: string, endDate?: string, team?: string): Promise<ApiResponse<any[]>> {
    // This would need to be implemented based on your game schedule data
    // For now, returning empty array
    return { success: true, data: [] };
  }

  // Get available players from dim_players
  async getAvailablePlayers(team?: string): Promise<ApiResponse<{ playerId: string; playerName: string; team: string }[]>> {
    const cacheKey = this.getCacheKey('available_players', { team });
    const cached = this.getCachedData(cacheKey);
    if (cached) return { success: true, data: cached };

    let query = `
      SELECT 
        id as playerId,
        name as playerName,
        team_name as team
      FROM bigquery.dim_players
    `;

    if (team) {
      query += ` WHERE team_name = '${team}'`;
    }

    query += ` ORDER BY name`;

    const result = await this.executeBigQueryQuery<{ playerId: string; playerName: string; team: string }>(query);
    if (result.success && result.data) {
      this.setCachedData(cacheKey, result.data);
    }
    return result;
  }

  // Get available teams from dim_players
  async getAvailableTeams(): Promise<ApiResponse<string[]>> {
    const cacheKey = this.getCacheKey('available_teams', {});
    const cached = this.getCachedData(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const { data, error } = await supabase.rpc('get_teams');

      if (error) {
        console.error('Error fetching teams:', error);
        return { success: false, error: error.message };
      }

      const teams = data.map(row => row.team_name);
      this.setCachedData(cacheKey, teams);
      return { success: true, data: teams };
    } catch (error) {
      console.error('Error fetching teams:', error);
      return { success: false, error: 'Failed to get teams' };
    }
  }

  // Get prop betting data for a specific player
  async getPlayerPropData(playerId: string): Promise<ApiResponse<DimPropPlayer[]>> {
    const cacheKey = this.getCacheKey('player_prop_data', { playerId });
    const cached = this.getCachedData(cacheKey);
    if (cached) return { success: true, data: cached };

    const query = `
      SELECT *
      FROM bigquery.dim_prop_player
      WHERE player_id = ${parseInt(playerId)}
      ORDER BY stat_type, loaded_at DESC
    `;
    
    const result = await this.executeBigQueryQuery<DimPropPlayer>(query);
    if (result.success && result.data) {
      this.setCachedData(cacheKey, result.data);
    }
    return result;
  }

  // Get player performance against lines
  async getPlayerLinePerformance(playerId: string): Promise<ApiResponse<DimPlayerStatLinePerf[]>> {
    const cacheKey = this.getCacheKey('player_line_performance', { playerId });
    const cached = this.getCachedData(cacheKey);
    if (cached) return { success: true, data: cached };

    const query = `
      SELECT *
      FROM bigquery.dim_player_stat_line_perf
      WHERE player_id = ${parseInt(playerId)}
      ORDER BY stat_type
    `;
    
    const result = await this.executeBigQueryQuery<DimPlayerStatLinePerf>(query);
    if (result.success && result.data) {
      this.setCachedData(cacheKey, result.data);
    }
    return result;
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const bigQueryService = new BigQueryService();