import React, { useMemo } from 'react';
import { ChevronRight, Clock, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TeamFlag } from '@/components/bolao/TeamFlag';
import { computeMatchDeadline } from '@/hooks/use-bolao';
import type { Bolao, BolaoPrediction, WcMatch } from '@/services/bolao.service';

interface BolaoStatsTopCardsProps {
  bolao: Bolao;
  matches: WcMatch[] | undefined;
  predictions: BolaoPrediction[] | undefined;
  onContinuarPalpites: () => void;
}

const STAGE_LABELS: { key: WcMatch['stage']; label: string }[] = [
  { key: 'group', label: 'Fase de grupos' },
  { key: 'round_of_32', label: 'Oitavas' },
  { key: 'round_of_16', label: '16 Avos' },
  { key: 'quarter', label: 'Quartas' },
  { key: 'semi', label: 'Semis' },
  { key: 'final', label: 'Final' },
];

function formatDayLabel(iso: string): string {
  // 'YYYY-MM-DD' → 'Sáb 14/06'
  const d = new Date(iso + 'T00:00:00');
  const dayShort = d.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  // Capitaliza e remove ponto: "sáb." → "Sáb"
  const cleaned = dayShort.replace(/\./g, '');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function countdownLabel(deadline: Date): string {
  const diffMs = deadline.getTime() - Date.now();
  if (diffMs <= 0) return 'encerrado';
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) {
    const min = Math.max(1, Math.floor(diffMs / 60_000));
    return `em ${min}min`;
  }
  if (hours < 24) return `em ${hours}h`;
  const days = Math.floor(hours / 24);
  return `em ${days}d`;
}

export const BolaoStatsTopCards: React.FC<BolaoStatsTopCardsProps> = ({
  bolao,
  matches,
  predictions,
  onContinuarPalpites,
}) => {
  const predictionsByMatch = useMemo(
    () => new Map((predictions || []).map((p) => [p.match_id, p])),
    [predictions]
  );

  // Total palpitados / disponíveis no bolão inteiro
  const totalAvailable = useMemo(
    () => (matches || []).filter((m) => !m.is_finished && m.home_team_code !== 'TBD').length,
    [matches]
  );
  const totalDone = useMemo(
    () =>
      (predictions || []).filter((p) => {
        const match = matches?.find((m) => m.id === p.match_id);
        return match && !match.is_finished && match.home_team_code !== 'TBD';
      }).length,
    [predictions, matches]
  );
  const pct = totalAvailable > 0 ? Math.round((totalDone / totalAvailable) * 100) : 0;

  // Breakdown por fase
  const stageBreakdown = useMemo(() => {
    if (!matches) return [];
    return STAGE_LABELS.map(({ key, label }) => {
      const stageMatches = matches.filter(
        (m) => m.stage === key && !m.is_finished && m.home_team_code !== 'TBD'
      );
      const total = stageMatches.length;
      const done = stageMatches.filter((m) => predictionsByMatch.has(m.id)).length;
      return { label, done, total };
    }).filter((s) => s.total > 0);
  }, [matches, predictionsByMatch]);

  // Próximo prazo + jogos
  const nextDeadlineGroup = useMemo(() => {
    if (!matches || bolao.is_closed) return null;
    const mode = bolao.prediction_deadline_mode ?? 'per_match';
    const now = Date.now();

    // Pra cada match aberto (não finalizado, com times definidos), calcula o deadline
    type Entry = { match: WcMatch; deadline: Date };
    const upcoming: Entry[] = [];
    for (const m of matches) {
      if (m.is_finished) continue;
      if (m.home_team_code === 'TBD' || m.away_team_code === 'TBD') continue;
      const deadline = computeMatchDeadline(m, mode, matches);
      if (deadline.getTime() <= now) continue;
      upcoming.push({ match: m, deadline });
    }
    if (upcoming.length === 0) return null;

    // Encontra o menor deadline e agrupa todos os matches com mesmo deadline
    upcoming.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
    const minDeadline = upcoming[0].deadline;
    const sameDeadline = upcoming.filter(
      (e) => Math.abs(e.deadline.getTime() - minDeadline.getTime()) < 60_000
    );

    // Quantos desses já foram palpitados pelo user
    const palpitated = sameDeadline.filter((e) => predictionsByMatch.has(e.match.id)).length;

    return {
      deadline: minDeadline,
      matches: sameDeadline.map((e) => e.match),
      palpitated,
    };
  }, [matches, bolao.prediction_deadline_mode, bolao.is_closed, predictionsByMatch]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
      {/* ─── Esquerda: SEUS PALPITES ─── */}
      <div className="bg-white border border-line rounded-rebrand-xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-2">
            Seus palpites
          </p>
          <Button
            variant={totalDone >= totalAvailable && totalAvailable > 0 ? 'outline-forest' : 'forest'}
            size="sm"
            onClick={onContinuarPalpites}
            className="rounded-rebrand-md gap-1 h-8 px-3 text-[12px]"
          >
            {totalAvailable === 0
              ? 'Fazer palpites'
              : totalDone === 0
                ? 'Começar palpites'
                : totalDone < totalAvailable
                  ? 'Continuar palpites'
                  : 'Revisar palpites'}
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex items-baseline gap-2 mb-3 tabular-nums">
          <span className="font-display text-[36px] sm:text-[40px] font-extrabold leading-none text-ink">
            {totalDone}
          </span>
          <span className="text-[16px] text-ink-2 font-medium">/ {totalAvailable}</span>
          <span className="text-[14px] text-ink-2 ml-1">· {pct}%</span>
        </div>

        <div className="h-2 bg-canvas-2 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full ${pct === 100 ? 'bg-status-success' : 'bg-forest'} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {stageBreakdown.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {stageBreakdown.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-rebrand-sm bg-canvas border border-line text-ink"
              >
                <span className="text-ink-2">{s.label}</span>
                <span className="font-semibold tabular-nums">
                  {s.done}/{s.total}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ─── Direita: PRÓXIMO PRAZO ─── */}
      <div className="bg-forest text-white rounded-rebrand-xl p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-amber/10 pointer-events-none" />
        <div className="absolute right-16 top-12 w-20 h-20 rounded-full bg-amber/10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-60">
              Próximo prazo
            </p>
            {nextDeadlineGroup &&
              (() => {
                const total = nextDeadlineGroup.matches.length;
                const done = nextDeadlineGroup.palpitated;
                const pending = total - done;
                if (total === 0) return null;
                if (done === total) {
                  return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-status-success text-white shadow-sm">
                      <Check className="w-3 h-3" strokeWidth={3} />
                      Tudo certo
                    </span>
                  );
                }
                if (done === 0) {
                  return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-status-danger text-white shadow-sm">
                      <AlertCircle className="w-3 h-3" />
                      Falta palpitar
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber text-forest shadow-sm">
                    <AlertCircle className="w-3 h-3" />
                    {pending} pendente{pending !== 1 ? 's' : ''}
                  </span>
                );
              })()}
          </div>

          {nextDeadlineGroup ? (
            <>
              <h3 className="font-display text-[28px] sm:text-[32px] font-extrabold leading-tight mb-2">
                {formatDayLabel(nextDeadlineGroup.matches[0].match_date)}
                {' · '}
                <span className="text-amber">
                  {nextDeadlineGroup.matches[0].match_time_brasilia.slice(0, 5)}
                </span>
              </h3>

              <div className="flex items-center gap-2 text-[12px] opacity-80 mb-4">
                <Clock className="w-3.5 h-3.5" />
                <span>{countdownLabel(nextDeadlineGroup.deadline)}</span>
                <span className="opacity-50">·</span>
                <span>
                  {nextDeadlineGroup.matches.length} jogo
                  {nextDeadlineGroup.matches.length !== 1 ? 's' : ''}
                </span>
                <span className="opacity-50">·</span>
                <span>
                  <span className="font-bold tabular-nums">{nextDeadlineGroup.palpitated}</span>{' '}
                  palpitado{nextDeadlineGroup.palpitated !== 1 ? 's' : ''}
                </span>
              </div>

              <ul className="space-y-1.5">
                {nextDeadlineGroup.matches.slice(0, 4).map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-2 text-[13px] tabular-nums"
                  >
                    <span className="opacity-60 w-12 shrink-0">
                      {m.match_time_brasilia.slice(0, 5)}
                    </span>
                    <TeamFlag code={m.home_team_code} size="sm" />
                    <span className="font-mono font-semibold w-9">{m.home_team_code}</span>
                    <span className="opacity-30 mx-1">×</span>
                    <span className="font-mono font-semibold w-9">{m.away_team_code}</span>
                    <TeamFlag code={m.away_team_code} size="sm" />
                  </li>
                ))}
              </ul>

              {nextDeadlineGroup.matches.length > 4 && (
                <p className="text-[11px] opacity-60 mt-2">
                  +{nextDeadlineGroup.matches.length - 4} jogo
                  {nextDeadlineGroup.matches.length - 4 !== 1 ? 's' : ''}
                </p>
              )}
            </>
          ) : (
            <p className="text-[14px] opacity-70">Sem prazos abertos no momento.</p>
          )}
        </div>
      </div>
    </div>
  );
};
