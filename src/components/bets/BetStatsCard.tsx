import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface BetStatsCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  valueColor?: string;
}

export const BetStatsCard: React.FC<BetStatsCardProps> = ({
  label,
  value,
  subtext,
  trend,
  valueColor = 'text-terminal-green',
}) => {
  const getTrendIcon = () => {
    if (trend === 'up') {
      return <TrendingUp className="w-4 h-4 text-terminal-green" />;
    } else if (trend === 'down') {
      return <TrendingDown className="w-4 h-4 text-terminal-red" />;
    }
    return null;
  };

  return (
    <div className="terminal-container p-4 flex flex-col items-center justify-center h-full">
      <div className="data-label text-xs mb-1">{label}</div>
      <div className="flex items-center justify-center gap-2">
        <div className={`text-2xl font-bold ${valueColor}`}>
          {value}
        </div>
        {getTrendIcon()}
      </div>
      {subtext && (
        <div className="text-xs opacity-50 mt-1 text-center">
          {subtext}
        </div>
      )}
    </div>
  );
};
