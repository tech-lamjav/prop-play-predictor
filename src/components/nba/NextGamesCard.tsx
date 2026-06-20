import React, { useState } from 'react';
import { Team, OpponentRankings, TeamPlaytypes } from '@/services/nba-data.service';
import { Calendar, ChevronDown } from 'lucide-react';
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
  if (rank >= 21) return { chipBg: 'bg-emerald-100', chipText: 'text-forest', rankText: 'text-forest', label: 'Defesa fraca' };
  if (rank >= 11) return { chipBg: 'bg-amber-100',   chipText: 'text-amber-700', rankText: 'text-amber-700', label: 'Defesa média' };
  return { chipBg: 'bg-rose-100', chipText: 'text-rose-700', rankText: 'text-rose-700', label: 'Defesa forte' };
}

function renderLastFiveWithColors(lastFive: string | null) {
  if (!lastFive) return <span className="text-ink-dim">N/A</span>;
  const chars = lastFive.split('');
  const total = chars.length;
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0">
      {chars.map((result, index) => {
        const isWin = result === 'V' || result === 'W';
        const opacityValue = total <= 1 ? 1 : 0.4 + (index / (total - 1)) * 0.6;
        return (
          <span
            key={index}
            className={`text-xs font-semibold tabular ${isWin ? 'text-forest' : 'text-rose-700'}`}
            style={{ opacity: opacityValue }}
          >
            {result}
          </span>
        );
      })}
    </span>
  );
}

function TeamBlock({ logo, abbr, record, b2b }: { logo: string; abbr: string; record: string; b2b: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="w-12 h-12 relative">
        <img
          src={logo}
          alt={abbr}
          className="w-full h-full object-contain"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `<span class="text-[11px] font-bold text-ink">${abbr}</span>`;
              parent.className = "w-12 h-12 flex items-center justify-center bg-canvas-2 rounded-full border border-line";
            }
          }}
        />
      </div>
      <div className="text-[11px] font-semibold tabular text-ink flex items-center gap-1">
        <span>{record}</span>
        {b2b && (
          <span className="text-[8px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded leading-none font-bold">B2B</span>
        )}
      </div>
    </div>
  );
}

export const NextGamesCard: React.FC<NextGamesCardProps> = ({
  team,
  isLoading,
  isTeamB2B = false,
  isOpponentB2B = false,
  nextGameTime,
  opponentRankings,
  opponentPlaytypes,
  selectedStatType = 'player_points',
}) => {
  const [defenseExpanded, setDefenseExpanded] = useState(false);
  const [playtypesExpanded, setPlaytypesExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white border border-line overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="p-4 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!team) return null;

  const teamRecord = `${team.wins}-${team.losses}`;
  const opponentRecord =
    team.next_opponent_wins != null && team.next_opponent_losses != null
      ? `${team.next_opponent_wins}-${team.next_opponent_losses}`
      : 'N/A';

  const teamOffRank = team.team_offensive_rating_rank;
  const teamDefRank = team.team_defensive_rating_rank;
  const oppOffRank = team.next_opponent_team_offensive_rating_rank;
  const oppDefRank = team.next_opponent_team_defensive_rating_rank;

  const matchup = (() => {
    if (!opponentRankings) return null;
    const mapping = STAT_TO_OPP[selectedStatType] || DEFAULT_OPP;
    const rank = opponentRankings[mapping.rankKey] as number;
    const value = opponentRankings[mapping.valueKey] as number;
    if (!rank) return null;
    const color = getMatchupColor(rank);
    const formatted = mapping.unit === '%' ? `${(value * 100).toFixed(1)}%` : value.toFixed(1);
    return { rank, formatted, label: mapping.label, color };
  })();

  return (
    <div className="rounded-lg bg-white border border-line overflow-hidden">
      {/* Header: label + data */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-line">
        <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">Próximo jogo</span>
        {nextGameTime && (
          <span className="text-[11px] tabular flex items-center gap-1.5 text-ink-dim">
            <Calendar className="w-3 h-3" />
            <span>{nextGameTime}</span>
          </span>
        )}
      </div>

      {/* B2B alert */}
      {isTeamB2B && isOpponentB2B && (
        <div className="text-center text-[10px] bg-amber-50 text-amber-700 border-b border-amber-200 py-1.5">
          ⚠ Ambos os times em B2B
        </div>
      )}

      {/* Matchup row: logos + VS + records */}
      <div className="px-4 py-4 grid grid-cols-[1fr_50px_1fr] gap-3 items-center">
        <TeamBlock
          logo={getTeamLogoUrl(team.team_name)}
          abbr={team.team_abbreviation}
          record={teamRecord}
          b2b={isTeamB2B}
        />
        <span className="text-center text-[10px] uppercase tracking-[0.16em] font-bold text-ink-dim">vs</span>
        <TeamBlock
          logo={getTeamLogoUrl(team.next_opponent_name)}
          abbr={team.next_opponent_abbreviation}
          record={opponentRecord}
          b2b={isOpponentB2B}
        />
      </div>

      {/* Form + ranks row */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-3 text-[11px] tabular text-ink-2">
        <div className="flex items-center gap-2 min-w-0">
          {renderLastFiveWithColors(team.team_last_five_games)}
          {(teamOffRank || teamDefRank) && (
            <span className="text-ink-dim truncate">
              Off #{teamOffRank || '—'} · Def #{teamDefRank || '—'}
            </span>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 min-w-0">
          {(oppOffRank || oppDefRank) && (
            <span className="text-ink-dim truncate">
              Off #{oppOffRank || '—'} · Def #{oppDefRank || '—'}
            </span>
          )}
          {renderLastFiveWithColors(team.next_opponent_team_last_five_games)}
        </div>
      </div>

      {/* Matchup highlight (stat-specific) */}
      {matchup && (
        <div className="mx-4 mb-4 rounded-lg bg-canvas-2/50 border border-line p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2 truncate">
                {team.next_opponent_abbreviation} · {matchup.label}
              </div>
              <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                <span className="text-[20px] font-semibold tabular tracking-tight text-ink">{matchup.formatted}</span>
                <span className={`text-[10px] uppercase tracking-[0.14em] font-bold px-1.5 h-4 inline-flex items-center rounded ${matchup.color.chipBg} ${matchup.color.chipText}`}>
                  {matchup.color.label}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-dim">Rank</div>
              <div className={`text-[20px] font-semibold tabular tracking-tight ${matchup.color.rankText}`}>#{matchup.rank}</div>
            </div>
          </div>
        </div>
      )}

      {/* Defesa do adversário — colapsável */}
      {opponentRankings && (
        <div className="border-t border-line">
          <button
            onClick={() => setDefenseExpanded(v => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-canvas-2/40 transition-colors"
          >
            <span className="text-[12px] font-semibold text-ink">
              Defesa de {team.next_opponent_abbreviation}
            </span>
            <ChevronDown className={`w-4 h-4 text-ink-dim transition-transform ${defenseExpanded ? 'rotate-180' : ''}`} />
          </button>
          {defenseExpanded && (
            <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {([
                { label: 'Pontos cedidos', value: opponentRankings.opp_pts, rank: opponentRankings.opp_pts_rank },
                { label: 'Rebotes cedidos', value: opponentRankings.opp_reb, rank: opponentRankings.opp_reb_rank },
                { label: 'Assists cedidas', value: opponentRankings.opp_ast, rank: opponentRankings.opp_ast_rank },
                { label: '3PT% cedido', value: opponentRankings.opp_fg3_pct, rank: opponentRankings.opp_fg3_pct_rank, isPct: true },
                { label: 'Pts no garrafão', value: opponentRankings.opp_pts_paint, rank: opponentRankings.opp_pts_paint_rank },
                { label: 'Rtg defensivo', value: opponentRankings.def_rating, rank: opponentRankings.def_rating_rank },
              ] as { label: string; value: number; rank: number; isPct?: boolean }[]).map(item => {
                const color = item.rank >= 21 ? 'text-forest' : item.rank >= 11 ? 'text-amber-700' : 'text-rose-700';
                const formatted = item.isPct ? `${(item.value * 100).toFixed(1)}%` : item.value.toFixed(1);
                return (
                  <div key={item.label} className="flex items-center justify-between text-[11px] tabular text-ink-2">
                    <span className="text-ink-dim">{item.label}</span>
                    <span>
                      {formatted} <span className={`font-bold ${color}`}>#{item.rank}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tipos de jogada do adversário — colapsável */}
      {opponentPlaytypes && (
        <div className="border-t border-line">
          <button
            onClick={() => setPlaytypesExpanded(v => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-canvas-2/40 transition-colors"
          >
            <span className="text-[12px] font-semibold text-ink">
              Tipos de jogada de {team.next_opponent_abbreviation}
            </span>
            <ChevronDown className={`w-4 h-4 text-ink-dim transition-transform ${playtypesExpanded ? 'rotate-180' : ''}`} />
          </button>
          {playtypesExpanded && (
            <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
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
                <div key={item.label} className="flex items-center justify-between text-[11px] tabular text-ink-2">
                  <span className="text-ink-dim">{item.label}</span>
                  <span>
                    {item.ppp.toFixed(2)} <span className="font-bold text-ink-2">#{item.rank}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
