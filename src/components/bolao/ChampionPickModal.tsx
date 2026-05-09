import React, { useState, useMemo, useEffect } from 'react';
import { Trophy, Search, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TeamFlag } from '@/components/bolao/TeamFlag';
import type { WcMatch } from '@/services/bolao.service';

interface Team {
  code: string;
  name: string;
}

interface ChampionPickModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matches: WcMatch[];
  currentPick: string | null;
  onConfirm: (teamCode: string) => void;
  isLoading?: boolean;
  championPoints?: number;
}

function extractTeams(matches: WcMatch[]): Team[] {
  const teamMap = new Map<string, string>();
  for (const m of matches) {
    if (m.home_team_code && m.home_team_code !== 'TBD') {
      teamMap.set(m.home_team_code, m.home_team);
    }
    if (m.away_team_code && m.away_team_code !== 'TBD') {
      teamMap.set(m.away_team_code, m.away_team);
    }
  }
  return Array.from(teamMap.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const ChampionPickModal: React.FC<ChampionPickModalProps> = ({
  open,
  onOpenChange,
  matches,
  currentPick,
  onConfirm,
  isLoading,
  championPoints = 25,
}) => {
  const [selected, setSelected] = useState<string | null>(currentPick);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) setSelected(currentPick);
  }, [open, currentPick]);

  const teams = useMemo(() => extractTeams(matches), [matches]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
    );
  }, [teams, search]);

  const handleOpen = (v: boolean) => {
    if (!v) setSearch('');
    onOpenChange(v);
  };

  const handleConfirm = () => {
    if (selected) onConfirm(selected);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="theme-bolao bg-canvas border border-line w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh] rounded-rebrand-xl">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0 border-b border-line">
          <DialogTitle className="flex items-center gap-2 text-ink font-display text-[18px] font-bold pr-8">
            <Trophy className="w-5 h-5 text-amber" />
            Palpite de campeão
          </DialogTitle>
          <p className="text-[12px] text-ink-2 mt-1">
            Quem vai vencer a Copa do Mundo 2026? Vale +{championPoints} pts se acertar.
          </p>
        </DialogHeader>

        <div className="px-5 pt-4 pb-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
            <input
              type="search"
              placeholder="Buscar seleção..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar seleção"
              className="w-full h-11 pl-9 pr-9 rounded-rebrand-md border border-line bg-white text-[13px] text-ink placeholder:text-ink-3 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Limpar busca"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-rebrand-sm text-ink-3 hover:text-ink hover:bg-canvas-2 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto minimal-scrollbar px-5 pb-3">
          {filtered.length === 0 ? (
            <p className="text-center text-[12px] text-ink-3 py-8">Nenhuma seleção encontrada</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filtered.map((team) => {
                const isSelected = selected === team.code;
                return (
                  <button
                    key={team.code}
                    onClick={() => setSelected(team.code)}
                    aria-label={`Escolher ${team.name} como campeão${isSelected ? ' (selecionado)' : ''}`}
                    aria-pressed={isSelected}
                    className={`relative flex flex-col items-center gap-1.5 p-3 min-h-[84px] rounded-rebrand-sm border text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber/40 ${
                      isSelected
                        ? 'border-amber bg-amber/[0.10] ring-2 ring-amber/30'
                        : 'border-line bg-white hover:border-line-2 hover:bg-canvas-2'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      </div>
                    )}
                    <TeamFlag code={team.code} size="md" />
                    <p className={`text-[11px] font-bold ${isSelected ? 'text-amber-2' : 'text-ink'}`}>
                      {team.code}
                    </p>
                    <p className="text-[9px] text-ink-2 leading-tight line-clamp-1">{team.name}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-line shrink-0 flex items-center justify-between gap-3 bg-white">
          {selected ? (
            <p className="text-[12px] text-ink-2 flex-1 truncate">
              Selecionado:{' '}
              <span className="font-bold text-amber-2">
                {teams.find((t) => t.code === selected)?.name ?? selected}
              </span>
            </p>
          ) : (
            <p className="text-[12px] text-ink-3 flex-1">Nenhuma seleção escolhida</p>
          )}
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleOpen(false)}
              className="h-11 px-4 rounded-rebrand-md text-[13px] font-medium text-ink-2 hover:text-ink hover:bg-canvas-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!selected || isLoading}
              onClick={handleConfirm}
              className="h-11 px-4 rounded-rebrand-md inline-flex items-center gap-1.5 bg-amber text-white text-[13px] font-bold hover:bg-amber-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Trophy className="w-4 h-4" />
              {isLoading ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
