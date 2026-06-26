import { ChevronLeft, ChevronRight } from 'lucide-react';

const TZ = 'America/Sao_Paulo';

function todayStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Rótulo amigável pra um dia (YYYY-MM-DD, BRT): Hoje / Amanhã / "Qui, 26/06". */
function dayLabel(s: string): string {
  const t = todayStr();
  const base = new Date(`${t}T12:00:00Z`);
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(base.getTime() + 864e5));
  if (s === t) return 'Hoje';
  if (s === tomorrow) return 'Amanhã';
  const d = new Date(`${s}T12:00:00Z`);
  const str = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' }).format(d).replace('.', '');
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Dia da semana curto (ter, qua…) e número do dia, a partir de YYYY-MM-DD (BRT). */
function dayParts(s: string): { wd: string; d: string } {
  const date = new Date(`${s}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short' }).format(date).replace('.', '');
  const d = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit' }).format(date);
  return { wd, d };
}

/**
 * Navegação por dias em CHIPS (rebrand). `days` ordenado asc (YYYY-MM-DD, BRT).
 * `counts` opcional: nº de jogos por dia (mostra "· N" no chip).
 * Setas ‹ › passam a seleção pro dia anterior/seguinte da lista.
 */
export default function FutebolDayStepper({
  days, value, onChange, counts, className = '',
}: { days: string[]; value: string; onChange: (d: string) => void; counts?: Record<string, number>; className?: string }) {
  if (!days.length) return null;
  const today = todayStr();
  const i = days.indexOf(value);
  const hasPrev = i > 0;
  const hasNext = i >= 0 && i < days.length - 1;
  const arrow = 'w-9 h-9 grid place-items-center rounded-md shrink-0 border border-line bg-white text-ink-2 enabled:hover:bg-canvas-2 disabled:opacity-30 disabled:cursor-default transition';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button type="button" className={arrow} disabled={!hasPrev} onClick={() => hasPrev && onChange(days[i - 1])} aria-label="Dia anterior">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {days.map((s) => {
          const { wd, d } = dayParts(s);
          const isToday = s === today;
          const active = s === value;
          return (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              title={dayLabel(s)}
              className={`flex items-center gap-2 rounded-full px-3 h-9 shrink-0 border transition ${
                active ? 'bg-forest text-canvas border-forest' : 'bg-transparent border-line text-ink hover:bg-canvas-2'
              }`}
            >
              <span className="text-[10px] uppercase tracking-[0.16em] font-semibold opacity-70">{wd}</span>
              <span className="text-[14px] font-semibold tabular-nums tracking-tight">{d}</span>
              {isToday && <span className="text-[9px] uppercase tracking-[0.16em] font-bold">Hoje</span>}
              {counts && counts[s] != null && <span className="text-[10px] tabular-nums opacity-60">· {counts[s]}</span>}
            </button>
          );
        })}
      </div>
      <button type="button" className={arrow} disabled={!hasNext} onClick={() => hasNext && onChange(days[i + 1])} aria-label="Próximo dia">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
