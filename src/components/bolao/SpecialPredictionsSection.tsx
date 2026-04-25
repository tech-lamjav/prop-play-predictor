import React, { useMemo, useState } from 'react';
import { Crown, Lock, ChevronDown, ChevronUp, Check, Search, X } from 'lucide-react';
import {
  useMySpecialPredictions,
  useSpecialSummary,
  useToggleSpecialPrediction,
} from '@/hooks/use-bolao';
import type { WcMatch } from '@/services/bolao.service';
import { useToast } from '@/hooks/use-toast';

interface Props {
  bolaoId: string;
  isPremium: boolean;
  matches: WcMatch[];
  hideChrome?: boolean;
  enabledTypes?: Record<string, boolean>;
}

type SpecialType = 'finalist' | 'semifinalist' | 'quarterfinalist' | 'round_of_32';

const TYPE_CONFIG: Record<SpecialType, { label: string; sublabel: string; max: number; pts: string }> = {
  finalist:       { label: 'Finalistas',       sublabel: 'Escolha 2 times',   max: 2,  pts: '+10 pts cada' },
  semifinalist:   { label: 'Semifinalistas',    sublabel: 'Escolha 4 times',   max: 4,  pts: '+5 pts cada'  },
  quarterfinalist:{ label: 'Quartas de Final',  sublabel: 'Escolha 8 times',   max: 8,  pts: '+3 pts cada'  },
  round_of_32:   { label: 'Mata-mata (32)',     sublabel: 'Escolha 32 seleções', max: 32, pts: '+1 pt cada'  },
};

function extractTeams(matches: WcMatch[]) {
  const map = new Map<string, string>();
  for (const m of matches) {
    if (m.home_team_code && m.home_team_code !== 'TBD') map.set(m.home_team_code, m.home_team);
    if (m.away_team_code && m.away_team_code !== 'TBD') map.set(m.away_team_code, m.away_team);
  }
  return Array.from(map.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

interface PickPanelProps {
  type: SpecialType;
  bolaoId: string;
  myPicks: string[];
  summaryCounts: Map<string, number>;
  teams: { code: string; name: string }[];
  totalMembers: number;
}

const PickPanel: React.FC<PickPanelProps> = ({ type, bolaoId, myPicks, summaryCounts, teams, totalMembers }) => {
  const { label, sublabel, max, pts } = TYPE_CONFIG[type];
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const toggle = useToggleSpecialPrediction();
  const { toast } = useToast();

  const filtered = useMemo(() => {
    if (!search) return teams;
    const q = search.toLowerCase();
    return teams.filter((t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q));
  }, [teams, search]);

  const handleToggle = (code: string) => {
    const isPicked = myPicks.includes(code);
    if (!isPicked && myPicks.length >= max) {
      toast({ title: `Máximo de ${max} times para ${label}`, variant: 'destructive' });
      return;
    }
    toggle.mutate(
      { bolaoId, predictionType: type, teamCode: code },
      {
        onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
      }
    );
  };

  const filled = myPicks.length;

  return (
    <div className="border border-terminal-border-subtle rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-terminal-dark-gray/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <p className="text-sm font-bold leading-tight">{label}</p>
            <p className="text-[10px] opacity-40 mt-0.5">{sublabel} · <span className="text-terminal-blue">{pts}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Progress chips */}
          <div className="flex gap-1">
            {Array.from({ length: max }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full border ${
                  i < filled
                    ? 'bg-terminal-blue border-terminal-blue'
                    : 'border-terminal-border-subtle bg-transparent'
                }`}
              />
            ))}
          </div>
          <span className="text-xs tabular-nums opacity-50">{filled}/{max}</span>
          {open ? <ChevronUp className="w-3.5 h-3.5 opacity-40" /> : <ChevronDown className="w-3.5 h-3.5 opacity-40" />}
        </div>
      </button>

      {/* Expanded team picker */}
      {open && (
        <div className="border-t border-terminal-border-subtle bg-terminal-dark-gray/10">
          {/* Search */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar seleção..."
                aria-label={`Buscar seleção em ${label}`}
                className="w-full bg-terminal-dark-gray border border-terminal-border rounded px-3 pl-9 h-10 text-sm placeholder:opacity-30 focus:outline-none focus:border-terminal-blue focus:ring-1 focus:ring-terminal-blue/30 transition-colors"
              />
            </div>
          </div>

          {/* Team grid */}
          <div className="px-3 pb-3 grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-56 overflow-y-auto">
            {filtered.map((team) => {
              const picked = myPicks.includes(team.code);
              const count = summaryCounts.get(team.code) ?? 0;
              return (
                <button
                  key={team.code}
                  onClick={() => handleToggle(team.code)}
                  disabled={toggle.isPending}
                  aria-label={`${picked ? 'Remover' : 'Escolher'} ${team.name} para ${label}`}
                  aria-pressed={picked}
                  className={`relative flex flex-col items-center gap-0.5 p-2 min-h-[60px] rounded border text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue/50 ${
                    picked
                      ? 'border-terminal-blue bg-terminal-blue/10 text-terminal-blue'
                      : 'border-terminal-border-subtle hover:border-terminal-border bg-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  {picked && (
                    <div className="absolute top-1 right-1 w-3 h-3 bg-terminal-blue rounded-full flex items-center justify-center">
                      <Check className="w-2 h-2 text-terminal-bg" />
                    </div>
                  )}
                  <span className="font-mono font-bold text-xs">{team.code}</span>
                  <span className="text-[10px] opacity-60 leading-tight text-center line-clamp-1">{team.name}</span>
                  {count > 0 && totalMembers > 1 && (
                    <span className="text-[9px] opacity-40 tabular-nums">{count} pick{count !== 1 ? 's' : ''}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* My picks summary */}
          {myPicks.length > 0 && (
            <div className="px-3 pb-3 border-t border-terminal-border-subtle/50 pt-2">
              <p className="text-[10px] opacity-40 mb-1 uppercase tracking-wider">Meus palpites</p>
              <div className="flex flex-wrap gap-1.5">
                {myPicks.map((code) => {
                  const team = teams.find(t => t.code === code);
                  return (
                    <button
                      key={code}
                      onClick={() => handleToggle(code)}
                      aria-label={`Remover ${team?.name ?? code} dos meus palpites`}
                      className="text-xs font-mono font-bold px-2.5 h-8 rounded border border-terminal-blue/50 bg-terminal-blue/10 text-terminal-blue hover:bg-terminal-red/10 hover:border-terminal-red/50 hover:text-terminal-red focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-red/50 transition-colors flex items-center gap-1"
                    >
                      <span>{code}</span>
                      <X className="w-3 h-3" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const SpecialPredictionsSection: React.FC<Props> = ({ bolaoId, isPremium, matches, hideChrome, enabledTypes }) => {
  const { data: myPreds } = useMySpecialPredictions(bolaoId);
  const { data: summary } = useSpecialSummary(bolaoId);

  const teams = useMemo(() => extractTeams(matches), [matches]);

  const myPicksByType = useMemo(() => {
    const map: Record<string, string[]> = { finalist: [], semifinalist: [], quarterfinalist: [], round_of_32: [] };
    for (const p of myPreds || []) {
      if (p.prediction_type in map) map[p.prediction_type].push(p.predicted_team_code);
    }
    return map;
  }, [myPreds]);

  const summaryByType = useMemo(() => {
    const map: Record<string, Map<string, number>> = {
      finalist: new Map(),
      semifinalist: new Map(),
      quarterfinalist: new Map(),
      round_of_32: new Map(),
    };
    for (const s of summary || []) {
      if (s.prediction_type in map) map[s.prediction_type].set(s.predicted_team_code, s.pick_count);
    }
    return map;
  }, [summary]);

  const totalMembers = useMemo(() => {
    const counts = new Set<string>();
    for (const s of summary || []) {
      if (s.prediction_type === 'finalist') counts.add(s.predicted_team_code);
    }
    return counts.size;
  }, [summary]);

  if (!isPremium) {
    return (
      <div className="terminal-container p-4 border-terminal-border-subtle/50">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="w-4 h-4 text-yellow-400 shrink-0" />
          <p className="text-xs font-bold uppercase tracking-wider text-yellow-400">
            Palpites Especiais
          </p>
          <Lock className="w-3 h-3 opacity-40 ml-auto" />
        </div>
        <p className="text-xs opacity-50 mb-3">
          Bolão PRO: palpite em finalistas (+10pts), semifinalistas (+5pts) e quartas (+3pts).
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(TYPE_CONFIG) as [SpecialType, typeof TYPE_CONFIG[SpecialType]][]).map(([type, cfg]) => (
            <div key={type} className="text-center p-2 rounded border border-terminal-border-subtle/50 opacity-40">
              <p className="text-[10px] font-bold">{cfg.label}</p>
              <p className="text-[9px] opacity-60">{cfg.pts}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={hideChrome ? 'terminal-container p-4' : 'terminal-container p-4'}>
      {!hideChrome && (
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-4 h-4 text-yellow-400 shrink-0" />
          <p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Palpites Especiais</p>
          <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded font-bold ml-auto">PRO</span>
        </div>
      )}

      <div className="space-y-2">
        {(Object.keys(TYPE_CONFIG) as SpecialType[]).filter((type) => !enabledTypes || enabledTypes[type] !== false).map((type) => (
          <PickPanel
            key={type}
            type={type}
            bolaoId={bolaoId}
            myPicks={myPicksByType[type] || []}
            summaryCounts={summaryByType[type] || new Map()}
            teams={teams}
            totalMembers={totalMembers}
          />
        ))}
      </div>

      <p className="text-[10px] opacity-30 mt-3 text-center">
        Pontos extras somados ao ranking principal após cada fase
      </p>
    </div>
  );
};
