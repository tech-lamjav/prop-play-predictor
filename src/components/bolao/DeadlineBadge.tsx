import React, { useEffect, useState } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import {
  getNextDeadline,
  formatDeadlineRelative,
  isDeadlineUrgent,
} from '@/hooks/use-bolao';
import type { WcMatch } from '@/services/bolao.service';

interface DeadlineBadgeProps {
  matches: WcMatch[] | undefined;
  mode: 'per_match' | 'per_day' | 'per_round' | 'per_stage' | 'tournament_start';
  isClosed: boolean;
  /** "compact" = single line, no icon prefix (use in tight cards) */
  variant?: 'default' | 'compact';
}

/**
 * Live-updating deadline indicator. Re-renders every 30s to keep the
 * relative time fresh ("47min" → "46min" → ...). Shows urgent pulse
 * when < 1h remains.
 */
export const DeadlineBadge: React.FC<DeadlineBadgeProps> = ({ matches, mode, isClosed, variant = 'default' }) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Refresh every 30s so the relative label stays accurate without
    // rerendering on every animation frame.
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const next = getNextDeadline(mode, matches, isClosed);
  if (!next) return null;

  const urgent = isDeadlineUrgent(next.deadline, now);
  const label = formatDeadlineRelative(next.deadline, now);

  if (variant === 'compact') {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium tabular-nums ${
          urgent ? 'text-terminal-red animate-pulse' : 'text-terminal-yellow/80'
        }`}
        title={`Próximo prazo: ${next.deadline.toLocaleString('pt-BR')}`}
      >
        <Clock className="w-3 h-3" />
        Fecha {label}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium tabular-nums ${
        urgent
          ? 'border-terminal-red/40 bg-terminal-red/10 text-terminal-red animate-pulse'
          : 'border-terminal-yellow/30 bg-terminal-yellow/5 text-terminal-yellow/90'
      }`}
      title={`Próximo prazo: ${next.deadline.toLocaleString('pt-BR')}`}
      aria-live="polite"
    >
      {urgent ? <AlertCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
      <span>Fecha {label}</span>
    </div>
  );
};
