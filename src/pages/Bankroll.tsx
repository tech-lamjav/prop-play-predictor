import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import { BetsHeader } from '../components/bets/BetsHeader';
import { BankrollEvolutionChart } from '@/components/bets/BankrollEvolutionChart';
import { CashFlowTable } from '../components/bets/CashFlowTable';
import { useUserUnit } from '@/hooks/use-user-unit';
import { createClient } from '../integrations/supabase/client';
import { useState, useEffect } from 'react';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Bet {
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
  status: 'pending' | 'won' | 'lost' | 'void' | 'cashout' | 'half_won' | 'half_lost';
  bet_date: string;
  match_date?: string;
  created_at: string;
  updated_at: string;
  raw_input?: string;
  processed_data?: any;
  cashout_amount?: number;
  cashout_date?: string;
  cashout_odds?: number;
  is_cashout?: boolean;
  channel?: string;
  tags?: Tag[];
}

export default function Bankroll() {
  const { user, isLoading: authLoading } = useAuth();
  const { formatWithUnits, config, updateConfig, formatCurrency } = useUserUnit();
  const supabase = createClient();
  const [bets, setBets] = useState<Bet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchBets();
    }
  }, [user?.id]);

  const fetchBets = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch tags for each bet
      const betsWithTags = await Promise.all(
        (data || []).map(async (bet) => {
          const { data: tags } = await supabase.rpc('get_bet_tags', { p_bet_id: bet.id });
          return { ...bet, tags: tags || [] };
        })
      );

      setBets(betsWithTags as any);
    } catch (err) {
      console.error('Error fetching bets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-terminal-black text-terminal-text flex items-center justify-center">
        <div className="text-terminal-blue">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-terminal-black text-terminal-text">
      <BetsHeader />
      
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <CashFlowTable 
          bets={bets}
          initialBankroll={config.bank_amount}
          formatCurrency={formatCurrency}
        />
      </div>
    </div>
  );
}
