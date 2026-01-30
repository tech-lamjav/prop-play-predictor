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
    const iconClass = 'w-3 h-3 md:w-4 md:h-4';
    if (trend === 'up') {
      return <TrendingUp className={`${iconClass} text-terminal-green shrink-0`} />;
    } else if (trend === 'down') {
      return <TrendingDown className={`${iconClass} text-terminal-red shrink-0`} />;
    }
    return null;
  };

  return (
    <div className="terminal-container p-3 md:p-4 flex flex-col items-center justify-center h-full min-w-0 overflow-hidden">
      <div className="data-label text-[10px] md:text-xs mb-0.5 md:mb-1 truncate w-full text-center">{label}</div>
      <div className="flex items-center justify-center gap-1 md:gap-2 min-w-0 w-full overflow-hidden">
        <div className={`text-base md:text-2xl font-bold ${valueColor} min-w-0 overflow-hidden text-ellipsis whitespace-nowrap max-w-full`} title={typeof value === 'string' ? value : String(value)}>
          {value}
        </div>
        {getTrendIcon()}
      </div>
      {subtext && (
        <div className="text-[10px] md:text-xs opacity-50 mt-0.5 md:mt-1 text-center truncate w-full">
          {subtext}
        </div>
      )}
    </div>
  );
};
