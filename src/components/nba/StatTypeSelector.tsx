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

const STAT_TYPES_BASIC: StatType[] = [
  { id: 'player_points', label: 'PTS', description: 'Points' },
  { id: 'player_assists', label: 'AST', description: 'Assists' },
  { id: 'player_rebounds', label: 'REB', description: 'Rebounds' },
  { id: 'player_threes', label: '3PT', description: '3-Pointers' },
  { id: 'player_steals', label: 'STL', description: 'Steals' },
  { id: 'player_blocks', label: 'BLK', description: 'Blocks' },
  { id: 'player_turnovers', label: 'TO', description: 'Turnovers' },
];

const STAT_TYPES_COMBOS: StatType[] = [
  { id: 'player_points_assists', label: 'P+A', description: 'Points + Assists' },
  { id: 'player_points_rebounds', label: 'P+R', description: 'Points + Rebounds' },
  { id: 'player_rebounds_assists', label: 'R+A', description: 'Rebounds + Assists' },
  { id: 'player_points_rebounds_assists', label: 'PRA', description: 'Pts + Reb + Ast' },
  { id: 'player_double_double', label: 'DD', description: 'Double-Double' },
];

const STAT_TYPES = [...STAT_TYPES_BASIC, ...STAT_TYPES_COMBOS];

export const StatTypeSelector: React.FC<StatTypeSelectorProps> = ({
  availableStats,
  selectedStat,
  onStatChange,
}) => {
  const filterGroup = (group: StatType[]) =>
    availableStats.length > 0
      ? group.filter(st => availableStats.some(as => as.id === st.id))
      : group;

  const basicStats = filterGroup(STAT_TYPES_BASIC);
  const comboStats = filterGroup(STAT_TYPES_COMBOS);

  const renderButton = (stat: StatType) => {
    const isSelected = selectedStat === stat.id;
    return (
      <button
        key={stat.id}
        onClick={() => onStatChange(stat.id)}
        className={`terminal-button px-3 py-1.5 text-center transition-all ${
          isSelected
            ? 'bg-terminal-blue text-terminal-black border-terminal-blue'
            : 'hover:border-terminal-blue/50'
        }`}
        title={stat.description}
      >
        <div className="text-xs font-bold">{stat.label}</div>
      </button>
    );
  };

  return (
    <div className="terminal-container px-4 py-3 mb-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] data-label opacity-50 shrink-0">STATS</span>
        <div className="flex gap-1 flex-wrap">
          {basicStats.map(renderButton)}
        </div>
        <div className="h-5 w-px bg-terminal-blue/20 shrink-0" />
        <div className="flex gap-1 flex-wrap">
          {comboStats.map(renderButton)}
        </div>
      </div>
    </div>
  );
};

export { STAT_TYPES };
export type { StatType };
