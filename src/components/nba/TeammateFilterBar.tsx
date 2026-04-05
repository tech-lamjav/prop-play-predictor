import React, { useState } from 'react';
import { Users, X, ChevronDown, Star } from 'lucide-react';
import { TeamPlayer } from '@/services/nba-data.service';
import { getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';

type TeammateFilter = {
  playerId: number;
  playerName: string;
  mode: 'with' | 'without';
} | null;

interface TeammateFilterBarProps {
  teammates: TeamPlayer[];
  currentPlayerId: number;
  teamName: string;
  teammateFilter: TeammateFilter;
  isLoading?: boolean;
  onFilterChange: (filter: TeammateFilter) => void;
}

export const TeammateFilterBar: React.FC<TeammateFilterBarProps> = ({
  teammates,
  currentPlayerId,
  teamName,
  teammateFilter,
  isLoading,
  onFilterChange,
}) => {
  const [open, setOpen] = useState(false);

  const available = teammates.filter(
    t => Number(t.player_id) !== Number(currentPlayerId)
  );

  const handleSelect = (teammate: TeamPlayer, mode: 'with' | 'without') => {
    onFilterChange({ playerId: teammate.player_id, playerName: teammate.player_name, mode });
    setOpen(false);
  };

  const handleClear = () => {
    onFilterChange(null);
    setOpen(false);
  };

  return (
    <div className="terminal-container px-4 py-3 mb-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] data-label opacity-50 shrink-0">TEAMMATE</span>

        {/* Active filter badge */}
        {teammateFilter ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${
              teammateFilter.mode === 'with'
                ? 'bg-terminal-green/15 border-terminal-green/50 text-terminal-green'
                : 'bg-terminal-red/15 border-terminal-red/50 text-terminal-red'
            }`}>
              {teammateFilter.mode === 'with' ? 'COM' : 'SEM'} {teammateFilter.playerName.split(' ').pop()}
            </span>
            <button
              onClick={handleClear}
              className="w-5 h-5 flex items-center justify-center rounded border border-white/20 text-white/40 hover:text-white/80 hover:border-white/40 transition-colors"
              title="Remover filtro"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setOpen(v => !v)}
              disabled={isLoading || available.length === 0}
              className="flex items-center gap-1.5 px-3 py-1 text-[11px] rounded border border-terminal-green/30 text-terminal-text hover:border-terminal-green/50 hover:bg-terminal-green/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Users className="w-3 h-3" />
              <span>Selecionar companheiro</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div
                className="absolute top-full left-0 mt-1 z-50 bg-terminal-dark-gray border border-terminal-border-subtle rounded shadow-lg min-w-[280px] max-h-[280px] overflow-y-auto
                  [&::-webkit-scrollbar]:w-1
                  [&::-webkit-scrollbar-track]:bg-transparent
                  [&::-webkit-scrollbar-thumb]:bg-white/20
                  [&::-webkit-scrollbar-thumb]:rounded-full
                  [&::-webkit-scrollbar-thumb:hover]:bg-white/40"
              >
                {available.map(t => {
                  const photoUrl = getPlayerPhotoUrl(t.player_name, teamName);
                  const initials = t.player_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={t.player_id}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-terminal-gray/40 border-b border-terminal-border-subtle/30 last:border-0"
                    >
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-terminal-gray border border-terminal-border-subtle shrink-0 flex items-center justify-center">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={t.player_name}
                            data-player-photo-index="0"
                            className="w-full h-full object-cover object-top"
                            onError={(e) => {
                              const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, t.player_name, teamName);
                              if (!didTry) {
                                const el = e.target as HTMLImageElement;
                                el.style.display = 'none';
                                const parent = el.parentElement;
                                if (parent) parent.innerHTML = `<span class="text-[9px] font-bold text-terminal-text opacity-60">${initials}</span>`;
                              }
                            }}
                          />
                        ) : (
                          <span className="text-[9px] font-bold text-terminal-text opacity-60">{initials}</span>
                        )}
                      </div>

                      {/* Name + position + stars */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-terminal-text truncate">{t.player_name}</span>
                          {t.rating_stars > 0 && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              {Array.from({ length: t.rating_stars }).map((_, i) => (
                                <Star key={i} className="w-2.5 h-2.5 fill-terminal-yellow text-terminal-yellow" />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] opacity-50">
                          <span>{t.position}</span>
                          {t.current_status && t.current_status.toLowerCase() !== 'active' && (
                            <span className="text-terminal-red">{t.current_status}</span>
                          )}
                        </div>
                      </div>

                      {/* COM / SEM */}
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleSelect(t, 'with')}
                          className="px-2 py-0.5 text-[10px] rounded border border-terminal-green/40 text-terminal-green hover:bg-terminal-green/15 transition-colors"
                        >
                          COM
                        </button>
                        <button
                          onClick={() => handleSelect(t, 'without')}
                          className="px-2 py-0.5 text-[10px] rounded border border-terminal-red/40 text-terminal-red hover:bg-terminal-red/15 transition-colors"
                        >
                          SEM
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <span className="text-[10px] opacity-40 animate-pulse">carregando...</span>
        )}
      </div>
    </div>
  );
};

export type { TeammateFilter };
