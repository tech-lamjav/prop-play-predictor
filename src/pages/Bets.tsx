import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/use-auth';
import { createClient } from '../integrations/supabase/client';
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
  Calendar
} from 'lucide-react';

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
  status: 'pending' | 'won' | 'lost' | 'void';
  bet_date: string;
  match_date?: string;
  created_at: string;
  updated_at: string;
  raw_input?: string;
  processed_data?: any;
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
    
    const totalReturn = wonBets.reduce((sum, bet) => sum + bet.potential_return, 0);
    const totalLost = lostBets.reduce((sum, bet) => sum + bet.stake_amount, 0);
    
    const winRate = totalBets > 0 ? (wonBets.length / (wonBets.length + lostBets.length)) * 100 : 0;
    const profit = totalReturn - totalLost;

    setStats({
      totalBets,
      totalStaked,
      totalReturn,
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

  useEffect(() => {
    if (user?.id) {
      fetchBets();
    }
  }, [user?.id]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-500', text: 'Pendente', icon: Clock },
      won: { color: 'bg-green-500', text: 'Ganhou', icon: TrendingUp },
      lost: { color: 'bg-red-500', text: 'Perdeu', icon: TrendingDown },
      void: { color: 'bg-gray-500', text: 'Anulada', icon: Clock }
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
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Minhas Apostas</h1>
              <p className="text-muted-foreground mt-2">
                Acompanhe suas apostas registradas via WhatsApp
              </p>
            </div>
            
            <Button onClick={fetchBets} variant="outline" disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Target className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total de Apostas</p>
                  <p className="text-2xl font-bold">{stats.totalBets}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Apostado</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalStaked)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Retorno Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalReturn)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Target className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Taxa de Acerto</p>
                  <p className="text-2xl font-bold">{stats.winRate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className={`h-8 w-8 ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Lucro/Prejuízo</p>
                  <p className={`text-2xl font-bold ${stats.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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

        {/* Bets List */}
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bets.map((bet) => (
              <Card key={bet.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-muted-foreground">
                        {bet.sport}
                      </span>
                    </div>
                    {getStatusBadge(bet.status)}
                  </div>
                  <CardTitle className="text-lg">{bet.bet_description}</CardTitle>
                  {bet.match_description && (
                    <p className="text-sm text-muted-foreground">
                      {bet.match_description}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Valor:</span>
                      <span className="font-semibold">{formatCurrency(bet.stake_amount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Odds:</span>
                      <span className="font-semibold">{bet.odds}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Retorno Potencial:</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(bet.potential_return)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Data:</span>
                      <span className="text-sm">{formatDate(bet.bet_date)}</span>
                    </div>
                    {bet.league && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Liga:</span>
                        <span className="text-sm">{bet.league}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4">
                    {bet.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateBetStatus(bet.id, 'won')}
                          className="flex-1"
                        >
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Ganhou
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateBetStatus(bet.id, 'lost')}
                          className="flex-1"
                        >
                          <TrendingDown className="w-3 h-3 mr-1" />
                          Perdeu
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteBet(bet.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
