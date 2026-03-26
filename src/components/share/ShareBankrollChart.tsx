import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ShareResolveBet } from '@/hooks/use-share-resolve';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ShareBankrollChartProps {
  bets: ShareResolveBet[];
}

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

export const ShareBankrollChart: React.FC<ShareBankrollChartProps> = ({ bets }) => {
  const chartData = useMemo(() => {
    const settled = bets
      .filter((b) =>
        ['won', 'lost', 'cashout', 'half_won', 'half_lost'].includes(b.status)
      )
      .map((b) => ({
        date: new Date(b.bet_date),
        profit: getBetProfit(b),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    let cumulative = 0;
    const result: { date: string; fullDate: string; balance: number }[] = [
      { date: 'Início', fullDate: 'Início', balance: 0 },
    ];

    for (const { date, profit } of settled) {
      cumulative += profit;
      result.push({
        date: format(date, 'dd/MM', { locale: ptBR }),
        fullDate: format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
        balance: cumulative,
      });
    }

    return result;
  }, [bets]);

  if (chartData.length <= 1) return null;

  return (
    <Card className="bg-terminal-dark-gray border-terminal-border">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-terminal-blue">
          Evolução do saldo acumulado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.5)"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.5)"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `R$ ${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--terminal-dark-gray)',
                  border: '1px solid var(--terminal-border)',
                  borderRadius: '4px',
                }}
                labelStyle={{ color: 'var(--terminal-text)' }}
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Saldo']}
                labelFormatter={(label) => label}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="var(--terminal-green)"
                strokeWidth={2}
                dot={{ fill: 'var(--terminal-green)', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
