import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  DollarSign, 
  BarChart3,
  Trophy,
  AlertCircle
} from 'lucide-react';
import { BetStats as BetStatsType } from '../../hooks/use-bets';

interface BetStatsProps {
  stats: BetStatsType | null;
  isLoading?: boolean;
}

export default function BetStats({ stats, isLoading }: BetStatsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total de Apostas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Apostas</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalBets}</div>
          <p className="text-xs text-muted-foreground">
            Apostas registradas
          </p>
        </CardContent>
      </Card>

      {/* Valor Total Apostado */}
      <Card>
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
      <Card>
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
      <Card>
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

      {/* Resumo Detalhado */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Resumo Detalhado</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.totalReturn)}
              </div>
              <p className="text-sm text-green-700">Total Retornado</p>
            </div>
            
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(stats.totalStaked)}
              </div>
              <p className="text-sm text-blue-700">Total Investido</p>
            </div>
            
            <div className={`text-center p-4 rounded-lg ${
              stats.profit >= 0 ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <div className={`text-2xl font-bold ${
                stats.profit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(stats.profit)}
              </div>
              <p className={`text-sm ${
                stats.profit >= 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {stats.profit >= 0 ? 'Lucro' : 'Prejuízo'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
