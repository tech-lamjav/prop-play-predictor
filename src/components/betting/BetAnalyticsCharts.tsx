import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  BarChart3, 
  PieChart as PieChartIcon,
  Calendar,
  Activity
} from 'lucide-react';
import { 
  ProfitTimelineData, 
  VolumeData, 
  SportDistributionData, 
  PerformanceHeatmapData 
} from '../../hooks/use-bet-analytics';

interface BetAnalyticsChartsProps {
  profitTimeline: ProfitTimelineData[];
  volumeData: (period: 'day' | 'week' | 'month') => VolumeData[];
  sportDistribution: SportDistributionData[];
  performanceHeatmap: PerformanceHeatmapData[];
  isLoading?: boolean;
}

const CHART_COLORS = {
  profit: '#10b981',
  loss: '#ef4444',
  pending: '#f59e0b',
  cashout: '#3b82f6',
  neutral: '#6b7280',
  green: '#10b981',
  red: '#ef4444',
  blue: '#3b82f6',
  yellow: '#f59e0b',
  purple: '#8b5cf6',
  orange: '#f97316',
  pink: '#ec4899',
};

const SPORT_COLORS = [
  CHART_COLORS.green,
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.orange,
  CHART_COLORS.pink,
  CHART_COLORS.yellow,
  CHART_COLORS.red,
];

export default function BetAnalyticsCharts({ 
  profitTimeline, 
  volumeData, 
  sportDistribution, 
  performanceHeatmap,
  isLoading 
}: BetAnalyticsChartsProps) {
  const [volumePeriod, setVolumePeriod] = useState<'day' | 'week' | 'month'>('day');
  
  const currentVolumeData = volumeData(volumePeriod);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  };

  const formatPeriodLabel = (period: string) => {
    if (volumePeriod === 'day') {
      return formatDate(period);
    } else if (volumePeriod === 'week') {
      const date = new Date(period);
      return `Sem ${date.getWeek?.() || Math.ceil(date.getDate() / 7)}`;
    } else {
      const [year, month] = period.split('-');
      return `${month}/${year}`;
    }
  };

  // Custom tooltip for profit line chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-slate-300 text-sm mb-2">{formatDate(label)}</p>
          <div className="space-y-1">
            <p className="text-green-400 text-sm">
              Lucro Acumulado: <span className="font-bold">{formatCurrency(payload[0].value)}</span>
            </p>
            <p className="text-blue-400 text-sm">
              Lucro Diário: <span className="font-bold">{formatCurrency(payload[1]?.value || 0)}</span>
            </p>
            <p className="text-slate-400 text-sm">
              Apostas: <span className="font-bold">{payload[0].payload?.betsCount || 0}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for volume chart
  const VolumeTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-slate-300 text-sm mb-2">{formatPeriodLabel(label)}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <p key={index} className="text-sm" style={{ color: entry.color }}>
                {entry.name}: <span className="font-bold">{entry.value}</span>
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for pie chart
  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
          <p className="text-slate-300 text-sm mb-2">{data.name}</p>
          <p className="text-blue-400 text-sm">
            Apostas: <span className="font-bold">{data.value}</span>
          </p>
          <p className="text-green-400 text-sm">
            Percentual: <span className="font-bold">{data.payload.percentage.toFixed(1)}%</span>
          </p>
          <p className="text-purple-400 text-sm">
            Lucro: <span className="font-bold">{formatCurrency(data.payload.profit)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profit Timeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <span>Evolução do Lucro</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Lucro acumulado ao longo do tempo
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9ca3af"
                  tickFormatter={formatDate}
                />
                <YAxis 
                  stroke="#9ca3af"
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="cumulativeProfit" 
                  stroke={CHART_COLORS.profit}
                  strokeWidth={3}
                  dot={{ fill: CHART_COLORS.profit, strokeWidth: 2, r: 4 }}
                  name="Lucro Acumulado"
                />
                <Line 
                  type="monotone" 
                  dataKey="dailyProfit" 
                  stroke={CHART_COLORS.blue}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: CHART_COLORS.blue, strokeWidth: 2, r: 3 }}
                  name="Lucro Diário"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Volume Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <span>Volume de Apostas</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Quantidade de apostas por período
              </p>
            </div>
            <ToggleGroup 
              type="single" 
              value={volumePeriod} 
              onValueChange={(value) => setVolumePeriod(value as 'day' | 'week' | 'month')}
              className="bg-slate-100 dark:bg-slate-800"
            >
              <ToggleGroupItem value="day" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                Dia
              </ToggleGroupItem>
              <ToggleGroupItem value="week" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                Semana
              </ToggleGroupItem>
              <ToggleGroupItem value="month" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                Mês
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currentVolumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="period" 
                  stroke="#9ca3af"
                  tickFormatter={formatPeriodLabel}
                />
                <YAxis stroke="#9ca3af" />
                <Tooltip content={<VolumeTooltip />} />
                <Legend />
                <Bar 
                  dataKey="won" 
                  stackId="a" 
                  fill={CHART_COLORS.green}
                  name="Ganhas"
                />
                <Bar 
                  dataKey="cashout" 
                  stackId="a" 
                  fill={CHART_COLORS.blue}
                  name="Cashouts"
                />
                <Bar 
                  dataKey="lost" 
                  stackId="a" 
                  fill={CHART_COLORS.red}
                  name="Perdidas"
                />
                <Bar 
                  dataKey="pending" 
                  stackId="a" 
                  fill={CHART_COLORS.yellow}
                  name="Pendentes"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Sport Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PieChartIcon className="h-5 w-5 text-purple-600" />
            <span>Distribuição por Esporte</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Percentual de apostas por esporte
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sportDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ sport, percentage }) => `${sport} (${percentage.toFixed(1)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {sportDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SPORT_COLORS[index % SPORT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Performance Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-orange-600" />
            <span>Performance por Período</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Taxa de acerto por dia da semana e hora
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <div className="grid grid-cols-8 gap-1 h-full">
              {/* Days of week labels */}
              <div className="flex flex-col justify-center text-xs text-muted-foreground">
                <div className="h-8"></div>
                <div className="h-8 flex items-center justify-center">Dom</div>
                <div className="h-8 flex items-center justify-center">Seg</div>
                <div className="h-8 flex items-center justify-center">Ter</div>
                <div className="h-8 flex items-center justify-center">Qua</div>
                <div className="h-8 flex items-center justify-center">Qui</div>
                <div className="h-8 flex items-center justify-center">Sex</div>
                <div className="h-8 flex items-center justify-center">Sáb</div>
              </div>
              
              {/* Hour labels and heatmap */}
              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} className="flex flex-col">
                  <div className="h-8 flex items-center justify-center text-xs text-muted-foreground">
                    {hour}h
                  </div>
                  {Array.from({ length: 7 }, (_, dayOfWeek) => {
                    const heatmapData = performanceHeatmap.find(
                      data => data.dayOfWeek === dayOfWeek && data.hour === hour
                    );
                    const performance = heatmapData?.performance || 0;
                    const betsCount = heatmapData?.betsCount || 0;
                    
                    const intensity = Math.min(performance / 100, 1);
                    const bgColor = intensity > 0.6 ? 'bg-green-600' : 
                                  intensity > 0.4 ? 'bg-yellow-500' : 
                                  intensity > 0.2 ? 'bg-orange-500' : 
                                  'bg-gray-300';
                    
                    return (
                      <div
                        key={`${dayOfWeek}-${hour}`}
                        className={`h-8 w-full ${bgColor} border border-gray-200 hover:border-gray-400 transition-colors cursor-pointer`}
                        title={`${dayOfWeek === 0 ? 'Dom' : dayOfWeek === 1 ? 'Seg' : dayOfWeek === 2 ? 'Ter' : dayOfWeek === 3 ? 'Qua' : dayOfWeek === 4 ? 'Qui' : dayOfWeek === 5 ? 'Sex' : 'Sáb'} ${hour}h - ${performance.toFixed(1)}% (${betsCount} apostas)`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-center space-x-4 mt-4 text-xs">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-gray-300 rounded"></div>
                <span>0-20%</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span>20-40%</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span>40-60%</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-600 rounded"></div>
                <span>60%+</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
