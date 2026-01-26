import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/use-auth';
import { createClient } from '../integrations/supabase/client';
import { BetsHeader } from '../components/bets/BetsHeader';
import { BetStatsCard } from '../components/bets/BetStatsCard';
import { TagSelector } from '../components/bets/TagSelector';
import { UnitConfigurationModal } from '../components/UnitConfigurationModal';
import { BankrollEvolutionChart } from '@/components/bets/BankrollEvolutionChart';
import { ReferralModal } from '../components/ReferralModal';
import { useUserUnit } from '@/hooks/use-user-unit';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  DollarSign,
  Calendar,
  X,
  Filter,
  Edit,
  Save,
  Settings,
  Search,
  Trash2,
  ChevronRight
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { useToast } from '../hooks/use-toast';

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
  status: 'pending' | 'won' | 'lost' | 'void' | 'cashout';
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
  betting_house?: string;
  tags?: Tag[];
}

const SPORTS_LIST = [
  'Futebol',
  'Basquete',
  'Atletismo',
  'Automobilismo',
  'Badminton',
  'Beisebol',
  'Biatlo',
  'Boxe',
  'Corrida de Cavalos',
  'Críquete',
  'Ciclismo',
  'Dardos',
  'eSports',
  'Esqui',
  'Futebol Americano',
  'Futsal',
  'Golfe',
  'Handebol',
  'Hóquei no Gelo',
  'MMA/UFC',
  'Natação',
  'Outros',
  'Padel',
  'Rugby',
  'Snooker',
  'Tênis',
  'Tênis de Mesa',
  'Vôlei',
  'Vôlei de Praia',
];

const LEAGUES_LIST = [
  'US - NBA',
  'BR - Série A',
  'EU - Champions League',
  'AL - Bundesliga',
  'AME - Copa Libertadores',
  'AME - Copa Sul-Americana',
  'AU - NBL',
  'BEL - Pro League',
  'BR - Copa do Brasil',
  'BR - Paulistão',
  'Diversos',
  'EN - Premier League',
  'ES - La Liga',
  'EU - Conference League',
  'EU - Eliminatórias UEFA Copa do Mundo',
  'EU - Europa League',
  'Fórmula 1',
  'FR - Ligue 1',
  'Futebol',
  'HOL - Eerste Divisie',
  'ITA - Série A',
  'ME - Liga Premier',
  'Mundial de Clubes FIFA',
  'Outros',
  'PT - Primeira Liga',
  'SAU - Pro League',
  'TUR - Lig 1',
  'US - NFL',
];

export default function Bets() {
  const { user, isLoading: authLoading } = useAuth();
  const { isConfigured, formatWithUnits, config, updateConfig, formatCurrency } = useUserUnit();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [bets, setBets] = useState<Bet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unitConfigOpen, setUnitConfigOpen] = useState(false);
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalBets: 0,
    totalStaked: 0,
    totalReturn: 0,
    winRate: 0,
    profit: 0,
    averageStake: 0,
    averageOdd: 0,
    roi: 0
  });
  
  // Modals state
  const [cashoutModal, setCashoutModal] = useState<{
    isOpen: boolean;
    bet: Bet | null;
    cashoutAmount: string;
    cashoutOdds: string;
  }>({
    isOpen: false,
    bet: null,
    cashoutAmount: '',
    cashoutOdds: ''
  });
  
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    bet: Bet | null;
    formData: {
      bet_description: string;
      match_description: string;
      sport: string;
      league: string;
      odds: string;
      stake_amount: string;
      bet_date: string;
      match_date: string;
      status: 'pending' | 'won' | 'lost' | 'void' | 'cashout';
    };
  }>({
    isOpen: false,
    bet: null,
    formData: {
      bet_description: '',
      match_description: '',
      sport: '',
      league: '',
      odds: '',
      stake_amount: '',
      bet_date: '',
      match_date: '',
      status: 'pending'
    }
  });

  const [isSportDropdownOpen, setIsSportDropdownOpen] = useState(false);
  const [isSportQueryTouched, setIsSportQueryTouched] = useState(false);
  const [sportHighlightIndex, setSportHighlightIndex] = useState(-1);
  const sportItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  
  const [isLeagueDropdownOpen, setIsLeagueDropdownOpen] = useState(false);
  const [isLeagueQueryTouched, setIsLeagueQueryTouched] = useState(false);
  const [leagueHighlightIndex, setLeagueHighlightIndex] = useState(-1);
  const leagueItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  
  // Filter states
  const [filters, setFilters] = useState({
    status: 'all',
    sport: 'all',
    league: 'all',
    searchQuery: '',
    dateFrom: '',
    dateTo: '',
    selectedTag: 'all'
  });

  // User tags state
  const [userTags, setUserTags] = useState<Tag[]>([]);

  const supabase = useMemo(() => createClient(), []);
  const isMountedRef = useRef(true);

  const fetchBets = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      if (!isMountedRef.current) return;
      setIsLoading(true);

      const { data, error } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!isMountedRef.current) return;

      // Fetch tags for each bet
      const betsWithTags = await Promise.all(
        (data || []).map(async (bet) => {
          if (!isMountedRef.current) return null;
          const { data: tags } = await supabase.rpc('get_bet_tags', { p_bet_id: bet.id });
          return { ...bet, tags: tags || [] };
        })
      );

      if (!isMountedRef.current) return;

      setBets(betsWithTags.filter(Boolean) as any);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Error fetching bets:', err);
      toast({
        title: 'Error',
        description: 'Failed to load bets',
        variant: 'destructive',
      });
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [user?.id, supabase, toast]);

  const calculateStats = useCallback((betsData: Bet[]) => {
    if (!isMountedRef.current) return;
    
    const totalBets = betsData.length;
    const totalStaked = betsData.reduce((sum, bet) => sum + bet.stake_amount, 0);
    
    const wonBets = betsData.filter(bet => bet.status === 'won');
    const lostBets = betsData.filter(bet => bet.status === 'lost');
    const cashoutBets = betsData.filter(bet => bet.status === 'cashout');
    
    const totalReturn = wonBets.reduce((sum, bet) => sum + bet.potential_return, 0);
    const totalCashout = cashoutBets.reduce((sum, bet) => sum + (bet.cashout_amount || 0), 0);
    
    const totalEarnings = totalReturn + totalCashout;
    const winRate = totalBets > 0 ? ((wonBets.length + cashoutBets.length) / (wonBets.length + lostBets.length + cashoutBets.length)) * 100 : 0;
    const profit = totalEarnings - totalStaked;
    const averageStake = totalBets > 0 ? totalStaked / totalBets : 0;
    
    const totalOdds = betsData.reduce((sum, bet) => sum + bet.odds, 0);
    const averageOdd = totalBets > 0 ? totalOdds / totalBets : 0;
    
    const roi = totalStaked > 0 ? (profit / totalStaked) * 100 : 0;

    if (isMountedRef.current) {
      setStats({
        totalBets,
        totalStaked,
        totalReturn: totalEarnings,
        winRate,
        profit,
        averageStake,
        averageOdd,
        roi
      });
    }
  }, []);

  // ... (Keep existing updateBetStatus, deleteBet, processCashout, updateBetData logic but adapted if needed)
  // For brevity, I'm keeping the logic but ensuring it uses the toast for notifications instead of local error state where appropriate
  
  const updateBetStatus = async (betId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('bets')
        .update({ status: newStatus })
        .eq('id', betId);

      if (error) throw error;
      if (isMountedRef.current) {
        await fetchBets();
        toast({ title: 'Success', description: 'Bet status updated' });
      }
    } catch (err) {
      if (isMountedRef.current) {
        toast({ title: 'Error', description: 'Failed to update bet status', variant: 'destructive' });
      }
    }
  };

  const deleteBet = async (betId: string) => {
    if (!window.confirm('Are you sure you want to delete this bet?')) return;
    
    try {
      const { error } = await supabase
        .from('bets')
        .delete()
        .eq('id', betId);

      if (error) throw error;
      if (isMountedRef.current) {
        await fetchBets();
        toast({ title: 'Success', description: 'Bet deleted' });
      }
    } catch (err) {
      if (isMountedRef.current) {
        toast({ title: 'Error', description: 'Failed to delete bet', variant: 'destructive' });
      }
    }
  };

  const processCashout = async () => {
    if (!cashoutModal.bet || !cashoutModal.cashoutAmount) return;
    
    try {
      const cashoutAmount = parseFloat(cashoutModal.cashoutAmount);
      if (isNaN(cashoutAmount)) throw new Error('Invalid amount');

      const { error } = await supabase
        .from('bets')
        .update({
          status: 'cashout',
          cashout_amount: cashoutAmount,
          cashout_date: new Date().toISOString(),
          is_cashout: true
        })
        .eq('id', cashoutModal.bet.id);

      if (error) throw error;

      if (isMountedRef.current) {
        setCashoutModal({ isOpen: false, bet: null, cashoutAmount: '', cashoutOdds: '' });
        await fetchBets();
        toast({ title: 'Success', description: 'Cashout processed' });
      }
    } catch (err) {
      if (isMountedRef.current) {
        toast({ title: 'Error', description: 'Failed to process cashout', variant: 'destructive' });
      }
    }
  };

  const updateBetData = async () => {
    if (!editModal.bet) return;

    try {
      const odds = parseFloat(editModal.formData.odds);
      const stakeAmount = parseFloat(editModal.formData.stake_amount);
      const potentialReturn = stakeAmount * odds;

      const updateData: any = {
        bet_description: editModal.formData.bet_description,
        match_description: editModal.formData.match_description || null,
        sport: editModal.formData.sport,
        league: editModal.formData.league || null,
        odds: odds,
        stake_amount: stakeAmount,
        potential_return: potentialReturn,
        bet_date: editModal.formData.bet_date || new Date().toISOString(),
        match_date: editModal.formData.match_date || null,
        status: editModal.formData.status,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('bets')
        .update(updateData)
        .eq('id', editModal.bet.id);

      if (error) throw error;

      if (isMountedRef.current) {
        setEditModal(prev => ({ ...prev, isOpen: false }));
        await fetchBets();
        toast({ title: 'Success', description: 'Bet updated' });
      }
    } catch (err) {
      if (isMountedRef.current) {
        toast({ title: 'Error', description: 'Failed to update bet', variant: 'destructive' });
      }
    }
  };

  // Helper functions
  const openCashoutModal = (bet: Bet) => {
    setCashoutModal({
      isOpen: true,
      bet,
      cashoutAmount: bet.cashout_amount?.toString() || '',
      cashoutOdds: bet.cashout_odds?.toString() || ''
    });
  };

  const openEditModal = (bet: Bet) => {
    setEditModal({
      isOpen: true,
      bet,
      formData: {
        bet_description: bet.bet_description || '',
        match_description: bet.match_description || '',
        sport: bet.sport || '',
        league: bet.league || '',
        odds: bet.odds?.toString() || '',
        stake_amount: bet.stake_amount?.toString() || '',
        bet_date: bet.bet_date ? new Date(bet.bet_date).toISOString().split('T')[0] : '',
        match_date: bet.match_date ? new Date(bet.match_date).toISOString().split('T')[0] : '',
        status: bet.status || 'pending'
      }
    });
    setIsSportDropdownOpen(false);
    setIsSportQueryTouched(false);
    setSportHighlightIndex(-1);
    setIsLeagueDropdownOpen(false);
    setIsLeagueQueryTouched(false);
    setLeagueHighlightIndex(-1);
  };

  const fetchReferralCode = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('referral_code')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      if (isMountedRef.current) {
        setReferralCode((data as any)?.referral_code || null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error fetching referral code:', err);
      }
    }
  }, [user?.id, supabase]);

  const fetchUserTags = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      
      if (isMountedRef.current) {
        setUserTags(data || []);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Error fetching user tags:', err);
      }
    }
  }, [user?.id, supabase]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (user?.id) {
      fetchBets();
      fetchReferralCode();
      fetchUserTags();
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [user?.id, fetchBets, fetchReferralCode, fetchUserTags]);

  // Filter logic
  const uniqueSports = useMemo(() => {
    const sports = Array.from(new Set(bets.map(bet => bet.sport).filter(Boolean)));
    return sports.sort();
  }, [bets]);

  const uniqueLeagues = useMemo(() => {
    const leagues = Array.from(new Set(bets.map(bet => bet.league).filter(Boolean)));
    return leagues.sort();
  }, [bets]);

  const filteredBets = useMemo(() => {
    return bets.filter(bet => {
      if (filters.status !== 'all' && bet.status !== filters.status) return false;
      if (filters.sport !== 'all' && bet.sport !== filters.sport) return false;
      if (filters.league !== 'all' && bet.league !== filters.league) return false;
      if (filters.dateFrom) {
        if (new Date(bet.bet_date) < new Date(filters.dateFrom)) return false;
      }
      if (filters.dateTo) {
        const filterDate = new Date(filters.dateTo);
        filterDate.setHours(23, 59, 59, 999);
        if (new Date(bet.bet_date) > filterDate) return false;
      }
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchDescription = bet.bet_description?.toLowerCase().includes(query);
        const matchMatch = bet.match_description?.toLowerCase().includes(query);
        const matchLeague = bet.league?.toLowerCase().includes(query);
        if (!matchDescription && !matchMatch && !matchLeague) return false;
      }
      // Filter by tag: bet must have the selected tag
      if (filters.selectedTag !== 'all') {
        const betTagIds = (bet.tags || []).map(tag => tag.id);
        if (!betTagIds.includes(filters.selectedTag)) return false;
      }
      return true;
    });
  }, [bets, filters]);

  const filteredSportsList = useMemo(() => {
    if (!isSportQueryTouched) {
      return SPORTS_LIST;
    }
    const query = editModal.formData.sport.trim().toLowerCase();
    if (!query) return SPORTS_LIST;
    return SPORTS_LIST.filter((sport) => sport.toLowerCase().includes(query));
  }, [editModal.formData.sport, isSportQueryTouched]);

  const filteredLeaguesList = useMemo(() => {
    if (!isLeagueQueryTouched) {
      return LEAGUES_LIST;
    }
    const query = editModal.formData.league.trim().toLowerCase();
    if (!query) return LEAGUES_LIST;
    return LEAGUES_LIST.filter((league) => league.toLowerCase().includes(query));
  }, [editModal.formData.league, isLeagueQueryTouched]);

  useEffect(() => {
    if (!isSportDropdownOpen || filteredSportsList.length === 0) {
      setSportHighlightIndex(-1);
      return;
    }

    setSportHighlightIndex((prev) => {
      if (prev < 0 || prev >= filteredSportsList.length) {
        return 0;
      }
      return prev;
    });
  }, [isSportDropdownOpen, filteredSportsList.length]);

  useEffect(() => {
    if (!isSportDropdownOpen || sportHighlightIndex < 0) return;
    const currentItem = sportItemRefs.current[sportHighlightIndex];
    if (currentItem?.scrollIntoView) {
      currentItem.scrollIntoView({ block: 'nearest' });
    }
  }, [isSportDropdownOpen, sportHighlightIndex]);

  useEffect(() => {
    if (!isLeagueDropdownOpen || filteredLeaguesList.length === 0) {
      setLeagueHighlightIndex(-1);
      return;
    }

    setLeagueHighlightIndex((prev) => {
      if (prev < 0 || prev >= filteredLeaguesList.length) {
        return 0;
      }
      return prev;
    });
  }, [isLeagueDropdownOpen, filteredLeaguesList.length]);

  useEffect(() => {
    if (!isLeagueDropdownOpen || leagueHighlightIndex < 0) return;
    const currentItem = leagueItemRefs.current[leagueHighlightIndex];
    if (currentItem?.scrollIntoView) {
      currentItem.scrollIntoView({ block: 'nearest' });
    }
  }, [isLeagueDropdownOpen, leagueHighlightIndex]);

  useEffect(() => {
    if (isMountedRef.current) {
      calculateStats(filteredBets);
    }
  }, [filteredBets, calculateStats]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-terminal-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-terminal-green"></div>
      </div>
    );
  }

  // Helper to translate status
  const translateStatus = (status: string) => {
    const map: Record<string, string> = {
      'pending': 'PENDENTE',
      'won': 'GANHOU',
      'lost': 'PERDEU',
      'void': 'ANULADA',
      'cashout': 'CASHOUT'
    };
    return map[status] || status.toUpperCase();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-terminal-black flex items-center justify-center text-terminal-text">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-terminal-red" />
          <p>Por favor, faça login para ver suas apostas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-terminal-black text-terminal-text">
      <BetsHeader onReferralClick={() => setReferralModalOpen(true)} />
      
      <main className="container mx-auto px-3 py-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <BetStatsCard 
            label="TOTAL APOSTAS" 
            value={stats.totalBets}
            valueColor="text-terminal-text"
          />
          <BetStatsCard 
            label="TAXA DE ACERTO" 
            value={`${stats.winRate.toFixed(1)}%`}
            trend={stats.winRate > 50 ? 'up' : 'down'}
          />
          <BetStatsCard 
            label="LUCRO" 
            value={formatWithUnits(stats.profit)}
            valueColor={stats.profit >= 0 ? 'text-terminal-green' : 'text-terminal-red'}
            trend={stats.profit >= 0 ? 'up' : 'down'}
          />
          <BetStatsCard 
            label="ROI" 
            value={`${stats.roi.toFixed(1)}%`}
            valueColor={stats.roi >= 0 ? 'text-terminal-green' : 'text-terminal-red'}
          />
          <BetStatsCard 
            label="TOTAL APOSTADO" 
            value={formatWithUnits(stats.totalStaked)}
            valueColor="text-terminal-text"
          />
          <BetStatsCard 
            label="RETORNO TOTAL" 
            value={formatWithUnits(stats.totalReturn)}
            valueColor="text-terminal-green"
          />
          <BetStatsCard 
            label="MÉDIA APOSTA" 
            value={formatWithUnits(stats.averageStake)}
            valueColor="text-terminal-text"
          />
          <BetStatsCard 
            label="MÉDIA ODDS" 
            value={stats.averageOdd.toFixed(2)}
            valueColor="text-terminal-blue"
          />
        </div>

        <BankrollEvolutionChart 
          bets={bets} 
          initialBankroll={config.bank_amount}
          onUpdateBankroll={async (amount) => {
            if (config.unit_calculation_method === 'direct') {
               return await updateConfig({
                 method: 'direct',
                 unitValue: config.unit_value || 10,
                 bankAmount: amount
               });
            } else {
               const currentDivisor = config.bank_amount && config.unit_value 
                  ? config.bank_amount / config.unit_value 
                  : 100;
               
               return await updateConfig({
                 method: 'division',
                 bankAmount: amount,
                 divisor: currentDivisor
               });
            }
          }}
        />

        {/* Cash Flow Button */}
        <button
          onClick={() => navigate('/bankroll')}
          className="w-full terminal-container p-4 mb-6 flex items-center justify-between hover:bg-terminal-dark-gray/50 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-left">
              <div className="font-bold text-sm text-blue-400">FLUXO DE CAIXA</div>
              <div className="text-xs opacity-60">Histórico detalhado de transações</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-blue-400 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </button>

        {/* Filters Bar */}
        <div className="terminal-container p-3 mb-4 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 w-full">
            <div className="relative col-span-2 md:w-auto md:min-w-[200px]">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-terminal-text opacity-50" />
              <input 
                type="text" 
                placeholder="BUSCAR APOSTAS..." 
                className="terminal-input w-full pl-8 pr-3 py-1.5 text-xs rounded-sm"
                value={filters.searchQuery}
                onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
              />
            </div>
            
            <select 
              className="terminal-input px-3 py-1.5 text-xs rounded-sm w-full md:w-auto md:min-w-[120px]"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="all">TODOS STATUS</option>
              <option value="pending">PENDENTE</option>
              <option value="won">GANHOU</option>
              <option value="lost">PERDEU</option>
              <option value="cashout">CASHOUT</option>
            </select>

            <select 
              className="terminal-input px-3 py-1.5 text-xs rounded-sm w-full md:w-auto md:min-w-[120px]"
              value={filters.sport}
              onChange={(e) => setFilters(prev => ({ ...prev, sport: e.target.value }))}
            >
              <option value="all">TODOS ESPORTES</option>
              {uniqueSports.map(sport => (
                <option key={sport} value={sport}>{sport.toUpperCase()}</option>
              ))}
            </select>

            <select 
              className="terminal-input px-3 py-1.5 text-xs rounded-sm w-full md:w-auto md:min-w-[120px]"
              value={filters.league}
              onChange={(e) => setFilters(prev => ({ ...prev, league: e.target.value }))}
            >
              <option value="all">TODAS LIGAS</option>
              {uniqueLeagues.map(league => (
                <option key={league} value={league}>{league.toUpperCase()}</option>
              ))}
            </select>

            {userTags.length > 0 && (
              <select 
                className="terminal-input px-3 py-1.5 text-xs rounded-sm w-full md:w-auto md:min-w-[120px]"
                value={filters.selectedTag}
                onChange={(e) => setFilters(prev => ({ ...prev, selectedTag: e.target.value }))}
              >
                <option value="all">TODAS AS TAGS</option>
                {userTags.map(tag => (
                  <option key={tag.id} value={tag.id}>{tag.name.toUpperCase()}</option>
                ))}
              </select>
            )}

            <input 
              type="date"
              className="terminal-input px-3 py-1.5 text-xs rounded-sm w-full md:w-auto"
              value={filters.dateFrom}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              placeholder="DATA INICIAL"
            />

            <input 
              type="date"
              className="terminal-input px-3 py-1.5 text-xs rounded-sm w-full md:w-auto"
              value={filters.dateTo}
              onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              placeholder="DATA FINAL"
            />
          </div>

          <div className="flex gap-2">
             <button 
              onClick={() => setUnitConfigOpen(true)}
              className="terminal-button px-4 py-2 text-sm flex items-center gap-2 border-terminal-border hover:border-terminal-green transition-colors"
            >
              <Settings className="w-4 h-4" />
              UNIDADES
            </button>
            <button 
              onClick={fetchBets}
              className="terminal-button px-4 py-2 text-sm flex items-center gap-2 border-terminal-border hover:border-terminal-green transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              ATUALIZAR
            </button>
          </div>
        </div>

        {/* Bets Table */}
        <div className="terminal-container p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="section-title">APOSTAS RECENTES</h3>
            <span className="text-[10px] opacity-50">MOSTRANDO {filteredBets.length} APOSTAS</span>
          </div>
          
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-terminal-gray" />
              ))}
            </div>
          ) : filteredBets.length === 0 ? (
            <div className="text-center py-12 opacity-50">
              <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>NENHUMA APOSTA ENCONTRADA</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-terminal-border-subtle">
                      <th className="text-left py-2 px-2 data-label">DATA</th>
                      <th className="text-left py-2 px-2 data-label">DESCRIÇÃO</th>
                      <th className="text-left py-2 px-2 data-label">TAGS</th>
                      <th className="text-left py-2 px-2 data-label">ESPORTE</th>
                      <th className="text-left py-2 px-2 data-label">LIGA</th>
                      <th className="text-right py-2 px-2 data-label">VALOR</th>
                      <th className="text-right py-2 px-2 data-label">ODDS</th>
                      <th className="text-right py-2 px-2 data-label">RETORNO</th>
                      <th className="text-center py-2 px-2 data-label">STATUS</th>
                      <th className="text-right py-2 px-2 data-label">AÇÕES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBets.map((bet) => (
                      <tr 
                        key={bet.id}
                        className="border-b border-terminal-border-subtle hover:bg-terminal-light-gray transition-colors"
                      >
                        <td className="py-2 px-2 opacity-70">
                          {new Date(bet.bet_date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-2 px-2 font-medium">
                          <div>{bet.bet_description}</div>
                          {bet.match_description && (
                            <div className="text-[10px] opacity-50">{bet.match_description}</div>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          <TagSelector
                            betId={bet.id}
                            selectedTags={bet.tags || []}
                            onTagsChange={async (newTags) => {
                              // Update local state immediately for responsiveness
                              setBets(bets.map(b => 
                                b.id === bet.id ? { ...b, tags: newTags } : b
                              ));
                              
                              // Sync with database
                              const currentTagIds = (bet.tags || []).map(t => t.id);
                              const newTagIds = newTags.map(t => t.id);
                              
                              // Remove tags that were deselected
                              const tagsToRemove = currentTagIds.filter(id => !newTagIds.includes(id));
                              for (const tagId of tagsToRemove) {
                                await supabase.rpc('remove_tag_from_bet', {
                                  p_bet_id: bet.id,
                                  p_tag_id: tagId
                                });
                              }
                              
                              // Add tags that were selected
                              const tagsToAdd = newTagIds.filter(id => !currentTagIds.includes(id));
                              for (const tagId of tagsToAdd) {
                                await supabase.rpc('add_tag_to_bet', {
                                  p_bet_id: bet.id,
                                  p_tag_id: tagId
                                });
                              }
                              
                              // Refresh the bets list to get updated data
                              await fetchBets();
                            }}
                          />
                        </td>
                        <td className="py-2 px-2 opacity-70">
                          {bet.sport}
                        </td>
                        <td className="py-2 px-2 opacity-70">
                          {bet.league || '-'}
                        </td>
                        <td className="text-right py-2 px-2">
                          {formatWithUnits(bet.stake_amount)}
                        </td>
                        <td className="text-right py-2 px-2 text-terminal-blue">
                          {bet.odds.toFixed(2)}
                        </td>
                        <td className={`text-right py-2 px-2 ${
                          bet.status === 'won' ? 'text-terminal-green' : 
                          bet.status === 'lost' ? 'text-terminal-red' : 
                          'opacity-70'
                        }`}>
                          {bet.is_cashout && bet.cashout_amount 
                            ? formatWithUnits(bet.cashout_amount)
                            : formatWithUnits(bet.potential_return)
                          }
                        </td>
                        <td className="text-center py-2 px-2">
                          <span className={`px-2 py-0.5 text-[10px] uppercase font-bold ${
                            bet.status === 'won' ? 'text-terminal-green bg-terminal-green/10' :
                            bet.status === 'lost' ? 'text-terminal-red bg-terminal-red/10' :
                            bet.status === 'pending' ? 'text-terminal-yellow bg-terminal-yellow/10' :
                            bet.status === 'cashout' ? 'text-terminal-blue bg-terminal-blue/10' :
                            'text-terminal-text bg-terminal-text/10'
                          }`}>
                            {translateStatus(bet.status)}
                          </span>
                        </td>
                        <td className="text-right py-3 px-2">
                          <div className="flex justify-end gap-2">
                            {bet.status === 'pending' && (
                              <>
                                <button 
                                  onClick={() => updateBetStatus(bet.id, 'won')}
                                  className="px-3 py-2 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-green hover:text-terminal-black hover:border-terminal-green transition-all flex items-center gap-2"
                                  title="Marcar como Ganhou"
                                >
                                  <TrendingUp className="w-4 h-4 text-terminal-green hover:text-terminal-black" />
                                  <span className="text-[10px] font-bold text-terminal-green hover:text-terminal-black">GANHOU</span>
                                </button>
                                <button 
                                  onClick={() => updateBetStatus(bet.id, 'lost')}
                                  className="px-3 py-2 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-red hover:text-terminal-black hover:border-terminal-red transition-all flex items-center gap-2"
                                  title="Marcar como Perdeu"
                                >
                                  <TrendingDown className="w-4 h-4 text-terminal-red hover:text-terminal-black" />
                                  <span className="text-[10px] font-bold text-terminal-red hover:text-terminal-black">PERDEU</span>
                                </button>
                                <button 
                                  onClick={() => openCashoutModal(bet)}
                                  className="px-3 py-2 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-blue hover:text-terminal-black hover:border-terminal-blue transition-all flex items-center gap-2"
                                  title="Cashout"
                                >
                                  <DollarSign className="w-4 h-4 text-terminal-blue hover:text-terminal-black" />
                                  <span className="text-[10px] font-bold text-terminal-blue hover:text-terminal-black">CASHOUT</span>
                                </button>
                              </>
                            )}
                            <button 
                              onClick={() => openEditModal(bet)}
                              className="p-2 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-blue hover:text-terminal-black hover:border-terminal-blue transition-all"
                              title="Editar"
                            >
                              <Edit className="w-5 h-5 text-terminal-blue hover:text-terminal-black" />
                            </button>
                            <button 
                              onClick={() => deleteBet(bet.id)}
                              className="p-2 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-red hover:text-terminal-black hover:border-terminal-red transition-all"
                              title="Excluir"
                            >
                              <Trash2 className="w-5 h-5 text-terminal-red hover:text-terminal-black" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked View */}
              <div className="md:hidden space-y-4">
                {filteredBets.map((bet) => (
                  <div 
                    key={bet.id} 
                    className="bg-terminal-black border border-terminal-border-subtle p-4 rounded-md space-y-3"
                  >
                    {/* Header: Date + Status */}
                    <div className="flex justify-between items-center">
                      <span className="text-xs opacity-50">
                        {new Date(bet.bet_date).toLocaleDateString('pt-BR')}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${
                        bet.status === 'won' ? 'text-terminal-green bg-terminal-green/10' :
                        bet.status === 'lost' ? 'text-terminal-red bg-terminal-red/10' :
                        bet.status === 'pending' ? 'text-terminal-yellow bg-terminal-yellow/10' :
                        bet.status === 'cashout' ? 'text-terminal-blue bg-terminal-blue/10' :
                        'text-terminal-text bg-terminal-text/10'
                      }`}>
                        {translateStatus(bet.status)}
                      </span>
                    </div>

                    {/* Main Info: Description + Sport */}
                    <div>
                      <div className="font-medium text-sm text-terminal-text">{bet.bet_description}</div>
                      {bet.match_description && (
                        <div className="text-xs opacity-60 mt-0.5">{bet.match_description}</div>
                      )}
                      <div className="text-xs text-terminal-blue mt-1 uppercase tracking-wider">
                        {bet.sport}
                      </div>
                      {bet.league && (
                        <div className="text-xs text-terminal-blue mt-0.5 uppercase tracking-wider">
                          {bet.league}
                        </div>
                      )}
                      {/* Tags */}
                      <div className="mt-2">
                        <TagSelector
                          betId={bet.id}
                          selectedTags={bet.tags || []}
                          onTagsChange={async (newTags) => {
                            // Update local state immediately for responsiveness
                            setBets(bets.map(b => 
                              b.id === bet.id ? { ...b, tags: newTags } : b
                            ));
                            
                            // Sync with database
                            const currentTagIds = (bet.tags || []).map(t => t.id);
                            const newTagIds = newTags.map(t => t.id);
                            
                            // Remove tags that were deselected
                            const tagsToRemove = currentTagIds.filter(id => !newTagIds.includes(id));
                            for (const tagId of tagsToRemove) {
                              await supabase.rpc('remove_tag_from_bet', {
                                p_bet_id: bet.id,
                                p_tag_id: tagId
                              });
                            }
                            
                            // Add tags that were selected
                            const tagsToAdd = newTagIds.filter(id => !currentTagIds.includes(id));
                            for (const tagId of tagsToAdd) {
                              await supabase.rpc('add_tag_to_bet', {
                                p_bet_id: bet.id,
                                p_tag_id: tagId
                              });
                            }
                            
                            // Refresh the bets list to get updated data
                            await fetchBets();
                          }}
                        />
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-terminal-border-subtle bg-terminal-dark-gray/30 -mx-4 px-4">
                      <div className="text-center">
                        <div className="text-[10px] opacity-50 uppercase mb-0.5">Valor</div>
                        <div className="text-sm">{formatWithUnits(bet.stake_amount)}</div>
                      </div>
                      <div className="text-center border-l border-terminal-border-subtle">
                        <div className="text-[10px] opacity-50 uppercase mb-0.5">Odds</div>
                        <div className="text-sm text-terminal-blue">{bet.odds.toFixed(2)}</div>
                      </div>
                      <div className="text-center border-l border-terminal-border-subtle">
                        <div className="text-[10px] opacity-50 uppercase mb-0.5">Retorno</div>
                        <div className={`text-sm ${
                          bet.status === 'won' ? 'text-terminal-green' : 
                          bet.status === 'lost' ? 'text-terminal-red' : 
                          'opacity-70'
                        }`}>
                          {bet.is_cashout && bet.cashout_amount 
                            ? formatWithUnits(bet.cashout_amount)
                            : formatWithUnits(bet.potential_return)
                          }
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {/* Actions */}
                    <div className="pt-2">
                      {bet.status === 'pending' ? (
                        <div className="grid grid-cols-4 gap-2">
                          <button 
                            onClick={() => updateBetStatus(bet.id, 'won')}
                            className="col-span-2 py-3 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-green hover:text-terminal-black hover:border-terminal-green transition-all flex justify-center items-center gap-2"
                            title="Marcar como Ganhou"
                          >
                            <TrendingUp className="w-5 h-5 text-terminal-green hover:text-terminal-black" />
                            <span className="text-xs font-bold text-terminal-green hover:text-terminal-black">GANHOU</span>
                          </button>
                          <button 
                            onClick={() => updateBetStatus(bet.id, 'lost')}
                            className="col-span-2 py-3 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-red hover:text-terminal-black hover:border-terminal-red transition-all flex justify-center items-center gap-2"
                            title="Marcar como Perdeu"
                          >
                            <TrendingDown className="w-5 h-5 text-terminal-red hover:text-terminal-black" />
                            <span className="text-xs font-bold text-terminal-red hover:text-terminal-black">PERDEU</span>
                          </button>
                          <button 
                            onClick={() => openCashoutModal(bet)}
                            className="col-span-2 py-3 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-blue hover:text-terminal-black hover:border-terminal-blue transition-all flex justify-center items-center gap-2"
                            title="Cashout"
                          >
                            <DollarSign className="w-5 h-5 text-terminal-blue hover:text-terminal-black" />
                            <span className="text-xs font-bold text-terminal-blue hover:text-terminal-black">CASHOUT</span>
                          </button>
                          <button 
                            onClick={() => openEditModal(bet)}
                            className="col-span-1 py-3 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-blue hover:text-terminal-black hover:border-terminal-blue transition-all flex justify-center items-center"
                            title="Editar"
                          >
                            <Edit className="w-5 h-5 text-terminal-blue hover:text-terminal-black" />
                          </button>
                          <button 
                            onClick={() => deleteBet(bet.id)}
                            className="col-span-1 py-3 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-red hover:text-terminal-black hover:border-terminal-red transition-all flex justify-center items-center"
                            title="Excluir"
                          >
                            <Trash2 className="w-5 h-5 text-terminal-red hover:text-terminal-black" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => openEditModal(bet)}
                            className="flex-1 py-3 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-blue hover:text-terminal-black hover:border-terminal-blue transition-all flex justify-center items-center"
                            title="Editar"
                          >
                            <Edit className="w-5 h-5 text-terminal-blue hover:text-terminal-black" />
                          </button>
                          <button 
                            onClick={() => deleteBet(bet.id)}
                            className="flex-1 py-3 rounded bg-terminal-gray border border-terminal-border hover:bg-terminal-red hover:text-terminal-black hover:border-terminal-red transition-all flex justify-center items-center"
                            title="Excluir"
                          >
                            <Trash2 className="w-5 h-5 text-terminal-red hover:text-terminal-black" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Keep existing Modals but wrap them or style them if possible. 
          For now, using the existing Shadcn dialogs is fine as they are overlays.
          I will just ensure they are rendered.
      */}
      
      {/* Cashout Modal */}
      <Dialog open={cashoutModal.isOpen} onOpenChange={(open) => 
        setCashoutModal(prev => ({ ...prev, isOpen: open }))
      }>
        <DialogContent className="bg-terminal-dark-gray border-terminal-border text-terminal-text sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-terminal-green">
              <DollarSign className="w-4 h-4" />
              {cashoutModal.bet?.is_cashout ? 'EDITAR CASHOUT' : 'CASHOUT'}
            </DialogTitle>
            <DialogDescription className="text-terminal-text opacity-60">
              {cashoutModal.bet?.is_cashout 
                ? 'Atualize o valor do cashout para esta aposta.'
                : 'Insira o valor do cashout para esta aposta.'
              }
            </DialogDescription>
          </DialogHeader>
          
          {cashoutModal.bet && (
            <div className="space-y-4">
              <div className="p-3 bg-terminal-black rounded border border-terminal-border-subtle">
                <p className="font-medium text-sm">{cashoutModal.bet.bet_description}</p>
                <div className="flex justify-between text-xs mt-2 opacity-70">
                  <span>VALOR: {formatWithUnits(cashoutModal.bet.stake_amount)}</span>
                  <span>ODDS: {cashoutModal.bet.odds}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase opacity-70">Valor do Cashout (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={cashoutModal.cashoutAmount}
                  onChange={(e) => setCashoutModal(prev => ({ ...prev, cashoutAmount: e.target.value }))}
                  className="bg-terminal-black border-terminal-border text-terminal-text"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => setCashoutModal({ isOpen: false, bet: null, cashoutAmount: '', cashoutOdds: '' })}
                  variant="outline"
                  className="flex-1 border-terminal-border hover:bg-terminal-gray text-terminal-text"
                >
                  CANCELAR
                </Button>
                <Button
                  onClick={processCashout}
                  disabled={!cashoutModal.cashoutAmount}
                  className="flex-1 bg-terminal-green hover:bg-terminal-green-bright text-white"
                >
                  CONFIRMAR
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModal.isOpen} onOpenChange={(open) => 
        {
          setEditModal(prev => ({ ...prev, isOpen: open }));
          if (!open) {
            setIsSportDropdownOpen(false);
            setIsSportQueryTouched(false);
            setSportHighlightIndex(-1);
            setIsLeagueDropdownOpen(false);
            setIsLeagueQueryTouched(false);
            setLeagueHighlightIndex(-1);
          }
        }
      }>
        <DialogContent className="bg-terminal-dark-gray border-terminal-border text-terminal-text sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-terminal-blue">
              <Edit className="w-4 h-4" />
              EDITAR APOSTA
            </DialogTitle>
          </DialogHeader>
          
          {editModal.bet && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase opacity-70">Descrição</Label>
                <Input
                  value={editModal.formData.bet_description}
                  onChange={(e) => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, bet_description: e.target.value } }))}
                  className="bg-terminal-black border-terminal-border text-terminal-text"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase opacity-70">Esporte</Label>
                  <div className="relative">
                    <Input
                      value={editModal.formData.sport}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditModal(prev => ({ ...prev, formData: { ...prev.formData, sport: value } }));
                        setIsSportQueryTouched(true);
                        setIsSportDropdownOpen(true);
                        setSportHighlightIndex(0);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Tab') {
                          setIsSportDropdownOpen(false);
                          setIsSportQueryTouched(false);
                          setSportHighlightIndex(-1);
                          return;
                        }

                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          if (!isSportDropdownOpen) {
                            setIsSportDropdownOpen(true);
                            setIsSportQueryTouched(true);
                          }
                          setSportHighlightIndex((prev) => {
                            if (filteredSportsList.length === 0) return -1;
                            const next = prev < filteredSportsList.length - 1 ? prev + 1 : 0;
                            return next;
                          });
                          return;
                        }

                        if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          if (!isSportDropdownOpen) {
                            setIsSportDropdownOpen(true);
                            setIsSportQueryTouched(true);
                          }
                          setSportHighlightIndex((prev) => {
                            if (filteredSportsList.length === 0) return -1;
                            const next = prev > 0 ? prev - 1 : filteredSportsList.length - 1;
                            return next;
                          });
                          return;
                        }

                        if (event.key === 'Enter') {
                          if (sportHighlightIndex >= 0 && filteredSportsList[sportHighlightIndex]) {
                            event.preventDefault();
                            const selectedSport = filteredSportsList[sportHighlightIndex];
                            setEditModal(prev => ({ ...prev, formData: { ...prev.formData, sport: selectedSport } }));
                            setIsSportDropdownOpen(false);
                            setIsSportQueryTouched(false);
                            setSportHighlightIndex(-1);
                          }
                          return;
                        }

                        if (event.key === 'Escape') {
                          setIsSportDropdownOpen(false);
                          setSportHighlightIndex(-1);
                        }
                      }}
                      onFocus={() => {
                        setIsSportDropdownOpen(true);
                        setIsSportQueryTouched(false);
                      }}
                      onBlur={() => setIsSportDropdownOpen(false)}
                      placeholder="Selecione ou digite o esporte"
                      className="bg-terminal-black border-terminal-border text-terminal-text"
                    />
                    {isSportDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded border border-terminal-border bg-terminal-dark-gray">
                        {filteredSportsList.length > 0 ? (
                          filteredSportsList.map((sport, index) => (
                            <button
                              key={sport}
                              type="button"
                              tabIndex={-1}
                              ref={(element) => {
                                sportItemRefs.current[index] = element;
                              }}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                setEditModal(prev => ({ ...prev, formData: { ...prev.formData, sport } }));
                                setIsSportDropdownOpen(false);
                                setIsSportQueryTouched(false);
                                setSportHighlightIndex(-1);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm text-terminal-text hover:bg-terminal-black ${
                                index === sportHighlightIndex ? 'bg-terminal-black' : ''
                              }`}
                            >
                              {sport}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-xs opacity-60">
                            Nenhum esporte encontrado
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase opacity-70">Liga</Label>
                  <div className="relative">
                    <Input
                      value={editModal.formData.league}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditModal(prev => ({ ...prev, formData: { ...prev.formData, league: value } }));
                        setIsLeagueQueryTouched(true);
                        setIsLeagueDropdownOpen(true);
                        setLeagueHighlightIndex(0);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Tab') {
                          setIsLeagueDropdownOpen(false);
                          setIsLeagueQueryTouched(false);
                          setLeagueHighlightIndex(-1);
                          return;
                        }

                        if (event.key === 'ArrowDown') {
                          event.preventDefault();
                          if (!isLeagueDropdownOpen) {
                            setIsLeagueDropdownOpen(true);
                            setIsLeagueQueryTouched(true);
                          }
                          setLeagueHighlightIndex((prev) => {
                            if (filteredLeaguesList.length === 0) return -1;
                            const next = prev < filteredLeaguesList.length - 1 ? prev + 1 : 0;
                            return next;
                          });
                          return;
                        }

                        if (event.key === 'ArrowUp') {
                          event.preventDefault();
                          if (!isLeagueDropdownOpen) {
                            setIsLeagueDropdownOpen(true);
                            setIsLeagueQueryTouched(true);
                          }
                          setLeagueHighlightIndex((prev) => {
                            if (filteredLeaguesList.length === 0) return -1;
                            const next = prev > 0 ? prev - 1 : filteredLeaguesList.length - 1;
                            return next;
                          });
                          return;
                        }

                        if (event.key === 'Enter') {
                          if (leagueHighlightIndex >= 0 && filteredLeaguesList[leagueHighlightIndex]) {
                            event.preventDefault();
                            const selectedLeague = filteredLeaguesList[leagueHighlightIndex];
                            setEditModal(prev => ({ ...prev, formData: { ...prev.formData, league: selectedLeague } }));
                            setIsLeagueDropdownOpen(false);
                            setIsLeagueQueryTouched(false);
                            setLeagueHighlightIndex(-1);
                          }
                          return;
                        }

                        if (event.key === 'Escape') {
                          setIsLeagueDropdownOpen(false);
                          setLeagueHighlightIndex(-1);
                        }
                      }}
                      onFocus={() => {
                        setIsLeagueDropdownOpen(true);
                        setIsLeagueQueryTouched(false);
                      }}
                      onBlur={() => setIsLeagueDropdownOpen(false)}
                      placeholder="Selecione ou digite a liga"
                      className="bg-terminal-black border-terminal-border text-terminal-text"
                    />
                    {isLeagueDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded border border-terminal-border bg-terminal-dark-gray">
                        {filteredLeaguesList.length > 0 ? (
                          filteredLeaguesList.map((league, index) => (
                            <button
                              key={league}
                              type="button"
                              tabIndex={-1}
                              ref={(element) => {
                                leagueItemRefs.current[index] = element;
                              }}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                setEditModal(prev => ({ ...prev, formData: { ...prev.formData, league } }));
                                setIsLeagueDropdownOpen(false);
                                setIsLeagueQueryTouched(false);
                                setLeagueHighlightIndex(-1);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm text-terminal-text hover:bg-terminal-black ${
                                index === leagueHighlightIndex ? 'bg-terminal-black' : ''
                              }`}
                            >
                              {league}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-xs opacity-60">
                            Nenhuma liga encontrada
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase opacity-70">Valor</Label>
                  <Input
                    type="number"
                    value={editModal.formData.stake_amount}
                    onChange={(e) => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, stake_amount: e.target.value } }))}
                    className="bg-terminal-black border-terminal-border text-terminal-text"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase opacity-70">Odds</Label>
                  <Input
                    type="number"
                    value={editModal.formData.odds}
                    onChange={(e) => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, odds: e.target.value } }))}
                    className="bg-terminal-black border-terminal-border text-terminal-text"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase opacity-70">Status</Label>
                <Select 
                  value={editModal.formData.status} 
                  onValueChange={(value: any) => setEditModal(prev => ({ ...prev, formData: { ...prev.formData, status: value } }))}
                >
                  <SelectTrigger className="bg-terminal-black border-terminal-border text-terminal-text">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-terminal-dark-gray border-terminal-border text-terminal-text">
                    <SelectItem value="pending">PENDENTE</SelectItem>
                    <SelectItem value="won">GANHOU</SelectItem>
                    <SelectItem value="lost">PERDEU</SelectItem>
                    <SelectItem value="void">ANULADA</SelectItem>
                    <SelectItem value="cashout">CASHOUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                  variant="outline"
                  className="flex-1 border-terminal-border hover:bg-terminal-gray text-terminal-text"
                >
                  CANCELAR
                </Button>
                <Button
                  onClick={updateBetData}
                  className="flex-1 bg-terminal-blue hover:bg-blue-600 text-white"
                >
                  SALVAR ALTERAÇÕES
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <UnitConfigurationModal 
        open={unitConfigOpen} 
        onOpenChange={setUnitConfigOpen} 
      />

      {user?.id && (
        <ReferralModal
          open={referralModalOpen}
          onOpenChange={setReferralModalOpen}
          userId={user.id}
          referralCode={referralCode}
        />
      )}
    </div>
  );
}
