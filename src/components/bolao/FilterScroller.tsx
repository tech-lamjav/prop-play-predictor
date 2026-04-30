import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface FilterScrollerProps {
  children: React.ReactNode;
  /** Optional icon shown before children (e.g. <Filter />) */
  filterIcon?: React.ReactNode;
  className?: string;
}

/**
 * Horizontal scrollable filter bar with fade-gradient + arrow indicators
 * when content overflows. Mirrors the pattern from NBADashboard tabs.
 *
 * Reacts to:
 *  - native scroll events
 *  - window resize
 *  - ResizeObserver on the scroller and inner track (catches font load,
 *    content add/remove)
 */
export const FilterScroller: React.FC<FilterScrollerProps> = ({ children, filterIcon, className }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // Recompute after children change (e.g. groups load async)
  useLayoutEffect(() => {
    update();
  }, [children]);

  const scrollBy = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  return (
    <div className={`relative mb-6 ${className ?? ''}`}>
      {/* Left fade + arrow */}
      {canLeft && (
        <>
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-canvas via-canvas/80 to-transparent z-10" />
          <button
            type="button"
            onClick={() => scrollBy('left')}
            aria-label="Rolar filtros para a esquerda"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-7 w-7 flex items-center justify-center rounded-full bg-white border border-line shadow-sm text-ink-2 hover:text-ink hover:bg-canvas-2 hover:border-line-2 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      {/* Right fade + arrow */}
      {canRight && (
        <>
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-canvas via-canvas/80 to-transparent z-10" />
          <button
            type="button"
            onClick={() => scrollBy('right')}
            aria-label="Rolar filtros para a direita"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-7 w-7 flex items-center justify-center rounded-full bg-white border border-line shadow-sm text-ink-2 hover:text-ink hover:bg-canvas-2 hover:border-line-2 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {filterIcon}
        {children}
      </div>
    </div>
  );
};
