import type { Game, Player, DailyOpportunity, GamePlayerStats } from '@/services/nba-data.service';

// Dados de EXEMPLO (fictícios) da NBA pro onboarding — usados só durante o tour,
// pra as telas nunca ficarem vazias (ex.: fora de temporada). Nada aqui é real.

const todayISO = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();

// Mês atual em São Paulo (1-12), à prova de fuso.
function saoPauloMonth(): number {
  const m = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', month: '2-digit' })
    .formatToParts(new Date())
    .find((p) => p.type === 'month')?.value;
  return m ? parseInt(m, 10) : 1;
}

// Recesso da NBA: julho, agosto e setembro não têm NENHUM jogo (nem regular,
// nem pré-temporada, nem playoffs) — a temporada recomeça em outubro. Só esses
// 3 meses retornam true, pra nunca mostrar exemplo num dia vago de temporada
// (ex.: All-Star break em fevereiro) — aí o estado vazio honesto é que vale.
// Quem consome combina isto com "o feed real está vazio" antes de exibir demo.
const NBA_OFFSEASON_MONTHS = new Set([7, 8, 9]);
export function isNbaOffSeason(): boolean {
  return NBA_OFFSEASON_MONTHS.has(saoPauloMonth());
}

const game = (over: Partial<Game>): Game => ({
  game_id: 0, game_date: todayISO(), game_datetime_brasilia: `${todayISO()}T21:30:00-03:00`,
  home_team_id: 0, home_team_name: '', home_team_abbreviation: '', home_team_score: null,
  visitor_team_id: 0, visitor_team_name: '', visitor_team_abbreviation: '', visitor_team_score: null,
  winner_team_id: null, loaded_at: nowISO(),
  home_team_is_b2b_game: false, visitor_team_is_b2b_game: false,
  home_team_is_next_game: true, visitor_team_is_next_game: true,
  home_team_last_five: 'WWLWW', visitor_team_last_five: 'LWWLW', ...over,
});

export const demoNbaGames: Game[] = [
  game({ game_id: 5001, home_team_id: 1, home_team_name: 'Los Angeles Lakers', home_team_abbreviation: 'LAL', visitor_team_id: 2, visitor_team_name: 'Golden State Warriors', visitor_team_abbreviation: 'GSW', game_datetime_brasilia: `${todayISO()}T21:30:00-03:00` }),
  game({ game_id: 5002, home_team_id: 3, home_team_name: 'Boston Celtics', home_team_abbreviation: 'BOS', visitor_team_id: 4, visitor_team_name: 'Milwaukee Bucks', visitor_team_abbreviation: 'MIL', visitor_team_is_b2b_game: true, game_datetime_brasilia: `${todayISO()}T22:00:00-03:00` }),
  game({ game_id: 5003, home_team_id: 5, home_team_name: 'Denver Nuggets', home_team_abbreviation: 'DEN', visitor_team_id: 6, visitor_team_name: 'Phoenix Suns', visitor_team_abbreviation: 'PHX', game_datetime_brasilia: `${todayISO()}T23:00:00-03:00` }),
];

const player = (over: Partial<Player>): Player => ({
  player_id: 0, player_name: '', position: 'G', team_id: 0, team_name: '', team_abbreviation: '',
  age: 27, last_game_text: 'Últimos: 24 pts, 6 reb, 5 ast', current_status: 'Active', rating_stars: 4, ...over,
});

export const demoNbaPlayers: Player[] = [
  player({ player_id: 101, player_name: 'LeBron James', position: 'F', team_id: 1, team_name: 'Los Angeles Lakers', team_abbreviation: 'LAL', age: 40, rating_stars: 5 }),
  player({ player_id: 102, player_name: 'Stephen Curry', position: 'G', team_id: 2, team_name: 'Golden State Warriors', team_abbreviation: 'GSW', age: 37, rating_stars: 5 }),
  player({ player_id: 103, player_name: 'Nikola Jokić', position: 'C', team_id: 5, team_name: 'Denver Nuggets', team_abbreviation: 'DEN', age: 30, rating_stars: 5 }),
  player({ player_id: 104, player_name: 'Jayson Tatum', position: 'F', team_id: 3, team_name: 'Boston Celtics', team_abbreviation: 'BOS', age: 27, rating_stars: 5 }),
  player({ player_id: 105, player_name: 'Austin Reaves', position: 'G', team_id: 1, team_name: 'Los Angeles Lakers', team_abbreviation: 'LAL', age: 27, rating_stars: 3 }),
];

const opp = (over: Partial<DailyOpportunity>): DailyOpportunity => ({
  game_id: 5001, game_date: todayISO(), game_time: '21:30',
  home_team_abbr: 'LAL', visitor_team_abbr: 'GSW',
  trigger_player_id: 101, trigger_name: 'LeBron James', trigger_status: 'Out',
  trigger_team_abbr: 'LAL', trigger_team_id: 1, trigger_days_out: 2, trigger_freshness: 'fresh',
  trigger_participation_pct: null, is_b2b: false, fatigue_level: null,
  backup_player_id: 105, backup_player_name: 'Austin Reaves', stat_type: 'PTS',
  avg_com: 16.2, avg_sem: 22.4, stddev_sem: 4.1, cv_sem: 0.18, gap: 6.2, gap_pct: 38,
  jogos_com: 24, jogos_sem: 7, line_value: 19.5, gap_vs_line: 2.9, gap_vs_line_pct: 15,
  signal: 'over', score: 82, score_base: 74, score_label: 'Alta',
  opponent_abbr: 'GSW', opponent_def_rank: 24, opponent_off_rank: 6, is_home: true,
  rating_stars: 4, spread: -3.5, blowout_deflator: 1, ...over,
});

// Estrelas por jogador (id → rating_stars) — usado na Análise 360.
export const demoPlayerStarsMap: Map<number, number> = new Map(
  demoNbaPlayers.map((p) => [p.player_id, p.rating_stars]),
);

// --- Dashboard do jogador (/nba-dashboard/:player) ---
// Jogador em foco no exemplo: LeBron James (id 101).
export const demoDashPlayer: Player = demoNbaPlayers[0];

// Gera as linhas jogo-a-jogo (pontos, rebotes, assistências) pro gráfico e as médias.
const dstat = (
  i: number,
  stat_type: string,
  stat_value: number,
  line: number,
  home: boolean,
  opp: string,
): GamePlayerStats => {
  const d = new Date();
  d.setDate(d.getDate() - (i * 2 + 1));
  return {
    player_id: 101,
    game_date: d.toISOString().slice(0, 10),
    game_id: 6000 + i,
    stat_type,
    stat_value,
    line,
    line_most_recent: line,
    is_b2b_game: false,
    stat_vs_line: stat_value >= line ? 'over' : 'under',
    played_against: opp,
    home_away: home ? 'home' : 'away',
    is_played: 'true',
    player_team_score: null,
    opponent_score: null,
    game_won: stat_value >= line,
    season: 2025,
    season_type: 'regular',
  };
};

const OPPS = ['GSW', 'PHX', 'DEN', 'BOS', 'MIL', 'DAL', 'MIN', 'OKC', 'NYK', 'MIA', 'CLE', 'SAC'];
const PTS = [28, 31, 24, 35, 22, 29, 33, 26, 30, 27, 34, 25];
const REB = [8, 7, 9, 6, 10, 8, 7, 9, 8, 6, 11, 7];
const AST = [9, 11, 8, 12, 7, 10, 9, 13, 8, 10, 9, 11];

export const demoDashGameStats: GamePlayerStats[] = [
  ...PTS.map((v, i) => dstat(i, 'player_points', v, 27.5, i % 2 === 0, OPPS[i])),
  ...REB.map((v, i) => dstat(i, 'player_rebounds', v, 7.5, i % 2 === 0, OPPS[i])),
  ...AST.map((v, i) => dstat(i, 'player_assists', v, 8.5, i % 2 === 0, OPPS[i])),
];

// Oportunidades do dia onde ESTE jogador (LeBron) é o beneficiado (backup).
export const demoDashOpps: DailyOpportunity[] = [
  opp({
    trigger_player_id: 105, trigger_name: 'Austin Reaves', trigger_status: 'Out', trigger_team_abbr: 'LAL', trigger_team_id: 1,
    backup_player_id: 101, backup_player_name: 'LeBron James', stat_type: 'player_points',
    avg_com: 26.4, avg_sem: 31.8, line_value: 28.5, gap_pct: 20, score: 78, score_label: 'Alta', rating_stars: 5,
  }),
  opp({
    trigger_player_id: 105, trigger_name: 'Austin Reaves', trigger_status: 'Out', trigger_team_abbr: 'LAL', trigger_team_id: 1,
    backup_player_id: 101, backup_player_name: 'LeBron James', stat_type: 'player_assists',
    avg_com: 8.1, avg_sem: 10.6, line_value: 9.5, gap_pct: 31, score: 69, score_label: 'Média', rating_stars: 5,
  }),
];

export const demoNbaOpportunities: DailyOpportunity[] = [
  opp({ trigger_player_id: 101, trigger_name: 'LeBron James', backup_player_id: 105, backup_player_name: 'Austin Reaves', stat_type: 'PTS', line_value: 19.5, gap_pct: 38, score: 82, score_label: 'Alta', rating_stars: 5 }),
  opp({ trigger_player_id: 101, trigger_name: 'LeBron James', backup_player_id: 106, backup_player_name: 'Rui Hachimura', stat_type: 'REB', avg_com: 5.1, avg_sem: 7.8, line_value: 6.5, gap_pct: 30, score: 71, score_label: 'Alta', rating_stars: 5 }),
  opp({ game_id: 5003, home_team_abbr: 'DEN', visitor_team_abbr: 'PHX', trigger_player_id: 103, trigger_name: 'Nikola Jokić', trigger_team_abbr: 'DEN', trigger_team_id: 5, trigger_status: 'Questionable', trigger_days_out: 0, backup_player_id: 107, backup_player_name: 'Aaron Gordon', stat_type: 'PTS', line_value: 15.5, gap_pct: 26, score: 63, score_label: 'Média', opponent_abbr: 'PHX', rating_stars: 5 }),
  opp({ game_id: 5002, home_team_abbr: 'BOS', visitor_team_abbr: 'MIL', trigger_player_id: 104, trigger_name: 'Jayson Tatum', trigger_team_abbr: 'BOS', trigger_team_id: 3, trigger_status: 'Out', trigger_days_out: 1, backup_player_id: 108, backup_player_name: 'Jaylen Brown', stat_type: 'PTS', line_value: 26.5, gap_pct: 22, score: 58, score_label: 'Média', opponent_abbr: 'MIL', rating_stars: 5 }),
];
