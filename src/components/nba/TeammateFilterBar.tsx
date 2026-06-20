import React, { useState } from 'react';
import { Users, X, ChevronDown, Star } from 'lucide-react';
import { TeamPlayer } from '@/services/nba-data.service';
import { getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';

type TeammateFilterEntry = {
  playerId: number;
  playerName: string;
  mode: 'with' | 'without';
};

type TeammateFilter = TeammateFilterEntry[] | null;

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

  const isSelected = (playerId: number) =>
    teammateFilter?.some(f => f.playerId === playerId) ?? false;

  const handleSelect = (teammate: TeamPlayer, mode: 'with' | 'without') => {
    const entry: TeammateFilterEntry = { playerId: teammate.player_id, playerName: teammate.player_name, mode };
    if (!teammateFilter) {
      onFilterChange([entry]);
    } else {
      // Remove if already selected, then add with new mode
      const filtered = teammateFilter.filter(f => f.playerId !== teammate.player_id);
      onFilterChange([...filtered, entry]);
    }
  };

  const handleRemove = (playerId: number) => {
    if (!teammateFilter) return;
    const filtered = teammateFilter.filter(f => f.playerId !== playerId);
    onFilterChange(filtered.length > 0 ? filtered : null);
  };

  const handleClearAll = () => {
    onFilterChange(null);
    setOpen(false);
  };

  return (
    <div className="rounded-lg bg-white border border-line px-4 py-3 mb-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] data-label opacity-50 shrink-0">TEAMMATE</span>

        {/* Active filter badges */}
        {teammateFilter && teammateFilter.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {teammateFilter.map(f => (
              <div key={f.playerId} className="flex items-center gap-1">
                <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${
                  f.mode === 'with'
                    ? 'bg-emerald-100 border-forest/50 text-forest'
                    : 'bg-rose-100 border-rose-200/50 text-rose-700'
                }`}>
                  {f.mode === 'with' ? 'COM' : 'SEM'} {f.playerName.split(' ').pop()}
                </span>
                <button
                  onClick={() => handleRemove(f.playerId)}
                  className="w-4 h-4 flex items-center justify-center rounded border border-white/20 text-white/40 hover:text-white/80 hover:border-white/40 transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            {teammateFilter.length > 1 && (
              <button
                onClick={handleClearAll}
                className="text-[9px] text-white/40 hover:text-white/70 transition-colors"
              >
                limpar
              </button>
            )}
          </div>
        )}

        {/* Add button */}
        <div className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            disabled={isLoading || available.length === 0}
            className="flex items-center gap-1.5 px-3 py-1 text-[11px] rounded border border-forest/30 text-ink hover:border-forest/50 hover:bg-forest/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Users className="w-3 h-3" />
            <span>{teammateFilter && teammateFilter.length > 0 ? '+' : 'Selecionar companheiro'}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div
              className="absolute top-full left-0 mt-1 z-50 bg-canvas-2 border border-line rounded shadow-lg min-w-[280px] max-h-[280px] overflow-y-auto
                [&::-webkit-scrollbar]:w-1
                [&::-webkit-scrollbar-track]:bg-transparent
                [&::-webkit-scrollbar-thumb]:bg-white/20
                [&::-webkit-scrollbar-thumb]:rounded-full
                [&::-webkit-scrollbar-thumb:hover]:bg-white/40"
            >
              {available.map(t => {
                const photoUrl = getPlayerPhotoUrl(t.player_name, teamName);
                const initials = t.player_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const selected = isSelected(t.player_id);
                return (
                  <div
                    key={t.player_id}
                    className={`flex items-center gap-2.5 px-3 py-2 hover:bg-canvas-2/40 border-b border-line/30 last:border-0 ${selected ? 'bg-canvas-2/20' : ''}`}
                  >
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-canvas-2 border border-line shrink-0 flex items-center justify-center">
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
                              if (parent) parent.innerHTML = `<span class="text-[9px] font-bold text-ink opacity-60">${initials}</span>`;
                            }
                          }}
                        />
                      ) : (
                        <span className="text-[9px] font-bold text-ink opacity-60">{initials}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-ink truncate">{t.player_name}</span>
                        {t.rating_stars > 0 && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            {Array.from({ length: t.rating_stars }).map((_, i) => (
                              <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-700" />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] opacity-50">
                        <span>{t.position}</span>
                        {t.current_status && t.current_status.toLowerCase() !== 'active' && (
                          <span className="text-rose-700">{t.current_status}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleSelect(t, 'with')}
                        className="px-2 py-0.5 text-[10px] rounded border border-forest/40 text-forest hover:bg-emerald-100 transition-colors"
                      >
                        COM
                      </button>
                      <button
                        onClick={() => handleSelect(t, 'without')}
                        className="px-2 py-0.5 text-[10px] rounded border border-rose-200/40 text-rose-700 hover:bg-rose-100 transition-colors"
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

        {isLoading && (
          <span className="text-[10px] opacity-40 animate-pulse">carregando...</span>
        )}
      </div>
    </div>
  );
};

export type { TeammateFilter, TeammateFilterEntry };
