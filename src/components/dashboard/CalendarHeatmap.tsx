import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { aggregateCalendarHeatmap } from '@/utils/dashboardAggregations';
import type { Bet } from '@/hooks/use-bets';

interface CalendarHeatmapProps {
  bets: Bet[];
}

const CELL = 17; // px
const GAP = 3; // px
const WINDOW_DAYS = 91; // ~13 semanas (~3 meses)
const STEP_DAYS = 28; // navegação: ~1 mês por click

const intensityClass = (n: number, maxN: number): string => {
  if (n === 0) return 'bg-ink-3/60';
  if (maxN <= 0) return 'bg-ink-3/60';
  const ratio = n / maxN;
  if (ratio <= 0.25) return 'bg-forest/30';
  if (ratio <= 0.5) return 'bg-forest/55';
  if (ratio <= 0.75) return 'bg-forest/80';
  return 'bg-forest';
};

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({ bets }) => {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [endDate, setEndDate] = useState<Date>(today);

  const data = useMemo(
    () => aggregateCalendarHeatmap(bets, WINDOW_DAYS, endDate),
    [bets, endDate]
  );

  const canGoForward = endDate.getTime() < today.getTime();
  const canGoBack = data.earliestBetDate
    ? data.windowStart.getTime() > data.earliestBetDate.getTime()
    : true;

  const goBack = () => {
    const newEnd = new Date(endDate);
    newEnd.setDate(newEnd.getDate() - STEP_DAYS);
    setEndDate(newEnd);
  };

  const goForward = () => {
    const newEnd = new Date(endDate);
    newEnd.setDate(newEnd.getDate() + STEP_DAYS);
    if (newEnd.getTime() > today.getTime()) newEnd.setTime(today.getTime());
    setEndDate(newEnd);
  };

  if (data.windowStart && bets.filter((b) => ['won', 'lost', 'cashout', 'half_won', 'half_lost', 'void'].includes(b.status)).length === 0) {
    return (
      <div className="bg-white border border-line rounded-xl p-5 h-full flex flex-col">
        <div className="text-[10px] uppercase tracking-[0.18em] text-amber-700 font-bold">Atividade</div>
        <h2 className="text-[16px] font-extrabold tracking-tight text-ink mt-1">Quando você aposta</h2>
        <div className="flex-1 grid place-items-center">
          <p className="text-[13px] text-ink-2">Nenhuma aposta registrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-xl p-5 h-full flex flex-col">
      <div className="text-[10px] uppercase tracking-[0.18em] text-amber-700 font-bold">Atividade</div>
      <h2 className="text-[16px] font-extrabold tracking-tight text-ink mt-1">Quando você aposta</h2>

      {/* Body: grid (left) + stats panel (right) */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 mt-4 min-h-0">
        {/* Grid */}
        <div className="lg:flex-1 min-w-0">
          {/* Month labels row with nav arrows */}
          <div className="flex items-center gap-1 mb-1" style={{ paddingLeft: 28 }}>
            <button
              type="button"
              onClick={goBack}
              disabled={!canGoBack}
              className="w-9 h-9 grid place-items-center rounded text-ink-2 hover:text-ink hover:bg-ink-3/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="relative h-4 flex-1">
              {data.months.map((m, i) => {
                const left = m.weekIndex * (CELL + GAP);
                return (
                  <span
                    key={i}
                    className="absolute text-[10px] text-ink-2 font-bold uppercase tracking-[0.06em] capitalize"
                    style={{ left }}
                  >
                    {m.label}
                  </span>
                );
              })}
            </div>
            <button
              type="button"
              onClick={goForward}
              disabled={!canGoForward}
              className="w-9 h-9 grid place-items-center rounded text-ink-2 hover:text-ink hover:bg-ink-3/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
              aria-label="Mês seguinte"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Day labels + week columns */}
          <div className="flex overflow-hidden" style={{ gap: GAP }}>
            <div className="flex flex-col" style={{ gap: GAP, marginRight: 6 }}>
              {DAY_LABELS.map((d, i) => (
                <span
                  key={i}
                  className="text-[9px] text-ink-2 tabular leading-none flex items-center"
                  style={{ height: CELL, width: 22 }}
                >
                  {d}
                </span>
              ))}
            </div>
            {data.weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
                {Array.from({ length: 7 }).map((_, di) => {
                  const cell = week[di];
                  if (!cell) {
                    return (
                      <div
                        key={di}
                        style={{ width: CELL, height: CELL }}
                        aria-hidden="true"
                      />
                    );
                  }
                  return (
                    <Tooltip key={di} delayDuration={120}>
                      <TooltipTrigger asChild>
                        <div
                          className={`rounded cursor-default transition-transform hover:scale-110 ${intensityClass(cell.n, data.maxN)}`}
                          style={{ width: CELL, height: CELL }}
                        />
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="theme-rebrand bg-ink text-white border-ink px-2.5 py-1.5 text-[11px] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.3)]"
                      >
                        <div className="font-bold tabular leading-tight">
                          {cell.date.toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-white/70 tabular text-[10px] leading-tight mt-0.5">
                          {cell.n === 0
                            ? 'nenhuma aposta'
                            : `${cell.n} ${cell.n === 1 ? 'aposta' : 'apostas'}`}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Stats panel */}
        <div className="shrink-0 lg:w-32 lg:pl-4 lg:border-l lg:border-line grid grid-cols-3 lg:grid-cols-1 gap-3 lg:gap-4 lg:self-stretch lg:justify-center">
          <div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-ink-2 font-bold">Mais ativo</div>
            {data.mostActiveDay ? (
              <>
                <div className="text-[13px] text-ink font-extrabold mt-0.5">{data.mostActiveDay.name}</div>
                <div className="text-[10px] text-ink-2 tabular">
                  {data.mostActiveDay.count} {data.mostActiveDay.count === 1 ? 'aposta' : 'apostas'}
                </div>
              </>
            ) : (
              <div className="text-[13px] text-ink-2 mt-0.5">—</div>
            )}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-ink-2 font-bold">Fim de semana</div>
            <div className="text-[13px] text-ink font-extrabold tabular mt-0.5">{data.weekendPct.toFixed(0)}%</div>
            <div className="text-[10px] text-ink-2 tabular">das apostas</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-ink-2 font-bold">Sequência</div>
            <div className="text-[13px] text-forest font-extrabold tabular mt-0.5">
              {data.longestStreak} {data.longestStreak === 1 ? 'dia' : 'dias'}
            </div>
            <div className="text-[10px] text-ink-2 tabular">recorde no período</div>
          </div>
        </div>
      </div>

      {/* Footer: legenda + totais */}
      <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-3 text-[11px] flex-wrap">
        <div className="flex items-center gap-1.5 text-ink-2">
          <span>Menos</span>
          <div className="flex" style={{ gap: 2 }}>
            <div className="rounded bg-ink-3/60" style={{ width: 10, height: 10 }} />
            <div className="rounded bg-forest/30" style={{ width: 10, height: 10 }} />
            <div className="rounded bg-forest/55" style={{ width: 10, height: 10 }} />
            <div className="rounded bg-forest/80" style={{ width: 10, height: 10 }} />
            <div className="rounded bg-forest" style={{ width: 10, height: 10 }} />
          </div>
          <span>Mais</span>
        </div>
        <div className="text-ink-2 tabular">
          {data.totalDays} {data.totalDays === 1 ? 'dia ativo' : 'dias ativos'} · {data.totalBets} {data.totalBets === 1 ? 'aposta' : 'apostas'}
        </div>
      </div>
    </div>
  );
};
