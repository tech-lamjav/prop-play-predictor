import type { FutebolValueBoardRow, FutebolFixture, FutebolStandingRow, FutebolLeaders, FutebolTeamProfile, FutebolTeamSeason, FutebolFixtureDetail, FutebolFixtureValueRow } from '@/services/futebol-data.service';

// Dados de EXEMPLO (fictícios) pro onboarding guiado — usados só enquanto o tour
// roda, pra a tela nunca ficar vazia. Nada aqui é real. Times/valores ilustrativos.

const base = (over: Partial<FutebolValueBoardRow>): FutebolValueBoardRow => ({
  fixture_id: 0,
  home_team_id: 0,
  away_team_id: 0,
  home_team_name: '',
  away_team_name: '',
  competition: 'brasileirao',
  kickoff_utc: '2025-08-10T21:30:00Z',
  status_short: null,
  market: 'match_winner',
  outcome: 'Home',
  line_value: null,
  edge: 0.05,
  best_odd: 2,
  best_book: 'Bet365',
  avg_odd: 1.95,
  n_casas: 6,
  janela_usada: 't1h',
  prob_justa_fechamento: 0.5,
  pts_valor: 20,
  pts_premissas: 20,
  pts_corroboracao: 15,
  penalidades: 0,
  score: 50,
  faixa: 'Média',
  evidencias: [],
  ...over,
});

// "Melhor por jogo" (é o que a tela de Oportunidades exibe). Mistura de faixas
// pra mostrar a régua (com valor × sem valor).
export const demoFutebolBoard: FutebolValueBoardRow[] = [
  base({
    fixture_id: 9001, home_team_id: 121, away_team_id: 127,
    home_team_name: 'Palmeiras', away_team_name: 'Flamengo',
    market: 'match_winner', outcome: 'Home', best_odd: 2.1, avg_odd: 1.98,
    edge: 0.123, prob_justa_fechamento: 0.52, score: 74, faixa: 'Alta',
    kickoff_utc: '2025-08-10T21:30:00Z',
    evidencias: ['Mandante forte em casa e adversário desfalcado no meio-campo.'],
  }),
  base({
    fixture_id: 9002, home_team_id: 130, away_team_id: 119,
    home_team_name: 'Grêmio', away_team_name: 'Internacional',
    market: 'goals_over_under', outcome: 'Over', line_value: 2.5, best_odd: 1.95, avg_odd: 1.88,
    edge: 0.081, prob_justa_fechamento: 0.55, score: 63, faixa: 'Alta',
    kickoff_utc: '2025-08-10T23:00:00Z',
    evidencias: ['Clássico historicamente aberto, com médias altas de gols dos dois lados.'],
  }),
  base({
    fixture_id: 9003, home_team_id: 126, away_team_id: 131,
    home_team_name: 'São Paulo', away_team_name: 'Corinthians',
    market: 'match_winner', outcome: 'Draw', best_odd: 3.25, avg_odd: 3.1,
    edge: 0.056, prob_justa_fechamento: 0.32, score: 51, faixa: 'Média',
    kickoff_utc: '2025-08-10T18:30:00Z',
    evidencias: ['Equilíbrio no retrospecto recente e defesas sólidas.'],
  }),
  base({
    fixture_id: 9004, home_team_id: 120, away_team_id: 124,
    home_team_name: 'Botafogo', away_team_name: 'Fluminense',
    market: 'goals_over_under', outcome: 'Under', line_value: 2.5, best_odd: 1.88, avg_odd: 1.8,
    edge: 0.031, prob_justa_fechamento: 0.54, score: 43, faixa: 'Média',
    kickoff_utc: '2025-08-11T00:00:00Z',
    evidencias: ['Dois times de posse e poucos gols nos últimos confrontos.'],
  }),
  base({
    fixture_id: 9005, home_team_id: 135, away_team_id: 118,
    home_team_name: 'Cruzeiro', away_team_name: 'Bahia',
    market: 'match_winner', outcome: 'Home', best_odd: 1.72, avg_odd: 1.7,
    edge: -0.008, prob_justa_fechamento: 0.6, score: 34, faixa: 'Baixa',
    kickoff_utc: '2025-08-10T19:00:00Z',
    evidencias: [],
  }),
];

// Jogos de exemplo (agenda) — mesmos fixture_ids do board pra casar a etiqueta
// de faixa na grade. Usados no hub /futebol e na lista /futebol/jogos.
const fx = (over: Partial<FutebolFixture>): FutebolFixture => ({
  fixture_id: 0, round: 'Regular Season - 20', kickoff_utc: '2025-08-10T21:30:00Z',
  date_utc: '2025-08-10', status_short: 'NS', status_long: 'Not Started',
  home_team_id: 0, home_team_name: '', home_team_logo: null,
  away_team_id: 0, away_team_name: '', away_team_logo: null,
  goals_home: null, goals_away: null, ...over,
});

export const demoFutebolFixtures: FutebolFixture[] = [
  fx({ fixture_id: 9001, home_team_id: 121, away_team_id: 127, home_team_name: 'Palmeiras', away_team_name: 'Flamengo', kickoff_utc: '2025-08-10T21:30:00Z' }),
  fx({ fixture_id: 9002, home_team_id: 130, away_team_id: 119, home_team_name: 'Grêmio', away_team_name: 'Internacional', kickoff_utc: '2025-08-10T23:00:00Z' }),
  fx({ fixture_id: 9003, home_team_id: 126, away_team_id: 131, home_team_name: 'São Paulo', away_team_name: 'Corinthians', kickoff_utc: '2025-08-10T18:30:00Z' }),
  fx({ fixture_id: 9004, home_team_id: 120, away_team_id: 124, home_team_name: 'Botafogo', away_team_name: 'Fluminense', kickoff_utc: '2025-08-11T00:00:00Z' }),
  fx({ fixture_id: 9005, home_team_id: 135, away_team_id: 118, home_team_name: 'Cruzeiro', away_team_name: 'Bahia', kickoff_utc: '2025-08-10T19:00:00Z' }),
];

// Classificação de exemplo (topo da tabela) — usada em /futebol/jogos e /futebol/time.
const st = (
  rank: number, team_id: number, team_name: string, points: number,
  wins: number, draws: number, loses: number, gf: number, ga: number, zone: string | null,
): FutebolStandingRow => ({
  team_id, team_name, rank, points, played: wins + draws + loses,
  wins, draws, loses, goals_for: gf, goals_against: ga, goals_diff: gf - ga,
  rank_description: zone,
});

export const demoFutebolStandings: FutebolStandingRow[] = [
  st(1, 121, 'Palmeiras', 44, 13, 5, 1, 34, 15, 'Promotion - Libertadores Group Stage'),
  st(2, 127, 'Flamengo', 41, 12, 5, 2, 32, 18, 'Promotion - Libertadores Group Stage'),
  st(3, 135, 'Cruzeiro', 38, 11, 5, 3, 28, 16, 'Promotion - Libertadores Group Stage'),
  st(4, 120, 'Botafogo', 35, 10, 5, 4, 26, 20, 'Promotion - Libertadores Group Stage'),
  st(5, 119, 'Internacional', 33, 9, 6, 4, 24, 19, 'Promotion - Copa Sudamericana'),
  st(6, 126, 'São Paulo', 31, 9, 4, 6, 22, 20, null),
  st(7, 130, 'Grêmio', 29, 8, 5, 6, 25, 23, null),
  st(8, 118, 'Bahia', 27, 7, 6, 6, 20, 21, null),
  st(9, 131, 'Corinthians', 25, 7, 4, 8, 19, 24, null),
];

// Perfil de time de exemplo (/futebol/time) — Palmeiras (id 121).
export const demoTeamProfile: FutebolTeamProfile = {
  team: { team_id: 121, team_name: 'Palmeiras', team_logo: null },
  results: [
    { scope: 'geral', games: 19, wins: 13, draws: 5, losses: 1, avg_gf: 1.8, avg_ga: 0.8, over25_pct: 47, btts_pct: 42 },
    { scope: 'casa', games: 10, wins: 8, draws: 2, losses: 0, avg_gf: 2.1, avg_ga: 0.6, over25_pct: 55, btts_pct: 40 },
    { scope: 'fora', games: 9, wins: 5, draws: 3, losses: 1, avg_gf: 1.4, avg_ga: 1.0, over25_pct: 40, btts_pct: 44 },
  ],
  stats_avg: [
    { scope: 'geral', games: 19, avg_possession: 55, avg_shots: 14.2, avg_shots_on_goal: 5.1, avg_corners: 6.2, avg_yellow: 1.8, avg_xg: 1.7, avg_xg_against: 0.9 },
    { scope: 'casa', games: 10, avg_possession: 58, avg_shots: 16.0, avg_shots_on_goal: 6.0, avg_corners: 7.0, avg_yellow: 1.6, avg_xg: 2.0, avg_xg_against: 0.7 },
    { scope: 'fora', games: 9, avg_possession: 52, avg_shots: 12.1, avg_shots_on_goal: 4.2, avg_corners: 5.4, avg_yellow: 2.0, avg_xg: 1.4, avg_xg_against: 1.1 },
  ],
};

export const demoTeamSeason: FutebolTeamSeason = {
  form: 'LDWWWW',
  played_total: 19, played_home: 10, played_away: 9,
  wins_total: 13, wins_home: 8, wins_away: 5,
  draws_total: 5, draws_home: 2, draws_away: 3,
  loses_total: 1, loses_home: 0, loses_away: 1,
  goals_for_avg_total: 1.8, goals_for_avg_home: 2.1, goals_for_avg_away: 1.4,
  goals_against_avg_total: 0.8, goals_against_avg_home: 0.6, goals_against_avg_away: 1.0,
  clean_sheet_total: 9, clean_sheet_home: 6, clean_sheet_away: 3,
  failed_to_score_total: 2,
  biggest_streak_wins: 6, biggest_streak_loses: 1,
  penalty_total: 4, penalty_scored_pct: 75,
};

// Últimos jogos (encerrados) do time — pra "Últimos resultados".
export const demoTeamFixtures: FutebolFixture[] = [
  fx({ fixture_id: 8901, home_team_id: 121, away_team_id: 131, home_team_name: 'Palmeiras', away_team_name: 'Corinthians', status_short: 'FT', status_long: 'Match Finished', goals_home: 2, goals_away: 0, kickoff_utc: '2025-07-27T21:30:00Z', date_utc: '2025-07-27' }),
  fx({ fixture_id: 8902, home_team_id: 124, away_team_id: 121, home_team_name: 'Fluminense', away_team_name: 'Palmeiras', status_short: 'FT', status_long: 'Match Finished', goals_home: 1, goals_away: 2, kickoff_utc: '2025-07-23T23:00:00Z', date_utc: '2025-07-23' }),
  fx({ fixture_id: 8903, home_team_id: 121, away_team_id: 118, home_team_name: 'Palmeiras', away_team_name: 'Bahia', status_short: 'FT', status_long: 'Match Finished', goals_home: 3, goals_away: 1, kickoff_utc: '2025-07-19T19:00:00Z', date_utc: '2025-07-19' }),
  fx({ fixture_id: 8904, home_team_id: 130, away_team_id: 121, home_team_name: 'Grêmio', away_team_name: 'Palmeiras', status_short: 'FT', status_long: 'Match Finished', goals_home: 1, goals_away: 1, kickoff_utc: '2025-07-15T23:30:00Z', date_utc: '2025-07-15' }),
  fx({ fixture_id: 8905, home_team_id: 121, away_team_id: 127, home_team_name: 'Palmeiras', away_team_name: 'Flamengo', status_short: 'FT', status_long: 'Match Finished', goals_home: 0, goals_away: 1, kickoff_utc: '2025-07-10T21:30:00Z', date_utc: '2025-07-10' }),
  fx({ fixture_id: 8906, home_team_id: 119, away_team_id: 121, home_team_name: 'Internacional', away_team_name: 'Palmeiras', status_short: 'FT', status_long: 'Match Finished', goals_home: 0, goals_away: 2, kickoff_utc: '2025-07-06T20:00:00Z', date_utc: '2025-07-06' }),
];

// Temporada do visitante (pro modelo de gols do detalhe do jogo).
export const demoAwaySeason: FutebolTeamSeason = {
  form: 'WLWDW',
  played_total: 19, played_home: 9, played_away: 10,
  wins_total: 12, wins_home: 7, wins_away: 5,
  draws_total: 5, draws_home: 2, draws_away: 3,
  loses_total: 2, loses_home: 0, loses_away: 2,
  goals_for_avg_total: 1.7, goals_for_avg_home: 2.0, goals_for_avg_away: 1.4,
  goals_against_avg_total: 0.9, goals_against_avg_home: 0.7, goals_against_avg_away: 1.1,
  clean_sheet_total: 8, clean_sheet_home: 5, clean_sheet_away: 3,
  failed_to_score_total: 3,
  biggest_streak_wins: 5, biggest_streak_loses: 1,
  penalty_total: 3, penalty_scored_pct: 67,
};

// Detalhe do jogo de exemplo (/futebol/jogo/:id) — Palmeiras x Flamengo.
export const demoFixtureDetail: FutebolFixtureDetail = {
  fixture: {
    ...fx({ fixture_id: 9001, home_team_id: 121, away_team_id: 127, home_team_name: 'Palmeiras', away_team_name: 'Flamengo', kickoff_utc: '2025-08-10T21:30:00Z', date_utc: '2025-08-10' }),
    competition: 'brasileirao', season: 2026, status_elapsed: null,
    venue_name: 'Allianz Parque', venue_city: 'São Paulo',
    score_halftime_home: null, score_halftime_away: null,
  },
  stats: [],
};

// Oportunidades do jogo (WhatToWatch + Explorar mercados).
const vr = (over: Partial<FutebolFixtureValueRow>): FutebolFixtureValueRow => ({
  market: 'match_winner', outcome: 'Home', outcome_order: 1, line_value: null,
  edge: 0.05, best_odd: 2, best_book: 'Bet365', avg_odd: 1.95, n_casas: 6, janela_usada: 't1h',
  prob_justa_fechamento: 0.5, pts_valor: 20, pts_premissas: 20, pts_corroboracao: 15,
  penalidades: 0, penalidades_globais_pts: 0, penalidades_especificas_pts: 0,
  score: 50, faixa: 'Média', modelo_api_concorda: true, linha_sharp_confirma: true,
  evidencias: [], avisos: [], contras: [], ...over,
});

export const demoFixtureValueRows: FutebolFixtureValueRow[] = [
  vr({
    market: 'match_winner', outcome: 'Home', outcome_order: 1, best_odd: 2.10, avg_odd: 1.98,
    edge: 0.123, prob_justa_fechamento: 0.52, score: 74, faixa: 'Alta',
    evidencias: [
      'Mandante forte em casa (8V em 10 jogos) e melhor ataque do returno.',
      'Adversário sem o titular do meio-campo, criando menos.',
      'Odd acima da linha justa nas principais casas.',
    ],
    contras: ['Visitante vem de vitória fora e não sofre gols há 3 jogos.'],
    avisos: [],
  }),
  vr({ market: 'match_winner', outcome: 'Draw', outcome_order: 2, best_odd: 3.30, avg_odd: 3.2, edge: 0.02, prob_justa_fechamento: 0.28, score: 46, faixa: 'Média' }),
  vr({ market: 'match_winner', outcome: 'Away', outcome_order: 3, best_odd: 3.60, avg_odd: 3.5, edge: -0.03, prob_justa_fechamento: 0.24, score: 33, faixa: 'Baixa' }),
  vr({ market: 'goals_over_under', outcome: 'Over', outcome_order: 1, line_value: 2.5, best_odd: 1.95, avg_odd: 1.9, edge: 0.06, prob_justa_fechamento: 0.55, score: 58, faixa: 'Média' }),
  vr({ market: 'goals_over_under', outcome: 'Under', outcome_order: 2, line_value: 2.5, best_odd: 1.90, avg_odd: 1.85, edge: -0.01, prob_justa_fechamento: 0.45, score: 39, faixa: 'Baixa' }),
];

// Artilheiros de exemplo.
export const demoFutebolLeaders: FutebolLeaders = {
  scorers: [
    { player_id: 1001, player_name: 'Pedro', team_name: 'Flamengo', goals: 12 },
    { player_id: 1002, player_name: 'Flaco López', team_name: 'Palmeiras', goals: 11 },
    { player_id: 1003, player_name: 'Calleri', team_name: 'São Paulo', goals: 10 },
    { player_id: 1004, player_name: 'Yuri Alberto', team_name: 'Corinthians', goals: 9 },
    { player_id: 1005, player_name: 'Everton Cebolinha', team_name: 'Grêmio', goals: 8 },
  ],
  cards: [],
};
