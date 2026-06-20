import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { Narrative } from '@/utils/dashboardAggregations';
import { InsightIcon } from './InsightIcon';

interface BetinhoNarrativeProps {
  narrative: Narrative;
  /** Habilita o botão "Atualizar análise" (placeholder enquanto a IA real não chega). */
  onRefresh?: () => void;
}

const splitHeadline = (
  headline: string,
  highlight: Narrative['headlineHighlight']
): { before: string; mark: string; after: string } | null => {
  if (!highlight) return null;
  const idx = headline.indexOf(highlight.text);
  if (idx === -1) return null;
  return {
    before: headline.slice(0, idx),
    mark: highlight.text,
    after: headline.slice(idx + highlight.text.length),
  };
};

export const BetinhoNarrative: React.FC<BetinhoNarrativeProps> = ({ narrative, onRefresh }) => {
  const split = splitHeadline(narrative.headline, narrative.headlineHighlight);
  const highlightTone = narrative.headlineHighlight?.tone ?? 'positive';
  const highlightColor = highlightTone === 'negative' ? 'text-rose-300' : 'text-amber-400';

  return (
    <div className="relative overflow-hidden rounded-xl bg-forest text-white">
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '8px 8px',
        }}
      />
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-full bg-amber-400 text-forest grid place-items-center text-[18px] font-bold shrink-0">
            B
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400 font-extrabold leading-tight">
              Betinho · {narrative.eyebrow}
            </div>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="h-8 px-3 rounded-md bg-amber-400 hover:bg-amber-300 text-forest font-extrabold text-[11px] flex items-center gap-1.5 transition-colors shrink-0"
              title="Personalizar análise (período + foco)"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span className="hidden sm:inline">Personalizar</span>
            </button>
          )}
        </div>

        {/* Body */}
        {narrative.hasEnoughData ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2
                className="text-[20px] md:text-[22px] font-extrabold leading-tight"
                style={{ letterSpacing: '-0.01em' }}
              >
                {split ? (
                  <>
                    {split.before}
                    <span className={highlightColor}>{split.mark}</span>
                    {split.after}
                  </>
                ) : (
                  narrative.headline
                )}
              </h2>
              <p className="text-[13px] text-white/85 leading-relaxed mt-3">
                {narrative.body.map((seg, i) => (
                  <span
                    key={i}
                    className={
                      seg.tone === 'positive'
                        ? 'text-amber-400 font-bold'
                        : seg.tone === 'negative'
                          ? 'text-rose-300 font-bold'
                          : undefined
                    }
                  >
                    {seg.text}
                  </span>
                ))}
              </p>
            </div>

            <div className="space-y-2">
              {narrative.bullets.map((bullet, i) => {
                const iconColor =
                  bullet.highlightTone === 'negative'
                    ? 'text-rose-300'
                    : bullet.highlightTone === 'positive'
                      ? 'text-amber-400'
                      : 'text-white/70';
                return (
                <div
                  key={i}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 flex items-start gap-2"
                >
                  <InsightIcon
                    name={bullet.icon}
                    className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`}
                  />
                  <div className="flex-1 text-[12px] leading-snug">
                    <span className="text-white/85">{bullet.text}</span>{' '}
                    {bullet.highlight && (
                      <span
                        className={`font-bold ${
                          bullet.highlightTone === 'negative'
                            ? 'text-rose-300'
                            : bullet.highlightTone === 'positive'
                              ? 'text-amber-400'
                              : 'text-white'
                        }`}
                      >
                        {bullet.highlight}
                      </span>
                    )}
                  </div>
                </div>
                );
              })}
              {narrative.bullets.length === 0 && (
                <div className="text-[12px] text-white/60 italic">
                  Sem padrões suficientemente fortes pra destacar.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h2
              className="text-[18px] md:text-[20px] font-extrabold leading-tight"
              style={{ letterSpacing: '-0.01em' }}
            >
              {narrative.headline}
            </h2>
            <p className="text-[13px] text-white/80 leading-relaxed mt-2 max-w-xl">
              {narrative.body.map((seg, i) => (
                <span
                  key={i}
                  className={
                    seg.tone === 'positive'
                      ? 'text-amber-400 font-bold'
                      : seg.tone === 'negative'
                        ? 'text-rose-300 font-bold'
                        : undefined
                  }
                >
                  {seg.text}
                </span>
              ))}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
