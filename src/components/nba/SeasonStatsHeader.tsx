import React from 'react';

interface SeasonStatsHeaderProps {
  seasonAvg: number;
  graphAvg: number;
  hitRate: number;
  totalGames: number;
  gamesOver: number;
  statType: string;
}

export const SeasonStatsHeader: React.FC<SeasonStatsHeaderProps> = ({
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

  const formatStatType = (type: string) => {
    return type.replace('player_', '').replace(/_/g, ' ').toUpperCase();
  };

  return (
    <div className="terminal-container p-4 mb-3">
      <div className="grid grid-cols-2 gap-4">
        {/* Graph Average */}
        <div className="text-center">
          <div className="data-label text-xs mb-1">GRAPH AVG</div>
          <div className="text-3xl font-bold text-terminal-green">
            {graphAvg.toFixed(1)}
          </div>
          <div className="text-xs opacity-50 mt-1">
            {formatStatType(statType)}
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
