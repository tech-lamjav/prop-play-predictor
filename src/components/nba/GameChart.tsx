import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { GamePlayerStats } from '@/services/nba-data.service';

interface GameChartProps {
  gameStats: GamePlayerStats[];
  statType?: string;
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

export const GameChart: React.FC<GameChartProps> = ({ gameStats, statType = 'Points' }) => {
  // Transform game stats into chart data
  const chartData: ChartDataPoint[] = gameStats
    .reverse() // Show oldest to newest
    .map((game, index) => ({
      game: `G${index + 1}`,
      value: game.stat_value ?? 0,
      opponent: game.played_against,
      date: new Date(game.game_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
      isOver: game.stat_vs_line === 'Over',
    }));

  // Calculate average
  const average = chartData.length > 0
    ? (chartData.reduce((sum, game) => sum + game.value, 0) / chartData.length).toFixed(1)
    : '0.0';

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

  return (
    <div className="terminal-container p-4 mb-3">
      <h3 className="section-title mb-3">PERFORMANCE GRAPH</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData} 
            margin={{
              top: 5,
              right: 5,
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
              tick={{
                fill: '#c5d0c0',
                fontSize: 11
              }} 
              axisLine={{
                stroke: '#3a3d3a'
              }} 
            />
            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.isOver ? '#7a9bb5' : '#5a7a95'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs flex justify-between opacity-60">
        <span>LAST {chartData.length} GAMES</span>
        <span className="font-medium">AVG: {average} {statType.toUpperCase()}</span>
      </div>
    </div>
  );
};
