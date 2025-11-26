import React from 'react';
import { Team } from '@/services/nba-data.service';
import { Calendar, MapPin, TrendingUp, TrendingDown } from 'lucide-react';

interface NextGamesCardProps {
  team: Team;
}

export const NextGamesCard: React.FC<NextGamesCardProps> = ({ team }) => {
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
          
          <div className="text-center">
            <div className="text-sm opacity-70 mb-1">{team.team_abbreviation}</div>
            <div className="text-lg font-bold text-terminal-blue">VS</div>
            <div className="text-sm opacity-70 mt-1">{team.next_opponent_abbreviation}</div>
          </div>
          
          <div className="text-xs text-center mt-2 opacity-50">
            {team.next_opponent_name}
          </div>
        </div>

        {/* Team Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded bg-black/20">
            <div className="data-label text-xs mb-1">YOUR TEAM</div>
            <div className="text-sm font-medium">
              {team.wins}-{team.losses}
            </div>
            <div className={`text-xs mt-1 ${getRecordColor(team.team_last_five_games)}`}>
              {formatLastFive(team.team_last_five_games)}
            </div>
          </div>
          
          <div className="p-2 rounded bg-black/20">
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
            <div className="data-label text-xs">TEAM RANKINGS</div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-terminal-blue" />
                <span className="opacity-70">Off:</span>
                <span className="font-medium">#{team.team_offensive_rating_rank || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-terminal-red" />
                <span className="opacity-70">Def:</span>
                <span className="font-medium">#{team.team_defensive_rating_rank || 'N/A'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs opacity-60">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span className="opacity-70">Opp Off:</span>
                <span className="font-medium">#{team.next_opponent_team_offensive_rating_rank || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1">
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
