import { supabase } from '@/integrations/supabase/client';

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
  wins: number;
  losses: number;
  team_last_five_games: string;
  next_opponent_name: string;
  next_opponent_abbreviation: string;
  is_next_game_home: boolean;
}

export interface GamePlayerStats {
  player_id: number;
  game_date: string;
  game_id: number;
  stat_type: string;
  stat_value: number;
  line: number;
  is_b2b_game: boolean;
  stat_vs_line: string;
  played_against: string;
  home_away: string;
  is_played: string;
}

export const nbaDataService = {
  async getAllPlayers(): Promise<Player[]> {
    const { data, error } = await supabase
      .rpc('get_all_players');
    
    if (error) throw error;
    return data || [];
  },

  async getPlayerById(playerId: number): Promise<Player | null> {
    const { data, error } = await supabase
      .rpc('get_player_by_id', { p_player_id: playerId });
    
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },

  async getPlayerByName(playerName: string): Promise<Player | null> {
    // Convert slug to proper case (e.g., "anthony-davis" -> "Anthony Davis")
    const formattedName = playerName
      .replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    const { data, error } = await supabase
      .rpc('get_player_by_name', { 
        p_player_name: formattedName
      });
    
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  },

  async getPlayerProps(playerId: number): Promise<PropPlayer[]> {
    const { data, error } = await supabase
      .rpc('get_player_props', { p_player_id: playerId });
    
    if (error) throw error;
    return (data || []) as PropPlayer[];
  },

  async getPlayerGameStats(playerId: number, limit = 15): Promise<GamePlayerStats[]> {
    const { data, error} = await supabase
      .rpc('get_player_game_stats', { 
        p_player_id: playerId,
        p_limit: limit 
      });
    
    if (error) throw error;
    return (data || []) as GamePlayerStats[];
  },

  async getTeamById(teamId: number): Promise<Team | null> {
    const { data, error } = await supabase
      .rpc('get_team_by_id', { p_team_id: teamId });
    
    if (error) throw error;
    return data && data.length > 0 ? data[0] as Team : null;
  },
};
