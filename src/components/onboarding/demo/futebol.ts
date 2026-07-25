import type { FutebolValueBoardRow, FutebolFixture } from '@/services/futebol-data.service';

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
