import { supabase } from '@/integrations/supabase/client';
const supabaseClient = supabase as any;
let allPlayersCache: { data: Player[]; expiresAt: number } | null = null;
const ALL_PLAYERS_CACHE_TTL_MS = 60 * 1000;

// Helper function to retry failed requests
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const err = error as any;
      const code = String(err?.code || '');
      const message = String(err?.message || '');

      // Skip retries for deterministic infra/schema errors.
      // These won't succeed on retry and only slow down UX.
      const nonRetryableCodes = new Set(['HV00J', '42883', 'PGRST202', 'PGRST204']);
      const isNonRetryable =
        nonRetryableCodes.has(code) ||
        message.includes('required option `table` is not specified') ||
        message.includes('function') && message.includes('does not exist');

      if (isNonRetryable) {
        throw err;
      }

      lastError = error as Error;
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error);
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Exponential backoff
      }
    }
  }
  
  throw lastError;
}

export interface Player {
  player_id: number;
  player_name: string;
  position: string;
  team_id: number;
  team_name: string;
  team_abbreviation: string;
  age: number;
  last_game_text: string;
  current_status: string;
  rating_stars: number;
}

export interface PropPlayer {
  player_id: number;
  team_id: number;
  stat_type: string;
  rating_stars: number;
  is_leader_with_injury: boolean;
  is_available_backup: boolean;
  stat_rank: number;
  next_available_player_name: string;
  next_player_stats_when_leader_out: number;
  next_player_stats_normal: number;
  loaded_at: string;
}

export interface Team {
  team_id: number;
  team_name: string;
  team_abbreviation: string;
  conference: string;
  team_city: string;
  season: number;
  conference_rank: number;
  wins: number;
  losses: number;
  team_last_five_games: string;
  team_rating_rank: number;
  team_offensive_rating_rank: number;
  team_defensive_rating_rank: number;
  next_opponent_id: number;
  next_opponent_name: string;
  next_opponent_abbreviation: string;
  is_next_game_home: boolean;
  next_opponent_team_last_five_games: string;
  next_opponent_conference_rank: number;
  next_opponent_team_rating_rank: number;
  next_opponent_team_offensive_rating_rank: number;
  next_opponent_team_defensive_rating_rank: number;
  team_injury_report_time_brasilia: string;
  next_game_injury_report_time_brasilia: string;
  loaded_at: string;
}

export interface TeamPlayer {
  player_id: number;
  player_name: string;
  position: string;
  team_id: number;
  age: number;
  current_status: string;
  rating_stars: number;
}

export interface GamePlayerStats {
  player_id: number;
  game_date: string;
  game_id: number;
  stat_type: string;
  stat_value: number;
  line: number;
  line_most_recent: number | null;  // Linha atual das casas de apostas
  is_b2b_game: boolean;
  stat_vs_line: string;
  played_against: string;
  home_away: string;
  is_played: string;
}

export interface Game {
  game_id: number;
  game_date: string;
  home_team_id: number;
  home_team_name: string;
  home_team_abbreviation: string;
  home_team_score: number | null;
  visitor_team_id: number;
  visitor_team_name: string;
  visitor_team_abbreviation: string;
  visitor_team_score: number | null;
  winner_team_id: number | null;
  loaded_at: string;
  home_team_is_b2b_game: boolean;
  visitor_team_is_b2b_game: boolean;
  home_team_is_next_game: boolean;
  visitor_team_is_next_game: boolean;
  home_team_last_five: string | null;  // Últimos 5 resultados (ex: "WWLWL")
  visitor_team_last_five: string | null;  // Últimos 5 resultados (ex: "LWWLW")
}

export interface PlayerShootingZones {
  player_id: number;
  player_name: string;
  corner_3_fga: number;
  corner_3_fgm: number;
  corner_3_fg_pct: number;
  left_corner_3_fga: number;
  left_corner_3_fgm: number;
  left_corner_3_fg_pct: number;
  right_corner_3_fga: number;
  right_corner_3_fgm: number;
  right_corner_3_fg_pct: number;
  above_the_break_3_fga: number;
  above_the_break_3_fgm: number;
  above_the_break_3_fg_pct: number;
  restricted_area_fga: number;
  restricted_area_fgm: number;
  restricted_area_fg_pct: number;
  in_the_paint_non_ra_fga: number;
  in_the_paint_non_ra_fgm: number;
  in_the_paint_non_ra_fg_pct: number;
  mid_range_fga: number;
  mid_range_fgm: number;
  mid_range_fg_pct: number;
  backcourt_fga: number;
  backcourt_fgm: number;
  backcourt_fg_pct: number;
  loaded_at: string;
}

export interface PlayerDashboardBundle {
  player: Player | null;
  game_stats: GamePlayerStats[];
  prop_players: PropPlayer[];
  team: Team | null;
  teammates: TeamPlayer[];
  shooting_zones: PlayerShootingZones | null;
}

export const nbaDataService = {
  async getAllPlayers(): Promise<Player[]> {
    if (allPlayersCache && Date.now() < allPlayersCache.expiresAt) {
      return allPlayersCache.data;
    }

    return withRetry(async () => {
      const { data, error } = await supabaseClient
        .rpc('get_all_players');
      
      if (error) throw error;
      const players = (data || []) as Player[];
      allPlayersCache = {
        data: players,
        expiresAt: Date.now() + ALL_PLAYERS_CACHE_TTL_MS,
      };
      return players;
    });
  },

  async getPlayerById(playerId: number): Promise<Player | null> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient
        .rpc('get_player_by_id', { p_player_id: playerId });
      
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    });
  },

  async getPlayerByName(playerName: string): Promise<Player | null> {
    // Normalize: remove diacritics/accents, replace hyphens with spaces, lowercase
    const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/-/g, ' ').toLowerCase();
    const searchName = normalize(playerName);

    // Fast path: use dedicated RPC if available in the environment
    try {
      const { data, error } = await supabaseClient.rpc('get_player_by_name', {
        p_player_name: playerName,
      });
      if (!error && data && data.length > 0) {
        return data[0] as Player;
      }
    } catch {
      // Fallback handled below (function may not exist in some environments)
    }

    try {
      // Get all players and search case-insensitively in JavaScript
      // This is necessary because BigQuery foreign tables don't support UPPER() in WHERE clauses
      const allPlayers = await this.getAllPlayers();
      
      // Find player by normalized name match (handles accents, hyphens, case)
      let player = allPlayers.find(p => normalize(p.player_name) === searchName);
      
      // If still not found, try partial match (for edge cases)
      if (!player) {
        const searchWords = searchName.split(' ');
        player = allPlayers.find(p => {
          const dbNormalized = normalize(p.player_name);
          return searchWords.every(word => dbNormalized.includes(word));
        });
      }
      
      return player || null;
    } catch (error) {
      console.error('Error finding player by name:', error);
      return null;
    }
  },

  async getPlayerProps(playerId: number): Promise<PropPlayer[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient
        .rpc('get_player_props', { p_player_id: playerId });
      
      if (error) throw error;
      return (data || []) as PropPlayer[];
    });
  },

  async getPlayerGameStats(playerId: number, limit = 15): Promise<GamePlayerStats[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient
        .rpc('get_player_game_stats', { 
          p_player_id: playerId,
          p_limit: limit 
        });
      
      if (error) throw error;
      return (data || []) as GamePlayerStats[];
    });
  },

  async getTeamById(teamId: number): Promise<Team | null> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient
        .rpc('get_team_by_id', { p_team_id: teamId });
      
      if (error) throw error;
      return data && data.length > 0 ? data[0] as Team : null;
    });
  },

  async getTeamPlayers(teamId: number): Promise<TeamPlayer[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient
        .rpc('get_team_players', { p_team_id: teamId });
      
      if (error) throw error;
      return (data || []) as TeamPlayer[];
    });
  },

  async getGames(params?: { gameDate?: string; teamAbbreviation?: string }): Promise<Game[]> {
    return withRetry(async () => {
      const { gameDate, teamAbbreviation } = params || {};
      const { data, error } = await supabaseClient.rpc('get_games', {
        p_game_date: gameDate ?? null,
        p_team_abbreviation: teamAbbreviation ?? null,
      });

      if (error) throw error;
      return (data || []) as Game[];
    });
  },

  async getPlayerShootingZones(playerId: number): Promise<PlayerShootingZones | null> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_player_shooting_zones', {
        p_player_id: playerId,
      });

      if (error) throw error;
      if (!data || data.length === 0) return null;
      return data[0] as PlayerShootingZones;
    });
  },

  async getPlayerDashboardBundle(playerId: number, gamesLimit = 40): Promise<PlayerDashboardBundle | null> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_player_dashboard_bundle', {
        p_player_id: playerId,
        p_games_limit: gamesLimit,
      });

      if (error) throw error;
      if (!data) return null;

      // Be resilient to different SQL client return shapes.
      let payload: any = data;
      if (Array.isArray(payload) && payload.length === 1 && payload[0]?.get_player_dashboard_bundle) {
        payload = payload[0].get_player_dashboard_bundle;
      } else if (payload?.get_player_dashboard_bundle) {
        payload = payload.get_player_dashboard_bundle;
      }

      if (!payload || typeof payload !== 'object') return null;

      return {
        player: (payload.player ?? null) as Player | null,
        game_stats: (payload.game_stats ?? []) as GamePlayerStats[],
        prop_players: (payload.prop_players ?? []) as PropPlayer[],
        team: (payload.team ?? null) as Team | null,
        teammates: (payload.teammates ?? []) as TeamPlayer[],
        shooting_zones: (payload.shooting_zones ?? null) as PlayerShootingZones | null,
      };
    });
  },
};
