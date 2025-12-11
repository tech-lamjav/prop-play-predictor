import React from 'react';
import { PlayerShootingZones } from '@/services/nba-data.service';
import { Skeleton } from '@/components/ui/skeleton';

interface ShootingZonesCardProps {
  data?: PlayerShootingZones | null;
  isLoading?: boolean;
  playerName?: string;
}

export const ShootingZonesCard: React.FC<ShootingZonesCardProps> = ({
  data,
  isLoading = false,
  playerName = '',
}) => {
  if (isLoading) {
    return (
      <div className="terminal-container p-4 rounded">
        <h3 className="section-title mb-3">SHOOTING ZONES</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Skeleton className="h-24 w-full bg-terminal-gray" />
          <Skeleton className="h-24 w-full bg-terminal-gray" />
          <Skeleton className="h-24 w-full bg-terminal-gray" />
          <Skeleton className="h-24 w-full bg-terminal-gray" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="terminal-container p-4 rounded">
        <h3 className="section-title mb-3">SHOOTING ZONES</h3>
        <div className="text-xs text-terminal-text opacity-60">
          Nenhum dado de zonas de arremesso para {playerName || 'o jogador selecionado'}.
        </div>
      </div>
    );
  }

  const zones = [
    {
      title: 'Corner 3',
      fga: data.corner_3_fga,
      fgm: data.corner_3_fgm,
      pct: data.corner_3_fg_pct,
    },
    {
      title: 'Left Corner 3',
      fga: data.left_corner_3_fga,
      fgm: data.left_corner_3_fgm,
      pct: data.left_corner_3_fg_pct,
    },
    {
      title: 'Right Corner 3',
      fga: data.right_corner_3_fga,
      fgm: data.right_corner_3_fgm,
      pct: data.right_corner_3_fg_pct,
    },
    {
      title: 'Above the Break 3',
      fga: data.above_the_break_3_fga,
      fgm: data.above_the_break_3_fgm,
      pct: data.above_the_break_3_fg_pct,
    },
    {
      title: 'Restricted Area',
      fga: data.restricted_area_fga,
      fgm: data.restricted_area_fgm,
      pct: data.restricted_area_fg_pct,
    },
    {
      title: 'Paint (Non-RA)',
      fga: data.in_the_paint_non_ra_fga,
      fgm: data.in_the_paint_non_ra_fgm,
      pct: data.in_the_paint_non_ra_fg_pct,
    },
    {
      title: 'Mid Range',
      fga: data.mid_range_fga,
      fgm: data.mid_range_fgm,
      pct: data.mid_range_fg_pct,
    },
    {
      title: 'Backcourt',
      fga: data.backcourt_fga,
      fgm: data.backcourt_fgm,
      pct: data.backcourt_fg_pct,
    },
  ];

  return (
    <div className="terminal-container p-4 rounded">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title">SHOOTING ZONES</h3>
        <div className="text-[11px] opacity-60">
          {playerName ? `Player: ${playerName}` : ''}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {zones.map((zone) => (
          <div key={zone.title} className="p-3 rounded bg-terminal-dark-gray border border-terminal-border-subtle">
            <div className="text-xs font-bold text-terminal-green mb-2">{zone.title}</div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex flex-col">
                <span className="opacity-60">FGA</span>
                <span className="font-semibold">{zone.fga?.toFixed(1) ?? '0.0'}</span>
              </div>
              <div className="flex flex-col text-terminal-blue">
                <span className="opacity-60">FGM</span>
                <span className="font-semibold">{zone.fgm?.toFixed(1) ?? '0.0'}</span>
              </div>
              <div className="flex flex-col text-terminal-yellow">
                <span className="opacity-60">FG%</span>
                <span className="font-semibold">
                  {zone.pct !== null && zone.pct !== undefined
                    ? `${(zone.pct * 100).toFixed(1)}%`
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};




