import React from 'react';
import { Team } from '@/services/nba-data.service';
import { Calendar, MapPin, TrendingUp, TrendingDown } from 'lucide-react';
import { getTeamLogoUrl } from '@/utils/team-logos';

import { Skeleton } from '@/components/ui/skeleton';

interface NextGamesCardProps {
  team?: Team;
  isLoading?: boolean;
  isTeamB2B?: boolean;
  isOpponentB2B?: boolean;
  nextGameTime?: string | null;
}

export const NextGamesCard: React.FC<NextGamesCardProps> = ({ team, isLoading, isTeamB2B = false, isOpponentB2B = false, nextGameTime }) => {
  if (isLoading) {
    return (
      <div className="terminal-container p-4">
        <h3 className="section-title mb-3">PRÓXIMO JOGO</h3>
        <div className="space-y-2">
          <Skeleton className="h-24 w-full bg-terminal-gray" />
          <Skeleton className="h-10 w-full bg-terminal-gray" />
          <Skeleton className="h-10 w-full bg-terminal-gray" />
        </div>
      </div>
    );
  }

  if (!team) return null;

  // index 0 = jogo mais antigo, último index = mais recente
  // opacidade cresce da esquerda para a direita
  const renderLastFiveWithColors = (lastFive: string | null) => {
    if (!lastFive) return <span className="opacity-50">N/A</span>;
    const chars = lastFive.split('');
    const total = chars.length;
    return (
      <div className="flex items-center gap-0.5">
        {chars.map((result, index) => {
          const isWin = result === 'V' || result === 'W';
          // opacity: oldest=40% → newest=100%
          const opacityValue = total <= 1 ? 1 : 0.4 + (index / (total - 1)) * 0.6;
          return (
            <span
              key={index}
              className={`text-xs font-medium ${isWin ? 'text-terminal-green' : 'text-terminal-red'}`}
              style={{ opacity: opacityValue }}
            >
              {result}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="terminal-container p-4">
      <h3 className="section-title mb-2">PRÓXIMO JOGO</h3>

      <div className="space-y-2">
        {/* Matchup */}
        <div className="p-2.5 rounded bg-terminal-blue/5 border border-terminal-blue/20">
          {/* Top row: home/away + time */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-terminal-blue" />
              <span className="text-[10px] data-label">
                {team.is_next_game_home ? 'CASA' : 'FORA'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {nextGameTime && (
                <span className="text-[10px] font-semibold text-terminal-green">{nextGameTime}</span>
              )}
              <Calendar className="w-3 h-3 opacity-40" />
            </div>
          </div>

          {isTeamB2B && isOpponentB2B && (
            <div className="text-center text-[9px] bg-terminal-yellow/10 text-terminal-yellow border border-terminal-yellow/20 rounded px-2 py-0.5 mb-2">
              ⚠ AMBOS TIMES B2B
            </div>
          )}

          {/* Teams row */}
          <div className="flex items-center justify-center gap-4 relative">
            {/* Current Team */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 relative">
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
                      parent.className = "w-10 h-10 flex items-center justify-center bg-terminal-gray rounded-full border border-terminal-border-subtle";
                    }
                  }}
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-terminal-text">{team.team_abbreviation}</span>
                {isTeamB2B && (
                  <span className="text-[8px] bg-terminal-yellow/20 text-terminal-yellow px-1 py-0.5 rounded leading-none">B2B</span>
                )}
              </div>
            </div>

            <span className="text-lg font-black text-terminal-blue italic">VS</span>

            {/* Opponent Team */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 relative">
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
                      parent.className = "w-10 h-10 flex items-center justify-center bg-terminal-gray rounded-full border border-terminal-border-subtle";
                    }
                  }}
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-terminal-text">{team.next_opponent_abbreviation}</span>
                {isOpponentB2B && (
                  <span className="text-[8px] bg-terminal-yellow/20 text-terminal-yellow px-1 py-0.5 rounded leading-none">B2B</span>
                )}
              </div>
            </div>
          </div>

          {/* Injury Report — canto inferior esquerdo do card, apenas em B2B */}
          {(isTeamB2B || isOpponentB2B) && team.next_game_injury_report_time_brasilia && (
            <div className="mt-2 text-[9px] opacity-50">
              <span className="data-label">INJURY REPORT:</span>{' '}{team.next_game_injury_report_time_brasilia}
            </div>
          )}
        </div>

        {/* Records + Last 5 + Rankings — one compact row per team */}
        <div className="space-y-1 text-xs">
          {/* Player's team */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-terminal-text w-7 shrink-0">{team.team_abbreviation}</span>
            <span className="opacity-60 shrink-0">{team.wins}-{team.losses}</span>
            <span className="opacity-30">·</span>
            {renderLastFiveWithColors(team.team_last_five_games)}
            {(team.team_offensive_rating_rank || team.team_defensive_rating_rank) && (
              <>
                <span className="opacity-30">·</span>
                <span className="flex items-center gap-0.5 text-[10px] shrink-0" title="Ranking ofensivo">
                  <TrendingUp className="w-3 h-3 text-terminal-blue shrink-0" />
                  <span className="font-medium"><span className="opacity-50">OFF</span> #{team.team_offensive_rating_rank || '—'}</span>
                </span>
                <span className="flex items-center gap-0.5 text-[10px] shrink-0" title="Ranking defensivo">
                  <TrendingDown className="w-3 h-3 text-terminal-red shrink-0" />
                  <span className="font-medium"><span className="opacity-50">DEF</span> #{team.team_defensive_rating_rank || '—'}</span>
                </span>
              </>
            )}
          </div>
          {/* Opponent */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-terminal-text w-7 shrink-0">{team.next_opponent_abbreviation}</span>
            <span className="opacity-60 shrink-0">
              {team.next_opponent_wins != null && team.next_opponent_losses != null
                ? `${team.next_opponent_wins}-${team.next_opponent_losses}`
                : 'N/A'}
            </span>
            <span className="opacity-30">·</span>
            {renderLastFiveWithColors(team.next_opponent_team_last_five_games)}
            {(team.next_opponent_team_offensive_rating_rank || team.next_opponent_team_defensive_rating_rank) && (
              <>
                <span className="opacity-30">·</span>
                <span className="flex items-center gap-0.5 text-[10px] shrink-0" title="Ranking ofensivo">
                  <TrendingUp className="w-3 h-3 opacity-60 shrink-0" />
                  <span className="font-medium opacity-80"><span className="opacity-50">OFF</span> #{team.next_opponent_team_offensive_rating_rank || '—'}</span>
                </span>
                <span className="flex items-center gap-0.5 text-[10px] shrink-0" title="Ranking defensivo">
                  <TrendingDown className="w-3 h-3 opacity-60 shrink-0" />
                  <span className="font-medium opacity-80"><span className="opacity-50">DEF</span> #{team.next_opponent_team_defensive_rating_rank || '—'}</span>
                </span>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
