import React from 'react';
import { Team } from '@/services/nba-data.service';
import { Calendar, MapPin, TrendingUp, TrendingDown } from 'lucide-react';
import { getTeamLogoUrl } from '@/utils/team-logos';

import { Skeleton } from '@/components/ui/skeleton';

interface NextGamesCardProps {
  team?: Team;
  isLoading?: boolean;
}

export const NextGamesCard: React.FC<NextGamesCardProps> = ({ team, isLoading }) => {
  if (isLoading) {
    return (
      <div className="terminal-container p-4">
        <h3 className="section-title mb-3">NEXT GAME</h3>
        <div className="space-y-3">
          <Skeleton className="h-32 w-full bg-terminal-gray" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16 w-full bg-terminal-gray" />
            <Skeleton className="h-16 w-full bg-terminal-gray" />
          </div>
        </div>
      </div>
    );
  }

  if (!team) return null;
  const getRecordColor = (lastFive: string) => {
    if (!lastFive) return 'opacity-50';
    const wins = (lastFive.match(/W/g) || []).length;
    if (wins >= 4) return 'text-terminal-blue';
    if (wins >= 2) return 'text-terminal-yellow';
    return 'text-terminal-red';
  };

  const formatLastFive = (lastFive: string) => {
    if (!lastFive) return 'N/A';
    return lastFive.split('').join(' ');
  };

  return (
    <div className="terminal-container p-4">
      <h3 className="section-title mb-3">NEXT GAME</h3>
      
      <div className="space-y-3">
        {/* Matchup */}
        <div className="p-3 rounded bg-terminal-blue/5 border border-terminal-blue/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-terminal-blue" />
              <span className="text-xs data-label">
                {team.is_next_game_home ? 'HOME' : 'AWAY'}
              </span>
            </div>
            <Calendar className="w-4 h-4 opacity-50" />
          </div>
          
          <div className="flex items-center justify-center gap-6 py-2">
            {/* Current Team */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 relative">
                <img 
                  src={getTeamLogoUrl(team.team_name)} 
                  alt={team.team_name}
                  className="w-full h-full object-contain"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `<span class="text-xs font-bold text-terminal-text">${team.team_abbreviation}</span>`;
                      parent.className = "w-12 h-12 flex items-center justify-center bg-terminal-gray rounded-full border border-terminal-border-subtle";
                    }
                  }}
                />
              </div>
              <span className="text-xs font-bold text-terminal-text">{team.team_abbreviation}</span>
            </div>

            {/* VS */}
            <div className="flex flex-col items-center">
              <span className="text-xl font-black text-terminal-blue italic">VS</span>
            </div>

            {/* Opponent Team */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 relative">
                <img 
                  src={getTeamLogoUrl(team.next_opponent_name)} 
                  alt={team.next_opponent_name}
                  className="w-full h-full object-contain"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `<span class="text-xs font-bold text-terminal-text">${team.next_opponent_abbreviation}</span>`;
                      parent.className = "w-12 h-12 flex items-center justify-center bg-terminal-gray rounded-full border border-terminal-border-subtle";
                    }
                  }}
                />
              </div>
              <span className="text-xs font-bold text-terminal-text">{team.next_opponent_abbreviation}</span>
            </div>
          </div>
          
          <div className="text-xs text-center mt-2 opacity-50">
            {team.next_opponent_name}
          </div>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded bg-black/20 text-center">
            <div className="data-label text-xs mb-1">YOUR TEAM</div>
            <div className="text-sm font-medium">
              {team.wins}-{team.losses}
            </div>
            <div className={`text-xs mt-1 ${getRecordColor(team.team_last_five_games)}`}>
              {formatLastFive(team.team_last_five_games)}
            </div>
          </div>
          
          <div className="p-2 rounded bg-black/20 text-center">
            <div className="data-label text-xs mb-1">OPPONENT</div>
            <div className="text-sm font-medium opacity-70">
              {team.next_opponent_team_last_five_games ? 
                formatLastFive(team.next_opponent_team_last_five_games) : 
                'N/A'
              }
            </div>
            <div className="text-xs mt-1 opacity-50">
              Last 5
            </div>
          </div>
        </div>

        {/* Rankings Comparison */}
        {(team.team_rating_rank || team.next_opponent_team_rating_rank) && (
          <div className="space-y-2">
            <div className="data-label text-xs text-center">TEAM RANKINGS</div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3 text-terminal-blue" />
                <span className="opacity-70">Off:</span>
                <span className="font-medium">#{team.team_offensive_rating_rank || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <TrendingDown className="w-3 h-3 text-terminal-red" />
                <span className="opacity-70">Def:</span>
                <span className="font-medium">#{team.team_defensive_rating_rank || 'N/A'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs opacity-60">
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span className="opacity-70">Opp Off:</span>
                <span className="font-medium">#{team.next_opponent_team_offensive_rating_rank || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-center gap-1">
                <TrendingDown className="w-3 h-3" />
                <span className="opacity-70">Opp Def:</span>
                <span className="font-medium">#{team.next_opponent_team_defensive_rating_rank || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Injury Report Time */}
        {team.next_game_injury_report_time_brasilia && (
          <div className="text-xs opacity-50 pt-2 border-t border-terminal-blue/10">
            <span className="data-label">INJURY REPORT:</span> {team.next_game_injury_report_time_brasilia}
          </div>
        )}
      </div>
    </div>
  );
};
