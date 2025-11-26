import React from 'react';

interface StatType {
  id: string;
  label: string;
  description: string;
}

interface StatTypeSelectorProps {
  availableStats: StatType[];
  selectedStat: string;
  onStatChange: (statId: string) => void;
}

const STAT_TYPES: StatType[] = [
  { id: 'player_points', label: 'PTS', description: 'Points' },
  { id: 'player_assists', label: 'AST', description: 'Assists' },
  { id: 'player_rebounds', label: 'REB', description: 'Rebounds' },
  { id: 'player_threes', label: '3PT', description: '3-Pointers' },
  { id: 'player_steals', label: 'STL', description: 'Steals' },
  { id: 'player_blocks', label: 'BLK', description: 'Blocks' },
  { id: 'player_turnovers', label: 'TO', description: 'Turnovers' },
  { id: 'player_points_assists', label: 'P+A', description: 'Points + Assists' },
  { id: 'player_points_rebounds', label: 'P+R', description: 'Points + Rebounds' },
  { id: 'player_rebounds_assists', label: 'R+A', description: 'Rebounds + Assists' },
  { id: 'player_points_rebounds_assists', label: 'PRA', description: 'Points + Rebounds + Assists' },
  { id: 'player_double_double', label: 'DD', description: 'Double-Double' },
];

export const StatTypeSelector: React.FC<StatTypeSelectorProps> = ({
  availableStats,
  selectedStat,
  onStatChange,
}) => {
  // Filter to only show stats that are available for this player
  const displayStats = availableStats.length > 0 
    ? STAT_TYPES.filter(st => availableStats.some(as => as.id === st.id))
    : STAT_TYPES;

  return (
    <div className="terminal-container p-4 mb-3">
      <h3 className="section-title mb-3">SELECT STAT TYPE</h3>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
        {displayStats.map((stat) => {
          const isSelected = selectedStat === stat.id;
          return (
            <button
              key={stat.id}
              onClick={() => onStatChange(stat.id)}
              className={`terminal-button p-2 text-center transition-all ${
                isSelected
                  ? 'bg-terminal-blue text-terminal-black border-terminal-blue'
                  : 'hover:border-terminal-blue/50'
              }`}
              title={stat.description}
            >
              <div className="text-xs font-bold">{stat.label}</div>
              {isSelected && (
                <div className="text-[8px] mt-0.5 opacity-80">ACTIVE</div>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2 text-[10px] opacity-50">
        {selectedStat && (
          <span>
            VIEWING: {STAT_TYPES.find(s => s.id === selectedStat)?.description.toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
};

export { STAT_TYPES };
export type { StatType };
