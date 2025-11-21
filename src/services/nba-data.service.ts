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
      .schema('bigquery')
      .from('dim_players')
      .select('*')
      .order('player_name');
    
    if (error) throw error;
    return data || [];
  },

  async getPlayerById(playerId: number): Promise<Player | null> {
    const { data, error } = await supabase
      .schema('bigquery')
      .from('dim_players')
      .select('*')
      .eq('player_id', playerId)
      .single();
    
    if (error) throw error;
    return data;
  },

  async getPlayerByName(playerName: string): Promise<Player | null> {
    const { data, error } = await supabase
      .schema('bigquery')
      .from('dim_players')
      .select('*')
      .ilike('player_name', playerName.replace(/-/g, ' '))
      .single();
    
    if (error) throw error;
    return data;
  },

  async getPlayerProps(playerId: number): Promise<PropPlayer[]> {
    const { data, error } = await supabase
      .schema('bigquery')
      .from('dim_prop_player')
      .select('*')
      .eq('player_id', playerId);
    
    if (error) throw error;
    return data || [];
  },

  async getPlayerGameStats(playerId: number, limit = 15): Promise<GamePlayerStats[]> {
    const { data, error} = await supabase
      .schema('bigquery')
      .from('ft_game_player_stats')
      .select('*')
      .eq('player_id', playerId)
      .order('game_date', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  },

  async getTeamById(teamId: number): Promise<Team | null> {
    const { data, error } = await supabase
      .schema('bigquery')
      .from('dim_teams')
      .select('*')
      .eq('team_id', teamId)
      .single();
    
    if (error) throw error;
    return data;
  },
};
