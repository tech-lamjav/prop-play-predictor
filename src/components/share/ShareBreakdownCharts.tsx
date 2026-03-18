import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ShareResolveBet } from '@/hooks/use-share-resolve';

function getBetProfit(bet: ShareResolveBet): number {
  if (bet.status === 'won') return bet.potential_return - bet.stake_amount;
  if (bet.status === 'lost') return -bet.stake_amount;
  if (bet.status === 'cashout' && bet.cashout_amount != null)
    return bet.cashout_amount - bet.stake_amount;
  if (bet.status === 'half_won')
    return (bet.stake_amount + bet.potential_return) / 2 - bet.stake_amount;
  if (bet.status === 'half_lost') return bet.stake_amount / 2 - bet.stake_amount;
  return 0;
}

function formatAxis(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
}

interface ShareBreakdownChartsProps {
  bets: ShareResolveBet[];
}

export const ShareBreakdownCharts: React.FC<ShareBreakdownChartsProps> = ({ bets }) => {
  const bySport = useMemo(() => {
    const settled = bets.filter((b) =>
      ['won', 'lost', 'cashout', 'half_won', 'half_lost'].includes(b.status)
    );
    const countBySport = new Map<string, number>();
    const profitBySport = new Map<string, number>();
    settled.forEach((bet) => {
      const sport = bet.sport || 'Outros';
      countBySport.set(sport, (countBySport.get(sport) ?? 0) + 1);
      profitBySport.set(sport, (profitBySport.get(sport) ?? 0) + getBetProfit(bet));
    });
    return Array.from(profitBySport.entries())
      .filter(([name]) => (countBySport.get(name) ?? 0) >= 2)
      .map(([name, profit]) => ({ name, profit: Number(profit.toFixed(2)) }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 8);
  }, [bets]);

  const byLeague = useMemo(() => {
    const settled = bets.filter((b) =>
      ['won', 'lost', 'cashout', 'half_won', 'half_lost'].includes(b.status)
    );
    const countByLeague = new Map<string, number>();
    const profitByLeague = new Map<string, number>();
    settled.forEach((bet) => {
      const league = bet.league || 'Outros';
      countByLeague.set(league, (countByLeague.get(league) ?? 0) + 1);
      profitByLeague.set(league, (profitByLeague.get(league) ?? 0) + getBetProfit(bet));
    });
    return Array.from(profitByLeague.entries())
      .filter(([name]) => (countByLeague.get(name) ?? 0) >= 2)
      .map(([name, profit]) => ({ name, profit: Number(profit.toFixed(2)) }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 8);
  }, [bets]);

  const byMarket = useMemo(() => {
    const settled = bets.filter((b) =>
      ['won', 'lost', 'cashout', 'half_won', 'half_lost'].includes(b.status)
    );
    const countByMarket = new Map<string, number>();
    const profitByMarket = new Map<string, number>();
    settled.forEach((bet) => {
      const market = bet.betting_market || 'Outros';
      countByMarket.set(market, (countByMarket.get(market) ?? 0) + 1);
      profitByMarket.set(market, (profitByMarket.get(market) ?? 0) + getBetProfit(bet));
    });
    return Array.from(profitByMarket.entries())
      .filter(([name]) => (countByMarket.get(name) ?? 0) >= 2)
      .map(([name, profit]) => ({ name, profit: Number(profit.toFixed(2)) }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 8);
  }, [bets]);

  const charts = [
    { data: bySport, title: 'Por esporte' },
    { data: byLeague, title: 'Por liga' },
    { data: byMarket, title: 'Por mercado' },
  ].filter((c) => c.data.length > 0);

  if (charts.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {charts.map(({ data, title }) => (
        <Card key={title} className="bg-terminal-dark-gray border-terminal-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-terminal-blue">
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.1)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fontSize: 10 }}
                    tickFormatter={formatAxis}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    stroke="rgba(255,255,255,0.5)"
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--terminal-dark-gray)',
                      border: '1px solid var(--terminal-border)',
                      borderRadius: '4px',
                    }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Lucro']}
                  />
                  <Bar
                    dataKey="profit"
                    fill="var(--terminal-green)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
