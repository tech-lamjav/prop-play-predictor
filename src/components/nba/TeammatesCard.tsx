import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TeamPlayer } from '@/services/nba-data.service';
import { Star } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';

interface TeammatesCardProps {
  teammates: TeamPlayer[];
  currentPlayerId: number;
  teamName: string;
  isLoading?: boolean;
}

export const TeammatesCard: React.FC<TeammatesCardProps> = ({ 
  teammates, 
  currentPlayerId,
  teamName,
  isLoading
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="terminal-container p-4">
        <h3 className="section-title mb-3">TEAMMATES</h3>
        <Skeleton className="h-4 w-32 mb-4 bg-terminal-gray" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full bg-terminal-gray" />
          ))}
        </div>
      </div>
    );
  }

  // Filter out current player and limit to top 5 teammates
  const displayTeammates = teammates
    .filter(p => p.player_id !== currentPlayerId)
    .slice(0, 5);

  const handlePlayerClick = (playerName: string) => {
    const slug = playerName.toLowerCase().replace(/\s+/g, '-');
    navigate(`/nba-dashboard/${slug}`);
  };

  return (
    <div className="terminal-container p-4">
      <h3 className="section-title mb-3">TEAMMATES</h3>
      <div className="text-xs data-label mb-2">{teamName}</div>
      
      {displayTeammates.length === 0 ? (
        <div className="text-sm opacity-50">No teammates data available</div>
      ) : (
        <div className="space-y-2">
          {displayTeammates.map((player) => (
            <button
              key={player.player_id}
              onClick={() => handlePlayerClick(player.player_name)}
              className="w-full text-left p-2 rounded border border-terminal-green/20 hover:border-terminal-green/50 hover:bg-terminal-green/5 transition-all group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-terminal-green group-hover:text-terminal-green-bright truncate">
                    {player.player_name}
                  </div>
                  <div className="text-xs opacity-70 flex items-center gap-2">
                    <span>{player.position}</span>
                    <span>•</span>
                    <span>Age {player.age}</span>
                  </div>
                </div>
                {player.rating_stars > 0 && (
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {Array.from({ length: player.rating_stars }).map((_, i) => (
                      <Star
                        key={i}
                        className="w-3 h-3 fill-terminal-yellow text-terminal-yellow"
                      />
                    ))}
                  </div>
                )}
              </div>
              {player.current_status && player.current_status.toLowerCase() !== 'active' && (
                <div className="text-xs text-terminal-red mt-1">
                  {player.current_status}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
