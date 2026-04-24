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

const STAT_LABELS: Record<string, string> = {
  player_points: 'Pontos',
  player_assists: 'Assistências',
  player_rebounds: 'Rebotes',
  player_threes: '3 Pontos',
  player_steals: 'Roubos',
  player_blocks: 'Bloqueios',
  player_turnovers: 'Turnovers',
  player_points_assists: 'Pts + Ast',
  player_points_rebounds: 'Pts + Reb',
  player_rebounds_assists: 'Reb + Ast',
  player_points_rebounds_assists: 'PRA',
  player_double_double: 'Double-Double',
  player_q1_points: '1Q Pontos',
  player_q1_assists: '1Q Assistências',
  player_q1_rebounds: '1Q Rebotes',
  player_h1_points: '1H Pontos',
};

export const STAT_TYPES_BASIC: StatType[] = [
  { id: 'player_points', label: 'Pontos', description: 'Pontos' },
  { id: 'player_assists', label: 'Assistências', description: 'Assistências' },
  { id: 'player_rebounds', label: 'Rebotes', description: 'Rebotes' },
  { id: 'player_threes', label: '3 Pontos', description: 'Cestas de 3 pontos' },
  { id: 'player_steals', label: 'Roubos', description: 'Roubos de bola' },
  { id: 'player_blocks', label: 'Bloqueios', description: 'Bloqueios' },
  { id: 'player_turnovers', label: 'Turnovers', description: 'Turnovers' },
];

export const STAT_TYPES_COMBOS: StatType[] = [
  { id: 'player_points_assists', label: 'Pts + Ast', description: 'Pontos + Assistências' },
  { id: 'player_points_rebounds', label: 'Pts + Reb', description: 'Pontos + Rebotes' },
  { id: 'player_rebounds_assists', label: 'Reb + Ast', description: 'Rebotes + Assistências' },
  { id: 'player_points_rebounds_assists', label: 'Pts + Reb + Ast', description: 'Pontos + Rebotes + Assistências' },
  { id: 'player_double_double', label: 'Double-Double', description: 'Double-Double' },
];

export const STAT_TYPES_PERIOD: StatType[] = [
  { id: 'player_q1_points', label: 'Pontos 1Q', description: '1º Quarto — Pontos' },
  { id: 'player_q1_rebounds', label: 'Rebotes 1Q', description: '1º Quarto — Rebotes' },
  { id: 'player_q1_assists', label: 'Assistências 1Q', description: '1º Quarto — Assistências' },
  { id: 'player_h1_points', label: 'Pontos 1H', description: '1º Tempo — Pontos' },
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
            ? 'border-terminal-blue text-terminal-blue bg-terminal-blue/10'
            : 'opacity-50 hover:opacity-80 hover:border-terminal-blue/40'
        }`}
        title={stat.description}
      >
        <div className="text-xs font-bold leading-none">{stat.label}</div>
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
