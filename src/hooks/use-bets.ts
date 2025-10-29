import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../integrations/supabase/client';

export interface Bet {
  id: string;
  user_id: string;
  bet_type: string;
  sport: string;
  league?: string;
  match_description?: string;
  bet_description: string;
  odds: number;
  stake_amount: number;
  potential_return: number;
  status: 'pending' | 'won' | 'lost' | 'void';
  bet_date: string;
  match_date?: string;
  created_at: string;
  updated_at: string;
  raw_input?: string;
  processed_data?: any;
}

export interface BetStats {
  totalBets: number;
  totalStaked: number;
  totalReturn: number;
  winRate: number;
  profit: number;
  roi: number;
}

export interface BetAggregation {
  period: string;
  total: number;
  won: number;
  lost: number;
  pending: number;
  cashout: number;
  profit: number;
}

export interface SportStats {
  sport: string;
  count: number;
  winRate: number;
  profit: number;
  totalStaked: number;
}

export function useBets(userId: string) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [stats, setStats] = useState<BetStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const calculateStats = useCallback((betsData: Bet[]) => {
    const totalBets = betsData.length;
    const totalStaked = betsData.reduce((sum, bet) => sum + bet.stake_amount, 0);
    
    const wonBets = betsData.filter(bet => bet.status === 'won');
    const lostBets = betsData.filter(bet => bet.status === 'lost');
    const pendingBets = betsData.filter(bet => bet.status === 'pending');
    
    const totalReturn = wonBets.reduce((sum, bet) => sum + bet.potential_return, 0);
    const totalLost = lostBets.reduce((sum, bet) => sum + bet.stake_amount, 0);
    
    const winRate = totalBets > 0 ? (wonBets.length / (wonBets.length + lostBets.length)) * 100 : 0;
    const profit = totalReturn - totalLost;
    const roi = totalStaked > 0 ? (profit / totalStaked) * 100 : 0;

    setStats({
      totalBets,
      totalStaked,
      totalReturn,
      winRate,
      profit,
      roi
    });
  }, []);

  const fetchBets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!userId) {
        setBets([]);
        setStats(null);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setBets(data || []);
      calculateStats(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar apostas');
    } finally {
      setIsLoading(false);
    }
  }, [userId, supabase, calculateStats]);

  useEffect(() => {
    if (userId && userId.trim() !== '') {
      fetchBets();
    } else {
      setBets([]);
      setStats(null);
      setIsLoading(false);
    }
  }, [userId, fetchBets]);

  const addBet = async (betData: Partial<Bet>) => {
    try {
      const { data, error } = await supabase
        .from('bets')
        .insert({
          ...betData,
          user_id: userId
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setBets(prev => [data, ...prev]);
      calculateStats([data, ...bets]);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar aposta');
      throw err;
    }
  };

  const updateBet = async (betId: string, updates: Partial<Bet>) => {
    try {
      const { data, error } = await supabase
        .from('bets')
        .update(updates)
        .eq('id', betId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setBets(prev => prev.map(bet => bet.id === betId ? data : bet));
      calculateStats(bets.map(bet => bet.id === betId ? data : bet));
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar aposta');
      throw err;
    }
  };

  const deleteBet = async (betId: string) => {
    try {
      const { error } = await supabase
        .from('bets')
        .delete()
        .eq('id', betId);

      if (error) {
        throw error;
      }

      setBets(prev => prev.filter(bet => bet.id !== betId));
      calculateStats(bets.filter(bet => bet.id !== betId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar aposta');
      throw err;
    }
  };

  const getBetsByStatus = (status: string) => {
    return bets.filter(bet => bet.status === status);
  };

  const getBetsBySport = (sport: string) => {
    return bets.filter(bet => bet.sport === sport);
  };

  const getBetsByDateRange = (startDate: string, endDate: string) => {
    return bets.filter(bet => {
      const betDate = new Date(bet.bet_date);
      return betDate >= new Date(startDate) && betDate <= new Date(endDate);
    });
  };

  const getBetsByPeriod = (period: 'day' | 'week' | 'month') => {
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
        acc[key] = [];
      }
      acc[key].push(bet);
      return acc;
    }, {} as Record<string, Bet[]>);

    return Object.entries(groupedBets)
      .map(([period, bets]) => ({ period, bets }))
      .sort((a, b) => a.period.localeCompare(b.period));
  };

  const getSportDistribution = () => {
    const sportStats = bets.reduce((acc, bet) => {
      if (!acc[bet.sport]) {
        acc[bet.sport] = {
          sport: bet.sport,
          count: 0,
          wins: 0,
          profit: 0,
          totalStaked: 0,
        };
      }
      
      acc[bet.sport].count++;
      acc[bet.sport].totalStaked += bet.stake_amount;
      
      if (bet.status === 'won') {
        acc[bet.sport].wins++;
        acc[bet.sport].profit += bet.potential_return - bet.stake_amount;
      } else if (bet.status === 'cashout') {
        acc[bet.sport].wins++;
        acc[bet.sport].profit += (bet.cashout_amount || 0) - bet.stake_amount;
      } else if (bet.status === 'lost') {
        acc[bet.sport].profit -= bet.stake_amount;
      }
      
      return acc;
    }, {} as Record<string, SportStats & { wins: number }>);

    return Object.values(sportStats).map(sport => ({
      sport: sport.sport,
      count: sport.count,
      winRate: sport.count > 0 ? (sport.wins / sport.count) * 100 : 0,
      profit: sport.profit,
      totalStaked: sport.totalStaked,
    }));
  };

  const getProfitTimeline = () => {
    const betsByDate = bets.reduce((acc, bet) => {
      const date = new Date(bet.bet_date).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(bet);
      return acc;
    }, {} as Record<string, Bet[]>);

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
      });
      
      cumulativeProfit += dailyProfit;
      
      return {
        date,
        cumulativeProfit,
        dailyProfit,
        betsCount: dayBets.length,
      };
    });
  };

  return {
    bets,
    stats,
    isLoading,
    error,
    fetchBets,
    addBet,
    updateBet,
    deleteBet,
    getBetsByStatus,
    getBetsBySport,
    getBetsByDateRange,
    getBetsByPeriod,
    getSportDistribution,
    getProfitTimeline
  };
}
