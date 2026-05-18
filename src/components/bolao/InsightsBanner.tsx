import React, { useEffect, useMemo, useState } from 'react';
import { Flame, Target, Crosshair, Zap, X } from 'lucide-react';
import { useBolaoInsights, useMarkInsightsSeen } from '@/hooks/use-bolao';
import type { BolaoInsight } from '@/services/bolao.service';

interface InsightsBannerProps {
  bolaoId: string;
}

interface InsightVisual {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string; // text + bg fundo do círculo do ícone
  borderClass: string; // borda do card
  label: string;
  message: (i: BolaoInsight) => string;
}

const INSIGHT_VISUAL: Record<string, InsightVisual> = {
  rare_correct: {
    icon: Crosshair,
    iconClass: 'text-amber-2 bg-amber/15',
    borderClass: 'border-amber/40',
    label: 'Cravou!',
    message: (i) => {
      const exact = i.payload.exact_count ?? 0;
      const total = i.payload.total_predictions ?? 0;
      const matchInfo = i.match_home_team && i.match_away_team
        ? ` em ${i.match_home_team} ${i.match_home_score}×${i.match_away_score} ${i.match_away_team}`
        : '';
      return `Você foi 1 de ${exact} de ${total} que cravaram o placar${matchInfo}.`;
    },
  },
  exact_score_lonely: {
    icon: Crosshair,
    iconClass: 'text-amber-2 bg-amber/15',
    borderClass: 'border-amber/40',
    label: 'Placar exato!',
    message: (i) => {
      const pct = i.payload.percentage ?? 0;
      const matchInfo = i.match_home_team && i.match_away_team
        ? ` em ${i.match_home_team} ${i.match_home_score}×${i.match_away_score} ${i.match_away_team}`
        : '';
      return `Só ${pct}% do bolão cravou o placar${matchInfo}. Você foi um deles.`;
    },
  },
  majority_wrong: {
    icon: Flame,
    iconClass: 'text-status-warning bg-status-warning/15',
    borderClass: 'border-status-warning/40',
    label: 'Contra a maré',
    message: (i) => {
      const pct = i.payload.wrong_percentage ?? 0;
      const matchInfo = i.match_home_team && i.match_away_team
        ? ` em ${i.match_home_team} ${i.match_home_score}×${i.match_away_score} ${i.match_away_team}`
        : '';
      return `${pct}% do bolão errou${matchInfo}. Você acertou.`;
    },
  },
  streak_3: {
    icon: Zap,
    iconClass: 'text-status-info bg-status-info/15',
    borderClass: 'border-status-info/40',
    label: 'Sequência de 3!',
    message: (i) => `Você acertou os últimos ${i.payload.streak ?? 3} palpites seguidos.`,
  },
  streak_5: {
    icon: Zap,
    iconClass: 'text-status-info bg-status-info/15',
    borderClass: 'border-status-info/40',
    label: 'Sequência de 5!',
    message: (i) => `Você acertou os últimos ${i.payload.streak ?? 5} palpites seguidos.`,
  },
};

const FALLBACK_VISUAL: InsightVisual = {
  icon: Target,
  iconClass: 'text-ink-2 bg-canvas-2',
  borderClass: 'border-line',
  label: 'Insight',
  message: () => '',
};

/**
 * Banner que aparece em BolaoDetail com insights pós-jogo do user.
 * Carrossel horizontal scrollável com auto-mark seen quando user vê.
 */
export const InsightsBanner: React.FC<InsightsBannerProps> = ({ bolaoId }) => {
  const { data: insights } = useBolaoInsights(bolaoId);
  const markSeen = useMarkInsightsSeen();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const unseenIds = useMemo(
    () => (insights || []).filter((i) => !i.seen && !dismissed.has(i.id)).map((i) => i.id),
    [insights, dismissed]
  );

  useEffect(() => {
    if (unseenIds.length === 0) return;
    const timer = setTimeout(() => {
      markSeen.mutate(unseenIds);
    }, 4000);
    return () => clearTimeout(timer);
  }, [unseenIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleInsights = useMemo(
    () => (insights || []).filter((i) => !dismissed.has(i.id)).slice(0, 5),
    [insights, dismissed]
  );

  if (visibleInsights.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-2 mb-2">
        Sobre seus últimos palpites
      </p>
      <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {visibleInsights.map((i) => {
          const visual = INSIGHT_VISUAL[i.type] ?? FALLBACK_VISUAL;
          const Icon = visual.icon;
          return (
            <div
              key={i.id}
              className={`relative shrink-0 max-w-[80vw] sm:max-w-md flex items-start gap-3 p-3.5 pr-9 rounded-rebrand-md border bg-white ${visual.borderClass}`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${visual.iconClass}`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-ink">{visual.label}</p>
                <p className="text-[11px] text-ink-2 mt-0.5 leading-relaxed">
                  {visual.message(i)}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDismissed((prev) => {
                    const next = new Set(prev);
                    next.add(i.id);
                    return next;
                  })
                }
                aria-label="Dispensar insight"
                className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded text-ink-3 hover:text-ink hover:bg-canvas-2 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
