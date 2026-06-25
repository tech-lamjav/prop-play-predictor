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

/** Navegação por dias com setas. `days` ordenado asc (YYYY-MM-DD, BRT). */
export default function FutebolDayStepper({
  days, value, onChange, className = '',
}: { days: string[]; value: string; onChange: (d: string) => void; className?: string }) {
  if (!days.length) return null;
  const i = days.indexOf(value);
  const hasPrev = i > 0;
  const hasNext = i >= 0 && i < days.length - 1;
  const btn = 'grid place-items-center w-7 h-7 rounded-rebrand-sm border border-line text-ink-2 enabled:hover:bg-canvas-2 disabled:opacity-30 disabled:cursor-default transition';
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <button type="button" className={btn} disabled={!hasPrev} onClick={() => hasPrev && onChange(days[i - 1])} aria-label="Dia anterior">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="min-w-[96px] text-center text-sm font-semibold text-ink tabular-nums">{dayLabel(value)}</span>
      <button type="button" className={btn} disabled={!hasNext} onClick={() => hasNext && onChange(days[i + 1])} aria-label="Próximo dia">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
