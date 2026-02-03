import type { Bet } from '@/hooks/use-bets';

export interface PeriodStats {
  totalBets: number;
  totalStaked: number;
  totalReturn: number;
  winRate: number;
  profit: number;
  roi: number;
  averageStake: number;
  averageOdd: number;
}

export type DateRangePreset = '7' | '30' | '90' | 'month' | 'ytd' | 'all';

/** Returns [start, end] as ISO date strings (start at 00:00, end at 23:59:59 is implied by next-day exclusive if needed). */
export function getDateRangeForPreset(
  preset: DateRangePreset,
  referenceDate: Date = new Date()
): { from: string; to: string } {
  const to = new Date(referenceDate);
  to.setHours(23, 59, 59, 999);
  const from = new Date(referenceDate);

  switch (preset) {
    case '7': {
      from.setDate(from.getDate() - 7);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case '30': {
      from.setDate(from.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case '90': {
      from.setDate(from.getDate() - 90);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case 'month': {
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case 'ytd': {
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    case 'all': {
      from.setTime(0);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    default:
      from.setDate(from.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: to.toISOString() };
  }
}

/** Same-length period immediately before the given range. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const endDate = new Date(to);
  const startDate = new Date(from);
  const lengthMs = endDate.getTime() - startDate.getTime();
  const prevEnd = new Date(startDate.getTime() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd.getTime() - lengthMs);
  prevStart.setHours(0, 0, 0, 0);
  return { from: prevStart.toISOString(), to: prevEnd.toISOString() };
}

export function filterBetsByDateRange(
  bets: Bet[],
  from: string,
  to: string
): Bet[] {
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime();
  return bets.filter((bet) => {
    const t = new Date(bet.bet_date).getTime();
    return t >= fromTime && t <= toTime;
  });
}

export function statsForDateRange(bets: Bet[]): PeriodStats {
  const totalBets = bets.length;
  const totalStaked = bets.reduce((sum, bet) => sum + bet.stake_amount, 0);

  const wonBets = bets.filter((b) => b.status === 'won');
  const lostBets = bets.filter((b) => b.status === 'lost');
  const cashoutBets = bets.filter((b) => b.status === 'cashout');
  const halfWonBets = bets.filter((b) => b.status === 'half_won');
  const halfLostBets = bets.filter((b) => b.status === 'half_lost');

  const totalReturn =
    wonBets.reduce((s, b) => s + b.potential_return, 0) +
    cashoutBets.reduce((s, b) => s + (b.cashout_amount ?? 0), 0) +
    halfWonBets.reduce((s, b) => s + (b.stake_amount + b.potential_return) / 2, 0) +
    halfLostBets.reduce((s, b) => s + b.stake_amount / 2, 0);

  const winEquiv = wonBets.length + cashoutBets.length + halfWonBets.length * 0.5;
  const lossEquiv = lostBets.length + halfLostBets.length * 0.5;
  const settledCount = winEquiv + lossEquiv;
  const winRate = settledCount > 0 ? (winEquiv / settledCount) * 100 : 0;
  const profit = totalReturn - totalStaked;
  const roi = totalStaked > 0 ? (profit / totalStaked) * 100 : 0;
  const averageStake = totalBets > 0 ? totalStaked / totalBets : 0;
  const totalOdds = bets.reduce((s, b) => s + b.odds, 0);
  const averageOdd = totalBets > 0 ? totalOdds / totalBets : 0;

  return {
    totalBets,
    totalStaked,
    totalReturn,
    winRate,
    profit,
    roi,
    averageStake,
    averageOdd,
  };
}

/** Trend: positive = improvement (e.g. profit went up), negative = worse. For profit/ROI/winRate higher is better; for losses lower is better. */
export function compareTrend(
  current: number,
  previous: number,
  higherIsBetter: boolean = true
): { trend: 'up' | 'down' | 'neutral'; pctChange: number } {
  if (previous === 0) {
    return { trend: current > 0 ? 'up' : current < 0 ? 'down' : 'neutral', pctChange: 0 };
  }
  const pctChange = ((current - previous) / Math.abs(previous)) * 100;
  const improved = higherIsBetter ? current > previous : current < previous;
  return {
    trend: Math.abs(pctChange) < 0.01 ? 'neutral' : improved ? 'up' : 'down',
    pctChange,
  };
}
