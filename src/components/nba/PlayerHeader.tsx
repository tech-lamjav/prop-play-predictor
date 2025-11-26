import React from 'react';
import { Player } from '@/services/nba-data.service';
import { Star, TrendingUp, TrendingDown } from 'lucide-react';

interface PlayerHeaderProps {
  player: Player;
  seasonAverages?: {
    points: number;
    assists: number;
    rebounds: number;
  };
}

export const PlayerHeader: React.FC<PlayerHeaderProps> = ({ player, seasonAverages }) => {
  // Generate initials for avatar
  const initials = player.player_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Determine status color
  const statusColor = player.current_status?.toLowerCase() === 'active' 
    ? 'text-terminal-green' 
    : 'text-terminal-red';

  return (
    <div className="terminal-container p-4 mb-3">
      <div className="flex items-start gap-4">
        {/* Player Avatar */}
        <div className="flex-shrink-0">
          <div className="w-20 h-20 rounded-lg bg-terminal-gray border-2 border-terminal-green flex items-center justify-center">
            <span className="text-2xl font-bold text-terminal-green">{initials}</span>
          </div>
        </div>

        {/* Player Info */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="text-2xl font-bold text-terminal-green mb-1">
                {player.player_name}
              </h2>
              <div className="flex items-center gap-3 text-sm">
                <span className="opacity-70">{player.team_name}</span>
                <span className="opacity-50">•</span>
                <span className="opacity-70">{player.position}</span>
                <span className="opacity-50">•</span>
                <span className={statusColor}>
                  {player.current_status || 'Active'}
                </span>
              </div>
            </div>

            {/* Rating Stars */}
            {player.rating_stars > 0 && (
              <div className="flex items-center gap-1 bg-terminal-dark-gray px-3 py-1.5 rounded border border-terminal-border-subtle">
                <Star className="w-4 h-4 text-terminal-green fill-current" />
                <span className="text-sm font-bold text-terminal-green">
                  {player.rating_stars}
                </span>
              </div>
            )}
          </div>

          {/* Season Averages */}
          {seasonAverages && (
            <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-terminal-border-subtle">
              <div>
                <div className="data-label mb-1">POINTS</div>
                <div className="text-lg font-bold text-terminal-text">
                  {seasonAverages.points.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="data-label mb-1">ASSISTS</div>
                <div className="text-lg font-bold text-terminal-text">
                  {seasonAverages.assists.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="data-label mb-1">REBOUNDS</div>
                <div className="text-lg font-bold text-terminal-text">
                  {seasonAverages.rebounds.toFixed(1)}
                </div>
              </div>
            </div>
          )}

          {/* Additional Info */}
          <div className="flex items-center gap-4 mt-3 text-xs opacity-60">
            <span>AGE: {player.age}</span>
            <span>TEAM: {player.team_abbreviation}</span>
            {player.last_game_text && <span>{player.last_game_text}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
