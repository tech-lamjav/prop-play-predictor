import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/use-auth';
import { createClient } from '../integrations/supabase/client';
import AuthenticatedLayout from '../components/AuthenticatedLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '../components/ui/resizable';
import { 
  RefreshCw, 
  AlertCircle,
  BarChart3,
  List,
  Filter,
  X,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Calendar,
  Edit,
  Save
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
import BetAnalytics from '../components/betting/BetAnalytics';
import BetListCompact from '../components/betting/BetListCompact';

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
}

export default function Bets() {
  const { user, isLoading: authLoading } = useAuth();
  const [bets, setBets] = useState<Bet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalBets: 0,
    totalStaked: 0,
    totalReturn: 0,
    winRate: 0,
    profit: 0
  });
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
  
  // Global filter states
  const [globalFilters, setGlobalFilters] = useState({
    status: 'all',
    sport: 'all',
    league: 'all',
    searchQuery: '',
    dateFrom: '',
    dateTo: ''
  });

  const supabase = createClient();

  const fetchBets = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setBets(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar apostas');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (betsData: Bet[]) => {
    const totalBets = betsData.length;
    const totalStaked = betsData.reduce((sum, bet) => sum + bet.stake_amount, 0);
    
    const wonBets = betsData.filter(bet => bet.status === 'won');
    const lostBets = betsData.filter(bet => bet.status === 'lost');
    const cashoutBets = betsData.filter(bet => bet.status === 'cashout');
    
    const totalReturn = wonBets.reduce((sum, bet) => sum + bet.potential_return, 0);
    const totalCashout = cashoutBets.reduce((sum, bet) => sum + (bet.cashout_amount || 0), 0);
    const totalLost = lostBets.reduce((sum, bet) => sum + bet.stake_amount, 0);
    
    const totalEarnings = totalReturn + totalCashout;
    const winRate = totalBets > 0 ? ((wonBets.length + cashoutBets.length) / (wonBets.length + lostBets.length + cashoutBets.length)) * 100 : 0;
    const profit = totalEarnings - totalStaked;

    setStats({
      totalBets,
      totalStaked,
      totalReturn: totalEarnings,
      winRate,
      profit
    });
  };

  const updateBetStatus = async (betId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('bets')
        .update({ status: newStatus })
        .eq('id', betId);

      if (error) {
        throw error;
      }

      // Refresh bets
      await fetchBets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar aposta');
    }
  };

  const deleteBet = async (betId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta aposta?')) return;
    
    try {
      const { error } = await supabase
        .from('bets')
        .delete()
        .eq('id', betId);

      if (error) {
        throw error;
      }

      // Refresh bets
      await fetchBets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir aposta');
    }
  };

  const processCashout = async () => {
    console.log('processCashout called', { 
      hasBet: !!cashoutModal.bet, 
      cashoutAmount: cashoutModal.cashoutAmount 
    });
    
    if (!cashoutModal.bet || !cashoutModal.cashoutAmount) {
      console.log('Missing required fields');
      return;
    }
    
    try {
      const cashoutAmount = parseFloat(cashoutModal.cashoutAmount);
      
      if (isNaN(cashoutAmount)) {
        setError('Valor inválido para cashout');
        return;
      }

      console.log('Updating bet:', cashoutModal.bet.id, 'with amount:', cashoutAmount);

      const { error } = await supabase
        .from('bets')
        .update({
          status: 'cashout',
          cashout_amount: cashoutAmount,
          cashout_date: new Date().toISOString(),
          is_cashout: true
        })
        .eq('id', cashoutModal.bet.id);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Cashout successful, closing modal and refreshing');
      
      // Close modal and refresh bets
      setCashoutModal({ isOpen: false, bet: null, cashoutAmount: '', cashoutOdds: '' });
      await fetchBets();
    } catch (err) {
      console.error('Error in processCashout:', err);
      setError(err instanceof Error ? err.message : 'Erro ao processar cashout');
    }
  };

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
  };

  const updateBetData = async () => {
    if (!editModal.bet) return;

    try {
      const odds = parseFloat(editModal.formData.odds);
      const stakeAmount = parseFloat(editModal.formData.stake_amount);

      if (isNaN(odds) || isNaN(stakeAmount)) {
        setError('Odds e valor da aposta devem ser números válidos');
        return;
      }

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

      if (error) {
        throw error;
      }

      // Close modal and refresh
      setEditModal({
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
      await fetchBets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar aposta');
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchBets();
    }
  }, [user?.id]);

  // Get unique sports and leagues from bets
  const uniqueSports = useMemo(() => {
    const sports = Array.from(new Set(bets.map(bet => bet.sport).filter(Boolean)));
    return sports.sort();
  }, [bets]);

  const uniqueLeagues = useMemo(() => {
    const leagues = Array.from(new Set(bets.map(bet => bet.league).filter(Boolean)));
    return leagues.sort();
  }, [bets]);

  // Filter bets based on global filters
  const filteredBets = useMemo(() => {
    return bets.filter(bet => {
      // Status filter
      if (globalFilters.status !== 'all' && bet.status !== globalFilters.status) {
        return false;
      }

      // Sport filter
      if (globalFilters.sport !== 'all' && bet.sport !== globalFilters.sport) {
        return false;
      }

      // League filter
      if (globalFilters.league !== 'all' && bet.league !== globalFilters.league) {
        return false;
      }

      // Date from filter
      if (globalFilters.dateFrom) {
        const betDate = new Date(bet.bet_date);
        const filterDate = new Date(globalFilters.dateFrom);
        if (betDate < filterDate) {
          return false;
        }
      }

      // Date to filter
      if (globalFilters.dateTo) {
        const betDate = new Date(bet.bet_date);
        const filterDate = new Date(globalFilters.dateTo);
        // Set to end of day for inclusive comparison
        filterDate.setHours(23, 59, 59, 999);
        if (betDate > filterDate) {
          return false;
        }
      }

      // Search query filter
      if (globalFilters.searchQuery) {
        const query = globalFilters.searchQuery.toLowerCase();
        const matchDescription = bet.bet_description?.toLowerCase().includes(query);
        const matchMatch = bet.match_description?.toLowerCase().includes(query);
        const matchLeague = bet.league?.toLowerCase().includes(query);
        
        if (!matchDescription && !matchMatch && !matchLeague) {
          return false;
        }
      }

      return true;
    });
  }, [bets, globalFilters]);

  const resetFilters = () => {
    setGlobalFilters({
      status: 'all',
      sport: 'all',
      league: 'all',
      searchQuery: '',
      dateFrom: '',
      dateTo: ''
    });
  };

  // Calculate stats based on filtered bets
  useEffect(() => {
    calculateStats(filteredBets);
  }, [filteredBets]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-500', text: 'Pendente', icon: Clock },
      won: { color: 'bg-green-500', text: 'Ganhou', icon: TrendingUp },
      lost: { color: 'bg-red-500', text: 'Perdeu', icon: TrendingDown },
      void: { color: 'bg-gray-500', text: 'Anulada', icon: Clock },
      cashout: { color: 'bg-blue-500', text: 'Cashout', icon: DollarSign }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} text-white flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.text}
      </Badge>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Você precisa estar logado para acessar suas apostas.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-4 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Minhas Apostas</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
                Dashboard analítico das suas apostas registradas via WhatsApp
              </p>
            </div>
            
            <Button onClick={fetchBets} variant="outline" disabled={isLoading} className="w-full sm:w-auto">
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Global Filters */}
        <div className="flex-shrink-0 px-4 py-3 border-b bg-slate-50 dark:bg-slate-900">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">Filtros Globais</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Status Filter */}
                  <Select 
                    value={globalFilters.status} 
                    onValueChange={(value) => setGlobalFilters(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="won">Ganhou</SelectItem>
                      <SelectItem value="lost">Perdeu</SelectItem>
                      <SelectItem value="cashout">Cashout</SelectItem>
                      <SelectItem value="void">Anulada</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Sport Filter */}
                  <Select 
                    value={globalFilters.sport} 
                    onValueChange={(value) => setGlobalFilters(prev => ({ ...prev, sport: value }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Esporte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {uniqueSports.map((sport) => (
                        <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* League Filter */}
                  <Select 
                    value={globalFilters.league} 
                    onValueChange={(value) => setGlobalFilters(prev => ({ ...prev, league: value }))}
                    disabled={uniqueLeagues.length === 0}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Liga" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {uniqueLeagues.map((league) => (
                        <SelectItem key={league} value={league}>{league}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Date Range */}
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      placeholder="De"
                      value={globalFilters.dateFrom}
                      onChange={(e) => setGlobalFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      className="h-9"
                    />
                    <Input
                      type="date"
                      placeholder="Até"
                      value={globalFilters.dateTo}
                      onChange={(e) => setGlobalFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      className="h-9"
                    />
                  </div>

                  {/* Search */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Buscar..."
                      value={globalFilters.searchQuery}
                      onChange={(e) => setGlobalFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                      className="h-9 flex-1"
                    />
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={resetFilters}
                      className="h-9 px-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Results count */}
              <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
                <List className="w-4 h-4" />
                Mostrando {filteredBets.length} de {bets.length} apostas
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex-shrink-0 px-4 py-2">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Main Content - Split Layout */}
        <div className="flex-1 min-h-0">
          {/* Desktop: Split Layout */}
          <div className="hidden lg:block h-full">
            <ResizablePanelGroup direction="horizontal" className="h-full">
              {/* Analytics Panel (60%) */}
              <ResizablePanel defaultSize={60} minSize={40} className="min-h-0">
                <div className="h-full p-4">
                  <BetAnalytics bets={filteredBets} isLoading={isLoading} />
                </div>
              </ResizablePanel>
              
              <ResizableHandle className="w-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors" />
              
              {/* List Panel (40%) */}
              <ResizablePanel defaultSize={40} minSize={30} className="min-h-0">
                <div className="h-full p-4">
                  <BetListCompact 
                    bets={filteredBets}
                    onEdit={openEditModal}
                    onDelete={deleteBet}
                    onStatusChange={updateBetStatus}
                    onCashout={openCashoutModal}
                    isLoading={isLoading}
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>

          {/* Mobile: Stacked Layout */}
          <div className="lg:hidden h-full overflow-y-auto">
            <div className="p-4 space-y-6">
              {/* Analytics Section */}
              <div>
                <BetAnalytics bets={filteredBets} isLoading={isLoading} />
              </div>
              
              {/* List Section */}
              <div>
                <BetListCompact 
                  bets={filteredBets}
                  onEdit={openEditModal}
                  onDelete={deleteBet}
                  onStatusChange={updateBetStatus}
                  onCashout={openCashoutModal}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Cashout Modal */}
        <Dialog open={cashoutModal.isOpen} onOpenChange={(open) => 
          setCashoutModal(prev => ({ ...prev, isOpen: open }))
        }>
          <DialogContent className="sm:max-w-md max-w-[95vw]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                {cashoutModal.bet?.is_cashout ? 'Editar Cashout' : 'Fazer Cashout'}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-400">
                {cashoutModal.bet?.is_cashout 
                  ? 'Edite o valor do cashout desta aposta.'
                  : 'Digite o valor do cashout para esta aposta.'
                }
              </DialogDescription>
            </DialogHeader>
            
            {cashoutModal.bet && (
              <div className="space-y-4">
                {/* Bet Info */}
                <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                  <p className="font-medium text-white text-base">{cashoutModal.bet.bet_description}</p>
                  <p className="text-sm text-gray-300">
                    {cashoutModal.bet.match_description}
                  </p>
                  <div className="flex justify-between text-sm mt-2 text-gray-300">
                    <span>Valor apostado: {formatCurrency(cashoutModal.bet.stake_amount)}</span>
                    <span>Odds originais: {cashoutModal.bet.odds}</span>
                  </div>
                </div>

                {/* Cashout Amount */}
                <div className="space-y-2">
                  <Label htmlFor="cashoutAmount" className="text-white font-medium">Valor do Cashout (R$)</Label>
                  <Input
                    id="cashoutAmount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={cashoutModal.cashoutAmount}
                    onChange={(e) => setCashoutModal(prev => ({ 
                      ...prev, 
                      cashoutAmount: e.target.value 
                    }))}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                {/* Profit/Loss Preview */}
                {cashoutModal.cashoutAmount && (
                  <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="flex justify-between text-sm text-gray-300">
                      <span>Valor apostado:</span>
                      <span className="font-medium text-white">{formatCurrency(cashoutModal.bet.stake_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-300">
                      <span>Valor cashout:</span>
                      <span className="font-medium text-white">{formatCurrency(parseFloat(cashoutModal.cashoutAmount) || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium border-t border-gray-700 pt-2 mt-2">
                      <span className="text-gray-300">Lucro/Prejuízo:</span>
                      <span className={parseFloat(cashoutModal.cashoutAmount) - cashoutModal.bet.stake_amount >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {formatCurrency((parseFloat(cashoutModal.cashoutAmount) || 0) - cashoutModal.bet.stake_amount)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Button
                    onClick={() => setCashoutModal({ isOpen: false, bet: null, cashoutAmount: '', cashoutOdds: '' })}
                    variant="outline"
                    className="flex-1 w-full"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={processCashout}
                    disabled={!cashoutModal.cashoutAmount}
                    className="flex-1 w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    {cashoutModal.bet?.is_cashout ? 'Atualizar' : 'Fazer Cashout'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Bet Modal */}
        <Dialog open={editModal.isOpen} onOpenChange={(open) => 
          setEditModal(prev => ({ ...prev, isOpen: open }))
        }>
          <DialogContent className="sm:max-w-lg max-w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Edit className="w-4 h-4 sm:w-5 sm:h-5" />
                Editar Aposta
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-400">
                Edite os detalhes da aposta abaixo.
              </DialogDescription>
            </DialogHeader>
            
            {editModal.bet && (
              <div className="space-y-4">
                {/* Bet Description */}
                <div className="space-y-2">
                  <Label htmlFor="betDescription" className="text-white font-medium">Descrição da Aposta *</Label>
                  <Input
                    id="betDescription"
                    placeholder="Ex: Lakers vence"
                    value={editModal.formData.bet_description}
                    onChange={(e) => setEditModal(prev => ({ 
                      ...prev, 
                      formData: { ...prev.formData, bet_description: e.target.value }
                    }))}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>

                {/* Match Description */}
                <div className="space-y-2">
                  <Label htmlFor="matchDescription" className="text-white font-medium">Descrição do Jogo</Label>
                  <Input
                    id="matchDescription"
                    placeholder="Ex: Lakers vs Warriors"
                    value={editModal.formData.match_description}
                    onChange={(e) => setEditModal(prev => ({ 
                      ...prev, 
                      formData: { ...prev.formData, match_description: e.target.value }
                    }))}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>

                {/* Sport and League Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sport" className="text-white font-medium">Esporte *</Label>
                    <Input
                      id="sport"
                      placeholder="Ex: Basquete"
                      value={editModal.formData.sport}
                      onChange={(e) => setEditModal(prev => ({ 
                        ...prev, 
                        formData: { ...prev.formData, sport: e.target.value }
                      }))}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="league" className="text-white font-medium">Liga</Label>
                    <Input
                      id="league"
                      placeholder="Ex: NBA"
                      value={editModal.formData.league}
                      onChange={(e) => setEditModal(prev => ({ 
                        ...prev, 
                        formData: { ...prev.formData, league: e.target.value }
                      }))}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                    />
                  </div>
                </div>

                {/* Odds and Stake Amount Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="odds" className="text-white font-medium">Odds *</Label>
                    <Input
                      id="odds"
                      type="number"
                      step="0.01"
                      placeholder="1.50"
                      value={editModal.formData.odds}
                      onChange={(e) => setEditModal(prev => ({ 
                        ...prev, 
                        formData: { ...prev.formData, odds: e.target.value }
                      }))}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stakeAmount" className="text-white font-medium">Valor (R$) *</Label>
                    <Input
                      id="stakeAmount"
                      type="number"
                      step="0.01"
                      placeholder="100.00"
                      value={editModal.formData.stake_amount}
                      onChange={(e) => setEditModal(prev => ({ 
                        ...prev, 
                        formData: { ...prev.formData, stake_amount: e.target.value }
                      }))}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                    />
                  </div>
                </div>

                {/* Dates Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="betDate" className="text-white font-medium">Data da Aposta</Label>
                    <Input
                      id="betDate"
                      type="date"
                      value={editModal.formData.bet_date}
                      onChange={(e) => setEditModal(prev => ({ 
                        ...prev, 
                        formData: { ...prev.formData, bet_date: e.target.value }
                      }))}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 [color-scheme:dark]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="matchDate" className="text-white font-medium">Data do Jogo</Label>
                    <Input
                      id="matchDate"
                      type="date"
                      value={editModal.formData.match_date}
                      onChange={(e) => setEditModal(prev => ({ 
                        ...prev, 
                        formData: { ...prev.formData, match_date: e.target.value }
                      }))}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 [color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Status Selection */}
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-white font-medium">Status da Aposta *</Label>
                  <Select 
                    value={editModal.formData.status} 
                    onValueChange={(value: 'pending' | 'won' | 'lost' | 'void' | 'cashout') => 
                      setEditModal(prev => ({ 
                        ...prev, 
                        formData: { ...prev.formData, status: value }
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-yellow-600" />
                          <span>Pendente</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="won">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span>Ganhou</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="lost">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="w-4 h-4 text-red-600" />
                          <span>Perdeu</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="void">
                        <div className="flex items-center gap-2">
                          <X className="w-4 h-4 text-gray-600" />
                          <span>Cancelada</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="cashout">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-blue-600" />
                          <span>Cashout</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Potential Return Preview */}
                {editModal.formData.odds && editModal.formData.stake_amount && (
                  <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                    <div className="flex justify-between text-sm text-gray-300">
                      <span>Valor apostado:</span>
                      <span className="font-medium text-white">{formatCurrency(parseFloat(editModal.formData.stake_amount) || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-300">
                      <span>Odds:</span>
                      <span className="font-medium text-white">{editModal.formData.odds}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium border-t border-gray-700 pt-2 mt-2">
                      <span className="text-gray-300">Retorno Potencial:</span>
                      <span className="text-green-400">
                        {formatCurrency((parseFloat(editModal.formData.stake_amount) || 0) * (parseFloat(editModal.formData.odds) || 0))}
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Button
                    onClick={() => setEditModal({
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
                        match_date: ''
                      }
                    })}
                    variant="outline"
                    className="flex-1 w-full"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={updateBetData}
                    disabled={!editModal.formData.bet_description || !editModal.formData.sport || !editModal.formData.odds || !editModal.formData.stake_amount}
                    className="flex-1 w-full"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Alterações
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
}
