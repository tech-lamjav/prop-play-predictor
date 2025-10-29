import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  DollarSign, 
  Trophy,
  BarChart3,
  Zap,
  Calendar,
  Clock,
  AlertCircle
} from 'lucide-react';
import { ExtendedBetStats } from '../../hooks/use-bet-analytics';

interface BetAnalyticsBigNumbersProps {
  stats: ExtendedBetStats | null;
  isLoading?: boolean;
}

export default function BetAnalyticsBigNumbers({ stats, isLoading }: BetAnalyticsBigNumbersProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString('pt-BR');
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Nenhuma estatística disponível</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getProfitColor = (profit: number) => {
    if (profit > 0) return 'text-green-600';
    if (profit < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getROIColor = (roi: number) => {
    if (roi > 0) return 'text-green-600';
    if (roi < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 60) return 'text-green-600';
    if (winRate >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStreakColor = (streak: { type: 'win' | 'loss' | 'none'; count: number }) => {
    if (streak.type === 'win') return 'text-green-600';
    if (streak.type === 'loss') return 'text-red-600';
    return 'text-gray-600';
  };

  const getStreakIcon = (streak: { type: 'win' | 'loss' | 'none'; count: number }) => {
    if (streak.type === 'win') return <TrendingUp className="h-4 w-4" />;
    if (streak.type === 'loss') return <TrendingDown className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Primary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total de Apostas */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Apostas</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalBets)}</div>
            <p className="text-xs text-muted-foreground">
              Apostas registradas
            </p>
          </CardContent>
        </Card>

        {/* Valor Total Apostado */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Apostado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalStaked)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total investido
            </p>
          </CardContent>
        </Card>

        {/* Taxa de Acerto */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Acerto</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getWinRateColor(stats.winRate)}`}>
              {formatPercentage(stats.winRate)}
            </div>
            <p className="text-xs text-muted-foreground">
              Apostas ganhas
            </p>
          </CardContent>
        </Card>

        {/* Lucro/Prejuízo */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resultado</CardTitle>
            {stats.profit >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getProfitColor(stats.profit)}`}>
              {formatCurrency(stats.profit)}
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={stats.profit >= 0 ? "default" : "destructive"}>
                ROI: {formatPercentage(stats.roi)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ROI */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ROI</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getROIColor(stats.roi)}`}>
              {formatPercentage(stats.roi)}
            </div>
            <p className="text-xs text-muted-foreground">
              Retorno sobre investimento
            </p>
          </CardContent>
        </Card>

        {/* Média de Odds */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média de Odds</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.averageOdds.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Odds médias das apostas
            </p>
          </CardContent>
        </Card>

        {/* Maior Vitória */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maior Vitória</CardTitle>
            <Trophy className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.biggestWin)}
            </div>
            <p className="text-xs text-muted-foreground">
              Maior retorno obtido
            </p>
          </CardContent>
        </Card>

        {/* Maior Perda */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maior Perda</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats.biggestLoss)}
            </div>
            <p className="text-xs text-muted-foreground">
              Maior valor perdido
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tertiary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Streak Atual */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Streak Atual</CardTitle>
            {getStreakIcon(stats.currentStreak)}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStreakColor(stats.currentStreak)}`}>
              {stats.currentStreak.count}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.currentStreak.type === 'win' ? 'Vitórias consecutivas' : 
               stats.currentStreak.type === 'loss' ? 'Derrotas consecutivas' : 
               'Sem streak ativo'}
            </p>
          </CardContent>
        </Card>

        {/* Total Cashouts */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cashouts</CardTitle>
            <Zap className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalCashouts}
            </div>
            <p className="text-xs text-muted-foreground">
              Total de cashouts realizados
            </p>
          </CardContent>
        </Card>

        {/* Valor em Cashouts */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Cashouts</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(stats.cashoutAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total recebido em cashouts
            </p>
          </CardContent>
        </Card>

        {/* Valor Pendente */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Pendente</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(stats.pendingAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              Apostas ainda em andamento
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
