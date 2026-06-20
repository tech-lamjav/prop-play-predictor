import type { Bet } from '@/hooks/use-bets';

export type BetWithTags = Bet & { tags?: { id: string; name: string; color?: string }[] };

const SETTLED = ['won', 'lost', 'cashout', 'half_won', 'half_lost', 'void'] as const;

export function profitForBet(bet: Bet): number {
  if (bet.status === 'won') return bet.potential_return - bet.stake_amount;
  if (bet.status === 'lost') return -bet.stake_amount;
  if (bet.status === 'cashout' && bet.cashout_amount != null) return bet.cashout_amount - bet.stake_amount;
  if (bet.status === 'half_won') return (bet.stake_amount + bet.potential_return) / 2 - bet.stake_amount;
  if (bet.status === 'half_lost') return bet.stake_amount / 2 - bet.stake_amount;
  return 0;
}

export function isSettled(bet: Bet): boolean {
  return (SETTLED as readonly string[]).includes(bet.status);
}

// ============ Heatmap (liga × mercado) ============

export interface HeatmapCell {
  l: number;
  m: number;
  n: number;
  totalStaked: number;
  profit: number;
  roi: number | null;
}

export interface HeatmapData {
  leagues: string[];
  markets: string[];
  cells: HeatmapCell[];
}

export function aggregateHeatmap(
  bets: Bet[],
  maxLeagues = 6,
  maxMarkets = 5
): HeatmapData {
  const settled = bets.filter(isSettled);

  // Step 1: count volume by league and market
  const leagueVolume = new Map<string, number>();
  const marketVolume = new Map<string, number>();
  settled.forEach((b) => {
    const lg = b.league || 'Outros';
    const mk = b.betting_market || 'Outros';
    leagueVolume.set(lg, (leagueVolume.get(lg) ?? 0) + 1);
    marketVolume.set(mk, (marketVolume.get(mk) ?? 0) + 1);
  });

  // Step 2: pick top N leagues and top M markets by volume
  const topLeagues = Array.from(leagueVolume.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxLeagues)
    .map(([name]) => name);
  const topMarkets = Array.from(marketVolume.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxMarkets)
    .map(([name]) => name);

  // Step 3: aggregate cells (l, m) → {n, totalStaked, profit}
  const cellMap = new Map<string, { n: number; totalStaked: number; profit: number }>();
  settled.forEach((b) => {
    const lg = b.league || 'Outros';
    const mk = b.betting_market || 'Outros';
    const l = topLeagues.indexOf(lg);
    const m = topMarkets.indexOf(mk);
    if (l === -1 || m === -1) return;
    const key = `${l}-${m}`;
    const prev = cellMap.get(key) ?? { n: 0, totalStaked: 0, profit: 0 };
    cellMap.set(key, {
      n: prev.n + 1,
      totalStaked: prev.totalStaked + b.stake_amount,
      profit: prev.profit + profitForBet(b),
    });
  });

  // Step 4: build full grid (including empty cells)
  const cells: HeatmapCell[] = [];
  for (let l = 0; l < topLeagues.length; l++) {
    for (let m = 0; m < topMarkets.length; m++) {
      const agg = cellMap.get(`${l}-${m}`);
      if (!agg) {
        cells.push({ l, m, n: 0, totalStaked: 0, profit: 0, roi: null });
      } else {
        const roi = agg.totalStaked > 0 ? (agg.profit / agg.totalStaked) * 100 : null;
        cells.push({
          l,
          m,
          n: agg.n,
          totalStaked: agg.totalStaked,
          profit: agg.profit,
          roi,
        });
      }
    }
  }

  return { leagues: topLeagues, markets: topMarkets, cells };
}

// ============ Drill-down (filtra por liga + mercado) ============

export interface DrillDownStats {
  league: string;
  market: string;
  bets: Bet[];
  n: number;
  totalStaked: number;
  profit: number;
  roi: number;
  won: number;
  lost: number;
  other: number;
  weeklySparkline: number[];
  lastThree: Bet[];
}

export function computeDrillDown(bets: Bet[], league: string, market: string): DrillDownStats {
  const matching = bets.filter(
    (b) => isSettled(b) && (b.league || 'Outros') === league && (b.betting_market || 'Outros') === market
  );
  const totalStaked = matching.reduce((s, b) => s + b.stake_amount, 0);
  const profit = matching.reduce((s, b) => s + profitForBet(b), 0);
  const roi = totalStaked > 0 ? (profit / totalStaked) * 100 : 0;
  const won = matching.filter((b) => b.status === 'won' || b.status === 'half_won').length;
  const lost = matching.filter((b) => b.status === 'lost' || b.status === 'half_lost').length;
  const other = matching.length - won - lost;

  // Last 3 bets by date desc
  const lastThree = [...matching]
    .sort((a, b) => new Date(b.bet_date).getTime() - new Date(a.bet_date).getTime())
    .slice(0, 3);

  // Weekly sparkline: profit accumulated by week
  const sortedAsc = [...matching].sort(
    (a, b) => new Date(a.bet_date).getTime() - new Date(b.bet_date).getTime()
  );
  const weeklyProfit = new Map<string, number>();
  sortedAsc.forEach((b) => {
    const d = new Date(b.bet_date);
    const year = d.getFullYear();
    const week = Math.floor(
      (d.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    const key = `${year}-${week}`;
    weeklyProfit.set(key, (weeklyProfit.get(key) ?? 0) + profitForBet(b));
  });
  let cum = 0;
  const weeklySparkline = Array.from(weeklyProfit.values()).map((p) => {
    cum += p;
    return cum;
  });
  if (weeklySparkline.length < 2) weeklySparkline.unshift(0);

  return {
    league,
    market,
    bets: matching,
    n: matching.length,
    totalStaked,
    profit,
    roi,
    won,
    lost,
    other,
    weeklySparkline,
    lastThree,
  };
}

// ============ Odds histogram ============

export interface OddsBucket {
  range: string;
  min: number;
  max: number; // inclusive upper bound for display, exclusive in math
  n: number;
  totalStaked: number;
  profit: number;
  roi: number;
}

const ODDS_BUCKETS: { range: string; min: number; max: number }[] = [
  { range: '1.0–1.3', min: 1, max: 1.3 },
  { range: '1.3–1.5', min: 1.3, max: 1.5 },
  { range: '1.5–2.1', min: 1.5, max: 2.1 },
  { range: '2.1–3.0', min: 2.1, max: 3.0 },
  { range: '3.0–5.0', min: 3.0, max: 5.0 },
  { range: '5.0+', min: 5.0, max: Infinity },
];

export function aggregateOddsDistribution(bets: Bet[]): OddsBucket[] {
  const settled = bets.filter(isSettled);
  return ODDS_BUCKETS.map((b) => {
    const inBucket = settled.filter((bet) => bet.odds >= b.min && bet.odds < b.max);
    const totalStaked = inBucket.reduce((s, x) => s + x.stake_amount, 0);
    const profit = inBucket.reduce((s, x) => s + profitForBet(x), 0);
    const roi = totalStaked > 0 ? (profit / totalStaked) * 100 : 0;
    return {
      range: b.range,
      min: b.min,
      max: b.max,
      n: inBucket.length,
      totalStaked,
      profit,
      roi,
    };
  });
}

// ============ Calendar heatmap (atividade por dia, estilo GitHub/Wispr) ============

export interface CalendarCell {
  date: Date;
  n: number;
}

export interface CalendarHeatmapData {
  /** Semanas em colunas (cada coluna tem até 7 cells, Sun→Sat). */
  weeks: CalendarCell[][];
  /** Labels de mês posicionados na semana onde aquele mês começa. */
  months: { label: string; weekIndex: number }[];
  maxN: number;
  /** Maior sequência de dias consecutivos com apostas DENTRO da janela. */
  longestStreak: number;
  totalDays: number;
  totalBets: number;
  /** Dia da semana com mais apostas DENTRO da janela. null se sem dados. */
  mostActiveDay: { name: string; count: number } | null;
  /** % de apostas no fim de semana DENTRO da janela. */
  weekendPct: number;
  /** Data de início (Domingo da semana mais antiga) da janela visível. */
  windowStart: Date;
  /** Data de fim da janela visível. */
  windowEnd: Date;
  /** Data da aposta mais antiga, pra saber se ainda dá pra navegar pra trás. */
  earliestBetDate: Date | null;
}

/** Parse "YYYY-MM-DD..." como Date local (evita drift de timezone que afeta date-only). */
const parseDateLocal = (s: string): Date => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  return new Date(s);
};

const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseKey = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const DAY_NAMES_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * Calendar heatmap das apostas — janela fixa de `windowDays` dias terminando em `endDate`
 * (default: hoje). Stats refletem APENAS o que está na janela visível, então setinhas de
 * navegação atualizam os números junto. Range NÃO respeita filtro de período do dashboard.
 */
export function aggregateCalendarHeatmap(
  bets: Bet[],
  windowDays = 91,
  endDate?: Date
): CalendarHeatmapData {
  const settled = bets.filter(isSettled);

  // Counts globais (pra encontrar a aposta mais antiga e ter dados em qualquer janela)
  const counts = new Map<string, number>();
  let earliestBetDate: Date | null = null;
  settled.forEach((b) => {
    const d = parseDateLocal(b.bet_date);
    const key = dateKey(d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!earliestBetDate || d < earliestBetDate) earliestBetDate = d;
  });

  // End/start da janela
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(end.getDate() - windowDays);
  while (start.getDay() !== 0) start.setDate(start.getDate() - 1);

  const empty: CalendarHeatmapData = {
    weeks: [],
    months: [],
    maxN: 0,
    longestStreak: 0,
    totalDays: 0,
    totalBets: 0,
    mostActiveDay: null,
    weekendPct: 0,
    windowStart: start,
    windowEnd: end,
    earliestBetDate,
  };

  if (settled.length === 0) return empty;

  // Build grid (cells) da janela. Em paralelo: stats por dia da semana DENTRO da janela.
  const weeks: CalendarCell[][] = [];
  const months: { label: string; weekIndex: number }[] = [];
  let currentWeek: CalendarCell[] = [];
  let weekIdx = 0;
  let lastMonthSeen = -1;
  let maxN = 0;
  const byDayOfWeekWindow: number[] = [0, 0, 0, 0, 0, 0, 0];
  let totalBetsWindow = 0;
  let totalDaysWindow = 0;

  const cursor = new Date(start);
  while (cursor <= end) {
    const key = dateKey(cursor);
    const n = counts.get(key) ?? 0;
    if (n > maxN) maxN = n;
    if (n > 0) {
      byDayOfWeekWindow[cursor.getDay()] += n;
      totalBetsWindow += n;
      totalDaysWindow++;
    }
    currentWeek.push({ date: new Date(cursor), n });

    if (cursor.getMonth() !== lastMonthSeen) {
      months.push({
        label: cursor.toLocaleString('pt-BR', { month: 'short' }).replace('.', ''),
        weekIndex: weekIdx,
      });
      lastMonthSeen = cursor.getMonth();
    }

    if (cursor.getDay() === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
      weekIdx++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  // Longest streak DENTRO da janela
  let longestStreak = 0;
  let run = 0;
  const startKey = dateKey(start);
  const endKey = dateKey(end);
  const sortedKeys = Array.from(counts.keys())
    .filter((k) => k >= startKey && k <= endKey)
    .sort();
  let prev: Date | null = null;
  for (const key of sortedKeys) {
    const d = parseKey(key);
    if (prev) {
      const diff = Math.round((d.getTime() - prev.getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prev = d;
  }

  // Most active day of week (na janela)
  let mostActiveDayIdx = 0;
  let mostActiveCount = 0;
  byDayOfWeekWindow.forEach((n, i) => {
    if (n > mostActiveCount) {
      mostActiveCount = n;
      mostActiveDayIdx = i;
    }
  });
  const mostActiveDay = mostActiveCount > 0
    ? { name: DAY_NAMES_FULL[mostActiveDayIdx], count: mostActiveCount }
    : null;

  const weekendBetsWindow = byDayOfWeekWindow[0] + byDayOfWeekWindow[6];
  const weekendPct = totalBetsWindow > 0 ? (weekendBetsWindow / totalBetsWindow) * 100 : 0;

  return {
    weeks,
    months,
    maxN,
    longestStreak,
    totalDays: totalDaysWindow,
    totalBets: totalBetsWindow,
    mostActiveDay,
    weekendPct,
    windowStart: start,
    windowEnd: end,
    earliestBetDate,
  };
}

// ============ Tag pivot ============

export interface TagPivotEntry {
  name: string;
  color?: string;
  n: number;
  totalStaked: number;
  profit: number;
  roi: number;
}

// ============ Focus filter (refilters bets antes da análise) ============

/**
 * Filtro multi-select de foco:
 * - `leagues`: array de ligas selecionadas (OR dentro do grupo)
 * - `tags`: array de tags selecionadas (OR dentro do grupo)
 * - Entre grupos: AND (aposta precisa bater liga E ter pelo menos uma tag selecionada)
 * - Ambos vazios = sem filtro.
 */
export interface FocusFilter {
  leagues: string[];
  tags: string[];
}

export const EMPTY_FOCUS: FocusFilter = { leagues: [], tags: [] };

export function isEmptyFocus(f: FocusFilter): boolean {
  return f.leagues.length === 0 && f.tags.length === 0;
}

export function applyFocus(bets: BetWithTags[], focus: FocusFilter): BetWithTags[] {
  if (isEmptyFocus(focus)) return bets;
  return bets.filter((b) => {
    const leagueOk =
      focus.leagues.length === 0 || focus.leagues.includes(b.league || 'Outros');
    const tagOk =
      focus.tags.length === 0 || (b.tags ?? []).some((t) => focus.tags.includes(t.name));
    // AND entre grupos: ambas condições precisam passar (uma é trivialmente true se grupo vazio)
    return leagueOk && tagOk;
  });
}

export function focusLabel(f: FocusFilter): string {
  if (isEmptyFocus(f)) return 'todos os escopos';
  const parts = [...f.leagues, ...f.tags];
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} + ${parts[1]}`;
  return `${parts[0]} + ${parts.length - 1} outros`;
}

/**
 * Retorna chips de foco baseados nos bets atuais: todas as ligas + todas as tags
 * ordenadas por volume desc. Tags com mesmo nome de liga são deduplicadas (mantém a liga).
 * O modal renderiza tudo com flex-wrap.
 */
export function getFocusOptions(
  bets: BetWithTags[],
  maxLeagues = 20,
  maxTags = 20
): { leagues: string[]; tags: string[] } {
  const settled = bets.filter(isSettled);
  const leagueVol = new Map<string, number>();
  const tagVol = new Map<string, number>();
  settled.forEach((b) => {
    const lg = b.league || 'Outros';
    leagueVol.set(lg, (leagueVol.get(lg) ?? 0) + 1);
    (b.tags ?? []).forEach((t) => {
      tagVol.set(t.name, (tagVol.get(t.name) ?? 0) + 1);
    });
  });
  const leagues = Array.from(leagueVol.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxLeagues)
    .map(([name]) => name);
  const leagueSet = new Set(leagues);
  const tags = Array.from(tagVol.entries())
    .filter(([name]) => !leagueSet.has(name)) // dedupe: tag com mesmo nome de liga
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTags)
    .map(([name]) => name);
  return { leagues, tags };
}

// ============ Derived insights (static analytics shaped like the mockup's AI output) ============

export type InsightType = 'opportunity' | 'warning' | 'discipline';

/** Nomes de ícones lucide usados nos componentes do dashboard. Cada componente mapeia → lucide-react. */
export type IconName =
  | 'trending-up'
  | 'alert-triangle'
  | 'target'
  | 'chart-bar'
  | 'flame'
  | 'snowflake';

export interface DerivedInsight {
  type: InsightType;
  icon: IconName;
  label: string;
  title: string;
  body: string;
}

export interface NarrativeBullet {
  icon: IconName;
  text: string;
  highlight?: string;
  highlightTone?: 'positive' | 'negative' | 'neutral';
}

/** Pedaço de texto do body — `tone` define cor de destaque (amber-on-forest, rose-on-forest). */
export interface NarrativeSegment {
  text: string;
  tone?: 'positive' | 'negative';
}

export interface Narrative {
  eyebrow: string;
  headline: string;
  /** Token a colorir dentro do headline (forest se positivo, rose se negativo). */
  headlineHighlight?: { text: string; tone: 'positive' | 'negative' };
  body: NarrativeSegment[];
  bullets: NarrativeBullet[];
  hasEnoughData: boolean;
}

interface StatsSummary {
  profit: number;
  roi: number;
  totalBets: number;
  totalStaked: number;
  winRate: number;
}

const MIN_SLICE_N = 3;

/** Formatter padrão pra moeda — strip ",00" final quando inteiro. */
const defaultMoneyFmt = (v: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(v);

/** Strip trailing ",00" se aparecer (útil quando o formatter da página adiciona centavos). */
const cleanCents = (s: string): string => s.replace(/[,.]00\b/, '');

/**
 * Compacta o número dentro de uma string monetária:
 *  - < 1.000: remove centavos. R$ 290,25 → R$ 290
 *  - 1.000–9.999: 1 casa K. R$ 1.234,56 → R$ 1,2K
 *  - 10.000–999.999: K inteiro. R$ 12.345 → R$ 12K
 *  - ≥ 1.000.000: M. R$ 1.234.567 → R$ 1,2M
 * Preserva prefixo/sufixo do formatter (R$, u, etc.).
 */
export const compactify = (s: string): string => {
  const match = s.match(/[\d.,]+/);
  if (!match) return s;
  const numStr = match[0];
  // Parse BR-format (123.456,78): strip thousands "." mas APENAS quando seguido de exatamente 3 dígitos
  // (impede que "100.0" en-US vire 1000)
  const cleaned = numStr.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  if (!Number.isFinite(value)) return s;
  if (Math.abs(value) < 1000) {
    // Strip cents only
    return s.replace(/,\d{2}\b/, '');
  }
  const abs = Math.abs(value);
  let suffix: 'K' | 'M';
  let scaled: number;
  if (abs >= 1_000_000) {
    suffix = 'M';
    scaled = value / 1_000_000;
  } else {
    suffix = 'K';
    scaled = value / 1_000;
  }
  const absScaled = Math.abs(scaled);
  const formatted = absScaled < 10
    ? scaled.toFixed(1).replace('.', ',')
    : Math.round(scaled).toString();
  return s.replace(numStr, `${formatted}${suffix}`);
};

export function deriveInsights(
  bets: Bet[],
  heatmap: HeatmapData,
  formatCurrency: (v: number) => string = defaultMoneyFmt
): DerivedInsight[] {
  const fmt = (v: number) => cleanCents(formatCurrency(Math.abs(v)));
  const insights: DerivedInsight[] = [];

  // Opportunity: best ROI slice with n >= MIN_SLICE_N
  const positiveSlices = heatmap.cells
    .filter((c) => c.n >= MIN_SLICE_N && c.roi !== null && c.roi > 5)
    .sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0));
  if (positiveSlices[0]) {
    const cell = positiveSlices[0];
    insights.push({
      type: 'opportunity',
      icon: 'trending-up',
      label: 'Oportunidade',
      title: `${heatmap.leagues[cell.l]} · ${heatmap.markets[cell.m]}`,
      body: `${(cell.roi ?? 0).toFixed(1)}% de ROI em ${cell.n} ${cell.n === 1 ? 'aposta' : 'apostas'} (${cell.profit > 0 ? '+' : '-'}${fmt(cell.profit)}). Continue apostando aqui.`,
    });
  }

  // Warning: worst ROI slice with n >= MIN_SLICE_N
  const negativeSlices = heatmap.cells
    .filter((c) => c.n >= MIN_SLICE_N && c.roi !== null && c.roi < -10)
    .sort((a, b) => (a.roi ?? 0) - (b.roi ?? 0));
  if (negativeSlices[0]) {
    const cell = negativeSlices[0];
    insights.push({
      type: 'warning',
      icon: 'alert-triangle',
      label: 'Vazamento',
      title: `${heatmap.leagues[cell.l]} · ${heatmap.markets[cell.m]}`,
      body: `${(cell.roi ?? 0).toFixed(1)}% de ROI em ${cell.n} apostas (-${fmt(cell.profit)}). Considere pausar ou ajustar critério.`,
    });
  }

  // Discipline: stake variance
  const settledStakes = bets.filter(isSettled).map((b) => b.stake_amount);
  if (settledStakes.length >= 5) {
    const mean = settledStakes.reduce((s, x) => s + x, 0) / settledStakes.length;
    const variance = settledStakes.reduce((s, x) => s + (x - mean) ** 2, 0) / settledStakes.length;
    const std = Math.sqrt(variance);
    const cv = mean > 0 ? std / mean : 0;
    if (cv > 0.5) {
      insights.push({
        type: 'discipline',
        icon: 'target',
        label: 'Disciplina',
        title: 'Stake varia muito',
        body: `Seu stake varia ${(cv * 100).toFixed(0)}% em relação à média (${fmt(mean)}). Padronizar reduz risco.`,
      });
    }
  }

  // Fallback discipline: avg odd analysis
  if (insights.filter((i) => i.type === 'discipline').length === 0 && bets.filter(isSettled).length >= 5) {
    const settled = bets.filter(isSettled);
    const avgOdd = settled.reduce((s, b) => s + b.odds, 0) / settled.length;
    if (avgOdd >= 3.0) {
      insights.push({
        type: 'discipline',
        icon: 'target',
        label: 'Disciplina',
        title: 'Odd média alta',
        body: `Odd média ${avgOdd.toFixed(2)} é arriscada. Apostas com odd 1.5–2.1 tendem a ter ROI mais estável.`,
      });
    } else if (avgOdd < 1.5) {
      insights.push({
        type: 'discipline',
        icon: 'target',
        label: 'Disciplina',
        title: 'Odd média baixa',
        body: `Odd média ${avgOdd.toFixed(2)} é conservadora. Pouco upside por aposta — vale revisar critério de seleção.`,
      });
    }
  }

  return insights.slice(0, 3);
}

export function composeNarrative(
  bets: Bet[],
  stats: StatsSummary,
  heatmap: HeatmapData,
  periodLabel: string,
  formatCurrency: (v: number) => string = defaultMoneyFmt
): Narrative {
  const fmt = (v: number) => cleanCents(formatCurrency(Math.abs(v)));
  const settled = bets.filter(isSettled);
  const hasEnoughData = settled.length >= 5;

  if (!hasEnoughData) {
    return {
      eyebrow: `Análise · ${periodLabel}`,
      headline: 'Pouco dado pra uma análise sólida.',
      body: [
        {
          text: `Você tem ${settled.length} ${settled.length === 1 ? 'aposta encerrada' : 'apostas encerradas'} no período. Cadastre pelo menos 5 apostas pra começar a ver padrões.`,
        },
      ],
      bullets: [],
      hasEnoughData: false,
    };
  }

  const isPositive = stats.profit >= 0;

  // Best/worst slice
  const positiveSlices = heatmap.cells
    .filter((c) => c.n >= MIN_SLICE_N && c.roi !== null && c.roi > 0)
    .sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0));
  const negativeSlices = heatmap.cells
    .filter((c) => c.n >= MIN_SLICE_N && c.roi !== null && c.roi < 0)
    .sort((a, b) => (a.roi ?? 0) - (b.roi ?? 0));
  const bestSlice = positiveSlices[0];
  const worstSlice = negativeSlices[0];

  // Headline composition
  let headline: string;
  let headlineHighlight: Narrative['headlineHighlight'];
  if (isPositive && stats.roi > 10) {
    headline = 'Você teve um período sólido.';
    headlineHighlight = { text: 'sólido', tone: 'positive' };
  } else if (isPositive && stats.roi > 0) {
    headline = 'Período no positivo, mas dá pra subir o ROI.';
    headlineHighlight = { text: 'positivo', tone: 'positive' };
  } else if (Math.abs(stats.profit) < stats.totalStaked * 0.02) {
    headline = 'Período praticamente neutro.';
  } else if (stats.roi > -10) {
    headline = 'Período negativo, mas recuperável.';
    headlineHighlight = { text: 'recuperável', tone: 'positive' };
  } else {
    headline = 'Período difícil. Vale revisar a estratégia.';
    headlineHighlight = { text: 'difícil', tone: 'negative' };
  }

  // Body como segments com tone nos números-chave
  const body: NarrativeSegment[] = [];
  const profitSign = stats.profit >= 0 ? '+' : '-';
  const profitTone: NarrativeSegment['tone'] = stats.profit >= 0 ? 'positive' : 'negative';
  body.push({ text: `${profitSign}${fmt(stats.profit)}`, tone: profitTone });
  body.push({ text: ' com ROI ' });
  body.push({
    text: `${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%`,
    tone: stats.roi >= 0 ? 'positive' : 'negative',
  });
  body.push({
    text: ` em ${stats.totalBets} ${stats.totalBets === 1 ? 'aposta' : 'apostas'}.`,
  });
  if (bestSlice) {
    body.push({
      text: ` ${heatmap.leagues[bestSlice.l]} (${heatmap.markets[bestSlice.m]}) puxou: ${bestSlice.n} apostas, `,
    });
    body.push({
      text: `${bestSlice.profit >= 0 ? '+' : '-'}${fmt(bestSlice.profit)}`,
      tone: bestSlice.profit >= 0 ? 'positive' : 'negative',
    });
    body.push({ text: '.' });
  }

  // Bullets
  const bullets: NarrativeBullet[] = [];
  if (bestSlice) {
    bullets.push({
      icon: 'trending-up',
      text: `${heatmap.leagues[bestSlice.l]} ${heatmap.markets[bestSlice.m]}:`,
      highlight: `${(bestSlice.roi ?? 0) > 0 ? '+' : ''}${(bestSlice.roi ?? 0).toFixed(1)}% ROI · mantenha o ritmo.`,
      highlightTone: 'positive',
    });
  }
  if (worstSlice) {
    bullets.push({
      icon: 'alert-triangle',
      text: `${heatmap.leagues[worstSlice.l]} ${heatmap.markets[worstSlice.m]}:`,
      highlight: `${(worstSlice.roi ?? 0).toFixed(1)}% ROI · considere pausar.`,
      highlightTone: 'negative',
    });
  }
  // 3rd bullet: discipline hint
  if (settled.length >= 5) {
    const stakes = settled.map((b) => b.stake_amount);
    const mean = stakes.reduce((s, x) => s + x, 0) / stakes.length;
    const variance = stakes.reduce((s, x) => s + (x - mean) ** 2, 0) / stakes.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    if (cv > 0.5) {
      bullets.push({
        icon: 'target',
        text: 'Stake oscilando:',
        highlight: `variação de ${(cv * 100).toFixed(0)}% · padronize pra reduzir risco.`,
        highlightTone: 'negative',
      });
    } else {
      const avgOdd = settled.reduce((s, b) => s + b.odds, 0) / settled.length;
      bullets.push({
        icon: 'target',
        text: 'Odd média:',
        highlight: `${avgOdd.toFixed(2)} · ${avgOdd >= 1.5 && avgOdd <= 2.5 ? 'dentro da faixa estável.' : 'fora da zona estável (1.5–2.5).'}`,
        highlightTone: avgOdd >= 1.5 && avgOdd <= 2.5 ? 'positive' : 'negative',
      });
    }
  }

  return {
    eyebrow: `Análise · ${periodLabel}`,
    headline,
    headlineHighlight,
    body,
    bullets,
    hasEnoughData: true,
  };
}

// ============ Slice narrative (analysis of one heatmap cell) ============

export interface SliceMetric {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

export interface SliceInsight {
  icon: IconName;
  text: string;
}

export interface SliceNarrative {
  /** Tipo da análise: 'slice' (liga × mercado) ou 'tag' (uma ou mais tags). */
  kind: 'slice' | 'tag';
  /** Eyebrow do modal — ex.: "Análise da fatia" / "Análise das tags". */
  eyebrow: string;
  /** Título principal — ex.: "Brasileirão · Dupla Chance" ou "TipsterX". */
  title: string;
  metrics: SliceMetric[];
  /** Parágrafo descritivo. */
  paragraph: string;
  insights: SliceInsight[];
  totalBets: number;
}

interface StreakInfo {
  type: 'win' | 'loss' | 'mixed' | 'none';
  count: number;
}

function computeCurrentStreak(bets: Bet[]): StreakInfo {
  // bets ordered by date desc
  const sorted = [...bets].sort(
    (a, b) => new Date(b.bet_date).getTime() - new Date(a.bet_date).getTime()
  );
  let count = 0;
  let type: 'win' | 'loss' | 'mixed' | 'none' = 'none';
  for (const b of sorted) {
    const isWin = b.status === 'won' || b.status === 'half_won';
    const isLoss = b.status === 'lost' || b.status === 'half_lost';
    if (!isWin && !isLoss) continue;
    const current = isWin ? 'win' : 'loss';
    if (type === 'none') {
      type = current;
      count = 1;
    } else if (type === current) {
      count++;
    } else {
      break;
    }
  }
  return { type, count };
}

export function composeSliceNarrative(
  bets: Bet[],
  league: string,
  market: string,
  formatCurrency: (v: number) => string = (v) => `R$ ${v.toFixed(0)}`
): SliceNarrative {
  const drill = computeDrillDown(bets, league, market);
  const settled = drill.bets;

  if (settled.length === 0) {
    return {
      kind: 'slice',
      eyebrow: 'Análise da fatia',
      title: `${league} · ${market}`,
      metrics: [],
      paragraph: 'Nenhuma aposta nesta fatia no período selecionado.',
      insights: [],
      totalBets: 0,
    };
  }

  const winRate = drill.n > 0 ? ((drill.won + drill.lost > 0 ? drill.won / (drill.won + drill.lost) : 0) * 100) : 0;
  const avgOdd = settled.reduce((s, b) => s + b.odds, 0) / settled.length;
  const avgStake = drill.totalStaked / drill.n;

  // Best / worst single bet
  const bestProfit = Math.max(...settled.map(profitForBet));
  const worstProfit = Math.min(...settled.map(profitForBet));

  // Current streak
  const streak = computeCurrentStreak(settled);

  // Metrics row
  const metrics: SliceMetric[] = [
    {
      label: 'ROI',
      // Formato BR: vírgula como decimal (compactify assume BR-format ao parsear)
      value: `${drill.roi >= 0 ? '+' : ''}${drill.roi.toFixed(1).replace('.', ',')}%`,
      tone: drill.roi >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Lucro',
      value: `${drill.profit >= 0 ? '+' : ''}${formatCurrency(drill.profit)}`,
      tone: drill.profit >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Acerto',
      value: `${winRate.toFixed(0)}%`,
      tone: 'neutral',
    },
    {
      label: 'Apostas',
      value: `${drill.n}`,
      tone: 'neutral',
    },
  ];

  // Paragraph composition
  const paraParts: string[] = [];
  paraParts.push(
    `Você tem ${drill.n} ${drill.n === 1 ? 'aposta' : 'apostas'} em ${league} (${market}), com ${drill.roi >= 0 ? '+' : ''}${drill.roi.toFixed(1)}% de ROI e ${drill.profit >= 0 ? '+' : ''}${formatCurrency(drill.profit)} de lucro no período.`
  );
  if (drill.won + drill.lost > 0) {
    paraParts.push(
      `Acerto em ${drill.won} de ${drill.won + drill.lost} (${winRate.toFixed(0)}%), com odd média ${avgOdd.toFixed(2)} e stake médio ${formatCurrency(avgStake)}.`
    );
  }
  const paragraph = paraParts.join(' ');

  // Insights
  const insights: SliceInsight[] = [];
  if (streak.type === 'win' && streak.count >= 3) {
    insights.push({
      icon: 'flame',
      text: `Sequência atual: ${streak.count} ${streak.count === 1 ? 'green' : 'greens'} consecutivos. Momento positivo.`,
    });
  } else if (streak.type === 'loss' && streak.count >= 3) {
    insights.push({
      icon: 'snowflake',
      text: `Sequência atual: ${streak.count} ${streak.count === 1 ? 'red' : 'reds'} consecutivas. Cuidado com tilt.`,
    });
  }
  if (avgOdd > 0) {
    if (avgOdd >= 1.5 && avgOdd <= 2.1) {
      insights.push({
        icon: 'target',
        text: `Odd média ${avgOdd.toFixed(2)} está na zona estável (1.5–2.1).`,
      });
    } else if (avgOdd < 1.5) {
      insights.push({
        icon: 'target',
        text: `Odd média ${avgOdd.toFixed(2)} é conservadora — pouco upside por aposta.`,
      });
    } else {
      insights.push({
        icon: 'target',
        text: `Odd média ${avgOdd.toFixed(2)} é arriscada — variância alta.`,
      });
    }
  }
  if (bestProfit > 0 && Math.abs(worstProfit) > 0) {
    insights.push({
      icon: 'chart-bar',
      text: `Maior green ${formatCurrency(bestProfit)} · maior red ${formatCurrency(Math.abs(worstProfit))}.`,
    });
  }

  return {
    kind: 'slice',
    eyebrow: 'Análise da fatia',
    title: `${league} · ${market}`,
    metrics,
    paragraph,
    insights: insights.slice(0, 3),
    totalBets: drill.n,
  };
}

/** Compose narrative for 1+ selected tags. Reuse the SliceNarrative shape (kind: 'tag'). */
export function composeTagNarrative(
  bets: BetWithTags[],
  selectedTagNames: string[],
  formatCurrency: (v: number) => string = defaultMoneyFmt
): SliceNarrative {
  const matching = bets.filter(
    (b) => isSettled(b) && (b.tags ?? []).some((t) => selectedTagNames.includes(t.name))
  );

  const tagsTitle =
    selectedTagNames.length === 1
      ? selectedTagNames[0]
      : selectedTagNames.length === 2
        ? `${selectedTagNames[0]}, ${selectedTagNames[1]}`
        : `${selectedTagNames[0]} + ${selectedTagNames.length - 1} outras tags`;

  if (matching.length === 0) {
    return {
      kind: 'tag',
      eyebrow: selectedTagNames.length === 1 ? 'Análise da tag' : 'Análise das tags',
      title: tagsTitle,
      metrics: [],
      paragraph: 'Nenhuma aposta com essas tags no período selecionado.',
      insights: [],
      totalBets: 0,
    };
  }

  const totalStaked = matching.reduce((s, b) => s + b.stake_amount, 0);
  const profit = matching.reduce((s, b) => s + profitForBet(b), 0);
  const roi = totalStaked > 0 ? (profit / totalStaked) * 100 : 0;
  const won = matching.filter((b) => b.status === 'won' || b.status === 'half_won').length;
  const lost = matching.filter((b) => b.status === 'lost' || b.status === 'half_lost').length;
  const winRate = won + lost > 0 ? (won / (won + lost)) * 100 : 0;
  const avgOdd = matching.reduce((s, b) => s + b.odds, 0) / matching.length;
  const avgStake = totalStaked / matching.length;

  const bestProfit = Math.max(...matching.map(profitForBet));
  const worstProfit = Math.min(...matching.map(profitForBet));
  const streak = computeCurrentStreak(matching);

  const metrics: SliceMetric[] = [
    {
      label: 'ROI',
      value: `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`,
      tone: roi >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Lucro',
      value: `${profit >= 0 ? '+' : ''}${formatCurrency(profit)}`,
      tone: profit >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Acerto',
      value: `${winRate.toFixed(0)}%`,
      tone: 'neutral',
    },
    {
      label: 'Apostas',
      value: `${matching.length}`,
      tone: 'neutral',
    },
  ];

  const scopePhrase = selectedTagNames.length === 1
    ? `com a tag ${selectedTagNames[0]}`
    : `com as tags ${selectedTagNames.join(', ')}`;

  const paraParts: string[] = [];
  paraParts.push(
    `Você tem ${matching.length} ${matching.length === 1 ? 'aposta' : 'apostas'} ${scopePhrase}, com ${roi >= 0 ? '+' : ''}${roi.toFixed(1)}% de ROI e ${profit >= 0 ? '+' : ''}${formatCurrency(profit)} de lucro no período.`
  );
  if (won + lost > 0) {
    paraParts.push(
      `Acerto em ${won} de ${won + lost} (${winRate.toFixed(0)}%), com odd média ${avgOdd.toFixed(2)} e stake médio ${formatCurrency(avgStake)}.`
    );
  }
  const paragraph = paraParts.join(' ');

  const insights: SliceInsight[] = [];
  if (streak.type === 'win' && streak.count >= 3) {
    insights.push({
      icon: 'flame',
      text: `Sequência atual: ${streak.count} greens consecutivos. Momento positivo.`,
    });
  } else if (streak.type === 'loss' && streak.count >= 3) {
    insights.push({
      icon: 'snowflake',
      text: `Sequência atual: ${streak.count} reds consecutivas. Cuidado com tilt.`,
    });
  }
  if (avgOdd > 0) {
    if (avgOdd >= 1.5 && avgOdd <= 2.1) {
      insights.push({
        icon: 'target',
        text: `Odd média ${avgOdd.toFixed(2)} está na zona estável (1.5–2.1).`,
      });
    } else if (avgOdd < 1.5) {
      insights.push({
        icon: 'target',
        text: `Odd média ${avgOdd.toFixed(2)} é conservadora — pouco upside por aposta.`,
      });
    } else {
      insights.push({
        icon: 'target',
        text: `Odd média ${avgOdd.toFixed(2)} é arriscada — variância alta.`,
      });
    }
  }
  if (bestProfit > 0 && Math.abs(worstProfit) > 0) {
    insights.push({
      icon: 'chart-bar',
      text: `Maior green ${formatCurrency(bestProfit)} · maior red ${formatCurrency(Math.abs(worstProfit))}.`,
    });
  }

  return {
    kind: 'tag',
    eyebrow: selectedTagNames.length === 1 ? 'Análise da tag' : 'Análise das tags',
    title: tagsTitle,
    metrics,
    paragraph,
    insights: insights.slice(0, 3),
    totalBets: matching.length,
  };
}

export function aggregateTagPivot(bets: BetWithTags[]): TagPivotEntry[] {
  const settled = bets.filter(isSettled);
  const byTag = new Map<string, { color?: string; n: number; totalStaked: number; profit: number }>();
  settled.forEach((b) => {
    const tags = b.tags ?? [];
    const stake = b.stake_amount;
    const p = profitForBet(b);
    if (tags.length === 0) {
      const prev = byTag.get('Sem tag') ?? { n: 0, totalStaked: 0, profit: 0 };
      byTag.set('Sem tag', {
        color: prev.color,
        n: prev.n + 1,
        totalStaked: prev.totalStaked + stake,
        profit: prev.profit + p,
      });
    } else {
      tags.forEach((tag) => {
        const name = tag.name || tag.id;
        const prev = byTag.get(name) ?? { color: tag.color, n: 0, totalStaked: 0, profit: 0 };
        byTag.set(name, {
          color: prev.color ?? tag.color,
          n: prev.n + 1,
          totalStaked: prev.totalStaked + stake,
          profit: prev.profit + p,
        });
      });
    }
  });
  return Array.from(byTag.entries())
    .map(([name, agg]) => ({
      name,
      color: agg.color,
      n: agg.n,
      totalStaked: agg.totalStaked,
      profit: Number(agg.profit.toFixed(2)),
      roi: agg.totalStaked > 0 ? (agg.profit / agg.totalStaked) * 100 : 0,
    }))
    .sort((a, b) => b.profit - a.profit);
}
