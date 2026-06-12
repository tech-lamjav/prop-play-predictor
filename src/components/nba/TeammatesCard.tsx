import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeamPlayer } from '@/services/nba-data.service';
import { Star, ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';

interface TeammatesCardProps {
  teammates: TeamPlayer[];
  currentPlayerId: number;
  teamName: string;
  isLoading?: boolean;
}

function StarRow({ n }: { n: number }) {
  const filled = Math.max(0, Math.min(3, n));
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {[0, 1, 2].map(i => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < filled ? 'text-amber-400 fill-amber-400' : 'text-ink-3'}`}
        />
      ))}
    </div>
  );
}

function statusLabel(status: string | undefined): { label: string; cls: string } | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === 'active' || s === '') return null;
  if (s.includes('out for season')) return { label: 'Out For Season', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
  if (s === 'out' || s.includes('out')) return { label: 'Out', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
  if (s.includes('doubtful')) return { label: 'Doubtful', cls: 'bg-orange-50 text-orange-700 border-orange-200' };
  if (s.includes('probable')) return { label: 'Probable', cls: 'bg-emerald-50 text-forest border-emerald-200' };
  if (s.includes('questionable')) return { label: 'Questionable', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: status, cls: 'bg-canvas-2 text-ink-2 border-line' };
}

export const TeammatesCard: React.FC<TeammatesCardProps> = ({
  teammates,
  currentPlayerId,
  teamName,
  isLoading,
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white border border-line overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <Skeleton className="h-3 w-24 mb-1" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const displayTeammates = teammates
    .filter(p => p.player_id !== currentPlayerId)
    .slice(0, 5);

  const handlePlayerClick = (playerName: string) => {
    const slug = playerName.toLowerCase().replace(/\s+/g, '-');
    navigate(`/nba-dashboard/${slug}`);
  };

  return (
    <div className="rounded-lg bg-white border border-line overflow-hidden">
      {/* Header: COMPANHEIROS + team name */}
      <button
        type="button"
        className="w-full px-4 py-3 flex items-center justify-between border-b border-line md:cursor-default"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="text-left">
          <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">Companheiros</div>
          {teamName && (
            <div className="text-[11px] mt-0.5 text-ink-dim">{teamName}</div>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-ink-dim transition-transform md:hidden ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <div className={`${expanded ? 'block' : 'hidden'} md:block`}>
        {displayTeammates.length === 0 ? (
          <div className="p-4 text-[12px] text-ink-dim">Nenhum dado de companheiros disponível</div>
        ) : (
          displayTeammates.map((player, i) => {
            const initials = player.player_name
              .split(/\s+/)
              .filter(Boolean)
              .map(w => w[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();
            const status = statusLabel(player.current_status);

            return (
              <button
                key={player.player_id}
                type="button"
                onClick={() => handlePlayerClick(player.player_name)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-canvas-2/40 transition-colors ${i > 0 ? 'border-t border-line' : ''}`}
              >
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-canvas-2 grid place-items-center">
                  <img
                    src={getPlayerPhotoUrl(player.player_name, teamName)}
                    alt={player.player_name}
                    className="w-full h-full object-cover object-top"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      const didTry = tryNextPlayerPhotoUrl(target, player.player_name, teamName);
                      if (!didTry) {
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `<span class="text-[11px] font-semibold text-ink-2">${initials}</span>`;
                        }
                      }
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold tracking-tight truncate text-ink">
                    {player.player_name}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] mt-0.5 text-ink-dim">
                    <span>{player.position}</span>
                    {status && (
                      <span className={`px-1.5 h-4 inline-flex items-center rounded text-[9px] font-bold border ${status.cls}`}>
                        {status.label}
                      </span>
                    )}
                  </div>
                </div>
                <StarRow n={player.rating_stars ?? 0} />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
