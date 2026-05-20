import React from 'react';
import { Filter, Home, Plane, Globe, X } from 'lucide-react';

interface QuickFiltersBarProps {
  lastNGames: number | 'all';
  homeAway: 'all' | 'home' | 'away';
  onLastNGamesChange: (value: number | 'all') => void;
  onHomeAwayChange: (value: 'all' | 'home' | 'away') => void;
  totalGamesAvailable: number;
  onClearFilters?: () => void;
}

export const QuickFiltersBar: React.FC<QuickFiltersBarProps> = ({
  lastNGames,
  homeAway,
  onLastNGamesChange,
  onHomeAwayChange,
  totalGamesAvailable,
  onClearFilters,
}) => {
  const hasActiveFilters = lastNGames !== 'all' || homeAway !== 'all';

  const handleClearFilters = () => {
    onLastNGamesChange('all');
    onHomeAwayChange('all');
    if (onClearFilters) {
      onClearFilters();
    }
  };
  const gameOptions: Array<{ value: number | 'all'; label: string }> = [
    { value: 5, label: 'Last 5' },
    { value: 10, label: 'Last 10' },
    { value: 15, label: 'Last 15' },
    { value: 'all', label: 'All' },
  ];

  const locationOptions: Array<{
    value: 'all' | 'home' | 'away';
    label: string;
    icon: React.ReactNode;
  }> = [
    { value: 'all', label: 'All', icon: <Globe className="w-3 h-3" /> },
    { value: 'home', label: 'Home', icon: <Home className="w-3 h-3" /> },
    { value: 'away', label: 'Away', icon: <Plane className="w-3 h-3" /> },
  ];

  return (
    <div className="rounded-lg bg-white border border-line p-3 mb-3">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Filter Icon */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-forest" />
          <span className="data-label text-xs">FILTERS</span>
        </div>

        {/* Last N Games Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-70">Games:</span>
          <div className="flex gap-1">
            {gameOptions.map((option) => {
              const isDisabled =
                typeof option.value === 'number' &&
                option.value > totalGamesAvailable;
              const isActive = lastNGames === option.value;

              return (
                <button
                  key={option.value}
                  onClick={() => !isDisabled && onLastNGamesChange(option.value)}
                  disabled={isDisabled}
                  className={`px-3 py-1 text-xs font-medium rounded border transition-all ${
                    isActive
                      ? 'bg-forest/20 border-forest text-forest'
                      : isDisabled
                      ? 'border-line text-ink/30 cursor-not-allowed'
                      : 'border-forest/30 text-ink hover:border-forest/50 hover:bg-forest/5'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-forest/20" />

        {/* Home/Away Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-70">Location:</span>
          <div className="flex gap-1">
            {locationOptions.map((option) => {
              const isActive = homeAway === option.value;

              return (
                <button
                  key={option.value}
                  onClick={() => onHomeAwayChange(option.value)}
                  className={`px-3 py-1 text-xs font-medium rounded border transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-forest/20 border-forest text-forest'
                      : 'border-forest/30 text-ink hover:border-forest/50 hover:bg-forest/5'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Filters Count and Clear Button */}
        {hasActiveFilters && (
          <div className="ml-auto flex items-center gap-2">
            <div className="text-xs px-2 py-1 rounded bg-emerald-50 text-forest border border-forest/30">
              {[
                lastNGames !== 'all' && `Last ${lastNGames}`,
                homeAway !== 'all' && homeAway.charAt(0).toUpperCase() + homeAway.slice(1),
              ]
                .filter(Boolean)
                .join(' • ')}
            </div>
            <button
              onClick={handleClearFilters}
              className="px-2 py-1 text-xs font-medium rounded border border-rose-200/30 text-rose-700 hover:bg-rose-50 hover:border-rose-200/50 transition-all flex items-center gap-1"
              title="Limpar filtros"
            >
              <X className="w-3 h-3" />
              Limpar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
