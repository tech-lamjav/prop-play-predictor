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
}

export interface FutebolFixtureExtras {
  events: FutebolEvent[];
  player_stats: FutebolPlayerStat[];
  form_home: FutebolFormResult[];
  form_away: FutebolFormResult[];
  lineups: FutebolLineup[];
  lineup_players: FutebolLineupPlayer[];
}

export interface FutebolInjury {
  team_id: number;
  player_id: number;
  player_name: string;
  injury_type: string;
  injury_reason: string;
}

export interface FutebolH2HMeeting {
  fixture_id: number;
  date_utc: string;
  competition: string;
  season: number;
  home_team_name: string;
  away_team_name: string;
  goals_home: number | null;
  goals_away: number | null;
  winner_team_id: number | null;
}

export interface FutebolStandingRow {
  team_id: number;
  team_name: string;
  rank: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  loses: number;
  goals_for: number;
  goals_against: number;
  goals_diff: number;
  rank_description: string | null;
}

export type FutebolZone = 'libertadores' | 'sula' | 'rebaixamento' | null;

/** Classifica a zona da tabela a partir do rank_description oficial. */
export function futebolZone(desc: string | null | undefined): FutebolZone {
  if (!desc) return null;
  const d = desc.toLowerCase();
  if (d.includes('libertadores')) return 'libertadores';
  if (d.includes('sudamericana')) return 'sula';
  if (d.includes('relegation')) return 'rebaixamento';
  return null;
}

// Cores das zonas (hex espelhando forest / status-info / status-danger do tema)
export const FUTEBOL_ZONE_COLOR: Record<Exclude<FutebolZone, null>, string> = {
  libertadores: '#0a3d2e',
  sula: '#1a5fb4',
  rebaixamento: '#b8341c',
};
export const FUTEBOL_ZONE_LABEL: Record<Exclude<FutebolZone, null>, string> = {
  libertadores: 'Libertadores',
  sula: 'Sul-Americana',
  rebaixamento: 'Rebaixamento',
};

/** Estado de acesso ao módulo Futebol (reverse trial 7 dias, sem cartão). */
export type FutebolAccessState = 'anon' | 'trial' | 'expired' | 'subscribed';
export interface FutebolAccess {
  state: FutebolAccessState;
  unlocked: boolean;
  days_left: number | null;
  trial_ends_at: string | null;
}

export interface FutebolTeamSeason {
  form: string | null;
  played_total: number | null; played_home: number | null; played_away: number | null;
  wins_total: number | null; wins_home: number | null; wins_away: number | null;
  draws_total: number | null; draws_home: number | null; draws_away: number | null;
  loses_total: number | null; loses_home: number | null; loses_away: number | null;
  goals_for_avg_total: number | null; goals_for_avg_home: number | null; goals_for_avg_away: number | null;
  goals_against_avg_total: number | null; goals_against_avg_home: number | null; goals_against_avg_away: number | null;
  clean_sheet_total: number | null; clean_sheet_home: number | null; clean_sheet_away: number | null;
  failed_to_score_total: number | null;
  biggest_streak_wins: number | null; biggest_streak_loses: number | null;
  penalty_total: number | null; penalty_scored_pct: number | null;
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

export interface FutebolMatchupTendencies {
  home: FutebolTeamSeason | null;
  away: FutebolTeamSeason | null;
}

export interface FutebolOddsRow {
  market_key: 'match_winner' | 'over_under' | 'btts' | 'double_chance' | 'asian_handicap';
  market_label: string;
  outcome_label: string;
  outcome_order: number;
  line: number | null;
  pinnacle_odd: number | null;
  avg_odd: number | null;
  best_odd: number;
  best_book: string;
  n_books: number;
  pin_open: number | null;
  pin_close: number | null;
}

export interface FutebolPrediction {
  has_prediction: boolean;
  predicted_winner_name: string | null;
  advice: string | null;
  prob_home_pct: number | null;
  prob_draw_pct: number | null;
  prob_away_pct: number | null;
  cmp_form_home: number | null; cmp_form_away: number | null;
  cmp_att_home: number | null; cmp_att_away: number | null;
  cmp_def_home: number | null; cmp_def_away: number | null;
  cmp_poisson_home: number | null; cmp_poisson_away: number | null;
  cmp_h2h_home: number | null; cmp_h2h_away: number | null;
  cmp_goals_home: number | null; cmp_goals_away: number | null;
  cmp_total_home: number | null; cmp_total_away: number | null;
}

export interface FutebolOddsBoardRow extends FutebolOddsRow {
  fixture_id: number;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  away_team_name: string;
  competition: string;
  kickoff_utc: string | null;
  status_short: string | null;
}

// ── Motor de Score (backend / BigQuery → fact_value_opportunities) ──
// O Score agora é calculado no backend (pipeline dbt do Mateus). O front lê pronto.
export interface FutebolValueBoardRow {
  fixture_id: number;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  away_team_name: string;
  competition: string;
  kickoff_utc: string | null;
  status_short: string | null;
  market: string;          // 'match_winner' | 'goals_over_under'
  outcome: string;         // 'Home'|'Draw'|'Away' | 'Over'|'Under'
  line_value: number | null; // linha do Over/Under; null no 1X2
  edge: number;
  best_odd: number;
  best_book: string;
  avg_odd: number;
  n_casas: number;
  janela_usada: string;    // t15m | t1h | t24h
  prob_justa_fechamento: number; // "Chance" (prob justa devigada) 0..1
  pts_valor: number;
  pts_premissas: number;
  pts_corroboracao: number;
  penalidades: number;
  score: number;           // 0..100
  faixa: string;           // 'Alta' | 'Média' | 'Baixa'
  evidencias: string[];    // "por quê" (montado no backend); usar a 1ª na lista
}

export interface FutebolFixtureValueRow {
  market: string;            // 'match_winner' | 'goals_over_under'
  outcome: string;
  outcome_order: number;
  line_value: number | null;
  edge: number;
  best_odd: number;
  best_book: string;
  avg_odd: number;
  n_casas: number;
  janela_usada: string;
  prob_justa_fechamento: number;
  pts_valor: number;
  pts_premissas: number;
  pts_corroboracao: number;
  penalidades: number;
  penalidades_globais_pts: number;
  penalidades_especificas_pts: number;
  score: number;
  faixa: string;
  modelo_api_concorda: boolean;
  linha_sharp_confirma: boolean;
  // "por quê", avisos e contras já vêm prontos do backend (montados a partir dos flags das premissas)
  evidencias: string[];
  avisos: string[];
  contras: string[];        // premissas-chave que NÃO bateram (pontos de atenção)
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

  async getFixtureInjuries(fixtureId: number): Promise<FutebolInjury[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_fixture_injuries', {
        p_fixture_id: fixtureId,
      });
      if (error) throw error;
      return (data || []) as FutebolInjury[];
    });
  },

  async getH2H(homeId: number, awayId: number): Promise<FutebolH2HMeeting[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_h2h', {
        p_home_id: homeId,
        p_away_id: awayId,
      });
      if (error) throw error;
      return (data || []) as FutebolH2HMeeting[];
    });
  },

  async getFixtureExtras(fixtureId: number): Promise<FutebolFixtureExtras> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_fixture_extras', {
        p_fixture_id: fixtureId,
      });
      if (error) throw error;
      return (data || { events: [], player_stats: [], form_home: [], form_away: [], h2h: [], lineups: [], lineup_players: [] }) as FutebolFixtureExtras;
    });
  },

  async getAccess(): Promise<FutebolAccess> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_access');
      if (error) throw error;
      return (data || { state: 'anon', unlocked: false, days_left: null, trial_ends_at: null }) as FutebolAccess;
    });
  },

  async getStandings(competition: Competition, season: number): Promise<FutebolStandingRow[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_standings_official', {
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

  async getTeamSeason(teamId: number, competition: Competition, season: number): Promise<FutebolTeamSeason | null> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_team_season', {
        p_team_id: teamId,
        p_competition: competition,
        p_season: season,
      });
      if (error) throw error;
      return (data && Object.keys(data).length ? data : null) as FutebolTeamSeason | null;
    });
  },

  // Tendências por mercado: reusa as season stats oficiais dos dois times (em
  // paralelo). O modelo Poisson roda no front (utils/futebol-tendencias.ts).
  async getMatchupTendencies(
    homeId: number,
    awayId: number,
    competition: Competition,
    season: number
  ): Promise<FutebolMatchupTendencies> {
    const [home, away] = await Promise.all([
      this.getTeamSeason(homeId, competition, season),
      this.getTeamSeason(awayId, competition, season),
    ]);
    return { home, away };
  },

  async getFixturePrediction(fixtureId: number): Promise<FutebolPrediction | null> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_fixture_prediction', {
        p_fixture_id: fixtureId,
      });
      if (error) throw error;
      const row = (data || [])[0];
      return (row || null) as FutebolPrediction | null;
    });
  },

  async getFixtureOdds(fixtureId: number): Promise<FutebolOddsRow[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_fixture_odds', {
        p_fixture_id: fixtureId,
      });
      if (error) throw error;
      return (data || []) as FutebolOddsRow[];
    });
  },

  async getOddsBoard(): Promise<FutebolOddsBoardRow[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_odds_board');
      if (error) throw error;
      return (data || []) as FutebolOddsBoardRow[];
    });
  },

  async getValueBoard(): Promise<FutebolValueBoardRow[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_value_board');
      if (error) throw error;
      return (data || []) as FutebolValueBoardRow[];
    });
  },

  async getFixtureValue(fixtureId: number): Promise<FutebolFixtureValueRow[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_fixture_value', {
        p_fixture_id: fixtureId,
      });
      if (error) throw error;
      return (data || []) as FutebolFixtureValueRow[];
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
