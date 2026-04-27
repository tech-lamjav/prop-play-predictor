import React, { useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';

interface PendingPredictionsStickyProps {
  /** Total de jogos jogáveis (não finalizados, sem TBD) */
  totalAvailable: number;
  /** Total de palpites já feitos */
  totalDone: number;
  /** ID do próximo jogo não palpitado (pra scroll) — se null, esconde botão */
  nextMatchId: number | null;
  /** Threshold de scroll antes de aparecer (default: 240px) */
  scrollThreshold?: number;
}

/**
 * Sticky bar that appears once user scrolls past the header, reminding
 * them how many predictions are still missing and offering a "Próximo"
 * button that smooth-scrolls to the next un-predicted match.
 *
 * Design: respeitoso. Não bloqueia conteúdo, fica fixo no topo,
 * desaparece quando todos os palpites foram feitos.
 */
export const PendingPredictionsSticky: React.FC<PendingPredictionsStickyProps> = ({
  totalAvailable,
  totalDone,
  nextMatchId,
  scrollThreshold = 240,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > scrollThreshold);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [scrollThreshold]);

  const pending = Math.max(0, totalAvailable - totalDone);
  const pct = totalAvailable > 0 ? Math.round((totalDone / totalAvailable) * 100) : 0;

  // Don't render if everything done — no nag.
  if (pending === 0) return null;
  if (!visible) return null;

  const handleNext = () => {
    if (nextMatchId == null) return;
    const el = document.getElementById(`match-${nextMatchId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Brief flash to draw attention to the target card
    el.classList.add('ring-2', 'ring-terminal-blue/60');
    setTimeout(() => {
      el.classList.remove('ring-2', 'ring-terminal-blue/60');
    }, 1500);
  };

  return (
    <div
      className="fixed top-0 inset-x-0 z-30 bg-terminal-bg/95 backdrop-blur-sm border-b border-terminal-border-subtle shadow-md"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs font-semibold">
              <span className="text-terminal-blue">{pending}</span>{' '}
              <span className="opacity-70">{pending === 1 ? 'palpite faltando' : 'palpites faltando'}</span>
            </p>
            <span className="text-[10px] opacity-50 tabular-nums shrink-0">
              {totalDone}/{totalAvailable} ({pct}%)
            </span>
          </div>
          <div className="h-1 rounded-full bg-terminal-border-subtle overflow-hidden">
            <div
              className="h-full bg-terminal-blue transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {nextMatchId != null && (
          <button
            type="button"
            onClick={handleNext}
            aria-label="Ir para o próximo jogo sem palpite"
            className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-lg border border-terminal-blue/40 bg-terminal-blue/10 text-terminal-blue hover:bg-terminal-blue/20 active:bg-terminal-blue/30 text-xs font-bold transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            Próximo
          </button>
        )}
      </div>
    </div>
  );
};
