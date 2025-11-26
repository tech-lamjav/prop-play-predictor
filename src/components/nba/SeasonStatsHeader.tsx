import React from 'react';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';

interface SeasonStatsHeaderProps {
  seasonAvg: number;
  graphAvg: number;
  hitRate: number;
  totalGames: number;
  gamesOver: number;
  statType: string;
}

export const SeasonStatsHeader: React.FC<SeasonStatsHeaderProps> = ({
  seasonAvg,
  graphAvg,
  hitRate,
  totalGames,
  gamesOver,
  statType,
}) => {
  const getHitRateColor = (rate: number) => {
    if (rate >= 60) return 'text-terminal-green';
    if (rate >= 50) return 'text-terminal-yellow';
    return 'text-terminal-red';
  };

  const getTrendIcon = () => {
    if (graphAvg > seasonAvg * 1.05) {
      return <TrendingUp className="w-4 h-4 text-terminal-green" />;
    } else if (graphAvg < seasonAvg * 0.95) {
      return <TrendingDown className="w-4 h-4 text-terminal-red" />;
    }
    return null;
  };

  const formatStatType = (type: string) => {
    return type.replace('player_', '').replace(/_/g, ' ').toUpperCase();
  };

  return (
    <div className="terminal-container p-4 mb-3">
      <div className="grid grid-cols-3 gap-4">
        {/* Season Average */}
        <div className="text-center">
          <div className="data-label text-xs mb-1">SZN AVG</div>
          <div className="text-3xl font-bold text-terminal-green">
            {seasonAvg.toFixed(1)}
          </div>
          <div className="text-xs opacity-50 mt-1">
            {formatStatType(statType)}
          </div>
        </div>

        {/* Graph Average */}
        <div className="text-center">
          <div className="data-label text-xs mb-1">GRAPH AVG</div>
          <div className="flex items-center justify-center gap-2">
            <div className="text-3xl font-bold text-terminal-green">
              {graphAvg.toFixed(1)}
            </div>
            {getTrendIcon()}
          </div>
          <div className="text-xs opacity-50 mt-1">
            Last {totalGames} games
          </div>
        </div>

        {/* Hit Rate */}
        <div className="text-center">
          <div className="data-label text-xs mb-1">HIT RATE</div>
          <div className={`text-3xl font-bold ${getHitRateColor(hitRate)}`}>
            {hitRate.toFixed(1)}%
          </div>
          <div className="text-xs opacity-50 mt-1">
            ({gamesOver}/{totalGames})
          </div>
        </div>
      </div>
    </div>
  );
};
