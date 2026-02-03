import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, ReferenceLine, Label } from 'recharts';
import { GamePlayerStats } from '@/services/nba-data.service';
import { RotateCcw } from 'lucide-react';

interface GameChartProps {
  gameStats: GamePlayerStats[];
  statType?: string;
  currentLine?: number | null;
}

interface ChartDataPoint {
  game: string;
  value: number;
  opponent: string;
  date: string;
  isOver: boolean;
}

const CustomXAxisTick = (props: any) => {
  const { x, y, payload, data } = props;
  const gameData = data.find((d: ChartDataPoint) => d.game === payload.value);
  
  return (
    <g transform={`translate(${x},${y})`}>
      <text 
        x={0} 
        y={0} 
        dy={12} 
        textAnchor="middle" 
        fill="#7a9bb5" 
        fontSize={11} 
        fontWeight={600}
      >
        {gameData?.opponent}
      </text>
      <text 
        x={0} 
        y={0} 
        dy={24} 
        textAnchor="middle" 
        fill="#8a9585" 
        fontSize={9}
      >
        {gameData?.date}
      </text>
    </g>
  );
};

export const GameChart: React.FC<GameChartProps> = ({ gameStats, statType = 'Points', currentLine }) => {
  const [adjustedLine, setAdjustedLine] = useState<number | null>(currentLine ?? null);
  const [isDragging, setIsDragging] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartBoundsRef = useRef<{ top: number; bottom: number; minY: number; maxY: number } | null>(null);
  
  useEffect(() => {
    setAdjustedLine(currentLine ?? null);
  }, [currentLine]);

  const chartData: ChartDataPoint[] = [...gameStats]
    .reverse()
    .map((game, index) => ({
      game: `G${index + 1}`,
      value: game.stat_value ?? 0,
      opponent: game.played_against,
      date: new Date(game.game_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
      isOver: game.stat_vs_line === 'Over',
    }));

  const average = chartData.length > 0
    ? (chartData.reduce((sum, game) => sum + game.value, 0) / chartData.length).toFixed(1)
    : '0.0';

  const hitRate = adjustedLine && chartData.length > 0
    ? {
        hits: chartData.filter(g => g.value > adjustedLine).length,
        total: chartData.length,
        percentage: ((chartData.filter(g => g.value > adjustedLine).length / chartData.length) * 100).toFixed(1)
      }
    : null;

  // Calcular domain do eixo Y
  const maxValue = Math.max(...chartData.map(d => d.value), adjustedLine || 0);
  const yAxisMax = Math.ceil(maxValue * 1.15);
  const yAxisMin = 0;

  // Handler para início do drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (adjustedLine === null || !chartContainerRef.current) return;
    
    const container = chartContainerRef.current;
    const rect = container.getBoundingClientRect();
    
    // Área do gráfico (aproximada - margins do Recharts)
    const chartTop = rect.top + 5; // margin top
    const chartBottom = rect.bottom - 80; // margin bottom + footer
    
    chartBoundsRef.current = {
      top: chartTop,
      bottom: chartBottom,
      minY: yAxisMin,
      maxY: yAxisMax
    };
    
    // Verificar se clicou perto da linha (tolerância de 15px)
    const chartHeight = chartBottom - chartTop;
    const lineYPosition = chartTop + chartHeight * (1 - (adjustedLine - yAxisMin) / (yAxisMax - yAxisMin));
    
    if (Math.abs(e.clientY - lineYPosition) < 15) {
      setIsDragging(true);
      e.preventDefault();
    }
  }, [adjustedLine, yAxisMin, yAxisMax]);

  // Handler para movimento do drag
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !chartBoundsRef.current) return;
    
    const { top, bottom, minY, maxY } = chartBoundsRef.current;
    const chartHeight = bottom - top;
    
    // Calcular valor Y baseado na posição do mouse
    const relativeY = Math.max(0, Math.min(1, (e.clientY - top) / chartHeight));
    const newValue = maxY - relativeY * (maxY - minY);
    
    // Arredondar para 0.5
    const roundedValue = Math.round(newValue * 2) / 2;
    setAdjustedLine(Math.max(0.5, roundedValue));
  }, [isDragging]);

  // Handler para fim do drag
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handler para mouse sair da área
  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  const handleReset = () => {
    setAdjustedLine(currentLine ?? null);
  };

  if (chartData.length === 0) {
    return (
      <div className="terminal-container p-4 mb-3">
        <h3 className="section-title mb-3">PERFORMANCE GRAPH</h3>
        <div className="h-64 flex items-center justify-center text-terminal-text opacity-50">
          <p>No game data available</p>
        </div>
      </div>
    );
  }

  const isLineModified = currentLine !== null && adjustedLine !== currentLine;

  return (
    <div className="terminal-container p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title">PERFORMANCE GRAPH</h3>
        
        {/* Valor da linha e botão reset */}
        {adjustedLine !== null && (
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white">
              LINE: {adjustedLine.toFixed(1)}
            </span>
            
            {isLineModified && (
              <button
                onClick={handleReset}
                className="w-6 h-6 flex items-center justify-center rounded border border-white/50 text-white/70 hover:bg-white/10 transition-colors"
                title={`Resetar para ${currentLine}`}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hint para arrastar */}
      {adjustedLine !== null && (
        <div className="mb-2 text-[10px] text-white/50 flex items-center gap-1">
          <span>↕</span>
          <span>Arraste a linha para simular diferentes cenários</span>
        </div>
      )}

      <div 
        ref={chartContainerRef}
        className={`h-64 ${isDragging ? 'cursor-grabbing' : adjustedLine !== null ? 'cursor-grab' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ userSelect: 'none' }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData} 
            margin={{
              top: 5,
              right: 30,
              left: -20,
              bottom: 30
            }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#3a3d3a" 
              vertical={false} 
            />
            <XAxis 
              dataKey="game" 
              tick={<CustomXAxisTick data={chartData} />} 
              axisLine={{
                stroke: '#3a3d3a'
              }} 
              height={50} 
            />
            <YAxis 
              domain={[yAxisMin, yAxisMax]}
              tick={{
                fill: '#c5d0c0',
                fontSize: 11
              }} 
              axisLine={{
                stroke: '#3a3d3a'
              }} 
            />
            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => {
                const isOverLine = adjustedLine !== null ? entry.value > adjustedLine : entry.isOver;
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={isOverLine ? '#22c55e' : '#ef4444'} 
                  />
                );
              })}
            </Bar>
            {adjustedLine !== null && (
              <ReferenceLine 
                y={adjustedLine} 
                stroke={isDragging ? '#ffffff' : isLineModified ? '#e5e5e5' : '#ffffff'}
                strokeWidth={isDragging ? 3 : 2}
                style={{ cursor: 'ns-resize' }}
              >
                <Label 
                  value={adjustedLine.toFixed(1)} 
                  position="right" 
                  fill="#ffffff"
                  fontSize={11}
                  fontWeight={700}
                />
              </ReferenceLine>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-2 text-xs flex justify-between">
        <span className="opacity-60">LAST {chartData.length} GAMES</span>
        <div className="flex gap-4">
          {hitRate && (
            <span className={`font-bold ${parseFloat(hitRate.percentage) >= 50 ? 'text-green-500' : 'text-red-500'}`}>
              HIT RATE: {hitRate.percentage}% ({hitRate.hits}/{hitRate.total})
            </span>
          )}
          <span className="font-medium opacity-60">AVG: {average}</span>
        </div>
      </div>
      
      {adjustedLine !== null && (
        <div className="mt-2 text-[10px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-green-500"></span> OVER
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-red-500"></span> UNDER
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-white"></span> LINE
            </span>
          </div>
          {currentLine !== null && (
            <span className="opacity-50">
              Original: {currentLine.toFixed(1)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
