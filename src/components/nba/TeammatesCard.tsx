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

export const TeammatesCard: React.FC<TeammatesCardProps> = ({
  teammates,
  currentPlayerId,
  teamName,
  isLoading
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="terminal-container p-4">
        <h3 className="section-title mb-3">COMPANHEIROS</h3>
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
      {/* Header — clicável só no mobile */}
      <button
        className="w-full flex items-center justify-between md:cursor-default"
        onClick={() => setExpanded(prev => !prev)}
      >
        <h3 className="section-title">COMPANHEIROS</h3>
        <ChevronDown
          className={`w-4 h-4 text-terminal-text/40 transition-transform md:hidden ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Conteúdo: sempre visível em desktop, colapsável no mobile */}
      <div className={`${expanded ? 'block' : 'hidden'} md:block`}>
        <div className="text-xs data-label mt-2 mb-2">{teamName}</div>

        {displayTeammates.length === 0 ? (
          <div className="text-sm opacity-50">Nenhum dado de companheiros disponível</div>
        ) : (
          <div className="space-y-2">
            {displayTeammates.map((player) => {
            const photoUrl = getPlayerPhotoUrl(player.player_name, teamName);
            const initials = player.player_name.split(' ').map(w => w[0]).join('').slice(0, 2);
            return (
              <button
                key={player.player_id}
                onClick={() => handlePlayerClick(player.player_name)}
                className="w-full text-left p-2 rounded border border-terminal-green/20 hover:border-terminal-green/50 hover:bg-terminal-green/5 transition-all group"
              >
                <div className="flex items-center gap-2">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-terminal-dark-gray border border-terminal-green/20">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={player.player_name}
                        className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          if (!tryNextPlayerPhotoUrl(e.currentTarget, player.player_name, teamName)) {
                            e.currentTarget.style.display = 'none';
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-terminal-green/60">
                        {initials}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-terminal-green group-hover:text-terminal-green-bright truncate">
                      {player.player_name}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs opacity-50">{player.position}</span>
                      {player.current_status && player.current_status.toLowerCase() !== 'active' && (
                        <span className="text-xs text-terminal-red">{player.current_status}</span>
                      )}
                    </div>
                  </div>

                  {/* Stars */}
                  {player.rating_stars > 0 && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {Array.from({ length: player.rating_stars }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-terminal-yellow text-terminal-yellow" />
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
};
