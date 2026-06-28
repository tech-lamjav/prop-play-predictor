import React from 'react';
import { Crown } from 'lucide-react';
import { TeamFlag } from '@/components/bolao/TeamFlag';
import type { WcMatch } from '@/services/bolao.service';
import type { ProjectionResult } from '@/components/bolao/group-projection';
import { resolveBracket, type BracketPicks, type ResolvedMatch, type ResolvedSlot } from '@/components/bolao/bracket';

const STAGE_COLS: { stage: string; label: string }[] = [
  { stage: 'round_of_32', label: '16 avos' },
  { stage: 'round_of_16', label: 'Oitavas' },
  { stage: 'quarter', label: 'Quartas' },
  { stage: 'semi', label: 'Semis' },
  { stage: 'final', label: 'Final' },
];

interface Props {
  matches: WcMatch[];
  projection: ProjectionResult | null;
  picks: BracketPicks;
  /** Avança (ou troca) o vencedor de um jogo. Sem isso, render é read-only. */
  onAdvance?: (match: ResolvedMatch, winnerCode: string) => void;
  busy?: boolean;
  /** Modo "chaveamento real": 16 avos vêm dos times reais do wc_matches. */
  realMode?: boolean;
}

export const KnockoutBracket: React.FC<Props> = ({ matches, projection, picks, onAdvance, busy, realMode }) => {
  const resolved = React.useMemo(
    () => resolveBracket(matches, projection, picks, { preferRealCodes: realMode }),
    [matches, projection, picks, realMode]
  );
  const byStage = React.useMemo(() => {
    const map = new Map<string, ResolvedMatch[]>();
    for (const m of resolved) {
      if (!map.has(m.stage)) map.set(m.stage, []);
      map.get(m.stage)!.push(m);
    }
    return map;
  }, [resolved]);

  const champion = resolved.find((m) => m.stage === 'final')?.winner ?? null;

  return (
    <div className="space-y-3">
      {champion && (
        <div className="rounded-rebrand-md border border-amber/40 bg-amber/[0.08] p-3 flex items-center gap-2.5">
          <Crown className="w-5 h-5 text-amber-2 shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <TeamFlag code={champion} size="sm" />
            <span className="text-[13px] font-bold text-ink truncate">Seu campeão: {champion}</span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto minimal-scrollbar pb-2">
        <div className="flex gap-3 min-w-max">
          {STAGE_COLS.map(({ stage, label }) => {
            const list = byStage.get(stage) ?? [];
            return (
              <div key={stage} className="flex flex-col gap-2 w-[180px] shrink-0">
                <p className="text-[10px] uppercase font-bold tracking-[0.12em] text-ink-2 text-center sticky top-0">
                  {label}
                </p>
                <div className="flex flex-col gap-2 justify-around h-full">
                  {list.map((m) => (
                    <MatchCard key={m.match_number} match={m} onAdvance={onAdvance} busy={busy} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const MatchCard: React.FC<{
  match: ResolvedMatch;
  onAdvance?: (m: ResolvedMatch, code: string) => void;
  busy?: boolean;
}> = ({ match, onAdvance, busy }) => {
  return (
    <div className="rounded-rebrand-sm border border-line bg-white overflow-hidden">
      <SlotRow slot={match.home} winner={match.winner} match={match} onAdvance={onAdvance} busy={busy} />
      <div className="h-px bg-line" />
      <SlotRow slot={match.away} winner={match.winner} match={match} onAdvance={onAdvance} busy={busy} />
    </div>
  );
};

const SlotRow: React.FC<{
  slot: ResolvedSlot;
  winner: string | null;
  match: ResolvedMatch;
  onAdvance?: (m: ResolvedMatch, code: string) => void;
  busy?: boolean;
}> = ({ slot, winner, match, onAdvance, busy }) => {
  const isWinner = !!slot.code && slot.code === winner;
  // só clicável quando os dois lados estão resolvidos e há handler
  const clickable = !!onAdvance && !!slot.code && !!match.home.code && !!match.away.code;

  return (
    <button
      type="button"
      disabled={!clickable || busy}
      onClick={() => slot.code && onAdvance?.(match, slot.code)}
      className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-left transition-colors ${
        isWinner ? 'bg-forest/[0.10]' : 'bg-white'
      } ${clickable ? 'hover:bg-canvas-2 cursor-pointer' : 'cursor-default'} disabled:cursor-default`}
    >
      {slot.code ? (
        <>
          <TeamFlag code={slot.code} size="sm" />
          <span className={`font-mono text-[11px] truncate ${isWinner ? 'font-bold text-forest' : 'text-ink'}`}>
            {slot.code}
          </span>
        </>
      ) : (
        <span className="text-[10px] text-ink-3 italic truncate">{slot.label}</span>
      )}
    </button>
  );
};
