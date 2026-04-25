import React, { useState, useMemo } from 'react';
import { Trophy, Search, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
}) => {
  const [selected, setSelected] = useState<string | null>(currentPick);
  const [search, setSearch] = useState('');

  const teams = useMemo(() => extractTeams(matches), [matches]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return teams;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q)
    );
  }, [teams, search]);

  const handleOpen = (v: boolean) => {
    if (!v) setSearch('');
    onOpenChange(v);
  };

  const handleConfirm = () => {
    if (selected) {
      onConfirm(selected);
    }
  };

  // Sync with external currentPick when modal opens
  React.useEffect(() => {
    if (open) setSelected(currentPick);
  }, [open, currentPick]);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="bg-terminal-bg border-terminal-border max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-terminal-text">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Palpite de Campeão
          </DialogTitle>
          <p className="text-xs opacity-50 mt-0.5">
            Quem vai vencer a Copa do Mundo 2026?
          </p>
        </DialogHeader>

        {/* Search */}
        <div className="px-5 pb-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
            <Input
              type="search"
              placeholder="Buscar seleção..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar seleção"
              className="pl-9 h-11 text-sm bg-terminal-dark-gray border-terminal-border text-terminal-text"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Limpar busca"
                className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded opacity-50 hover:opacity-100 hover:bg-terminal-gray/40 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Team grid */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 pb-3">
          {filtered.length === 0 ? (
            <p className="text-center text-xs opacity-40 py-8">
              Nenhuma seleção encontrada
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {filtered.map((team) => {
                const isSelected = selected === team.code;
                return (
                  <button
                    key={team.code}
                    onClick={() => setSelected(team.code)}
                    aria-label={`Escolher ${team.name} como campeão${isSelected ? ' (selecionado)' : ''}`}
                    aria-pressed={isSelected}
                    className={`relative flex flex-col items-center gap-1.5 p-3 min-h-[72px] rounded border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/50 ${
                      isSelected
                        ? 'border-yellow-500/60 bg-yellow-500/5'
                        : 'border-terminal-border hover:border-terminal-border-subtle bg-terminal-dark-gray/30'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-yellow-500 flex items-center justify-center">
                        <Check className="w-2 h-2 text-terminal-bg" />
                      </div>
                    )}
                    {/* Flag placeholder */}
                    <div className="w-8 h-5 rounded-sm bg-terminal-border-subtle/40 border border-terminal-border-subtle/30 shrink-0" />
                    <div className="text-center w-full">
                      <p
                        className={`text-[11px] font-bold ${isSelected ? 'text-yellow-400' : 'text-terminal-text'}`}
                      >
                        {team.code}
                      </p>
                      <p className="text-[9px] opacity-50 leading-tight line-clamp-1">
                        {team.name}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-terminal-border shrink-0 flex items-center justify-between gap-3">
          {selected ? (
            <p className="text-xs opacity-60 flex-1">
              Selecionado:{' '}
              <span className="font-bold text-yellow-400">
                {teams.find((t) => t.code === selected)?.name ?? selected}
              </span>
            </p>
          ) : (
            <p className="text-xs opacity-40 flex-1">Nenhuma seleção escolhida</p>
          )}
          <div className="flex gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpen(false)}
              className="text-terminal-text text-sm h-11 px-4"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!selected || isLoading}
              onClick={handleConfirm}
              className="bg-yellow-500 text-terminal-bg hover:bg-yellow-500/90 text-sm gap-1.5 h-11 px-4 font-bold"
            >
              <Trophy className="w-4 h-4" />
              {isLoading ? 'Salvando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
