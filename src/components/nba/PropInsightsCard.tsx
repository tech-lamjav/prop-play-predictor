import React from 'react';
import { PropPlayer } from '@/services/nba-data.service';
import { Star, TrendingUp, AlertTriangle, Users } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

interface PropInsightsCardProps {
  propPlayers: PropPlayer[];
  playerName: string;
  isLoading?: boolean;
}

export const PropInsightsCard: React.FC<PropInsightsCardProps> = ({ propPlayers, playerName, isLoading }) => {
  if (isLoading) {
    return (
      <div className="terminal-container p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title">PROP INSIGHTS</h3>
          <Skeleton className="h-4 w-20 bg-terminal-gray" />
        </div>
        <div className="space-y-2 mb-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full bg-terminal-gray" />
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-terminal-border-subtle grid grid-cols-3 gap-2">
          <Skeleton className="h-10 w-full bg-terminal-gray" />
          <Skeleton className="h-10 w-full bg-terminal-gray" />
          <Skeleton className="h-10 w-full bg-terminal-gray" />
        </div>
      </div>
    );
  }
  // Get top-rated props (3 stars)
  const topProps = propPlayers
    .filter(p => p.rating_stars === 3)
    .slice(0, 5);

  // Get props with injury impact
  const injuryImpactProps = propPlayers.filter(p => p.is_leader_with_injury);

  if (propPlayers.length === 0) {
    return (
      <div className="terminal-container p-4 mb-3">
        <h3 className="section-title mb-3">PROP INSIGHTS</h3>
        <div className="text-center py-8 opacity-50">
          <p className="text-xs">No prop data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-container p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title">PROP INSIGHTS</h3>
        <div className="text-[10px] opacity-50">
          {topProps.length} TOP RATED
        </div>
      </div>

      {/* Top Rated Props */}
      {topProps.length > 0 && (
        <div className="space-y-2 mb-4">
          {topProps.map((prop, index) => (
            <div
              key={index}
              className="bg-terminal-dark-gray p-3 rounded border border-terminal-border-subtle hover:border-terminal-green/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="text-xs font-medium text-terminal-green mb-1">
                    {prop.stat_type.replace('player_', '').replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] opacity-60">
                    <span>RANK #{prop.stat_rank}</span>
                    {prop.is_available_backup && (
                      <>
                        <span>•</span>
                        <span className="text-terminal-green">BACKUP AVAILABLE</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-terminal-gray px-2 py-1 rounded">
                  <Star className="w-3 h-3 text-terminal-green fill-current" />
                  <span className="text-xs font-bold text-terminal-green">{prop.rating_stars}</span>
                </div>
              </div>

              {/* Backup Player Info */}
              {prop.is_available_backup && prop.next_available_player_name && prop.next_available_player_name.trim() !== '' && (
                <div className="mt-2 pt-2 border-t border-terminal-border-subtle">
                  <div className="flex items-center gap-2 text-[10px]">
                    <Users className="w-3 h-3 opacity-50" />
                    <span className="opacity-60">NEXT:</span>
                    <span className="text-terminal-text">{prop.next_available_player_name}</span>
                  </div>
                  {(prop.next_player_stats_normal > 0 || prop.next_player_stats_when_leader_out > 0) && (
                    <div className="flex items-center gap-2 text-[10px] mt-1 ml-5">
                      {prop.next_player_stats_normal > 0 && (
                        <>
                          <span className="opacity-60">AVG:</span>
                          <span className="stat-positive">{prop.next_player_stats_normal.toFixed(1)}</span>
                        </>
                      )}
                      {prop.next_player_stats_when_leader_out > 0 && (
                        <>
                          {prop.next_player_stats_normal > 0 && <span className="opacity-60">→</span>}
                          <span className="stat-positive font-bold">
                            {prop.next_player_stats_when_leader_out.toFixed(1)}
                          </span>
                          <span className="opacity-60">(when {playerName.split(' ')[0]} out)</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Injury Impact Alert */}
      {injuryImpactProps.length > 0 && (
        <div className="bg-terminal-red/10 border border-terminal-red/30 p-3 rounded">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-terminal-red flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-xs font-medium text-terminal-red mb-1">
                INJURY IMPACT DETECTED
              </div>
              <div className="text-[10px] opacity-80">
                {injuryImpactProps.length} prop{injuryImpactProps.length > 1 ? 's' : ''} affected by team injuries
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-3 pt-3 border-t border-terminal-border-subtle grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="data-label mb-1">TOTAL PROPS</div>
          <div className="text-sm font-bold">{propPlayers.length}</div>
        </div>
        <div>
          <div className="data-label mb-1">TOP RATED</div>
          <div className="text-sm font-bold stat-positive">{topProps.length}</div>
        </div>
        <div>
          <div className="data-label mb-1">AVG RANK</div>
          <div className="text-sm font-bold">
            {(propPlayers.reduce((sum, p) => sum + p.stat_rank, 0) / propPlayers.length).toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
};
