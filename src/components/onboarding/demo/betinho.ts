// Dados de EXEMPLO (fictícios) do Betinho pro onboarding — usados só durante o
// tour, pra a banca nunca aparecer vazia. Datas relativas a hoje pra passar os
// filtros de período. Nada aqui é real.

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

type Status = 'pending' | 'won' | 'lost' | 'void' | 'cashout' | 'half_won' | 'half_lost';

export interface DemoBet {
  id: string;
  user_id: string;
  bet_type: string;
  sport: string;
  league?: string;
  betting_market?: string;
  match_description?: string;
  bet_description: string;
  odds: number;
  stake_amount: number;
  potential_return: number;
  is_credit_bet?: boolean;
  status: Status;
  bet_date: string;
  match_date?: string;
  created_at: string;
  updated_at: string;
  cashout_amount?: number;
  channel?: string;
  tags?: { id: string; name: string; color?: string }[];
}

const bet = (
  id: number, daysAgo: number, status: Status, sport: string, league: string,
  market: string, desc: string, match: string, stake: number, odds: number,
  tags: string[] = [], cashout?: number,
): DemoBet => ({
  id: `demo-${id}`, user_id: 'demo', bet_type: 'single', sport, league,
  betting_market: market, match_description: match, bet_description: desc,
  odds, stake_amount: stake, potential_return: +(stake * odds).toFixed(2),
  status, bet_date: iso(daysAgo), match_date: iso(daysAgo), created_at: iso(daysAgo), updated_at: iso(daysAgo),
  cashout_amount: cashout, channel: 'telegram',
  tags: tags.map((t, i) => ({ id: `demo-tag-${id}-${i}`, name: t })),
});

export const demoBets: DemoBet[] = [
  bet(1, 1, 'pending', 'Basquete', 'NBA', 'Pontos', 'Luka Dončić +8.5 assistências', 'Lakers x Warriors', 100, 1.9, ['Props']),
  bet(2, 2, 'won', 'Basquete', 'NBA', 'Pontos', 'LeBron James +24.5 pontos', 'Lakers x Warriors', 100, 1.9, ['Props', 'Live']),
  bet(3, 3, 'lost', 'Futebol', 'Brasileirão', 'Gols', 'Mais de 2,5 gols', 'Grêmio x Internacional', 80, 1.95, ['Gols']),
  bet(4, 5, 'won', 'Basquete', 'NBA', 'Cestas de 3', 'Stephen Curry +4.5 cestas de 3', 'Warriors x Suns', 120, 2.1, ['Props']),
  bet(5, 7, 'half_won', 'Futebol', 'Brasileirão', 'Handicap', 'Palmeiras -0.5/-1', 'Palmeiras x Flamengo', 100, 1.85, ['Handicap']),
  bet(6, 9, 'lost', 'Basquete', 'NBA', 'Rebotes', 'Nikola Jokić +11.5 rebotes', 'Nuggets x Wolves', 90, 1.8, ['Props']),
  bet(7, 12, 'cashout', 'Futebol', 'Brasileirão', 'Resultado', 'Flamengo vitória', 'Flamengo x Bahia', 150, 2.0, ['Resultado'], 210),
  bet(8, 15, 'won', 'Basquete', 'NBA', 'Pts+Reb+Ast', 'Giannis +29.5 pontos', 'Bucks x Heat', 100, 1.9, ['Props', 'Live']),
  bet(9, 18, 'won', 'Futebol', 'Brasileirão', 'Ambos marcam', 'Ambos marcam: Sim', 'Grêmio x Bahia', 60, 1.75, ['Gols']),
  bet(10, 22, 'lost', 'Basquete', 'NBA', 'Assistências', 'Jayson Tatum +5.5 assistências', 'Celtics x Knicks', 80, 2.0, ['Props']),
];

export interface DemoMovement {
  id: string;
  user_id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  movement_date: string;
  description: string | null;
  source: 'manual' | 'bankroll_edit';
  affects_balance: boolean;
  created_at: string;
  updated_at: string;
}

export const demoMovements: DemoMovement[] = [
  { id: 'demo-mov-1', user_id: 'demo', type: 'deposit', amount: 1000, movement_date: iso(40), description: 'Banca inicial', source: 'manual', affects_balance: true, created_at: iso(40), updated_at: iso(40) },
  { id: 'demo-mov-2', user_id: 'demo', type: 'deposit', amount: 300, movement_date: iso(14), description: 'Aporte', source: 'manual', affects_balance: true, created_at: iso(14), updated_at: iso(14) },
];
