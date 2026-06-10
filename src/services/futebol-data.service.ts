import { supabase } from '@/integrations/supabase/client';

// As RPCs de futebol ainda não estão nos tipos gerados do Supabase (existem
// só no dev, lendo BigQuery via FDW no schema bq_futebol). Cast pra any, mesmo
// padrão de nba-data.service.ts.
const supabaseClient = supabase as any;

// Retry com backoff, pulando erros determinísticos (função/coluna inexistente).
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1200): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const err = error as any;
      const code = String(err?.code || '');
      const message = String(err?.message || '');
      const nonRetryable =
        new Set(['42883', 'PGRST202', 'PGRST204']).has(code) ||
        (message.includes('function') && message.includes('does not exist'));
      if (nonRetryable) throw err;
      lastError = error as Error;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 1.5;
      }
    }
  }
  throw lastError;
}

export type Competition = 'brasileirao' | 'copa_mundo';

export interface FutebolFixture {
  fixture_id: number;
  round: string | null;
  kickoff_utc: string | null;
  date_utc: string | null;
  status_short: string | null;
  status_long: string | null;
  home_team_id: number;
  home_team_name: string;
  home_team_logo: string | null;
  away_team_id: number;
  away_team_name: string;
  away_team_logo: string | null;
  goals_home: number | null;
  goals_away: number | null;
}

export interface FutebolTeamStats {
  team_side: 'home' | 'away';
  team_id: number | null;
  team_name: string | null;
  shots_on_goal: number | null;
  shots_off_goal: number | null;
  total_shots: number | null;
  blocked_shots: number | null;
  shots_insidebox: number | null;
  shots_outsidebox: number | null;
  fouls: number | null;
  corner_kicks: number | null;
  offsides: number | null;
  ball_possession: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  goalkeeper_saves: number | null;
  total_passes: number | null;
  passes_accurate: number | null;
  passes_pct: number | null;
  expected_goals: number | null;
  goals_prevented: number | null;
}

export interface FutebolFormResult {
  fixture_id: number;
  date_utc: string;
  opponent: string;
  side: 'home' | 'away';
  goals_for: number;
  goals_against: number;
  result: 'W' | 'D' | 'L';
}

export interface FutebolH2H {
  fixture_id: number;
  date_utc: string;
  season: number;
  home_team_name: string;
  away_team_name: string;
  goals_home: number | null;
  goals_away: number | null;
}

export interface FutebolPlayerStat {
  player_id: number;
  team_side: 'home' | 'away';
  player_name: string | null;
  minutes: number | null;
  rating: number | null;
  goals: number | null;
  assists: number | null;
  shots_total: number | null;
  shots_on: number | null;
  passes_key: number | null;
  tackles_total: number | null;
  is_substitute: boolean | null;
}

export interface FutebolLineup {
  team_id: number;
  team_name: string | null;
  team_side: 'home' | 'away';
  formation: string | null;
  coach_name: string | null;
}

export interface FutebolEvent {
  minute: number | null;
  minute_extra: number | null;
  team_side: 'home' | 'away';
  team_name: string | null;
  player_name: string | null;
  assist_player_name: string | null;
  event_type: 'Goal' | 'Card' | 'subst' | 'Var' | string;
  event_detail: string | null;
}

export interface FutebolLineupPlayer {
  team_id: number;
  team_side: 'home' | 'away';
  is_starter: boolean | null;
  player_slot: number | null;
  player_id: number | null;
  player_name: string | null;
  shirt_number: number | null;
  position: string | null;
  grid: string | null;
}

export interface FutebolFixtureDetail {
  fixture: (FutebolFixture & {
    competition: Competition;
    season: number;
    status_elapsed: number | null;
    venue_name: string | null;
    venue_city: string | null;
    score_halftime_home: number | null;
    score_halftime_away: number | null;
  }) | null;
  stats: FutebolTeamStats[];
  events: FutebolEvent[];
  player_stats: FutebolPlayerStat[];
  form_home: FutebolFormResult[];
  form_away: FutebolFormResult[];
  h2h: FutebolH2H[];
  lineups: FutebolLineup[];
  lineup_players: FutebolLineupPlayer[];
}

export interface FutebolStandingRow {
  team_id: number;
  team_name: string;
  team_logo: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
}

export type ProfileScope = 'geral' | 'casa' | 'fora';

export interface FutebolScopeResult {
  scope: ProfileScope;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  avg_gf: number;
  avg_ga: number;
  over25_pct: number;
  btts_pct: number;
}

export interface FutebolScopeStats {
  scope: ProfileScope;
  games: number;
  avg_possession: number | null;
  avg_shots: number | null;
  avg_shots_on_goal: number | null;
  avg_corners: number | null;
  avg_yellow: number | null;
  avg_xg: number | null;
  avg_xg_against: number | null;
}

export interface FutebolTeamProfile {
  team: { team_id: number; team_name: string | null; team_logo: string | null } | null;
  results: FutebolScopeResult[];
  stats_avg: FutebolScopeStats[];
}

export interface FutebolTeamMarket {
  games: number;
  avg_gf: number;
  avg_ga: number;
  over25_pct: number;
  btts_pct: number;
}

export interface FutebolMatchupMarkets {
  home?: FutebolTeamMarket;
  away?: FutebolTeamMarket;
}

export interface FutebolScorer {
  player_id: number;
  player_name: string;
  team_name: string | null;
  goals: number;
}

export interface FutebolCardLeader {
  player_id: number;
  player_name: string;
  team_name: string | null;
  yellow: number;
  red: number;
}

export interface FutebolLeaders {
  scorers: FutebolScorer[];
  cards: FutebolCardLeader[];
}

export const futebolDataService = {
  async getFixtures(
    competition: Competition,
    season: number,
    round?: string | null
  ): Promise<FutebolFixture[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_fixtures', {
        p_competition: competition,
        p_season: season,
        p_round: round ?? null,
      });
      if (error) throw error;
      return (data || []) as FutebolFixture[];
    });
  },

  async getFixtureDetail(fixtureId: number): Promise<FutebolFixtureDetail> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_fixture_detail', {
        p_fixture_id: fixtureId,
      });
      if (error) throw error;
      return (data || { fixture: null }) as FutebolFixtureDetail;
    });
  },

  async getStandings(competition: Competition, season: number): Promise<FutebolStandingRow[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_standings', {
        p_competition: competition,
        p_season: season,
      });
      if (error) throw error;
      return (data || []) as FutebolStandingRow[];
    });
  },

  async getTeamProfile(teamId: number, competition: Competition, season: number): Promise<FutebolTeamProfile> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_team_profile', {
        p_team_id: teamId,
        p_competition: competition,
        p_season: season,
      });
      if (error) throw error;
      return (data || { team: null, results: [], stats_avg: [] }) as FutebolTeamProfile;
    });
  },

  async getMatchupMarkets(
    homeId: number,
    awayId: number,
    competition: Competition,
    season: number
  ): Promise<FutebolMatchupMarkets> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_matchup_markets', {
        p_home_id: homeId,
        p_away_id: awayId,
        p_competition: competition,
        p_season: season,
      });
      if (error) throw error;
      return (data || {}) as FutebolMatchupMarkets;
    });
  },

  async getLeaders(competition: Competition, season: number): Promise<FutebolLeaders> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_leaders', {
        p_competition: competition,
        p_season: season,
      });
      if (error) throw error;
      return (data || { scorers: [], cards: [] }) as FutebolLeaders;
    });
  },
};
