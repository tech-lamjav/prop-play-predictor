import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

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
  valueColor = 'text-ink',
}) => {
  const getTrendIcon = () => {
    const iconClass = 'w-3 h-3 md:w-3.5 md:h-3.5';
    if (trend === 'up') {
      return <TrendingUp className={`${iconClass} text-emerald-700 shrink-0`} />;
    } else if (trend === 'down') {
      return <TrendingDown className={`${iconClass} text-rose-700 shrink-0`} />;
    }
    return null;
  };

  return (
    <div className="bg-white border border-line rounded-xl p-3 md:p-4 min-w-0 overflow-hidden">
      <div className="text-[10px] md:text-[11px] uppercase tracking-[0.14em] font-bold text-ink-2 truncate">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5 mt-1.5 min-w-0">
        <div
          className={`text-[18px] md:text-[22px] font-extrabold tracking-tight tabular ${valueColor} min-w-0 overflow-hidden text-ellipsis whitespace-nowrap`}
          title={typeof value === 'string' ? value : String(value)}
        >
          {value}
        </div>
        {getTrendIcon()}
      </div>
      {subtext && (
        <div className="text-[10px] md:text-[11px] text-ink-2/80 mt-1 truncate">
          {subtext}
        </div>
      )}
    </div>
  );
};
