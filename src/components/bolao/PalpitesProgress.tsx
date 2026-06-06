import React from 'react';

interface PalpitesProgressProps {
  done: number;
  total: number;
  /** "modal" = dentro do dialog (cabeçalho compacto). "page" = dentro de página (mais espaço) */
  variant?: 'modal' | 'page';
  /**
   * Quando presente e ainda há pendentes, o indicador vira clicável (ex.: pular
   * pra aba "Pendentes"). Sem isso, renderiza estático.
   */
  onClick?: () => void;
}

/**
 * Indicador de progresso dos palpites.
 * Número grande + barra fina horizontal.
 *
 *  Fazer Palpites               12 / 72
 *  ████████░░░░░░░░░░░░░░░ 17%
 */
export const PalpitesProgress: React.FC<PalpitesProgressProps> = ({ done, total, variant = 'modal', onClick }) => {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const isComplete = total > 0 && done >= total;
  const clickable = !!onClick && !isComplete && total > 0;

  // Cor escala: ink-3 → amber → forest conforme progresso
  const colorClass =
    pct >= 80 ? 'text-forest'
    : pct >= 50 ? 'text-forest'
    : pct >= 20 ? 'text-amber-2'
    : 'text-ink-3';

  const Tag: any = clickable ? 'button' : 'div';

  return (
    <Tag
      type={clickable ? 'button' : undefined}
      onClick={clickable ? onClick : undefined}
      aria-label={
        clickable
          ? `${total - done} palpites faltando — ver pendentes`
          : `${done} de ${total} palpites feitos (${pct}%)`
      }
      className={`flex flex-col items-end gap-1.5 w-32 ${
        clickable ? 'group cursor-pointer rounded-rebrand-md -m-1 p-1 hover:bg-canvas-2 transition-colors' : ''
      }`}
      role={clickable ? undefined : 'progressbar'}
      aria-valuenow={clickable ? undefined : done}
      aria-valuemin={clickable ? undefined : 0}
      aria-valuemax={clickable ? undefined : total}
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
      {clickable && (
        <span className="text-[10px] font-semibold text-status-warning group-hover:underline underline-offset-2">
          ver {total - done} pendente{total - done !== 1 ? 's' : ''}
        </span>
      )}
    </Tag>
  );
};
