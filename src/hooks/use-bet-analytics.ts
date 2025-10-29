import { useMemo } from 'react';
import { Bet } from './use-bets';

export interface ExtendedBetStats {
  totalBets: number;
  totalStaked: number;
  totalReturn: number;
  winRate: number;
  profit: number;
  roi: number;
  averageOdds: number;
  biggestWin: number;
  biggestLoss: number;
  currentStreak: {
    type: 'win' | 'loss' | 'none';
    count: number;
  };
  totalCashouts: number;
  cashoutAmount: number;
  pendingAmount: number;
  lostAmount: number;
}

export interface ProfitTimelineData {
  date: string;
  cumulativeProfit: number;
  dailyProfit: number;
  betsCount: number;
}

export interface VolumeData {
  period: string;
  total: number;
  won: number;
  lost: number;
  pending: number;
  cashout: number;
}

export interface SportDistributionData {
  sport: string;
  count: number;
  percentage: number;
  profit: number;
}

export interface PerformanceHeatmapData {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
  performance: number; // win rate or profit
  betsCount: number;
}

export function useBetAnalytics(bets: Bet[]) {
  const extendedStats = useMemo((): ExtendedBetStats => {
    if (bets.length === 0) {
      return {
        totalBets: 0,
        totalStaked: 0,
        totalReturn: 0,
        winRate: 0,
        profit: 0,
        roi: 0,
        averageOdds: 0,
        biggestWin: 0,
        biggestLoss: 0,
        currentStreak: { type: 'none', count: 0 },
        totalCashouts: 0,
        cashoutAmount: 0,
        pendingAmount: 0,
        lostAmount: 0,
      };
    }

    const totalBets = bets.length;
    const totalStaked = bets.reduce((sum, bet) => sum + bet.stake_amount, 0);
    
    const wonBets = bets.filter(bet => bet.status === 'won');
    const lostBets = bets.filter(bet => bet.status === 'lost');
    const cashoutBets = bets.filter(bet => bet.status === 'cashout');
    const pendingBets = bets.filter(bet => bet.status === 'pending');
    
    const totalReturn = wonBets.reduce((sum, bet) => sum + bet.potential_return, 0);
    const cashoutAmount = cashoutBets.reduce((sum, bet) => sum + (bet.cashout_amount || 0), 0);
    const totalLost = lostBets.reduce((sum, bet) => sum + bet.stake_amount, 0);
    const pendingAmount = pendingBets.reduce((sum, bet) => sum + bet.stake_amount, 0);
    
    const totalEarnings = totalReturn + cashoutAmount;
    const profit = totalEarnings - totalStaked;
    const winRate = totalBets > 0 ? ((wonBets.length + cashoutBets.length) / (wonBets.length + lostBets.length + cashoutBets.length)) * 100 : 0;
    const roi = totalStaked > 0 ? (profit / totalStaked) * 100 : 0;
    
    const averageOdds = bets.length > 0 ? bets.reduce((sum, bet) => sum + bet.odds, 0) / bets.length : 0;
    
    const biggestWin = Math.max(
      ...wonBets.map(bet => bet.potential_return),
      ...cashoutBets.map(bet => bet.cashout_amount || 0),
      0
    );
    
    const biggestLoss = Math.max(...lostBets.map(bet => bet.stake_amount), 0);
    
    // Calculate current streak
    const sortedBets = [...bets].sort((a, b) => new Date(b.bet_date).getTime() - new Date(a.bet_date).getTime());
    let currentStreak = { type: 'none' as const, count: 0 };
    
    if (sortedBets.length > 0) {
      const latestBet = sortedBets[0];
      if (latestBet.status === 'won' || latestBet.status === 'cashout') {
        currentStreak.type = 'win';
      } else if (latestBet.status === 'lost') {
        currentStreak.type = 'loss';
      }
      
      for (const bet of sortedBets) {
        if (currentStreak.type === 'win' && (bet.status === 'won' || bet.status === 'cashout')) {
          currentStreak.count++;
        } else if (currentStreak.type === 'loss' && bet.status === 'lost') {
          currentStreak.count++;
        } else if (bet.status === 'pending' || bet.status === 'void') {
          continue;
        } else {
          break;
        }
      }
    }

    return {
      totalBets,
      totalStaked,
      totalReturn: totalEarnings,
      winRate,
      profit,
      roi,
      averageOdds,
      biggestWin,
      biggestLoss,
      currentStreak,
      totalCashouts: cashoutBets.length,
      cashoutAmount,
      pendingAmount,
      lostAmount: totalLost,
    };
  }, [bets]);

  const profitTimeline = useMemo((): ProfitTimelineData[] => {
    if (bets.length === 0) return [];

    // Group bets by date
    const betsByDate = bets.reduce((acc, bet) => {
      const date = new Date(bet.bet_date).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(bet);
      return acc;
    }, {} as Record<string, Bet[]>);

    // Calculate daily profits and cumulative
    const dates = Object.keys(betsByDate).sort();
    let cumulativeProfit = 0;
    
    return dates.map(date => {
      const dayBets = betsByDate[date];
      let dailyProfit = 0;
      
      dayBets.forEach(bet => {
        if (bet.status === 'won') {
          dailyProfit += bet.potential_return - bet.stake_amount;
        } else if (bet.status === 'cashout') {
          dailyProfit += (bet.cashout_amount || 0) - bet.stake_amount;
        } else if (bet.status === 'lost') {
          dailyProfit -= bet.stake_amount;
        }
        // Pending bets don't affect daily profit
      });
      
      cumulativeProfit += dailyProfit;
      
      return {
        date,
        cumulativeProfit,
        dailyProfit,
        betsCount: dayBets.length,
      };
    });
  }, [bets]);

  const volumeData = useMemo(() => (period: 'day' | 'week' | 'month' = 'day'): VolumeData[] => {
    if (bets.length === 0) return [];

    const groupedBets = bets.reduce((acc, bet) => {
      const betDate = new Date(bet.bet_date);
      let key: string;
      
      switch (period) {
        case 'day':
          key = betDate.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(betDate);
          weekStart.setDate(betDate.getDate() - betDate.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${betDate.getFullYear()}-${String(betDate.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = betDate.toISOString().split('T')[0];
      }
      
      if (!acc[key]) {
        acc[key] = { total: 0, won: 0, lost: 0, pending: 0, cashout: 0 };
      }
      
      acc[key].total++;
      acc[key][bet.status as keyof typeof acc[string]]++;
      
      return acc;
    }, {} as Record<string, VolumeData>);

    return Object.entries(groupedBets)
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [bets]);

  const sportDistribution = useMemo((): SportDistributionData[] => {
    if (bets.length === 0) return [];

    const sportStats = bets.reduce((acc, bet) => {
      if (!acc[bet.sport]) {
        acc[bet.sport] = {
          count: 0,
          profit: 0,
          totalStaked: 0,
        };
      }
      
      acc[bet.sport].count++;
      acc[bet.sport].totalStaked += bet.stake_amount;
      
      if (bet.status === 'won') {
        acc[bet.sport].profit += bet.potential_return - bet.stake_amount;
      } else if (bet.status === 'cashout') {
        acc[bet.sport].profit += (bet.cashout_amount || 0) - bet.stake_amount;
      } else if (bet.status === 'lost') {
        acc[bet.sport].profit -= bet.stake_amount;
      }
      
      return acc;
    }, {} as Record<string, { count: number; profit: number; totalStaked: number }>);

    const totalBets = bets.length;
    
    return Object.entries(sportStats)
      .map(([sport, stats]) => ({
        sport,
        count: stats.count,
        percentage: (stats.count / totalBets) * 100,
        profit: stats.profit,
      }))
      .sort((a, b) => b.count - a.count);
  }, [bets]);

  const performanceHeatmap = useMemo((): PerformanceHeatmapData[] => {
    if (bets.length === 0) return [];

    const heatmapData: Record<string, { wins: number; total: number; profit: number }> = {};
    
    bets.forEach(bet => {
      const betDate = new Date(bet.bet_date);
      const dayOfWeek = betDate.getDay();
      const hour = betDate.getHours();
      const key = `${dayOfWeek}-${hour}`;
      
      if (!heatmapData[key]) {
        heatmapData[key] = { wins: 0, total: 0, profit: 0 };
      }
      
      heatmapData[key].total++;
      
      if (bet.status === 'won') {
        heatmapData[key].wins++;
        heatmapData[key].profit += bet.potential_return - bet.stake_amount;
      } else if (bet.status === 'cashout') {
        heatmapData[key].wins++;
        heatmapData[key].profit += (bet.cashout_amount || 0) - bet.stake_amount;
      } else if (bet.status === 'lost') {
        heatmapData[key].profit -= bet.stake_amount;
      }
    });

    return Object.entries(heatmapData)
      .map(([key, data]) => {
        const [dayOfWeek, hour] = key.split('-').map(Number);
        return {
          dayOfWeek,
          hour,
          performance: data.total > 0 ? (data.wins / data.total) * 100 : 0,
          betsCount: data.total,
        };
      })
      .filter(data => data.betsCount > 0);
  }, [bets]);

  return {
    extendedStats,
    profitTimeline,
    volumeData,
    sportDistribution,
    performanceHeatmap,
  };
}
