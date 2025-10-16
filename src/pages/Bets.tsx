import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/use-auth';
import { createClient } from '../integrations/supabase/client';
import AuthenticatedLayout from '../components/AuthenticatedLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
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
  List,
  Edit,
  Save
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
      match_date: ''
    }
  });
  
  // Filter states
  const [filters, setFilters] = useState({
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
      calculateStats(data || []);
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
    if (!cashoutModal.bet || !cashoutModal.cashoutAmount || !cashoutModal.cashoutOdds) return;
    
    try {
      const cashoutAmount = parseFloat(cashoutModal.cashoutAmount);
      const cashoutOdds = parseFloat(cashoutModal.cashoutOdds);
      
      if (isNaN(cashoutAmount) || isNaN(cashoutOdds)) {
        setError('Valores inválidos para cashout');
        return;
      }

      const { error } = await supabase
        .from('bets')
        .update({
          status: 'cashout',
          cashout_amount: cashoutAmount,
          cashout_odds: cashoutOdds,
          cashout_date: new Date().toISOString(),
          is_cashout: true
        })
        .eq('id', cashoutModal.bet.id);

      if (error) {
        throw error;
      }

      // Close modal and refresh bets
      setCashoutModal({ isOpen: false, bet: null, cashoutAmount: '', cashoutOdds: '' });
      await fetchBets();
    } catch (err) {
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
        match_date: bet.match_date ? new Date(bet.match_date).toISOString().split('T')[0] : ''
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
          match_date: ''
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

  // Filter bets based on filters
  const filteredBets = useMemo(() => {
    return bets.filter(bet => {
      // Status filter
      if (filters.status !== 'all' && bet.status !== filters.status) {
        return false;
      }

      // Sport filter
      if (filters.sport !== 'all' && bet.sport !== filters.sport) {
        return false;
      }

      // League filter
      if (filters.league !== 'all' && bet.league !== filters.league) {
        return false;
      }

      // Date from filter
      if (filters.dateFrom) {
        const betDate = new Date(bet.bet_date);
        const filterDate = new Date(filters.dateFrom);
        if (betDate < filterDate) {
          return false;
        }
      }

      // Date to filter
      if (filters.dateTo) {
        const betDate = new Date(bet.bet_date);
        const filterDate = new Date(filters.dateTo);
        // Set to end of day for inclusive comparison
        filterDate.setHours(23, 59, 59, 999);
        if (betDate > filterDate) {
          return false;
        }
      }

      // Search query filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchDescription = bet.bet_description?.toLowerCase().includes(query);
        const matchMatch = bet.match_description?.toLowerCase().includes(query);
        const matchLeague = bet.league?.toLowerCase().includes(query);
        
        if (!matchDescription && !matchMatch && !matchLeague) {
          return false;
        }
      }

      return true;
    });
  }, [bets, filters]);

  const resetFilters = () => {
    setFilters({
      status: 'all',
      sport: 'all',
      league: 'all',
      searchQuery: '',
      dateFrom: '',
      dateTo: ''
    });
  };

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Minhas Apostas</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
                Acompanhe suas apostas registradas via WhatsApp
              </p>
            </div>
            
            <Button onClick={fetchBets} variant="outline" disabled={isLoading} className="w-full sm:w-auto">
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                <Target className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <div className="sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total de Apostas</p>
                  <p className="text-xl sm:text-2xl font-bold">{stats.totalBets}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                <div className="sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total Apostado</p>
                  <p className="text-lg sm:text-2xl font-bold">{formatCurrency(stats.totalStaked)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                <div className="sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Retorno Total</p>
                  <p className="text-lg sm:text-2xl font-bold">{formatCurrency(stats.totalReturn)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                <Target className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <div className="sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Taxa de Acerto</p>
                  <p className="text-xl sm:text-2xl font-bold">{stats.winRate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-2 md:col-span-1">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
                <TrendingUp className={`h-6 w-6 sm:h-8 sm:w-8 ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <div className="sm:ml-4">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">Lucro/Prejuízo</p>
                  <p className={`text-lg sm:text-2xl font-bold ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(stats.profit)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                <CardTitle className="text-base sm:text-lg">Filtros</CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={resetFilters}
                className="w-full sm:w-auto"
              >
                <X className="w-4 h-4 mr-1" />
                Limpar Filtros
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
              {/* Status Filter */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={filters.status} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
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
              </div>

              {/* Sport Filter */}
              <div className="space-y-2">
                <Label>Esporte</Label>
                <Select 
                  value={filters.sport} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, sport: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os esportes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {uniqueSports.map((sport) => (
                      <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* League Filter */}
              <div className="space-y-2">
                <Label>Liga</Label>
                <Select 
                  value={filters.league} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, league: value }))}
                  disabled={uniqueLeagues.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as ligas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {uniqueLeagues.map((league) => (
                      <SelectItem key={league} value={league}>{league}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date From Filter */}
              <div className="space-y-2">
                <Label>Data De</Label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                />
              </div>

              {/* Date To Filter */}
              <div className="space-y-2">
                <Label>Data Até</Label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                />
              </div>

              {/* Search Filter */}
              <div className="space-y-2">
                <Label>Buscar</Label>
                <Input
                  placeholder="Buscar apostas..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
                />
              </div>
            </div>
            
            {/* Results count */}
            <div className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
              <List className="w-4 h-4" />
              Mostrando {filteredBets.length} de {bets.length} apostas
            </div>
          </CardContent>
        </Card>

        {/* Bets List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : bets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma aposta encontrada
              </h3>
              <p className="text-gray-500 text-center mb-6">
                Envie uma mensagem via WhatsApp para registrar suas apostas!
              </p>
            </CardContent>
          </Card>
        ) : filteredBets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Filter className="w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma aposta corresponde aos filtros
              </h3>
              <p className="text-gray-500 text-center mb-6">
                Tente ajustar os filtros para ver mais resultados.
              </p>
              <Button onClick={resetFilters} variant="outline">
                Limpar Filtros
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredBets.map((bet) => (
              <Card key={bet.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-3 sm:p-4">
                  <div className="space-y-3">
                    {/* Header - Status and Sport */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {getStatusBadge(bet.status)}
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Target className="w-3.5 h-3.5 text-blue-600" />
                            <span>{bet.sport}</span>
                            {bet.league && (
                              <>
                                <span>•</span>
                                <span className="text-xs">{bet.league}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <h3 className="font-semibold text-sm sm:text-base">{bet.bet_description}</h3>
                        {bet.match_description && (
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            {bet.match_description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Values Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 border-y">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Valor</p>
                        <p className="font-semibold text-sm">{formatCurrency(bet.stake_amount)}</p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Odds</p>
                        <p className="font-semibold text-sm">{bet.odds}</p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">
                          {bet.is_cashout ? 'Cashout' : 'Retorno'}
                        </p>
                        <p className="font-semibold text-sm text-green-600">
                          {bet.is_cashout && bet.cashout_amount 
                            ? formatCurrency(bet.cashout_amount)
                            : formatCurrency(bet.potential_return)
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Data</p>
                        <p className="text-xs sm:text-sm">{new Date(bet.bet_date).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {bet.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateBetStatus(bet.id, 'won')}
                            className="flex-1 min-w-[80px]"
                          >
                            <TrendingUp className="w-3 h-3 sm:mr-1" />
                            <span className="hidden xs:inline sm:inline">Ganhou</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateBetStatus(bet.id, 'lost')}
                            className="flex-1 min-w-[80px]"
                          >
                            <TrendingDown className="w-3 h-3 sm:mr-1" />
                            <span className="hidden xs:inline sm:inline">Perdeu</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openCashoutModal(bet)}
                            className="flex-1 min-w-[90px]"
                          >
                            <DollarSign className="w-3 h-3 sm:mr-1" />
                            <span className="hidden xs:inline sm:inline">Cashout</span>
                          </Button>
                        </>
                      )}
                      {bet.status === 'cashout' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openCashoutModal(bet)}
                          className="flex-1"
                        >
                          <DollarSign className="w-3 h-3 mr-1" />
                          <span className="text-xs sm:text-sm">Editar Cashout</span>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(bet)}
                        className="min-w-[40px]"
                      >
                        <Edit className="w-3 h-3" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteBet(bet.id)}
                        className="min-w-[40px]"
                      >
                        <X className="w-3 h-3" />
                        <span className="sr-only">Excluir</span>
                      </Button>
                    </div>

                    {/* Cashout info if applicable */}
                    {bet.is_cashout && bet.cashout_amount && (
                      <div className="pt-2 border-t flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs sm:text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <DollarSign className="w-3 h-3" />
                          <span>Cashout: {formatCurrency(bet.cashout_amount)}</span>
                        </div>
                        {bet.cashout_odds && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span>Odds: {bet.cashout_odds}</span>
                          </div>
                        )}
                        {bet.cashout_date && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(bet.cashout_date).toLocaleDateString('pt-BR')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

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
              <DialogDescription className="text-sm">
                {cashoutModal.bet?.is_cashout 
                  ? 'Edite os valores do cashout desta aposta.'
                  : 'Digite o valor e odds do cashout para esta aposta.'
                }
              </DialogDescription>
            </DialogHeader>
            
            {cashoutModal.bet && (
              <div className="space-y-4">
                {/* Bet Info */}
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{cashoutModal.bet.bet_description}</p>
                  <p className="text-sm text-muted-foreground">
                    {cashoutModal.bet.match_description}
                  </p>
                  <div className="flex justify-between text-sm mt-2 text-gray-700 dark:text-gray-300">
                    <span>Valor apostado: {formatCurrency(cashoutModal.bet.stake_amount)}</span>
                    <span>Odds originais: {cashoutModal.bet.odds}</span>
                  </div>
                </div>

                {/* Cashout Amount */}
                <div className="space-y-2">
                  <Label htmlFor="cashoutAmount" className="text-gray-900 dark:text-gray-100">Valor do Cashout (R$)</Label>
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
                    className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Cashout Odds */}
                <div className="space-y-2">
                  <Label htmlFor="cashoutOdds" className="text-gray-900 dark:text-gray-100">Odds no momento do Cashout</Label>
                  <Input
                    id="cashoutOdds"
                    type="number"
                    step="0.01"
                    placeholder="1.00"
                    value={cashoutModal.cashoutOdds}
                    onChange={(e) => setCashoutModal(prev => ({ 
                      ...prev, 
                      cashoutOdds: e.target.value 
                    }))}
                    className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Profit/Loss Preview */}
                {cashoutModal.cashoutAmount && cashoutModal.cashoutOdds && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                      <span>Valor apostado:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(cashoutModal.bet.stake_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                      <span>Valor cashout:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(parseFloat(cashoutModal.cashoutAmount) || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium border-t border-blue-200 dark:border-blue-800 pt-2 mt-2">
                      <span className="text-gray-700 dark:text-gray-300">Lucro/Prejuízo:</span>
                      <span className={parseFloat(cashoutModal.cashoutAmount) - cashoutModal.bet.stake_amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
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
                    disabled={!cashoutModal.cashoutAmount || !cashoutModal.cashoutOdds}
                    className="flex-1 w-full"
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
              <DialogDescription className="text-sm">
                Edite os detalhes da aposta abaixo.
              </DialogDescription>
            </DialogHeader>
            
            {editModal.bet && (
              <div className="space-y-4">
                {/* Bet Description */}
                <div className="space-y-2">
                  <Label htmlFor="betDescription" className="text-gray-900 dark:text-gray-100">Descrição da Aposta *</Label>
                  <Input
                    id="betDescription"
                    placeholder="Ex: Lakers vence"
                    value={editModal.formData.bet_description}
                    onChange={(e) => setEditModal(prev => ({ 
                      ...prev, 
                      formData: { ...prev.formData, bet_description: e.target.value }
                    }))}
                    className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Match Description */}
                <div className="space-y-2">
                  <Label htmlFor="matchDescription" className="text-gray-900 dark:text-gray-100">Descrição do Jogo</Label>
                  <Input
                    id="matchDescription"
                    placeholder="Ex: Lakers vs Warriors"
                    value={editModal.formData.match_description}
                    onChange={(e) => setEditModal(prev => ({ 
                      ...prev, 
                      formData: { ...prev.formData, match_description: e.target.value }
                    }))}
                    className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Sport and League Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sport" className="text-gray-900 dark:text-gray-100">Esporte *</Label>
                    <Input
                      id="sport"
                      placeholder="Ex: Basquete"
                      value={editModal.formData.sport}
                      onChange={(e) => setEditModal(prev => ({ 
                        ...prev, 
                        formData: { ...prev.formData, sport: e.target.value }
                      }))}
                      className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="league" className="text-gray-900 dark:text-gray-100">Liga</Label>
                    <Input
                      id="league"
                      placeholder="Ex: NBA"
                      value={editModal.formData.league}
                      onChange={(e) => setEditModal(prev => ({ 
                        ...prev, 
                        formData: { ...prev.formData, league: e.target.value }
                      }))}
                      className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                {/* Odds and Stake Amount Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="odds" className="text-gray-900 dark:text-gray-100">Odds *</Label>
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
                      className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stakeAmount" className="text-gray-900 dark:text-gray-100">Valor (R$) *</Label>
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
                      className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                {/* Dates Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="betDate" className="text-gray-900 dark:text-gray-100">Data da Aposta</Label>
                    <Input
                      id="betDate"
                      type="date"
                      value={editModal.formData.bet_date}
                      onChange={(e) => setEditModal(prev => ({ 
                        ...prev, 
                        formData: { ...prev.formData, bet_date: e.target.value }
                      }))}
                      className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="matchDate" className="text-gray-900 dark:text-gray-100">Data do Jogo</Label>
                    <Input
                      id="matchDate"
                      type="date"
                      value={editModal.formData.match_date}
                      onChange={(e) => setEditModal(prev => ({ 
                        ...prev, 
                        formData: { ...prev.formData, match_date: e.target.value }
                      }))}
                      className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 dark:[color-scheme:dark]"
                    />
                  </div>
                </div>

                {/* Potential Return Preview */}
                {editModal.formData.odds && editModal.formData.stake_amount && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                      <span>Valor apostado:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(parseFloat(editModal.formData.stake_amount) || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                      <span>Odds:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{editModal.formData.odds}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium border-t border-blue-200 dark:border-blue-800 pt-2 mt-2">
                      <span className="text-gray-700 dark:text-gray-300">Retorno Potencial:</span>
                      <span className="text-green-600 dark:text-green-400">
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
