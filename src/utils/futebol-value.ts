// ============================================================
// futebol-value.ts — valor (edge), Score de Confiabilidade e Kelly
// ============================================================
// O coração do value bet. Para cada mercado de partição limpa (Resultado,
// Over/Under 2,5, Ambos marcam), estima a PROBABILIDADE JUSTA removendo a margem
// (devig) da linha sharp da Pinnacle — ou, quando a Pinnacle não cobre, do
// consenso. Compara a MELHOR odd disponível com essa prob. justa → edge.
//
// IMPORTANTE (metodologia v2): ranquear por EDGE CRU engana — em odds altas o
// edge explode com ruído (1 casa fora da curva vira "+6%") e ignora risco. Por
// isso usamos um SCORE DE CONFIABILIDADE (0–100) que combina:
//   1. Kelly (quanto a aposta vale de fato — pune longshot sozinho)
//   2. Banda de odds sã (~1.4–4.0; zebra e juice perdem peso)
//   3. Corroboração (melhor odd não pode ser outlier solitário vs a média)
//   4. Âncora sharp (valor confirmado contra a Pinnacle, não só consenso)
//   5. Movimento de linha (t24h→t1h)
// Stake sugerido = ½ Kelly (gestão de banca conservadora). Mercados sem odds
// (escanteios/cartões) NÃO entram aqui — só tendência descritiva.
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
  marketLabel: string;   // PT, ex.: "Vencedor (1X2)"
  outcomeKey: string;
  outcomeLabel: string;
  fairProb: number;      // 0..1
  bestOdd: number;
  avgOdd: number;
  bestBook: string;
  nBooks: number;
  edge: number;          // bestOdd × fairProb − 1
  kelly: number;         // edge / (bestOdd − 1), full Kelly (fração da banca)
  stake: number;         // ½ Kelly (stake sugerido)
  score: number;         // 0..100 — Score de Confiabilidade
  tier: ValueTier;
  suspect: boolean;      // melhor odd é outlier / poucas casas → linha suspeita
  anchor: 'pinnacle' | 'consensus';
  moveDir: 'up' | 'down' | null;
}

export interface ValueMarket {
  key: string;
  label: string;
  anchor: 'pinnacle' | 'consensus';
  margin: number;
  outcomes: ValueOutcome[];
}

export interface FixtureValue {
  markets: ValueMarket[];
  best: ValueOutcome | null; // maior SCORE do jogo (não maior edge)
}

const MARKET_LABEL: Record<string, string> = {
  match_winner: 'Vencedor (1X2)',
  over_under_25: 'Mais/Menos 2,5 gols',
  btts: 'Ambos marcam',
};
const VALUE_MARKETS = ['match_winner', 'over_under_25', 'btts'];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

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

// Crédito cheio em odds "sãs"; decai em zebra (>4) e em juice (<1.4)
function oddsBandFactor(odd: number): number {
  if (odd >= 1.4 && odd <= 4.0) return 1;
  if (odd < 1.4) return clamp((odd - 1.15) / (1.4 - 1.15), 0, 1);
  return clamp((6.5 - odd) / (6.5 - 4.0), 0, 1); // zera em odd ≥ 6.5
}

// Melhor odd muito acima da média das casas = provável linha desatualizada/limite
function corroboration(best: number, avg: number, nBooks: number): { factor: number; suspect: boolean } {
  let factor = 1;
  let suspect = false;
  if (avg && avg > 1) {
    const ratio = best / avg;
    if (ratio >= 1.12) { factor = 0.35; suspect = true; }
    else if (ratio > 1.05) factor = 1 - ((ratio - 1.05) / (1.12 - 1.05)) * 0.65;
  }
  if (nBooks < 4) { factor *= 0.55; suspect = true; }
  else if (nBooks < 8) factor *= 0.85;
  return { factor: clamp(factor, 0, 1), suspect };
}

const KELLY_FULL_CAP = 0.06; // 6% full-Kelly = score 100 nesse eixo

function tierFromScore(score: number, suspect: boolean): ValueTier {
  if (suspect) return 'low';
  if (score >= 55) return 'value';
  if (score >= 30) return 'slight';
  if (score > 0) return 'fair';
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
      const kelly = r.best_odd > 1 ? Math.max(0, edge / (r.best_odd - 1)) : 0;
      const avgOdd = r.avg_odd ?? r.best_odd;
      const { factor: corrobFactor, suspect } = corroboration(r.best_odd, avgOdd, r.n_books);

      let moveDir: 'up' | 'down' | null = null;
      if (r.pin_open != null && r.pin_close != null && r.pin_open !== r.pin_close) {
        moveDir = r.pin_close > r.pin_open ? 'up' : 'down';
      }
      const moveFactor = moveDir === 'up' ? 1.06 : moveDir === 'down' ? 0.92 : 1;

      let score = 0;
      if (edge > 0) {
        const kellyNorm = clamp(kelly / KELLY_FULL_CAP, 0, 1);
        const band = oddsBandFactor(r.best_odd);
        const sharp = anchor === 'pinnacle' ? 1 : 0.72;
        score = Math.round(clamp(100 * kellyNorm * band * corrobFactor * sharp * moveFactor, 0, 100));
      }

      return {
        marketKey: key,
        marketLabel: MARKET_LABEL[key],
        outcomeKey: r.outcome_label,
        outcomeLabel: outcomePt(r.outcome_label, homeName, awayName),
        fairProb,
        bestOdd: r.best_odd,
        avgOdd,
        bestBook: r.best_book,
        nBooks: r.n_books,
        edge,
        kelly,
        stake: kelly / 2,
        score,
        tier: tierFromScore(score, suspect),
        suspect,
        anchor,
        moveDir,
      };
    });

    markets.push({ key, label: MARKET_LABEL[key], anchor, margin: sum - 1, outcomes });
  }

  // hero = maior SCORE do jogo (não maior edge)
  const best = markets
    .flatMap((m) => m.outcomes)
    .reduce<ValueOutcome | null>((b, o) => (b == null || o.score > b.score ? o : b), null);

  return { markets, best };
}

export const fmtPct = (p: number) => `${(p * 100).toFixed(0)}%`;
export const fmtEdge = (e: number) => `${e >= 0 ? '+' : ''}${(e * 100).toFixed(1)}%`;
export const fmtStake = (s: number) => `${(s * 100).toFixed(1)}%`;

/** Limiar pra um valor virar destaque/hero (abaixo disso: "sem valor claro"). */
export const HERO_MIN_SCORE = 35;
/** Limiar pra entrar na lista de oportunidades. */
export const OPP_MIN_SCORE = 12;

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
  best: ValueOutcome | null;
}

export interface BoardResult {
  fixtures: number;
  opportunities: Opportunity[]; // score >= OPP_MIN_SCORE, ordenadas por score desc
  monitored: MonitoredFixture[]; // todos os jogos com odds, ordenados por melhor score
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
    monitored.push({
      fixtureId: fid, homeId: meta.home_team_id, awayId: meta.away_team_id,
      homeName: meta.home_team_name, awayName: meta.away_team_name,
      competition: meta.competition, kickoffUtc: meta.kickoff_utc,
      best: fv.best,
    });
    for (const o of fv.markets.flatMap((m) => m.outcomes)) {
      if (o.score >= OPP_MIN_SCORE) {
        opportunities.push({
          ...o, fixtureId: fid, homeId: meta.home_team_id, awayId: meta.away_team_id,
          homeName: meta.home_team_name, awayName: meta.away_team_name,
          competition: meta.competition, kickoffUtc: meta.kickoff_utc,
        });
      }
    }
  }

  opportunities.sort((a, b) => b.score - a.score);
  monitored.sort((a, b) => (b.best?.score ?? 0) - (a.best?.score ?? 0));
  return { fixtures: byFixture.size, opportunities, monitored };
}
