import React from 'react';

interface PalpitesProgressProps {
  done: number;
  total: number;
  /** "modal" = dentro do dialog (cabeçalho compacto). "page" = dentro de página (mais espaço) */
  variant?: 'modal' | 'page';
}

/**
 * Indicador de progresso dos palpites.
 * Número grande + barra fina horizontal.
 *
 *  Fazer Palpites               12 / 72
 *  ████████░░░░░░░░░░░░░░░ 17%
 */
export const PalpitesProgress: React.FC<PalpitesProgressProps> = ({ done, total, variant = 'modal' }) => {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const isComplete = total > 0 && done >= total;

  // Cor escala: cinza → amarelo → azul → verde conforme progresso
  const colorClass =
    pct >= 80 ? 'text-terminal-green'
    : pct >= 50 ? 'text-terminal-blue'
    : pct >= 20 ? 'text-terminal-yellow'
    : 'text-terminal-text/60';

  // bg-terminal-* classes não existem no CSS, só as text-terminal-*. Usamos
  // a CSS var inline.
  const barColorVar =
    pct >= 80 ? 'var(--terminal-green)'
    : pct >= 50 ? 'var(--terminal-blue)'
    : pct >= 20 ? 'var(--terminal-yellow)'
    : 'var(--terminal-text)';

  return (
    <div
      className="flex flex-col items-end gap-1.5 w-32"
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${done} de ${total} palpites feitos (${pct}%)`}
    >
      <div className="flex items-baseline gap-1 tabular-nums">
        <span className={`${variant === 'modal' ? 'text-lg' : 'text-xl'} font-bold leading-none ${colorClass}`}>
          {done}
        </span>
        <span className="text-xs opacity-50 font-medium">/ {total}</span>
        <span className="text-[10px] opacity-50 ml-1">{pct}%</span>
        {isComplete && <span className="text-xs ml-0.5">✓</span>}
      </div>
      <div className="w-full h-2 rounded-full bg-black/50 border border-terminal-border-subtle overflow-hidden">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: done > 0 ? `max(4px, ${pct}%)` : '0%',
            backgroundColor: barColorVar,
          }}
        />
      </div>
    </div>
  );
};
