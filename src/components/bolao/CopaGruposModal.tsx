import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWcMatches } from '@/hooks/use-bolao';
import { TeamFlag } from './TeamFlag';

interface StandingEntry {
  code: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CopaGruposModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const { data: matches } = useWcMatches();

  const groupStandings = useMemo(() => {
    if (!matches) return {} as Record<string, StandingEntry[]>;
    const raw: Record<string, Record<string, StandingEntry>> = {};

    matches
      .filter((m) => m.group_name && m.home_team_code !== 'TBD')
      .forEach((m) => {
        const g = m.group_name!;
        if (!raw[g]) raw[g] = {};
        if (!raw[g][m.home_team_code])
          raw[g][m.home_team_code] = { code: m.home_team_code, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
        if (!raw[g][m.away_team_code])
          raw[g][m.away_team_code] = { code: m.away_team_code, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };

        if (m.is_finished && m.home_score != null && m.away_score != null) {
          const home = raw[g][m.home_team_code];
          const away = raw[g][m.away_team_code];
          home.p++; away.p++;
          home.gf += m.home_score; home.ga += m.away_score;
          away.gf += m.away_score; away.ga += m.home_score;
          if (m.home_score > m.away_score) {
            home.w++; home.pts += 3; away.l++;
          } else if (m.away_score > m.home_score) {
            away.w++; away.pts += 3; home.l++;
          } else {
            home.d++; home.pts++; away.d++; away.pts++;
          }
        }
      });

    const sorted: Record<string, StandingEntry[]> = {};
    Object.entries(raw).forEach(([g, teams]) => {
      sorted[g] = Object.values(teams).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gf - b.ga !== a.gf - a.ga) return (b.gf - b.ga) - (a.gf - a.ga);
        return b.gf - a.gf;
      });
    });
    return sorted;
  }, [matches]);

  const sortedGroups = Object.entries(groupStandings).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-bolao bg-canvas border border-line w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-3xl max-h-[85vh] flex flex-col overflow-hidden rounded-rebrand-xl">
        {/* Fixed header */}
        <DialogHeader className="shrink-0 border-b border-line pb-3">
          <DialogTitle className="font-display text-[18px] font-bold text-ink">
            Tabela dos Grupos — Copa 2026
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pr-1 minimal-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            {sortedGroups.map(([groupName, teams]) => (
              <div key={groupName} className="rounded-rebrand-md border border-line bg-white p-3">
                <p className="text-[10px] uppercase font-bold tracking-[0.12em] text-ink-2 mb-2">
                  Grupo {groupName}
                </p>

                {/* Column header */}
                <div className="grid grid-cols-[1fr_18px_18px_18px_18px_26px] gap-1 text-[9px] uppercase text-ink-3 pb-1.5 border-b border-line mb-1 text-center">
                  <span className="text-left">Sel.</span>
                  <span>J</span>
                  <span>V</span>
                  <span>E</span>
                  <span>D</span>
                  <span className="font-bold">Pts</span>
                </div>

                {teams.map((team, idx) => (
                  <div
                    key={team.code}
                    className={`grid grid-cols-[1fr_18px_18px_18px_18px_26px] gap-1 py-1 text-[12px] text-center items-center ${
                      idx < 2 ? 'text-ink' : 'text-ink-3'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-left">
                      <span
                        className={`w-1 h-3 rounded-sm shrink-0 ${
                          idx < 2 ? 'bg-forest' : 'bg-transparent'
                        }`}
                      />
                      <TeamFlag code={team.code} />
                      <span className="font-mono font-bold text-[10px]">{team.code}</span>
                    </div>
                    <span className="tabular-nums">{team.p}</span>
                    <span className="tabular-nums">{team.w}</span>
                    <span className="tabular-nums">{team.d}</span>
                    <span className="tabular-nums">{team.l}</span>
                    <span className={`font-bold tabular-nums ${idx < 2 ? 'text-forest' : 'text-ink-2'}`}>
                      {team.pts}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <p className="text-[10px] text-ink-3 text-center mt-3 pb-1">
            Verde = classificado · Tabela atualizada após cada resultado
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
