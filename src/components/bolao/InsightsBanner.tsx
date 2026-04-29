import React, { useEffect, useMemo, useState } from 'react';
import { Flame, Target, Crosshair, Zap, X } from 'lucide-react';
import { useBolaoInsights, useMarkInsightsSeen } from '@/hooks/use-bolao';
import type { BolaoInsight } from '@/services/bolao.service';

interface InsightsBannerProps {
  bolaoId: string;
}

interface InsightVisual {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  borderColor: string;
  bgColor: string;
  label: string; // título curto do insight
  message: (i: BolaoInsight) => string; // texto contextual
}

const INSIGHT_VISUAL: Record<string, InsightVisual> = {
  rare_correct: {
    icon: Crosshair,
    iconColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/40',
    bgColor: 'bg-yellow-500/5',
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
    iconColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/40',
    bgColor: 'bg-yellow-500/5',
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
    iconColor: 'text-orange-400',
    borderColor: 'border-orange-400/40',
    bgColor: 'bg-orange-400/5',
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
    iconColor: 'text-terminal-blue',
    borderColor: 'border-terminal-blue/40',
    bgColor: 'bg-terminal-blue/5',
    label: 'Sequência de 3!',
    message: (i) => `Você acertou os últimos ${i.payload.streak ?? 3} palpites seguidos.`,
  },
  streak_5: {
    icon: Zap,
    iconColor: 'text-terminal-blue',
    borderColor: 'border-terminal-blue/40',
    bgColor: 'bg-terminal-blue/5',
    label: 'Sequência de 5!',
    message: (i) => `Você acertou os últimos ${i.payload.streak ?? 5} palpites seguidos. 🔥`,
  },
};

const FALLBACK_VISUAL: InsightVisual = {
  icon: Target,
  iconColor: 'text-terminal-text/70',
  borderColor: 'border-terminal-border',
  bgColor: 'bg-terminal-dark-gray/30',
  label: 'Insight',
  message: () => '',
};

/**
 * Banner que aparece em BolaoDetail com insights pós-jogo do user.
 * Carrossel horizontal scrollável com auto-mark seen quando user vê.
 *
 * Comportamento:
 *  - Não renderiza se não há insights
 *  - Marca como vistos depois de 4s na tela (delay pra user ler)
 *  - Cada card é dispensável individualmente
 */
export const InsightsBanner: React.FC<InsightsBannerProps> = ({ bolaoId }) => {
  const { data: insights } = useBolaoInsights(bolaoId);
  const markSeen = useMarkInsightsSeen();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const unseenIds = useMemo(
    () => (insights || []).filter(i => !i.seen && !dismissed.has(i.id)).map(i => i.id),
    [insights, dismissed]
  );

  // Auto-mark seen 4s depois de aparecer (delay pra ler)
  useEffect(() => {
    if (unseenIds.length === 0) return;
    const timer = setTimeout(() => {
      markSeen.mutate(unseenIds);
    }, 4000);
    return () => clearTimeout(timer);
  }, [unseenIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleInsights = useMemo(
    () => (insights || []).filter(i => !dismissed.has(i.id)).slice(0, 5),
    [insights, dismissed]
  );

  if (visibleInsights.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="text-[11px] font-bold uppercase tracking-wider opacity-50 mb-2">
        Sobre seus últimos palpites
      </p>
      <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {visibleInsights.map((i) => {
          const visual = INSIGHT_VISUAL[i.type] ?? FALLBACK_VISUAL;
          const Icon = visual.icon;
          return (
            <div
              key={i.id}
              className={`relative shrink-0 max-w-[80vw] sm:max-w-md flex items-start gap-3 p-3.5 pr-9 rounded-lg border ${visual.borderColor} ${visual.bgColor}`}
            >
              <div className={`w-9 h-9 rounded-full ${visual.bgColor} ${visual.borderColor} border flex items-center justify-center shrink-0`}>
                <Icon className={`w-4.5 h-4.5 ${visual.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${visual.iconColor}`}>{visual.label}</p>
                <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">
                  {visual.message(i)}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDismissed(prev => {
                    const next = new Set(prev);
                    next.add(i.id);
                    return next;
                  })
                }
                aria-label="Dispensar insight"
                className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded text-terminal-text/40 hover:text-terminal-text/80 hover:bg-terminal-gray/30 transition-colors"
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
