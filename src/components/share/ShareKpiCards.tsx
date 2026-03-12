import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { statsForDateRange } from '@/utils/bettingStats';
import type { ShareResolveBet } from '@/hooks/use-share-resolve';
import type { Bet } from '@/hooks/use-bets';
import { TrendingUp, Target, Percent, Hash } from 'lucide-react';

interface ShareKpiCardsProps {
  bets: ShareResolveBet[];
}

export const ShareKpiCards: React.FC<ShareKpiCardsProps> = ({ bets }) => {
  const stats = statsForDateRange(bets as unknown as Bet[]);

  const cards = [
    {
      title: 'Lucro / Prejuízo',
      value: stats.profit,
      format: (v: number) => `R$ ${v >= 0 ? '' : '-'}${Math.abs(v).toFixed(2)}`,
      icon: TrendingUp,
      positive: stats.profit >= 0,
    },
    {
      title: 'ROI',
      value: stats.roi,
      format: (v: number) => `${v.toFixed(1)}%`,
      icon: Percent,
      positive: stats.roi >= 0,
    },
    {
      title: 'Taxa de Acerto',
      value: stats.winRate,
      format: (v: number) => `${v.toFixed(1)}%`,
      icon: Target,
      positive: true,
    },
    {
      title: 'Total de apostas',
      value: stats.totalBets,
      format: (v: number) => String(v),
      icon: Hash,
      positive: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.title}
            className="bg-terminal-dark-gray border-terminal-border"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-terminal-text/80">
                {card.title}
              </CardTitle>
              <Icon className="w-4 h-4 text-terminal-green/70" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <span
                className={
                  card.title === 'Lucro / Prejuízo'
                    ? card.positive
                      ? 'text-terminal-green text-lg font-semibold'
                      : 'text-terminal-red text-lg font-semibold'
                    : 'text-terminal-text text-lg font-semibold'
                }
              >
                {card.format(card.value)}
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
