import React, { useMemo, useState } from 'react';
import { Team, OpponentRankings, TeamPlaytypes } from '@/services/nba-data.service';
import { Calendar, MapPin, TrendingUp, TrendingDown, Shield, ChevronDown } from 'lucide-react';
import { getTeamLogoUrl } from '@/utils/team-logos';

import { Skeleton } from '@/components/ui/skeleton';

interface NextGamesCardProps {
  team?: Team;
  isLoading?: boolean;
  isTeamB2B?: boolean;
  isOpponentB2B?: boolean;
  nextGameTime?: string | null;
  opponentRankings?: OpponentRankings | null;
  opponentPlaytypes?: TeamPlaytypes | null;
  selectedStatType?: string;
}

const STAT_TO_OPP: Record<string, { rankKey: keyof OpponentRankings; valueKey: keyof OpponentRankings; label: string; unit: string }> = {
  player_points:              { rankKey: 'opp_pts_rank',     valueKey: 'opp_pts',     label: 'Pontos cedidos',  unit: 'pts/jogo' },
  player_rebounds:            { rankKey: 'opp_reb_rank',     valueKey: 'opp_reb',     label: 'Rebotes cedidos', unit: 'reb/jogo' },
  player_assists:             { rankKey: 'opp_ast_rank',     valueKey: 'opp_ast',     label: 'Assists cedidas', unit: 'ast/jogo' },
  player_threes:              { rankKey: 'opp_fg3_pct_rank', valueKey: 'opp_fg3_pct', label: '3PT% cedido',     unit: '%' },
  player_steals:              { rankKey: 'opp_stl_rank',     valueKey: 'opp_stl',     label: 'Roubos cedidos',  unit: 'stl/jogo' },
  player_blocks:              { rankKey: 'opp_blk_rank',     valueKey: 'opp_blk',     label: 'Bloqueios cedidos', unit: 'blk/jogo' },
  player_points_rebounds:     { rankKey: 'opp_pts_rank',     valueKey: 'opp_pts',     label: 'Pontos cedidos',  unit: 'pts/jogo' },
  player_points_assists:      { rankKey: 'opp_pts_rank',     valueKey: 'opp_pts',     label: 'Pontos cedidos',  unit: 'pts/jogo' },
  player_rebounds_assists:    { rankKey: 'opp_reb_rank',     valueKey: 'opp_reb',     label: 'Rebotes cedidos', unit: 'reb/jogo' },
  player_points_rebounds_assists: { rankKey: 'opp_pts_rank', valueKey: 'opp_pts',     label: 'Pontos cedidos',  unit: 'pts/jogo' },
};

const DEFAULT_OPP = { rankKey: 'def_rating_rank' as keyof OpponentRankings, valueKey: 'def_rating' as keyof OpponentRankings, label: 'Def Rating', unit: '' };

function getMatchupColor(rank: number) {
  if (rank >= 21) return { text: 'text-terminal-green', bg: 'bg-terminal-green/10', border: 'border-terminal-green/20', label: 'DEFESA FRACA' };
  if (rank >= 11) return { text: 'text-terminal-yellow', bg: 'bg-terminal-yellow/10', border: 'border-terminal-yellow/20', label: 'DEFESA MEDIA' };
  return { text: 'text-terminal-red', bg: 'bg-terminal-red/10', border: 'border-terminal-red/20', label: 'DEFESA FORTE' };
}

const SPECIAL_TYPES_USED: Record<string, number> = {};

export const NextGamesCard: React.FC<NextGamesCardProps> = ({ team, isLoading, isTeamB2B = false, isOpponentB2B = false, nextGameTime, opponentRankings, opponentPlaytypes, selectedStatType = 'player_points' }) => {
  const [defenseExpanded, setDefenseExpanded] = useState(false);
  const [playtypesExpanded, setPlaytypesExpanded] = useState(false);
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
                <span className="text-[10px] font-semibold text-terminal-blue">{nextGameTime}</span>
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

        {/* Matchup dinâmico por stat selecionada */}
        {opponentRankings && (() => {
          const mapping = STAT_TO_OPP[selectedStatType] || DEFAULT_OPP;
          const rank = opponentRankings[mapping.rankKey] as number;
          const value = opponentRankings[mapping.valueKey] as number;
          if (!rank) return null;
          const color = getMatchupColor(rank);
          const formatted = mapping.unit === '%'
            ? `${(value * 100).toFixed(1)}%`
            : value.toFixed(1);

          return (
            <div className={`rounded p-2.5 border ${color.border} ${color.bg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className={`w-3.5 h-3.5 ${color.text}`} />
                  <div>
                    <p className="text-[10px] opacity-50">{team.next_opponent_abbreviation} — {mapping.label}</p>
                    <p className="text-sm font-bold">
                      {formatted} <span className="opacity-40 text-xs">{mapping.unit !== '%' ? mapping.unit : ''}</span>
                      <span className={`ml-2 font-bold ${color.text}`}>#{rank}</span>
                    </p>
                  </div>
                </div>
                <span className={`text-[9px] font-bold ${color.text}`}>{color.label}</span>
              </div>
            </div>
          );
        })()}

        {/* Defesa do adversário — colapsável */}
        {opponentRankings && (
          <div className="border-t border-terminal-border-subtle pt-2">
            <button
              onClick={() => setDefenseExpanded(v => !v)}
              className="w-full flex items-center justify-between py-1"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">
                Defesa de {team.next_opponent_abbreviation}
              </span>
              <ChevronDown className={`w-3 h-3 opacity-30 transition-transform ${defenseExpanded ? 'rotate-180' : ''}`} />
            </button>
            {defenseExpanded && (
              <div className="mt-1">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {([
                    { label: 'Pontos cedidos', value: opponentRankings.opp_pts, rank: opponentRankings.opp_pts_rank },
                    { label: 'Rebotes cedidos', value: opponentRankings.opp_reb, rank: opponentRankings.opp_reb_rank },
                    { label: 'Assists cedidas', value: opponentRankings.opp_ast, rank: opponentRankings.opp_ast_rank },
                    { label: '3PT% cedido', value: opponentRankings.opp_fg3_pct, rank: opponentRankings.opp_fg3_pct_rank, isPct: true },
                    { label: 'Pts no garrafão', value: opponentRankings.opp_pts_paint, rank: opponentRankings.opp_pts_paint_rank },
                    { label: 'Rtg defensivo', value: opponentRankings.def_rating, rank: opponentRankings.def_rating_rank },
                  ] as { label: string; value: number; rank: number; isPct?: boolean }[]).map(item => {
                    const color = item.rank >= 21 ? 'text-terminal-green' : item.rank >= 11 ? 'text-terminal-yellow' : 'text-terminal-red';
                    const formatted = item.isPct ? `${(item.value * 100).toFixed(1)}%` : item.value.toFixed(1);
                    return (
                      <div key={item.label} className="flex items-center justify-between text-[10px]">
                        <span className="opacity-50">{item.label}</span>
                        <span>
                          {formatted} <span className={`font-bold ${color}`}>#{item.rank}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tipos de jogada do adversário — colapsável */}
        {opponentPlaytypes && (
          <div className="border-t border-terminal-border-subtle pt-2">
            <button
              onClick={() => setPlaytypesExpanded(v => !v)}
              className="w-full flex items-center justify-between py-1"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">
                Tipos de jogada de {team.next_opponent_abbreviation}
              </span>
              <ChevronDown className={`w-3 h-3 opacity-30 transition-transform ${playtypesExpanded ? 'rotate-180' : ''}`} />
            </button>
            {playtypesExpanded && (
              <div className="mt-1">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {([
                    { label: 'Isolamento', ppp: opponentPlaytypes.iso_ppp, rank: opponentPlaytypes.iso_ppp_rank },
                    { label: 'Arremesso aberto', ppp: opponentPlaytypes.spotup_ppp, rank: opponentPlaytypes.spotup_ppp_rank },
                    { label: 'Pick & Roll (bola)', ppp: opponentPlaytypes.pnr_bh_ppp, rank: opponentPlaytypes.pnr_bh_ppp_rank },
                    { label: 'Pick & Roll (roll)', ppp: opponentPlaytypes.pnr_rm_ppp, rank: opponentPlaytypes.pnr_rm_ppp_rank },
                    { label: 'Jogo de costas', ppp: opponentPlaytypes.postup_ppp, rank: opponentPlaytypes.postup_ppp_rank },
                    { label: 'Transição', ppp: opponentPlaytypes.transition_ppp, rank: opponentPlaytypes.transition_ppp_rank },
                    { label: 'Entrega de mão', ppp: opponentPlaytypes.handoff_ppp, rank: opponentPlaytypes.handoff_ppp_rank },
                    { label: 'Corte', ppp: opponentPlaytypes.cut_ppp, rank: opponentPlaytypes.cut_ppp_rank },
                  ] as { label: string; ppp: number; rank: number }[]).map(item => (
                    <div key={item.label} className="flex items-center justify-between text-[10px]">
                      <span className="opacity-50">{item.label}</span>
                      <span>
                        {item.ppp.toFixed(2)} <span className="font-bold opacity-70">#{item.rank}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
