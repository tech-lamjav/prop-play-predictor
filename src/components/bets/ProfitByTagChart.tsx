import React, { useMemo, useState } from 'react';
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
const MAX_BARS_DEFAULT = 10;
const MAX_BARS_FILTERED = 20;

export interface BetWithTags extends Bet {
  tags?: { id: string; name: string; color?: string }[];
}

interface TagEntry {
  name: string;
  profit: number;
  color?: string;
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
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);

  const fullSeries = useMemo(() => {
    const settled = bets.filter((b) =>
      ['won', 'lost', 'cashout', 'half_won', 'half_lost'].includes(b.status)
    );
    const byTag = new Map<string, { profit: number; color?: string }>();
    settled.forEach((bet) => {
      const profit = profitForBet(bet);
      const tags = (bet as BetWithTags).tags ?? [];
      if (tags.length === 0) {
        const key = 'Sem tag';
        const prev = byTag.get(key);
        byTag.set(key, {
          profit: (prev?.profit ?? 0) + profit,
          color: prev?.color,
        });
      } else {
        tags.forEach((tag) => {
          const name = tag.name || tag.id;
          const prev = byTag.get(name);
          byTag.set(name, {
            profit: (prev?.profit ?? 0) + profit,
            color: prev?.color ?? tag.color,
          });
        });
      }
    });
    return Array.from(byTag.entries())
      .map(([name, { profit, color }]) => ({
        name,
        profit: Number(profit.toFixed(2)),
        color,
      }))
      .sort((a, b) => b.profit - a.profit);
  }, [bets]);

  const availableTags = fullSeries;

  const chartData = useMemo(() => {
    if (selectedTagNames.length === 0) {
      return fullSeries.slice(0, MAX_BARS_DEFAULT);
    }
    const filtered = fullSeries.filter((entry) =>
      selectedTagNames.includes(entry.name)
    );
    return filtered.slice(0, MAX_BARS_FILTERED);
  }, [fullSeries, selectedTagNames]);

  const toggleTag = (name: string) => {
    setSelectedTagNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const clearSelection = () => setSelectedTagNames([]);

  if (fullSeries.length === 0) {
    return (
      <div className="terminal-container p-4 mb-6">
        <h3 className="section-title mb-2">LUCRO POR TAG</h3>
        <p className="text-xs opacity-60">Nenhuma aposta encerrada no período</p>
      </div>
    );
  }

  const hasSelection = selectedTagNames.length > 0;
  const showEmptyFilteredMessage = hasSelection && chartData.length === 0;

  return (
    <div className="terminal-container p-4 mb-6">
      <h3 className="section-title mb-4">LUCRO POR TAG</h3>

      <div className="flex flex-wrap gap-2 mb-3">
        {availableTags.map((entry) => {
          const selected = selectedTagNames.includes(entry.name);
          return (
            <button
              key={entry.name}
              type="button"
              onClick={() => toggleTag(entry.name)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                selected
                  ? 'bg-terminal-dark-gray border-terminal-green text-terminal-text'
                  : 'border-terminal-border text-terminal-text opacity-70 hover:opacity-100 hover:border-terminal-border/80'
              }`}
            >
              {entry.color != null && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
              )}
              <span>{entry.name}</span>
            </button>
          );
        })}
        {hasSelection && (
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium border border-terminal-border text-terminal-text opacity-70 hover:opacity-100 hover:border-terminal-green transition-colors"
          >
            Limpar
          </button>
        )}
      </div>

      {showEmptyFilteredMessage ? (
        <p className="text-xs opacity-60 py-4">Nenhum dado para as tags selecionadas</p>
      ) : (
        <div style={{ height: chartHeight }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8 }}>
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
                  color: '#e5e5e5',
                }}
                labelStyle={{ color: '#e5e5e5' }}
                itemStyle={{ color: '#e5e5e5' }}
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
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.profit >= 0 ? FILL_POSITIVE : FILL_NEGATIVE} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
