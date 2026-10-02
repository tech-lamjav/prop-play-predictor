import React from 'react';
import { useTranslation } from 'react-i18next';

interface StatType {
  id: string;
}

interface StatTypeSelectorProps {
  availableStats: StatType[];
  selectedStat: string;
  onStatChange: (statId: string) => void;
}

// ⚠️ As listas guardam IDENTIFICADOR, nunca texto. O rótulo do botão e a
// descrição do title vêm do catálogo por esse identificador
// (`estatisticas.rotulo.<id>` e `estatisticas.descricao.<id>`), que é o que
// permite a mesma lista servir os dois idiomas sem duplicar tela (#541).
export const STAT_TYPES_BASIC: StatType[] = [
  { id: 'player_points' },
  { id: 'player_assists' },
  { id: 'player_rebounds' },
  { id: 'player_threes' },
  { id: 'player_steals' },
  { id: 'player_blocks' },
  { id: 'player_turnovers' },
];

export const STAT_TYPES_COMBOS: StatType[] = [
  { id: 'player_points_assists' },
  { id: 'player_points_rebounds' },
  { id: 'player_rebounds_assists' },
  { id: 'player_points_rebounds_assists' },
  { id: 'player_double_double' },
];

export const STAT_TYPES_PERIOD: StatType[] = [
  { id: 'player_q1_points' },
  { id: 'player_q1_rebounds' },
  { id: 'player_q1_assists' },
  { id: 'player_h1_points' },
  { id: 'player_h1_rebounds' },
  { id: 'player_h1_assists' },
];

const STAT_TYPES = [...STAT_TYPES_BASIC, ...STAT_TYPES_COMBOS];

export const StatTypeSelector: React.FC<StatTypeSelectorProps> = ({
  availableStats,
  selectedStat,
  onStatChange,
}) => {
  const { t } = useTranslation('nba');

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
        className={`bg-white border border-line text-ink hover:border-forest/30 px-3 py-1.5 text-center transition-all ${
          isSelected
            ? 'border-forest text-forest bg-forest/10'
            : 'opacity-50 hover:opacity-80 hover:border-forest/40'
        }`}
        title={t(`estatisticas.descricao.${stat.id}`)}
      >
        <div className="text-xs font-bold leading-none">{t(`estatisticas.rotulo.${stat.id}`)}</div>
      </button>
    );
  };

  return (
    <div className="rounded-lg bg-white border border-line px-4 py-3 mb-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] data-label opacity-50 shrink-0">{t('grafico.grupoEstatisticas')}</span>
        <div className="flex gap-1 flex-wrap">
          {basicStats.map(renderButton)}
        </div>
        <div className="h-5 w-px bg-forest/20 shrink-0" />
        <div className="flex gap-1 flex-wrap">
          {comboStats.map(renderButton)}
        </div>
      </div>
    </div>
  );
};

export { STAT_TYPES };
export type { StatType };
