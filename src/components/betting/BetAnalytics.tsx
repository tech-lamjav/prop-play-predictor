import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { BarChart3, TrendingUp, Activity } from 'lucide-react';
import BetAnalyticsBigNumbers from './BetAnalyticsBigNumbers';
import BetAnalyticsCharts from './BetAnalyticsCharts';
import { Bet } from '../../hooks/use-bets';
import { useBetAnalytics } from '../../hooks/use-bet-analytics';

interface BetAnalyticsProps {
  bets: Bet[];
  isLoading?: boolean;
}

export default function BetAnalytics({ bets, isLoading }: BetAnalyticsProps) {
  const {
    extendedStats,
    profitTimeline,
    volumeData,
    sportDistribution,
    performanceHeatmap,
  } = useBetAnalytics(bets);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-foreground">Analytics Dashboard</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Análise detalhada das suas apostas e performance
        </p>
      </div>

      {/* Content with scroll */}
      <ScrollArea className="flex-1">
        <div className="space-y-6 pr-4">
          {/* Big Numbers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span>Métricas Principais</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Indicadores-chave da sua performance
              </p>
            </CardHeader>
            <CardContent>
              <BetAnalyticsBigNumbers stats={extendedStats} isLoading={isLoading} />
            </CardContent>
          </Card>

          {/* Charts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-purple-600" />
                <span>Gráficos e Visualizações</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Análise visual dos dados e tendências
              </p>
            </CardHeader>
            <CardContent>
              <BetAnalyticsCharts
                profitTimeline={profitTimeline}
                volumeData={volumeData}
                sportDistribution={sportDistribution}
                performanceHeatmap={performanceHeatmap}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>

          {/* Quick Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-orange-600" />
                <span>Insights Rápidos</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Principais descobertas dos seus dados
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Best Sport */}
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                    Melhor Esporte
                  </h4>
                  {sportDistribution.length > 0 ? (
                    <div>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {sportDistribution[0].sport}
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {sportDistribution[0].percentage.toFixed(1)}% das apostas
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Lucro: {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(sportDistribution[0].profit)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Sem dados suficientes</p>
                  )}
                </div>

                {/* Current Streak */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                    Streak Atual
                  </h4>
                  {extendedStats && extendedStats.currentStreak.count > 0 ? (
                    <div>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {extendedStats.currentStreak.count} {extendedStats.currentStreak.type === 'win' ? 'vitórias' : 'derrotas'}
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {extendedStats.currentStreak.type === 'win' ? 'Em sequência de vitórias!' : 'Sequência de derrotas'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Sem streak ativo</p>
                  )}
                </div>

                {/* ROI Performance */}
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2">
                    Performance ROI
                  </h4>
                  {extendedStats ? (
                    <div>
                      <p className={`text-lg font-bold ${extendedStats.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {extendedStats.roi.toFixed(1)}%
                      </p>
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        {extendedStats.roi >= 0 ? 'Retorno positivo' : 'Retorno negativo'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Sem dados</p>
                  )}
                </div>

                {/* Average Odds */}
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <h4 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">
                    Odds Médias
                  </h4>
                  {extendedStats ? (
                    <div>
                      <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                        {extendedStats.averageOdds.toFixed(2)}
                      </p>
                      <p className="text-sm text-orange-700 dark:text-orange-300">
                        {extendedStats.averageOdds > 2.0 ? 'Apostas de alto risco' : 
                         extendedStats.averageOdds > 1.5 ? 'Apostas moderadas' : 
                         'Apostas conservadoras'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Sem dados</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
