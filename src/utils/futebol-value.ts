// ============================================================
// futebol-value.ts — valor (edge) a partir das odds reais do mercado
// ============================================================
// O coração do value bet. Para cada mercado de partição limpa (Resultado,
// Over/Under 2,5, Ambos marcam), estima a PROBABILIDADE JUSTA removendo a margem
// (devig) da linha sharp da Pinnacle — ou, quando a Pinnacle não cobre o mercado,
// do consenso das casas. Compara a MELHOR odd disponível entre as casas com essa
// prob. justa → edge (+EV) = melhor_odd × prob_justa − 1.
//
// Metodologia reconhecida: a linha devigada da Pinnacle é referência de "preço
// justo" no mercado. Se uma casa paga acima disso, é valor. NÃO é o nosso modelo
// (Poisson) — é o mercado contra o mercado. Dupla Chance fica de fora (outcomes
// se sobrepõem, devig por normalização não vale).
// ============================================================

export interface FutebolOddsRow {
  market_key: 'match_winner' | 'over_under_25' | 'btts' | 'double_chance';
  market_label: string;
  outcome_label: string;
  outcome_order: number;
  pinnacle_odd: number | null;
  avg_odd: number | null;
  best_odd: number;
  best_book: string;
  n_books: number;
  pin_open: number | null;
  pin_close: number | null;
}

export type ValueTier = 'value' | 'slight' | 'fair' | 'low';

export interface ValueOutcome {
  marketKey: string;
  marketLabel: string;
  outcomeKey: string;
  outcomeLabel: string;
  fairProb: number;   // 0..1
  bestOdd: number;
  bestBook: string;
  nBooks: number;
  edge: number;       // bestOdd × fairProb − 1
  tier: ValueTier;
  anchor: 'pinnacle' | 'consensus';
  moveDir: 'up' | 'down' | null; // movimento da Pinnacle t24h → t1h
}

export interface ValueMarket {
  key: string;
  label: string;
  anchor: 'pinnacle' | 'consensus';
  margin: number; // vig da linha-âncora (sum implícitas − 1)
  outcomes: ValueOutcome[];
}

export interface FixtureValue {
  markets: ValueMarket[];
  best: ValueOutcome | null; // maior edge do jogo
}

const MARKET_LABEL: Record<string, string> = {
  match_winner: 'Resultado',
  over_under_25: 'Mais/Menos 2,5 gols',
  btts: 'Ambos marcam',
};
// mercados de partição limpa (somam 100%) — onde o devig por normalização é válido
const VALUE_MARKETS = ['match_winner', 'over_under_25', 'btts'];

function outcomePt(key: string, homeName: string, awayName: string): string {
  switch (key) {
    case 'Home': return homeName;
    case 'Away': return awayName;
    case 'Draw': return 'Empate';
    case 'Over 2.5': return 'Mais de 2,5';
    case 'Under 2.5': return 'Menos de 2,5';
    case 'Yes': return 'Sim';
    case 'No': return 'Não';
    default: return key;
  }
}

function tierOf(edge: number): ValueTier {
  if (edge >= 0.015) return 'value';
  if (edge >= 0) return 'slight';
  if (edge >= -0.015) return 'fair';
  return 'low';
}

export function computeFixtureValue(
  rows: FutebolOddsRow[],
  homeName: string,
  awayName: string
): FixtureValue {
  const markets: ValueMarket[] = [];

  for (const key of VALUE_MARKETS) {
    const group = rows.filter((r) => r.market_key === key).sort((a, b) => a.outcome_order - b.outcome_order);
    if (group.length < 2) continue;

    // âncora: Pinnacle se cobre todos os outcomes; senão consenso (média das casas)
    const hasPinAll = group.every((r) => r.pinnacle_odd != null && r.pinnacle_odd > 1);
    const anchor: 'pinnacle' | 'consensus' = hasPinAll ? 'pinnacle' : 'consensus';
    const anchorOdd = (r: FutebolOddsRow) => (anchor === 'pinnacle' ? r.pinnacle_odd : r.avg_odd) ?? null;

    const implied = group.map((r) => {
      const o = anchorOdd(r);
      return o && o > 1 ? 1 / o : null;
    });
    if (implied.some((p) => p == null)) continue;
    const sum = implied.reduce((s, p) => s + (p as number), 0);
    if (sum <= 0) continue;

    const outcomes: ValueOutcome[] = group.map((r, i) => {
      const fairProb = (implied[i] as number) / sum;
      const edge = r.best_odd * fairProb - 1;
      let moveDir: 'up' | 'down' | null = null;
      if (r.pin_open != null && r.pin_close != null && r.pin_open !== r.pin_close) {
        moveDir = r.pin_close > r.pin_open ? 'up' : 'down';
      }
      return {
        marketKey: key,
        marketLabel: MARKET_LABEL[key],
        outcomeKey: r.outcome_label,
        outcomeLabel: outcomePt(r.outcome_label, homeName, awayName),
        fairProb,
        bestOdd: r.best_odd,
        bestBook: r.best_book,
        nBooks: r.n_books,
        edge,
        tier: tierOf(edge),
        anchor,
        moveDir,
      };
    });

    markets.push({ key, label: MARKET_LABEL[key], anchor, margin: sum - 1, outcomes });
  }

  const best = markets
    .flatMap((m) => m.outcomes)
    .reduce<ValueOutcome | null>((b, o) => (b == null || o.edge > b.edge ? o : b), null);

  return { markets, best };
}

export const fmtPct = (p: number) => `${(p * 100).toFixed(0)}%`;
export const fmtEdge = (e: number) => `${e >= 0 ? '+' : ''}${(e * 100).toFixed(1)}%`;

// ---------- Board de oportunidades (todos os jogos com odds) ----------

export interface BoardRow extends FutebolOddsRow {
  fixture_id: number;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  away_team_name: string;
  competition: string;
  kickoff_utc: string | null;
  status_short: string | null;
}

export interface Opportunity extends ValueOutcome {
  fixtureId: number;
  homeId: number;
  awayId: number;
  homeName: string;
  awayName: string;
  competition: string;
  kickoffUtc: string | null;
}

export interface MonitoredFixture {
  fixtureId: number;
  homeId: number;
  awayId: number;
  homeName: string;
  awayName: string;
  competition: string;
  kickoffUtc: string | null;
  bestEdge: number;
}

export interface BoardResult {
  fixtures: number;
  opportunities: Opportunity[]; // edge >= 0, ordenadas desc
  monitored: MonitoredFixture[]; // todos os jogos com odds (cobertura), ordenados por melhor edge
}

export function computeBoardOpportunities(rows: BoardRow[]): BoardResult {
  const byFixture = new Map<number, BoardRow[]>();
  for (const r of rows) {
    const arr = byFixture.get(r.fixture_id);
    if (arr) arr.push(r);
    else byFixture.set(r.fixture_id, [r]);
  }

  const opportunities: Opportunity[] = [];
  const monitored: MonitoredFixture[] = [];

  for (const [fid, frows] of byFixture) {
    const meta = frows[0];
    const fv = computeFixtureValue(frows, meta.home_team_name, meta.away_team_name);
    const outs = fv.markets.flatMap((m) => m.outcomes);
    const bestEdge = outs.reduce((b, o) => Math.max(b, o.edge), -Infinity);
    monitored.push({
      fixtureId: fid, homeId: meta.home_team_id, awayId: meta.away_team_id,
      homeName: meta.home_team_name, awayName: meta.away_team_name,
      competition: meta.competition, kickoffUtc: meta.kickoff_utc,
      bestEdge: Number.isFinite(bestEdge) ? bestEdge : 0,
    });
    for (const o of outs) {
      if (o.edge >= 0) {
        opportunities.push({
          ...o, fixtureId: fid, homeId: meta.home_team_id, awayId: meta.away_team_id,
          homeName: meta.home_team_name, awayName: meta.away_team_name,
          competition: meta.competition, kickoffUtc: meta.kickoff_utc,
        });
      }
    }
  }

  opportunities.sort((a, b) => b.edge - a.edge);
  monitored.sort((a, b) => b.bestEdge - a.bestEdge);
  return { fixtures: byFixture.size, opportunities, monitored };
}
