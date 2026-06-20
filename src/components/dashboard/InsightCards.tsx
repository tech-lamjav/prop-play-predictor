import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { DerivedInsight } from '@/utils/dashboardAggregations';
import { InsightIcon } from './InsightIcon';

interface InsightCardsProps {
  insights: DerivedInsight[];
  /** Disparado ao clicar no CTA "Ver como aplicar" — passa o insight pra o pai decidir. */
  onApplyInsight?: (insight: DerivedInsight) => void;
}

const TONE_CLASSES: Record<DerivedInsight['type'], { wrapper: string; label: string; cta: string; iconWrap: string; iconColor: string }> = {
  opportunity: {
    wrapper: 'bg-forest/5 border-forest/30',
    label: 'text-forest',
    cta: 'text-forest hover:text-forest-soft',
    iconWrap: 'bg-forest/10',
    iconColor: 'text-forest',
  },
  warning: {
    wrapper: 'bg-rose-50 border-rose-200',
    label: 'text-rose-700',
    cta: 'text-rose-700 hover:text-rose-900',
    iconWrap: 'bg-rose-100',
    iconColor: 'text-rose-700',
  },
  discipline: {
    wrapper: 'bg-amber-50 border-amber-200',
    label: 'text-amber-700',
    cta: 'text-amber-700 hover:text-amber-900',
    iconWrap: 'bg-amber-100',
    iconColor: 'text-amber-700',
  },
};

const CTA_TEXT: Record<DerivedInsight['type'], string> = {
  opportunity: 'Ver fatia no mapa',
  warning: 'Ver fatia no mapa',
  discipline: 'Revisar disciplina',
};

export const InsightCards: React.FC<InsightCardsProps> = ({ insights, onApplyInsight }) => {
  if (insights.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-amber-700 font-extrabold">
            Plano de ação
          </div>
          <h2 className="text-[16px] font-extrabold tracking-tight text-ink mt-0.5">
            {insights.length} {insights.length === 1 ? 'movimento que aumentaria' : 'movimentos que aumentariam'} seu ROI
          </h2>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {insights.map((insight, i) => {
          const tone = TONE_CLASSES[insight.type];
          return (
            <div
              key={i}
              className={`rounded-xl border p-4 ${tone.wrapper}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-md grid place-items-center ${tone.iconWrap}`}>
                  <InsightIcon name={insight.icon} className={`w-4 h-4 ${tone.iconColor}`} />
                </div>
                <div className={`text-[9px] uppercase tracking-[0.14em] font-extrabold ${tone.label}`}>
                  {insight.label}
                </div>
              </div>
              <div className="text-[13px] font-extrabold text-ink leading-tight mb-1.5">{insight.title}</div>
              <div className="text-[11px] text-ink-2 leading-snug">{insight.body}</div>
              {onApplyInsight && (
                <button
                  type="button"
                  onClick={() => onApplyInsight(insight)}
                  className={`mt-3 inline-flex items-center gap-1 text-[11px] font-bold transition-colors ${tone.cta}`}
                >
                  {CTA_TEXT[insight.type]}
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
