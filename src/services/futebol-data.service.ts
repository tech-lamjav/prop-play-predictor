import { supabase } from '@/integrations/supabase/client';
import {
  normalizeFutebolFixtureValueRows,
  normalizeFutebolValueBoardRows,
  type FutebolScoreVersion,
} from './futebol-score-contract';
import { filtrarMercadosOcultos, VITRINE_FALLBACK } from '@/utils/futebol-mercados-ocultos';

// A vitrine muda por UPDATE no banco, não por release, então a lista não pode
// ser lida uma vez e congelada pela vida da aba. Cinco minutos é curto o
// bastante para devolver um mercado sem pedir refresh, e longo o bastante para
// não somar uma chamada a cada carga do board.
const MERCADOS_OCULTOS_TTL_MS = 5 * 60 * 1000;
let mercadosOcultosCache: { valor: string[]; expiraEm: number } | null = null;

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

// Slug da competição. String livre (data-driven) — o backend é a fonte de verdade
// (futebol.fact_fixtures.competition). Rótulos/ordem ficam em utils/futebol-competitions.
export type Competition = string;

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

/**
 * Linha da agenda por dia (RPC get_futebol_fixtures_by_day, migration 092).
 * Traz `competition` e `season` que o get_futebol_fixtures não devolve: numa lista
 * de uma liga só o front já sabia qual era, numa lista multi-liga não, e o link do
 * time é /futebol/time/:id?c=&s=. O `day_brt` vem calculado no banco pelo
 * public.futebol_dia_brt, então o front não precisa reimplementar a virada de dia.
 */
export interface FutebolFixtureByDay extends FutebolFixture {
  competition: string;
  season: number;
  day_brt: string;
}

/**
 * Um candidato (mercado + saída + linha) com as premissas acesas e apagadas.
 * RPC get_futebol_fixture_premissas, migration 093.
 *
 * Dois estados só: as tabelas int_* não têm NULL, então premissa sem dado hoje é
 * indistinguível de premissa apagada. É o T3 da recalibragem; quando ele entrar,
 * entra um terceiro array aqui.
 */
export interface FutebolFixturePremissas {
  market: string;
  outcome: string;
  line_value: number | null;
  pts_premissas: number;
  penalidades_pts: number;
  acesas: string[];
  apagadas: string[];
  penalidades: string[];
}

/** Um motivo do contrato de leitura: o banco define o grupo e o front apenas o exibe. */
export interface FutebolFixtureReasonItem {
  id: string;
  tipo: 'premissa' | 'componente_score' | 'penalidade';
  texto?: string;
  pontos?: number;
}

/**
 * Desde quando cada saída está publicada, por oportunidade
 * (RPC get_futebol_fixture_disponivel_desde, issue #300).
 *
 * É o início da disponibilidade CONTÍNUA ATUAL: uma rejeição seguida de
 * reativação reinicia o relógio. Vem `null` quando a chave já existia antes de
 * o snapshot estrear, porque ali o horário dataria a estreia e não a
 * publicação — melhor vazio que inventado.
 */
export interface FutebolFixtureDisponibilidade {
  market: string;
  outcome: string;
  line_value: number | null;
  disponivel_desde: string | null;
}

/**
 * Motivos de qualquer saída cotada da Bancada (RPC get_futebol_fixture_reason_contract).
 * A separação favor/contra é autoridade do backend; não derive o lado pelo slug.
 *
 * `componentes_score` saiu no contrato de contexto (spec #301): o Score deixou
 * de ser uma soma de partes exibível, então a RPC não devolve mais a
 * decomposição. Campo extra numa resposta antiga é inofensivo em runtime, então
 * o tipo pode andar na frente da virada.
 */
export interface FutebolFixtureReasonContractRow {
  market: string;
  outcome: string;
  line_value: number | null;
  score: number;
  favor: FutebolFixtureReasonItem[];
  contra: FutebolFixtureReasonItem[];
}

/**
 * Números de temporada de um lado do confronto (RPC get_futebol_fixture_numeros).
 * Serve para EMBASAR as premissas: sem o número, "em boa fase" é adjetivo.
 * `ate` é o snapshot_date, para a tela declarar a data do dado.
 */
export interface FutebolFixtureNumeros {
  side: 'home' | 'away';
  team_id: number;
  team_name: string;
  posicao: number | null;
  pontos: number | null;
  zona: string | null;
  jogos: number | null;
  jogos_casa: number | null;
  jogos_fora: number | null;
  v_casa: number | null;
  e_casa: number | null;
  d_casa: number | null;
  v_fora: number | null;
  e_fora: number | null;
  d_fora: number | null;
  gf_casa: number | null;
  ga_casa: number | null;
  gf_fora: number | null;
  ga_fora: number | null;
  gf_total: number | null;
  ga_total: number | null;
  clean_sheets: number | null;
  sem_marcar: number | null;
  forma: string | null;
  h2h_jogos: number | null;
  h2h_vitorias: number | null;
  h2h_empates: number | null;
  ate: string | null;
}

/**
 * Um jogo passado de um dos times, na competição e temporada do confronto (RPC 095).
 * É o que permite auditar a média: filtrada pelo mando certo, a média destas linhas
 * reproduz o mesmo número que a premissa usa (medido: Palmeiras em casa, 10 jogos,
 * 0,80 gol sofrido, igual ao ga_casa da 094).
 */
export interface FutebolFixtureHistorico {
  side: 'home' | 'away';
  team_id: number;
  team_name: string;
  past_fixture_id: number;
  data: string;
  ordem: number;
  em_casa: boolean;
  adversario: string;
  /** Para o escudo do adversário embaixo da barra. */
  adversario_id: number;
  gols_pro: number;
  gols_contra: number;
  total_gols: number;
  ambos_marcaram: boolean;
  sem_sofrer: boolean;
  sem_marcar: boolean;
  /** Gols esperados do time no jogo. Null onde a API não entregou (9% dos jogos). */
  xg: number | null;
  xg_contra: number | null;
  resultado: 'V' | 'E' | 'D';
}

/** Um dia com jogo, pra régua de datas (RPC get_futebol_fixture_days). */
export interface FutebolFixtureDay {
  day_brt: string;
  jogos: number;
  ligas: number;
}

/** Competição + temporada que existe de fato no mart (RPC get_futebol_competitions). */
export interface FutebolCompetitionInfo {
  competition: string;
  season: number;
  jogos: number;
  primeiro: string | null;
  ultimo: string | null;
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
  /**
   * 'confirmed' = escalação anunciada antes do apito · 'real' = registro de
   * quem entrou em campo, montado depois do jogo. A RPC devolve UMA fase por
   * jogo, nunca as duas. Ver `futebol-escalacao.ts`.
   */
  lineup_phase: string | null;
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
  /** Mesma fase de `FutebolLineup`. Ver `futebol-escalacao.ts`. */
  lineup_phase: string | null;
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
  /** Grupo da fase de grupos ('Group A'…). Em pontos corridos vem o nome da liga,
   *  que é como a API marca quem não tem grupo. Ver migration 096. */
  group_name: string | null;
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
  /** Mediana discreta das odds observadas na janela usada pela consulta. */
  reference_odd: number | null;
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
  score_versao: FutebolScoreVersion;
  pts_valor: number;
  pts_premissas: number;
  pts_corroboracao: number;
  penalidades: number;
  score: number;           // 0..100
  faixa: string;           // 'Alta' | 'Média' | 'Baixa'
  evidencias: string[];    // "por quê" (montado no backend); usar a 1ª na lista
  /**
   * Quantas checagens ficaram sem resposta por falta de dado. NÃO desconta
   * nota (ADR 0003: dado faltante diagnostica, não penaliza). Ver
   * `futebol-sem-dado.ts` — nunca renderizar como penalidade.
   */
  premissas_sem_dado: number | null;
}

// ── O que foi ALERTADO no Telegram (public.daily_opportunity_picks, ver 091) ──
// Fonte separada do board de propósito: o mart é full-refresh e re-escolhe a
// janela de odds, então o pick que saiu às 10h pode não estar mais lá à noite.
// Isto é o registro do que a pessoa recebeu, não do que fechou.
export interface FutebolAlertedPick {
  game_day: string;           // YYYY-MM-DD (dia do jogo, BRT)
  fixture_id: number;
  market: string | null;      // null nas linhas antigas sem pick estruturado
  outcome: string | null;
  line_value: number | null;
  bet_description: string;    // rótulo exatamente como foi enviado
  betting_market: string | null;
  league: string | null;      // slug da competição (mesmo do board)
  match_description: string;  // "Coritiba × Palmeiras" (fallback de nome)
  odds: number;               // odd do momento do envio
  janela_usada: string | null;
  // Números do instante do envio. Vêm null nas enviadas antes da migration 091:
  // o pipeline sobrescreve a janela e destrói chance/valor/Score da manhã, então
  // não há de onde recuperar — a tela mostra "—" nesses casos.
  score: number | null;
  faixa: string | null;
  edge: number | null;
  prob_justa_fechamento: number | null;
  sent_at: string;
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
  score_versao: FutebolScoreVersion;
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
  /**
   * Quantas checagens ficaram sem resposta por falta de dado.
   *
   * ⚠️ NÃO juntar com `contras` nem com `avisos`. `contras` são premissas que
   * FORAM avaliadas e não bateram; esta é o contrário — nem deu para avaliar.
   * E `avisos` carregam desconto de pontos, que este não tem.
   * Ver `futebol-sem-dado.ts`.
   */
  premissas_sem_dado: number | null;
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

  /**
   * Jogos de UM dia (fuso BRT) em todas as ligas. Uma chamada no lugar das N do
   * useFutebolFixturesMulti (uma por liga, temporada inteira): o pior dia do mart
   * são 33 jogos em 16 KB, contra ~850 KB das 8 chamadas antigas.
   */
  async getFixturesByDay(day: string, competitions?: string[] | null): Promise<FutebolFixtureByDay[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_fixtures_by_day', {
        p_day: day,
        p_competitions: competitions ?? null,
      });
      if (error) throw error;
      return (data || []) as FutebolFixtureByDay[];
    });
  },

  /** Dias com jogo num intervalo, com contagem. Alimenta a régua de datas sem baixar jogo. */
  async getFixtureDays(from: string, to: string): Promise<FutebolFixtureDay[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_fixture_days', {
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return (data || []) as FutebolFixtureDay[];
    });
  },

  /**
   * Competições e temporadas presentes no mart. Fonte de verdade do que existe, no
   * lugar das listas fixas do front (que escondiam a champions_league e as
   * temporadas 2025 de La Liga, Premier, Libertadores e Sul-Americana).
   */
  async getCompetitions(): Promise<FutebolCompetitionInfo[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_competitions');
      if (error) throw error;
      return (data || []) as FutebolCompetitionInfo[];
    });
  },

  /**
   * Mapa de premissas do jogo nos 5 mercados. Funciona onde o preço não existe:
   * as premissas cobrem os 6.597 jogos do mart (1.177 futuros), enquanto odd só
   * aparece a partir de T−24h.
   */
  async getFixturePremissas(fixtureId: number): Promise<FutebolFixturePremissas[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_fixture_premissas', {
        p_fixture_id: fixtureId,
      });
      if (error) throw error;
      return (data || []) as FutebolFixturePremissas[];
    });
  },

  /** Contrato de motivos da saída cotada nos cinco mercados (migration 109). */
  async getFixtureReasonContract(fixtureId: number): Promise<FutebolFixtureReasonContractRow[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_fixture_reason_contract', {
        p_fixture_id: fixtureId,
      });
      if (error) throw error;
      return (data || []) as FutebolFixtureReasonContractRow[];
    });
  },

  /** Desde quando cada saída está publicada (issue #300). */
  async getFixtureDisponibilidade(fixtureId: number): Promise<FutebolFixtureDisponibilidade[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_fixture_disponivel_desde', {
        p_fixture_id: fixtureId,
      });
      if (error) throw error;
      return (data || []) as FutebolFixtureDisponibilidade[];
    });
  },

  /** Números que embasam as premissas (campanha casa/fora, gols por jogo, forma, tabela). */
  async getFixtureNumeros(fixtureId: number): Promise<FutebolFixtureNumeros[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_fixture_numeros', {
        p_fixture_id: fixtureId,
      });
      if (error) throw error;
      return (data || []) as FutebolFixtureNumeros[];
    });
  },

  /** Jogo a jogo dos dois times, para auditar a média de cada premissa. */
  /**
   * O jogo a jogo dos dois times na **janela da premissa** (#350).
   *
   * O padrão são 10 por lado porque é a janela mais larga que o modelo usa: as
   * médias de gols e xG olham 10, e os critérios de contagem olham menos e
   * recortam do começo desta lista. Pedir 40, como antes, encheria o gráfico com
   * jogos que não entram em critério nenhum.
   */
  async getFixtureHistorico(fixtureId: number, max = 10): Promise<FutebolFixtureHistorico[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_fixture_historico', {
        p_fixture_id: fixtureId,
        p_max: max,
      });
      if (error) throw error;
      return (data || []) as FutebolFixtureHistorico[];
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
      const { data, error } = await supabaseClient.rpc('get_futebol_fixture_quotes', {
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

  /**
   * Os mercados que estão fora da VITRINE — não fora do board.
   *
   * A lista vem do banco (migration 116) e não de constante, porque devolver um
   * mercado à tela tem de ser um UPDATE e não um release, e porque o Telegram
   * roda em outro runtime e precisa ler a MESMA fonte.
   *
   * ⚠️ Falha em silêncio, de propósito. O `withRetry` trata "função não existe"
   * como erro definitivo, então um front publicado antes da migration mataria o
   * board inteiro por causa de uma leitura de configuração. Sem a lista o
   * comportamento é o de hoje — nada escondido —, que é degradação e não
   * regressão. Ver prop-play-predictor#324.
   */
  async getMercadosOcultos(): Promise<string[]> {
    const agora = Date.now();
    if (mercadosOcultosCache && agora < mercadosOcultosCache.expiraEm) {
      return mercadosOcultosCache.valor;
    }
    try {
      const { data, error } = await supabaseClient.rpc('get_futebol_mercados_ocultos');
      if (error) throw error;
      const valor = (data || []) as string[];
      mercadosOcultosCache = { valor, expiraEm: agora + MERCADOS_OCULTOS_TTL_MS };
      return valor;
    } catch {
      // No escuro vale o último valor bom; sem ele, o fallback. Cair para lista
      // vazia mostraria na tela o que o produto tirou da prateleira, e a janela
      // realista de escuro é justamente a de antes da migration — quando
      // esconder já é o comportamento decidido.
      return mercadosOcultosCache?.valor ?? [...VITRINE_FALLBACK];
    }
  },

  async getValueBoard(): Promise<FutebolValueBoardRow[]> {
    return withRetry(async () => {
      const [{ data, error }, ocultos] = await Promise.all([
        supabaseClient.rpc('get_futebol_value_board'),
        this.getMercadosOcultos(),
      ]);
      if (error) throw error;
      return filtrarMercadosOcultos(normalizeFutebolValueBoardRows(data || []), ocultos);
    });
  },

  /**
   * O board de um período JÁ PASSADO, na versão que estava viva NO APITO.
   *
   * Não é o mesmo dado que `getValueBoard` filtrado por data, e a diferença é o
   * ponto inteiro desta função. O board é reconstruído do zero a cada execução e
   * não expurga jogo encerrado, então a linha de um jogo de junho continua sendo
   * reavaliada com o dado de hoje. Medido em produção: 97% das versões do
   * histórico nasceram DEPOIS do apito, em média 668 horas depois.
   *
   * Ou seja, ler o passado pelo board mostra a nota recalculada semanas depois,
   * e não a que foi publicada. Isto aqui lê a foto do apito. Ver migration 101 e
   * a ADR 0009 do `analytics-engineering`.
   *
   * Devolve o MESMO tipo do board de propósito: as duas RPCs têm as mesmas
   * colunas na mesma ordem, então a tela não precisa saber de onde veio a linha.
   *
   * Datas em `YYYY-MM-DD`, dia BRT, inclusivas nas duas pontas.
   *
   * ⚠️ NÃO aplica `filtrarMercadosOcultos`, e isso é decisão, não esquecimento.
   * O histórico é o registro do que foi PUBLICADO e visto: até o Handicap sair
   * da vitrine ele apareceu na tela, e o assinante pode ter apostado nele.
   * Escondê-lo aqui reescreveria o passado dele e mudaria a performance exibida.
   * Ver prop-play-predictor#324.
   */
  async getValueHistory(from: string, to: string): Promise<FutebolValueBoardRow[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_value_history', {
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return normalizeFutebolValueBoardRows(data || []);
    });
  },

  /**
   * O que foi ALERTADO no Telegram nos últimos 90 dias (dia do jogo, BRT).
   * Sem dia = todos, porque o front precisa saber QUAIS dias tiveram alerta pra
   * montar o seletor de dias (o mart não guarda dia antigo). São poucas linhas.
   * Ver migration 091.
   */
  async getAlertedPicks(day?: string): Promise<FutebolAlertedPick[]> {
    return withRetry(async () => {
      const { data, error } = await supabaseClient.rpc('get_futebol_alerted_picks', {
        p_day: day ?? null,
      });
      if (error) throw error;
      return (data || []) as FutebolAlertedPick[];
    });
  },

  async getFixtureValue(fixtureId: number): Promise<FutebolFixtureValueRow[]> {
    return withRetry(async () => {
      const [{ data, error }, ocultos] = await Promise.all([
        supabaseClient.rpc('get_futebol_fixture_value', { p_fixture_id: fixtureId }),
        this.getMercadosOcultos(),
      ]);
      if (error) throw error;
      return filtrarMercadosOcultos(normalizeFutebolFixtureValueRows(data || []), ocultos);
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
