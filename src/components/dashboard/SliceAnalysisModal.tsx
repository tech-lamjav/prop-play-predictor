import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sparkles, X, ArrowRight } from 'lucide-react';
import { compactify, type SliceNarrative } from '@/utils/dashboardAggregations';
import { InsightIcon } from './InsightIcon';

interface SliceAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  narrative: SliceNarrative | null;
  onViewAllBets?: () => void;
}

const toneColor = (tone?: 'positive' | 'negative' | 'neutral') => {
  if (tone === 'positive') return 'text-forest';
  if (tone === 'negative') return 'text-rose-700';
  return 'text-ink';
};

export const SliceAnalysisModal: React.FC<SliceAnalysisModalProps> = ({
  open,
  onOpenChange,
  narrative,
  onViewAllBets,
}) => {
  if (!narrative) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-rebrand bg-white border-line p-0 overflow-hidden max-w-lg shadow-[0_30px_60px_-20px_rgba(0,0,0,0.3)] [&>button]:hidden">
        {/* Header forest */}
        <div className="relative overflow-hidden bg-forest text-white px-6 py-5">
          <div
            className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '8px 8px',
            }}
          />
          <div className="relative flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-amber-400 text-forest grid place-items-center text-[18px] font-bold shrink-0">
              B
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400 font-bold">
                {narrative.eyebrow}
              </div>
              <DialogTitle className="text-[18px] font-extrabold tracking-tight leading-tight mt-0.5 truncate">
                {narrative.title}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-white/65 mt-1">
                Análise derivada dos seus dados
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 grid place-items-center shrink-0 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {narrative.totalBets === 0 ? (
            <p className="text-[13px] text-ink-2">{narrative.paragraph}</p>
          ) : (
            <>
              {/* Metrics row */}
              <div className="grid grid-cols-4 gap-2 mb-5">
                {narrative.metrics.map((m, i) => (
                  <div key={i} className="bg-ink-3/40 border border-line/60 rounded-lg p-2.5 min-w-0 overflow-hidden">
                    <div className="text-[9px] uppercase tracking-[0.14em] text-ink-2 font-bold truncate">
                      {m.label}
                    </div>
                    <div
                      className={`text-[14px] sm:text-[15px] font-bold tabular mt-0.5 truncate whitespace-nowrap ${toneColor(m.tone)}`}
                      title={m.value}
                    >
                      {compactify(m.value)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Paragraph */}
              <p className="text-[13px] text-ink leading-relaxed">{narrative.paragraph}</p>

              {/* Insights */}
              {narrative.insights.length > 0 && (
                <div className="mt-5 pt-5 border-t border-line space-y-2">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-amber-700 font-bold">
                    Pontos de atenção
                  </div>
                  {narrative.insights.map((ins, i) => {
                    const iconColor =
                      ins.icon === 'flame'
                        ? 'text-forest'
                        : ins.icon === 'snowflake'
                          ? 'text-rose-700'
                          : 'text-amber-700';
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-2 bg-ink-3/30 border border-line/60 rounded-lg px-3 py-2"
                      >
                        <InsightIcon
                          name={ins.icon}
                          className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`}
                        />
                        <span className="text-[12px] text-ink leading-snug">{ins.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer CTA */}
              <div className="mt-5 pt-5 border-t border-line flex gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="h-10 px-4 rounded-md border border-line text-[12px] font-bold text-ink-2 hover:text-ink hover:bg-ink-3/40 transition-colors flex-1"
                >
                  Fechar
                </button>
                {onViewAllBets && (
                  <button
                    type="button"
                    onClick={() => {
                      onViewAllBets();
                      onOpenChange(false);
                    }}
                    className="h-10 px-5 rounded-md bg-amber-400 text-forest font-bold text-[12px] hover:bg-amber-300 transition-colors flex-[2] flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {narrative.totalBets === 1 ? 'Ver a aposta' : `Ver todas as ${narrative.totalBets} apostas`}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
