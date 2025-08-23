import { GCSClient } from '@/lib/gcs-client';
import type {
  Player,
  Game,
  PlayerGame,
  PropBet,
  PlayerStats,
  PropAnalysis,
  InjuryReport,
  TeamStats,
  ModelPerformance,
  PlayerFilters,
  GameFilters,
  PropFilters,
  ApiResponse,
  PaginatedResponse
} from '@/types/sports';

export class SportsDataService {
  private gcsClient: GCSClient;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    try {
      this.gcsClient = new GCSClient({
        projectId: import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_ID || '',
        bucketName: import.meta.env.VITE_GOOGLE_CLOUD_STORAGE_BUCKET || '',
        apiKey: import.meta.env.VITE_GOOGLE_CLOUD_API_KEY,
        accessToken: import.meta.env.VITE_GOOGLE_CLOUD_ACCESS_TOKEN,
      });
    } catch (error) {
      console.error('Failed to initialize GCS client:', error);
      throw error;
    }
  }

  private async getCachedData<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T;
    }
    return null;
  }

  private setCachedData<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Player Management
  async getPlayers(filters?: PlayerFilters): Promise<ApiResponse<PaginatedResponse<Player>>> {
    try {
      const cacheKey = `players_${JSON.stringify(filters)}`;
      const cached = await this.getCachedData<PaginatedResponse<Player>>(cacheKey);
      if (cached) return { success: true, data: cached };

      // In a real implementation, you'd fetch from GCS or your data source
      const players = await this.fetchPlayersFromGCS(filters);
      this.setCachedData(cacheKey, players);
      
      return { success: true, data: players };
    } catch (error) {
      console.error('Error fetching players:', error);
      return { success: false, error: 'Failed to fetch players' };
    }
  }

  async getPlayerById(id: string): Promise<ApiResponse<Player>> {
    try {
      const cacheKey = `player_${id}`;
      const cached = await this.getCachedData<Player>(cacheKey);
      if (cached) return { success: true, data: cached };

      const player = await this.fetchPlayerFromGCS(id);
      if (player) {
        this.setCachedData(cacheKey, player);
        return { success: true, data: player };
      }
      
      return { success: false, error: 'Player not found' };
    } catch (error) {
      console.error('Error fetching player:', error);
      return { success: false, error: 'Failed to fetch player' };
    }
  }

  // Game Management
  async getGames(filters?: GameFilters): Promise<ApiResponse<PaginatedResponse<Game>>> {
    try {
      const cacheKey = `games_${JSON.stringify(filters)}`;
      const cached = await this.getCachedData<PaginatedResponse<Game>>(cacheKey);
      if (cached) return { success: true, data: cached };

      const games = await this.fetchGamesFromGCS(filters);
      this.setCachedData(cacheKey, games);
      
      return { success: true, data: games };
    } catch (error) {
      console.error('Error fetching games:', error);
      return { success: false, error: 'Failed to fetch games' };
    }
  }

  async getGameById(id: string): Promise<ApiResponse<Game>> {
    try {
      const cacheKey = `game_${id}`;
      const cached = await this.getCachedData<Game>(cacheKey);
      if (cached) return { success: true, data: cached };

      const game = await this.fetchGameFromGCS(id);
      if (game) {
        this.setCachedData(cacheKey, game);
        return { success: true, data: game };
      }
      
      return { success: false, error: 'Game not found' };
    } catch (error) {
      console.error('Error fetching game:', error);
      return { success: false, error: 'Failed to fetch game' };
    }
  }

  // Prop Bets Management
  async getPropBets(filters?: PropFilters): Promise<ApiResponse<PaginatedResponse<PropBet>>> {
    try {
      const cacheKey = `props_${JSON.stringify(filters)}`;
      const cached = await this.getCachedData<PaginatedResponse<PropBet>>(cacheKey);
      if (cached) return { success: true, data: cached };

      const props = await this.fetchPropsFromGCS(filters);
      this.setCachedData(cacheKey, props);
      
      return { success: true, data: props };
    } catch (error) {
      console.error('Error fetching prop bets:', error);
      return { success: false, error: 'Failed to fetch prop bets' };
    }
  }

  // Analysis Management
  async getPropAnalysis(propId: string): Promise<ApiResponse<PropAnalysis>> {
    try {
      const cacheKey = `analysis_${propId}`;
      const cached = await this.getCachedData<PropAnalysis>(cacheKey);
      if (cached) return { success: true, data: cached };

      const analysis = await this.fetchAnalysisFromGCS(propId);
      if (analysis) {
        this.setCachedData(cacheKey, analysis);
        return { success: true, data: analysis };
      }
      
      return { success: false, error: 'Analysis not found' };
    } catch (error) {
      console.error('Error fetching analysis:', error);
      return { success: false, error: 'Failed to fetch analysis' };
    }
  }

  // Injury Reports
  async getInjuryReports(teamId?: string): Promise<ApiResponse<InjuryReport[]>> {
    try {
      const cacheKey = `injuries_${teamId || 'all'}`;
      const cached = await this.getCachedData<InjuryReport[]>(cacheKey);
      if (cached) return { success: true, data: cached };

      const injuries = await this.fetchInjuriesFromGCS(teamId);
      this.setCachedData(cacheKey, injuries);
      
      return { success: true, data: injuries };
    } catch (error) {
      console.error('Error fetching injury reports:', error);
      return { success: false, error: 'Failed to fetch injury reports' };
    }
  }

  // Model Performance
  async getModelPerformance(days: number = 30): Promise<ApiResponse<ModelPerformance[]>> {
    try {
      const cacheKey = `model_performance_${days}`;
      const cached = await this.getCachedData<ModelPerformance[]>(cacheKey);
      if (cached) return { success: true, data: cached };

      const performance = await this.fetchModelPerformanceFromGCS(days);
      this.setCachedData(cacheKey, performance);
      
      return { success: true, data: performance };
    } catch (error) {
      console.error('Error fetching model performance:', error);
      return { success: false, error: 'Failed to fetch model performance' };
    }
  }

  // GCS Data Fetching Methods (implement based on your data structure)
  private async fetchPlayersFromGCS(filters?: PlayerFilters): Promise<PaginatedResponse<Player>> {
    try {
      // Try to list files from the players directory
      const files = await this.gcsClient.listFiles('players/');
      const players: Player[] = [];
      
      for (const file of files.slice(0, 10)) { // Limit for demo
        try {
          const content = await this.gcsClient.getFileContent(file);
          const player = JSON.parse(content) as Player;
          if (this.matchesPlayerFilters(player, filters)) {
            players.push(player);
          }
        } catch (error) {
          console.error(`Error parsing player file ${file}:`, error);
        }
      }
      
      return {
        data: players,
        pagination: {
          page: 1,
          limit: 10,
          total: players.length,
          totalPages: 1
        }
      };
    } catch (error) {
      console.error('Error fetching players from GCS:', error);
      // Return empty result if GCS is not accessible
      return {
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 1
        }
      };
    }
  }

  private async fetchPlayerFromGCS(id: string): Promise<Player | null> {
    try {
      const content = await this.gcsClient.getFileContent(`players/${id}.json`);
      return JSON.parse(content) as Player;
    } catch (error) {
      console.error(`Error fetching player ${id}:`, error);
      return null;
    }
  }

  private async fetchGamesFromGCS(filters?: GameFilters): Promise<PaginatedResponse<Game>> {
    try {
      const files = await this.gcsClient.listFiles('games/');
      const games: Game[] = [];
      
      for (const file of files.slice(0, 10)) {
        try {
          const content = await this.gcsClient.getFileContent(file);
          const game = JSON.parse(content) as Game;
          if (this.matchesGameFilters(game, filters)) {
            games.push(game);
          }
        } catch (error) {
          console.error(`Error parsing game file ${file}:`, error);
        }
      }
      
      return {
        data: games,
        pagination: {
          page: 1,
          limit: 10,
          total: games.length,
          totalPages: 1
        }
      };
    } catch (error) {
      console.error('Error fetching games from GCS:', error);
      return {
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 1
        }
      };
    }
  }

  private async fetchGameFromGCS(id: string): Promise<Game | null> {
    try {
      const content = await this.gcsClient.getFileContent(`games/${id}.json`);
      return JSON.parse(content) as Game;
    } catch (error) {
      console.error(`Error fetching game ${id}:`, error);
      return null;
    }
  }

  private async fetchPropsFromGCS(filters?: PropFilters): Promise<PaginatedResponse<PropBet>> {
    try {
      const files = await this.gcsClient.listFiles('props/');
      const props: PropBet[] = [];
      
      for (const file of files.slice(0, 10)) {
        try {
          const content = await this.gcsClient.getFileContent(file);
          const prop = JSON.parse(content) as PropBet;
          if (this.matchesPropFilters(prop, filters)) {
            props.push(prop);
          }
        } catch (error) {
          console.error(`Error parsing prop file ${file}:`, error);
        }
      }
      
      return {
        data: props,
        pagination: {
          page: 1,
          limit: 10,
          total: props.length,
          totalPages: 1
        }
      };
    } catch (error) {
      console.error('Error fetching props from GCS:', error);
      return {
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 1
        }
      };
    }
  }

  private async fetchAnalysisFromGCS(propId: string): Promise<PropAnalysis | null> {
    try {
      const content = await this.gcsClient.getFileContent(`analysis/${propId}.json`);
      return JSON.parse(content) as PropAnalysis;
    } catch (error) {
      console.error(`Error fetching analysis ${propId}:`, error);
      return null;
    }
  }

  private async fetchInjuriesFromGCS(teamId?: string): Promise<InjuryReport[]> {
    try {
      const files = await this.gcsClient.listFiles('injuries/');
      const injuries: InjuryReport[] = [];
      
      for (const file of files) {
        try {
          const content = await this.gcsClient.getFileContent(file);
          const injury = JSON.parse(content) as InjuryReport;
          if (!teamId || injury.team === teamId) {
            injuries.push(injury);
          }
        } catch (error) {
          console.error(`Error parsing injury file ${file}:`, error);
        }
      }
      
      return injuries;
    } catch (error) {
      console.error('Error fetching injuries from GCS:', error);
      return [];
    }
  }

  private async fetchModelPerformanceFromGCS(days: number): Promise<ModelPerformance[]> {
    try {
      const files = await this.gcsClient.listFiles('performance/');
      const performance: ModelPerformance[] = [];
      
      for (const file of files.slice(-days)) {
        try {
          const content = await this.gcsClient.getFileContent(file);
          const perf = JSON.parse(content) as ModelPerformance;
          performance.push(perf);
        } catch (error) {
          console.error(`Error parsing performance file ${file}:`, error);
        }
      }
      
      return performance;
    } catch (error) {
      console.error('Error fetching model performance from GCS:', error);
      return [];
    }
  }

  // Filter Helper Methods
  private matchesPlayerFilters(player: Player, filters?: PlayerFilters): boolean {
    if (!filters) return true;
    
    if (filters.search && !player.name.toLowerCase().includes(filters.search.toLowerCase()) &&
        !player.team.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    
    if (filters.team && player.team !== filters.team) return false;
    if (filters.position && player.position !== filters.position) return false;
    if (filters.sport && player.sport !== filters.sport) return false;
    
    return true;
  }

  private matchesGameFilters(game: Game, filters?: GameFilters): boolean {
    if (!filters) return true;
    
    if (filters.date && game.date !== filters.date) return false;
    if (filters.team && game.homeTeam !== filters.team && game.awayTeam !== filters.team) return false;
    if (filters.status && game.status !== filters.status) return false;
    if (filters.sport) return false; // Add sport field to Game interface if needed
    
    return true;
  }

  private matchesPropFilters(prop: PropBet, filters?: PropFilters): boolean {
    if (!filters) return true;
    
    if (filters.playerId && prop.playerId !== filters.playerId) return false;
    if (filters.gameId && prop.gameId !== filters.gameId) return false;
    if (filters.type && prop.type !== filters.type) return false;
    if (filters.bookmaker && prop.bookmaker !== filters.bookmaker) return false;
    
    return true;
  }

  // Cache Management
  clearCache(): void {
    this.cache.clear();
  }

  clearCacheByPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  // Health Check
  async checkGCSConnection(): Promise<boolean> {
    try {
      await this.gcsClient.isBucketPublic();
      return true;
    } catch (error) {
      console.error('GCS connection check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const sportsDataService = new SportsDataService();
