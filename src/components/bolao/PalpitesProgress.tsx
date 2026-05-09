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

  // Cor escala: ink-3 → amber → forest conforme progresso
  const colorClass =
    pct >= 80 ? 'text-forest'
    : pct >= 50 ? 'text-forest'
    : pct >= 20 ? 'text-amber-2'
    : 'text-ink-3';

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
        <span className="text-[12px] text-ink-2 font-medium">/ {total}</span>
        <span className="text-[10px] text-ink-3 ml-1">{pct}%</span>
        {isComplete && <span className="text-[12px] ml-0.5 text-forest" aria-hidden="true">✓</span>}
      </div>
      <div className="w-full h-2 rounded-full bg-canvas-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ease-out ${pct >= 20 && pct < 50 ? 'bg-amber' : pct < 20 ? 'bg-ink-3' : 'bg-forest'}`}
          style={{
            width: done > 0 ? `max(4px, ${pct}%)` : '0%',
          }}
        />
      </div>
    </div>
  );
};
