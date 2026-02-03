import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Bet } from '@/hooks/use-bets';
import { formatChartAxis } from '@/utils/chartFormatters';

const FILL_POSITIVE = '#5b9bd5';
const FILL_NEGATIVE = '#e57373';

export interface BetWithTags extends Bet {
  tags?: { id: string; name: string; color?: string }[];
}

function profitForBet(bet: Bet): number {
  if (bet.status === 'won') return bet.potential_return - bet.stake_amount;
  if (bet.status === 'lost') return -bet.stake_amount;
  if (bet.status === 'cashout' && bet.cashout_amount != null)
    return bet.cashout_amount - bet.stake_amount;
  if (bet.status === 'half_won')
    return (bet.stake_amount + bet.potential_return) / 2 - bet.stake_amount;
  if (bet.status === 'half_lost') return bet.stake_amount / 2 - bet.stake_amount;
  return 0;
}

interface ProfitByTagChartProps {
  bets: BetWithTags[];
  formatValue?: (value: number) => string;
  chartHeight?: number;
}

export const ProfitByTagChart: React.FC<ProfitByTagChartProps> = ({
  bets,
  formatValue = (v) => `R$ ${v.toFixed(2)}`,
  chartHeight = 280,
}) => {
  const data = useMemo(() => {
    const settled = bets.filter((b) =>
      ['won', 'lost', 'cashout', 'half_won', 'half_lost'].includes(b.status)
    );
    const byTag = new Map<string, number>();
    settled.forEach((bet) => {
      const profit = profitForBet(bet);
      const tags = (bet as BetWithTags).tags ?? [];
      if (tags.length === 0) {
        const key = 'Sem tag';
        byTag.set(key, (byTag.get(key) ?? 0) + profit);
      } else {
        tags.forEach((tag) => {
          const name = tag.name || tag.id;
          byTag.set(name, (byTag.get(name) ?? 0) + profit);
        });
      }
    });
    return Array.from(byTag.entries())
      .map(([name, profit]) => ({ name, profit: Number(profit.toFixed(2)) }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  }, [bets]);

  if (data.length === 0) {
    return (
      <div className="terminal-container p-4 mb-6">
        <h3 className="section-title mb-2">LUCRO POR TAG</h3>
        <p className="text-xs opacity-60">Nenhuma aposta encerrada no período</p>
      </div>
    );
  }

  return (
    <div className="terminal-container p-4 mb-6">
      <h3 className="section-title mb-4">LUCRO POR TAG</h3>
      <div style={{ height: chartHeight }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
            <XAxis
              type="number"
              stroke="#666"
              tick={{ fill: 'var(--terminal-text)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatChartAxis(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              stroke="#666"
              tick={{ fill: 'var(--terminal-text)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '4px',
                color: '#fff',
              }}
              formatter={(value: number) => [formatValue(value), 'Lucro']}
              labelFormatter={(label) => label}
            />
            <Bar
              dataKey="profit"
              radius={[0, 4, 4, 0]}
              name="Lucro"
              animationDuration={400}
              animationEasing="ease-out"
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.profit >= 0 ? FILL_POSITIVE : FILL_NEGATIVE} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
