import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/use-auth';
import { useBets, Bet, BetFiltersState } from '../hooks/use-bets';
import BetStats from '../components/betting/BetStats';
import BetCard from '../components/betting/BetCard';
import BetFilters, { BetFiltersState as FiltersState } from '../components/betting/BetFilters';
import WhatsAppSyncButton from '../components/WhatsAppSyncButton';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  Plus, 
  RefreshCw, 
  MessageCircle, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Target
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';

export default function BettingDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { 
    bets, 
    stats, 
    isLoading, 
    error, 
    fetchBets, 
    updateBet, 
    deleteBet,
    getBetsByStatus 
  } = useBets(user?.id || '');
  
  const [filters, setFilters] = useState<FiltersState>({
    search: '',
    status: 'all',
    sport: 'all',
    dateFrom: null,
    dateTo: null,
    minOdds: '',
    maxOdds: '',
    minAmount: '',
    maxAmount: '',
  });
  
  const [filteredBets, setFilteredBets] = useState<Bet[]>([]);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (user?.id) {
      fetchBets();
    }
  }, [user?.id, fetchBets]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const applyFilters = useCallback(() => {
    let filtered = [...bets];

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(bet => 
        bet.bet_description.toLowerCase().includes(searchTerm) ||
        bet.match_description?.toLowerCase().includes(searchTerm) ||
        bet.sport.toLowerCase().includes(searchTerm) ||
        bet.league?.toLowerCase().includes(searchTerm)
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(bet => bet.status === filters.status);
    }

    // Sport filter
    if (filters.sport !== 'all') {
      filtered = filtered.filter(bet => bet.sport.toLowerCase() === filters.sport);
    }

    // Date range filter
    if (filters.dateFrom) {
      filtered = filtered.filter(bet => 
        new Date(bet.bet_date) >= filters.dateFrom!
      );
    }
    if (filters.dateTo) {
      filtered = filtered.filter(bet => 
        new Date(bet.bet_date) <= filters.dateTo!
      );
    }

    // Odds range filter
    if (filters.minOdds) {
      filtered = filtered.filter(bet => bet.odds >= parseFloat(filters.minOdds));
    }
    if (filters.maxOdds) {
      filtered = filtered.filter(bet => bet.odds <= parseFloat(filters.maxOdds));
    }

    // Amount range filter
    if (filters.minAmount) {
      filtered = filtered.filter(bet => bet.stake_amount >= parseFloat(filters.minAmount));
    }
    if (filters.maxAmount) {
      filtered = filtered.filter(bet => bet.stake_amount <= parseFloat(filters.maxAmount));
    }

    setFilteredBets(filtered);
  }, [bets, filters]);

  const handleFiltersChange = (newFilters: FiltersState) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      sport: 'all',
      dateFrom: null,
      dateTo: null,
      minOdds: '',
      maxOdds: '',
      minAmount: '',
      maxAmount: '',
    });
  };

  const handleStatusChange = async (betId: string, status: string) => {
    try {
      await updateBet(betId, { status: status as any });
    } catch (error) {
      console.error('Error updating bet status:', error);
    }
  };

  const handleDeleteBet = async (betId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta aposta?')) {
      try {
        await deleteBet(betId);
      } catch (error) {
        console.error('Error deleting bet:', error);
      }
    }
  };

  const getBetsByTab = (tab: string) => {
    switch (tab) {
      case 'pending':
        return getBetsByStatus('pending');
      case 'won':
        return getBetsByStatus('won');
      case 'lost':
        return getBetsByStatus('lost');
      case 'void':
        return getBetsByStatus('void');
      default:
        return filteredBets;
    }
  };

  const getTabCount = (tab: string) => {
    return getBetsByTab(tab).length;
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
            Você precisa estar logado para acessar o dashboard de apostas.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard de Apostas</h1>
              <p className="text-muted-foreground mt-2">
                Gerencie suas apostas e acompanhe sua performance
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <WhatsAppSyncButton 
                userId={user.id} 
                onSyncComplete={() => fetchBets()}
              />
              <Button onClick={() => fetchBets()} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8">
          <BetStats stats={stats} isLoading={isLoading} />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <BetFilters 
            onFiltersChange={handleFiltersChange}
            onClearFilters={handleClearFilters}
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all" className="flex items-center space-x-2">
              <Target className="w-4 h-4" />
              <span>Todas ({getTabCount('all')})</span>
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Pendentes ({getTabCount('pending')})</span>
            </TabsTrigger>
            <TabsTrigger value="won" className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4" />
              <span>Ganhas ({getTabCount('won')})</span>
            </TabsTrigger>
            <TabsTrigger value="lost" className="flex items-center space-x-2">
              <TrendingDown className="w-4 h-4" />
              <span>Perdidas ({getTabCount('lost')})</span>
            </TabsTrigger>
            <TabsTrigger value="void" className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Anuladas ({getTabCount('void')})</span>
            </TabsTrigger>
          </TabsList>

          {/* Content */}
          <TabsContent value={activeTab} className="space-y-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-full"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : error ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Erro ao carregar apostas: {error}
                </AlertDescription>
              </Alert>
            ) : getBetsByTab(activeTab).length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageCircle className="w-12 h-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhuma aposta encontrada
                  </h3>
                  <p className="text-gray-500 text-center mb-6">
                    {activeTab === 'all' 
                      ? 'Você ainda não tem apostas registradas. Envie uma mensagem via WhatsApp para começar!'
                      : `Nenhuma aposta ${activeTab === 'pending' ? 'pendente' : 
                          activeTab === 'won' ? 'ganha' : 
                          activeTab === 'lost' ? 'perdida' : 'anulada'} encontrada.`
                    }
                  </p>
                  <WhatsAppSyncButton 
                    userId={user.id} 
                    onSyncComplete={() => fetchBets()}
                    variant="default"
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {getBetsByTab(activeTab).map((bet) => (
                  <BetCard
                    key={bet.id}
                    bet={bet}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteBet}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
