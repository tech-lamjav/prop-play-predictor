import React from 'react';
import { Player } from '@/services/nba-data.service';
import { Star } from 'lucide-react';
import { getTeamLogoUrl, getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';

import { Skeleton } from '@/components/ui/skeleton';

interface PlayerHeaderProps {
  player?: Player;
  seasonAverages?: {
    points: number;
    assists: number;
    rebounds: number;
  };
  isLoading?: boolean;
}

function StarRow({ n }: { n: number }) {
  const filled = Math.max(0, Math.min(3, n));
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0">
      {[0, 1, 2].map(i => (
        <Star key={i} className={`w-3 h-3 ${i < filled ? 'text-amber-400 fill-amber-400' : 'text-ink-dim'}`} />
      ))}
    </span>
  );
}

function statusLabel(status: string | undefined): { label: string; cls: string } {
  const s = (status ?? '').toLowerCase();
  if (s === 'active' || s === '') return { label: 'Ativo', cls: 'text-forest' };
  if (s.includes('out for season')) return { label: 'Fora da temporada', cls: 'text-rose-700' };
  if (s === 'out' || s.includes('out')) return { label: 'Fora', cls: 'text-rose-700' };
  if (s.includes('doubtful')) return { label: 'Duvidoso', cls: 'text-orange-700' };
  if (s.includes('probable')) return { label: 'Provável', cls: 'text-emerald-700' };
  if (s.includes('questionable')) return { label: 'Questionável', cls: 'text-amber-700' };
  return { label: status ?? 'Ativo', cls: 'text-ink-2' };
}

export const PlayerHeader: React.FC<PlayerHeaderProps> = ({ player, seasonAverages, isLoading }) => {
  if (isLoading) {
    return (
      <div className="rounded-xl bg-white border border-line p-5">
        <div className="flex items-start gap-4">
          <Skeleton className="w-20 h-20 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-3 gap-3 mt-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!player) return null;

  const initials = player.player_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const status = statusLabel(player.current_status);

  return (
    <div className="rounded-xl bg-white border border-line p-5">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-canvas-2 to-line-2 grid place-items-center">
          <img
            src={getPlayerPhotoUrl(player.player_name, player.team_name)}
            alt={player.player_name}
            className="w-full h-full object-cover"
            loading="lazy"
            data-player-photo-index="0"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const hasNext = tryNextPlayerPhotoUrl(target, player.player_name, player.team_name);
              if (hasNext) return;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<span class="text-[22px] font-semibold text-ink-2">${initials}</span>`;
              }
            }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[22px] font-semibold tracking-tight leading-tight text-ink truncate">
                {player.player_name}
              </h2>
              <div className="text-[12px] mt-0.5 text-ink-2 flex items-center gap-1.5 flex-wrap">
                <img
                  src={getTeamLogoUrl(player.team_name)}
                  alt={player.team_name}
                  className="w-4 h-4 object-contain shrink-0"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="truncate">{player.team_name}</span>
                <span className="text-ink-dim">·</span>
                <span>{player.position}</span>
                <span className="text-ink-dim">·</span>
                <span className={`font-semibold ${status.cls}`}>{status.label}</span>
              </div>
            </div>

            {player.rating_stars > 0 && (
              <div className="px-2 h-7 inline-flex items-center gap-0.5 rounded-md bg-amber-100 shrink-0">
                <StarRow n={player.rating_stars} />
              </div>
            )}
          </div>

          {/* Season averages */}
          {seasonAverages && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2/70">Pontos</div>
                <div className="text-[22px] font-semibold tabular tracking-tight leading-tight mt-0.5 text-ink">
                  {seasonAverages.points.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2/70">Assistências</div>
                <div className="text-[22px] font-semibold tabular tracking-tight leading-tight mt-0.5 text-ink">
                  {seasonAverages.assists.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2/70">Rebotes</div>
                <div className="text-[22px] font-semibold tabular tracking-tight leading-tight mt-0.5 text-ink">
                  {seasonAverages.rebounds.toFixed(1)}
                </div>
              </div>
            </div>
          )}

          <div className="text-[11px] mt-3 text-ink-2/70 flex items-center gap-2 flex-wrap">
            <span>Idade {player.age}</span>
            {player.last_game_text && (
              <>
                <span className="text-ink-dim">·</span>
                <span>{player.last_game_text}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
