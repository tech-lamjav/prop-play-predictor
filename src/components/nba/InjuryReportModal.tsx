import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { nbaDataService, Game, Player } from '@/services/nba-data.service';
import { getTeamLogoUrl } from '@/utils/team-logos';
import { Loader2, Star } from 'lucide-react';

const INJURY_STATUSES = ['Probable', 'Questionable', 'Doubtful', 'Out'] as const;
type InjuryStatus = (typeof INJURY_STATUSES)[number];

const STATUS_STYLE: Record<InjuryStatus, { headerBg: string; headerText: string; playerText: string }> = {
  Probable:     { headerBg: 'bg-[#1c2a1c]', headerText: 'text-lime-400',    playerText: 'text-lime-300'   },
  Questionable: { headerBg: 'bg-[#252516]', headerText: 'text-yellow-400',  playerText: 'text-yellow-300' },
  Doubtful:     { headerBg: 'bg-[#251e14]', headerText: 'text-orange-400',  playerText: 'text-orange-300' },
  Out:          { headerBg: 'bg-[#251515]', headerText: 'text-red-400',     playerText: 'text-red-400'    },
};

interface InjuredPlayer { name: string; stars: number }

function normalizeStatus(status: string): InjuryStatus | null {
  const s = (status ?? '').toLowerCase().trim();
  if (!s || s === 'active' || s === 'available' || s.includes('unk')) return null;
  if (s.includes('probable')) return 'Probable';
  if (s.includes('questionable')) return 'Questionable';
  if (s.includes('doubtful')) return 'Doubtful';
  if (s === 'out' || s.includes('out') || s.includes('inactive') || s.includes('injured')) return 'Out';
  return null;
}

let playersCache: Player[] | null = null;

interface Props {
  open: boolean;
  onClose: () => void;
  games: Game[];
}

export function InjuryReportModal({ open, onClose, games }: Props) {
  const [players, setPlayers] = useState<Player[]>(playersCache ?? []);
  const [isLoading, setIsLoading] = useState(!playersCache);

  useEffect(() => {
    if (!open || playersCache) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await nbaDataService.getAllPlayers();
        playersCache = data;
        setPlayers(data);
      } catch (e) {
        console.error('Error loading injury report', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [open]);

  // Build map: teamAbbr → status → [{ name, stars }]
  const teamInjuryData = new Map<string, Map<InjuryStatus, InjuredPlayer[]>>();
  players.forEach((player) => {
    const status = normalizeStatus(player.current_status || '');
    if (!status) return;
    if (!teamInjuryData.has(player.team_abbreviation)) {
      teamInjuryData.set(player.team_abbreviation, new Map());
    }
    const m = teamInjuryData.get(player.team_abbreviation)!;
    if (!m.has(status)) m.set(status, []);
    m.get(status)!.push({ name: player.player_name, stars: player.rating_stars ?? 0 });
  });

  const matchups = games
    .map((game) => ({
      gameId: game.game_id,
      home: { abbr: game.home_team_abbreviation, name: game.home_team_name },
      visitor: { abbr: game.visitor_team_abbreviation, name: game.visitor_team_name },
      homeHasInjuries: teamInjuryData.has(game.home_team_abbreviation),
      visitorHasInjuries: teamInjuryData.has(game.visitor_team_abbreviation),
    }))
    .filter((m) => m.homeHasInjuries || m.visitorHasInjuries);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl w-full bg-terminal-dark-gray border-terminal-border-subtle text-terminal-text font-mono max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-terminal-border-subtle">
          <DialogTitle className="text-xs uppercase tracking-widest text-terminal-text/60">
            Injury Report — Jogos de Hoje
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-terminal-green opacity-60" />
            <span className="text-xs text-terminal-text/40">Carregando dados...</span>
          </div>
        ) : matchups.length === 0 ? (
          <div className="text-center py-16 text-sm text-terminal-text/40">
            Nenhuma lesão reportada para os jogos de hoje
          </div>
        ) : (
          <div
            className="overflow-y-auto flex-1"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
          >
            {/* ── Mobile layout: cards por confronto ── */}
            <div className="lg:hidden px-4 py-4 space-y-4">
              {matchups.map((matchup, idx) => (
                <div key={matchup.gameId}>
                  {idx > 0 && <div className="border-t-2 border-terminal-border mb-4" />}

                  {/* Matchup label */}
                  <div className="bg-[#1d2330] rounded-lg px-3 py-1.5 mb-2">
                    <span className="text-[10px] text-terminal-text/50 font-mono tracking-widest uppercase">
                      {matchup.home.abbr} vs {matchup.visitor.abbr}
                    </span>
                  </div>

                  {/* Teams */}
                  <div className="space-y-2">
                    {[
                      { team: matchup.home, hasInjuries: matchup.homeHasInjuries, isHome: true },
                      { team: matchup.visitor, hasInjuries: matchup.visitorHasInjuries, isHome: false },
                    ]
                      .filter((t) => t.hasInjuries)
                      .map(({ team, isHome }) => {
                        const teamMap = teamInjuryData.get(team.abbr);
                        return (
                          <div key={team.abbr} className="bg-[#242b35] rounded-lg p-3">
                            {/* Team header */}
                            <div className="flex items-center gap-2 mb-2.5">
                              <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                                <img
                                  src={getTeamLogoUrl(team.name)}
                                  alt={team.abbr}
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    const t = e.target as HTMLImageElement;
                                    t.style.display = 'none';
                                    const p = t.parentElement;
                                    if (p) p.innerHTML = `<span class="text-[10px] font-bold text-terminal-text/60">${team.abbr}</span>`;
                                  }}
                                />
                              </div>
                              <span className="text-sm font-semibold text-terminal-text">{team.name}</span>
                              {isHome && (
                                <span className="text-[9px] text-terminal-text/25 font-mono ml-auto">casa</span>
                              )}
                            </div>

                            {/* Injury rows per status */}
                            <div className="space-y-1.5">
                              {INJURY_STATUSES.map((status) => {
                                const players = teamMap?.get(status) ?? [];
                                if (players.length === 0) return null;
                                return (
                                  <div key={status} className="flex items-start gap-2">
                                    <span className={`text-[10px] font-semibold w-24 flex-shrink-0 pt-0.5 ${STATUS_STYLE[status].headerText}`}>
                                      {status}
                                    </span>
                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 flex-1">
                                      {players
                                        .sort((a, b) => b.stars - a.stars)
                                        .map((player) => (
                                          <span
                                            key={player.name}
                                            className={`text-xs ${player.stars >= 3 ? 'font-bold' : 'font-normal'} ${STATUS_STYLE[status].playerText} flex items-center gap-0.5`}
                                          >
                                            {player.name}
                                            {player.stars >= 3 && (
                                              <Star className="w-2.5 h-2.5 text-terminal-yellow fill-terminal-yellow inline flex-shrink-0" />
                                            )}
                                          </span>
                                        ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop layout: tabela ── */}
            <div className="hidden lg:block">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
              <thead className="sticky top-0 z-20">
                <tr>
                  <th style={{ width: '180px' }} className="bg-terminal-dark-gray border-b border-terminal-border-subtle py-3 px-5" />
                  {INJURY_STATUSES.map((status) => (
                    <th
                      key={status}
                      style={{ width: 'calc((100% - 180px) / 4)' }}
                      className={`py-3 px-4 text-center text-xs font-semibold border-b border-terminal-border-subtle border-l border-l-terminal-border/30 ${STATUS_STYLE[status].headerBg} ${STATUS_STYLE[status].headerText}`}
                    >
                      {status}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {matchups.map((matchup, idx) => (
                  <React.Fragment key={matchup.gameId}>
                    <tr className="bg-[#1d2330]">
                      <td
                        colSpan={5}
                        className={`px-5 py-2 ${idx > 0 ? 'border-t-2 border-terminal-border' : ''}`}
                      >
                        <span className="text-[10px] text-terminal-text/50 font-mono tracking-widest uppercase">
                          {matchup.home.abbr} vs {matchup.visitor.abbr}
                        </span>
                      </td>
                    </tr>

                    {matchup.homeHasInjuries && (
                      <TeamRow team={matchup.home} teamInjuryData={teamInjuryData} isHome bgClass="bg-[#242b35]" />
                    )}

                    {matchup.homeHasInjuries && matchup.visitorHasInjuries && (
                      <tr><td colSpan={5} className="p-0"><div className="border-t border-terminal-border/25" /></td></tr>
                    )}

                    {matchup.visitorHasInjuries && (
                      <TeamRow team={matchup.visitor} teamInjuryData={teamInjuryData} isHome={false} bgClass="bg-[#1e2630]" />
                    )}
                  </React.Fragment>
                ))}
                <tr><td colSpan={5} className="py-3" /></tr>
              </tbody>
            </table>
            </div>{/* end desktop wrapper */}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TeamRow({
  team,
  teamInjuryData,
  isHome,
  bgClass,
}: {
  team: { abbr: string; name: string };
  teamInjuryData: Map<string, Map<InjuryStatus, InjuredPlayer[]>>;
  isHome: boolean;
  bgClass: string;
}) {
  const teamMap = teamInjuryData.get(team.abbr);

  return (
    <tr className={bgClass}>
      {/* Team cell: logo + full name only */}
      <td className="py-3 pl-4 pr-4 align-middle">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
            <img
              src={getTeamLogoUrl(team.name)}
              alt={team.abbr}
              className="w-full h-full object-contain"
              onError={(e) => {
                const t = e.target as HTMLImageElement;
                t.style.display = 'none';
                const parent = t.parentElement;
                if (parent) parent.innerHTML = `<span class="text-[10px] font-bold text-terminal-text/60">${team.abbr}</span>`;
              }}
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-terminal-text truncate">{team.name}</span>
            {isHome && <span className="text-[9px] text-terminal-text/25 font-mono">casa</span>}
          </div>
        </div>
      </td>

      {/* Status columns */}
      {INJURY_STATUSES.map((status, i) => {
        const players = teamMap?.get(status) ?? [];
        const isLast = i === INJURY_STATUSES.length - 1;
        return (
          <td
            key={status}
            className={`py-3 px-4 align-top border-l border-l-terminal-border/20 ${!isLast ? 'border-r border-r-terminal-border/10' : ''}`}
          >
            {players.length > 0 ? (
              <div className="flex flex-col gap-1">
                {players
                  .sort((a, b) => b.stars - a.stars)
                  .map((player) => (
                    <div key={player.name} className="flex items-center gap-1">
                      <span className={`text-xs leading-snug ${player.stars >= 3 ? 'font-bold' : 'font-medium'} ${STATUS_STYLE[status].playerText}`}>
                        {player.name}
                      </span>
                      {player.stars >= 3 && (
                        <Star className="w-2.5 h-2.5 text-terminal-yellow fill-terminal-yellow flex-shrink-0" />
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <span className="text-terminal-text/20 text-xs select-none">—</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}
