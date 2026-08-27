import { useRef, useLayoutEffect } from 'react';
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

/** Dia da semana curto (ter, qua…), número e mês curto, a partir de YYYY-MM-DD (BRT). */
function dayParts(s: string): { wd: string; d: string; mon: string } {
  const date = new Date(`${s}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short' }).format(date).replace('.', '');
  const d = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: '2-digit' }).format(date);
  const mon = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, month: 'short' }).format(date).replace('.', '');
  return { wd, d, mon };
}

/**
 * Navegação por dias em CHIPS (rebrand). `days` ordenado asc (YYYY-MM-DD, BRT).
 * `counts` opcional: nº de jogos por dia (mostra "· N" no chip).
 * Setas ‹ › passam a seleção pro dia anterior/seguinte da lista.
 */
export default function FutebolDayStepper({
  days, value, onChange, counts, className = '',
}: { days: string[]; value: string; onChange: (d: string) => void; counts?: Record<string, number>; className?: string }) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const jaPosicionou = useRef(false);
  // Na primeira abertura a régua pode ter dezenas de dias e começar lá no
  // histórico. Posiciona antes da pintura para não mostrar essa janela antiga;
  // depois disso, as trocas feitas pelo usuário continuam com animação suave.
  useLayoutEffect(() => {
    if (!activeRef.current) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    activeRef.current.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: reduce || !jaPosicionou.current ? 'auto' : 'smooth',
    });
    jaPosicionou.current = true;
  }, [value, days.length]);

  if (!days.length) return null;
  const today = todayStr();
  const i = days.indexOf(value);
  const hasPrev = i > 0;
  const hasNext = i >= 0 && i < days.length - 1;
  const isTodayView = value === today;
  const hasToday = days.includes(today);
  const arrow = 'w-9 h-9 grid place-items-center rounded-md shrink-0 border border-line bg-white text-ink-2 enabled:hover:bg-canvas-2 disabled:opacity-30 disabled:cursor-default transition';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button type="button" className={arrow} disabled={!hasPrev} onClick={() => hasPrev && onChange(days[i - 1])} aria-label="Dia anterior">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {days.map((s) => {
          const { wd, d, mon } = dayParts(s);
          const isToday = s === today;
          const active = s === value;
          return (
            <button
              key={s}
              ref={active ? activeRef : undefined}
              type="button"
              onClick={() => onChange(s)}
              title={dayLabel(s)}
              className={`flex items-center gap-2 rounded-full px-3 h-9 shrink-0 border transition ${
                active
                  ? 'bg-forest text-canvas border-forest'
                  : isToday
                  ? 'bg-forest-tint border-forest text-forest'
                  : 'bg-transparent border-line text-ink hover:bg-canvas-2'
              }`}
            >
              <span className="text-[10px] uppercase tracking-[0.16em] font-semibold opacity-70">{wd}</span>
              <span className="text-[14px] font-semibold tabular-nums tracking-tight">{d}</span>
              <span className="text-[10px] uppercase tracking-[0.12em] font-semibold opacity-70">{mon}</span>
              {isToday && <span className="text-[9px] uppercase tracking-[0.16em] font-bold">Hoje</span>}
              {counts && counts[s] != null && <span className="text-[10px] tabular-nums opacity-60">· {counts[s]}</span>}
            </button>
          );
        })}
      </div>
      <button type="button" className={arrow} disabled={!hasNext} onClick={() => hasNext && onChange(days[i + 1])} aria-label="Próximo dia">
        <ChevronRight className="w-4 h-4" />
      </button>
      {/* Atalho pra voltar pro dia de hoje quando a navegação se afasta */}
      {!isTodayView && hasToday && (
        <button
          type="button"
          onClick={() => onChange(today)}
          className="shrink-0 h-9 px-3 rounded-md border border-forest bg-forest-tint text-forest text-[11px] font-bold uppercase tracking-[0.1em] hover:bg-forest hover:text-canvas transition"
        >
          Hoje
        </button>
      )}
    </div>
  );
}
