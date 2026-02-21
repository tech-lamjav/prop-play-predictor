import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TrendingUp, Save, Edit2 } from 'lucide-react';
import { Bet } from '@/hooks/use-bets';
import type { CapitalMovement } from '@/hooks/use-capital-movements';

interface BankrollEvolutionChartProps {
  bets: Bet[];
  initialBankroll: number | null;
  onUpdateBankroll: (amount: number) => Promise<boolean>;
  /** Capital movements (aportes/resgates) to include in timeline. Only affects_balance=true are applied to balance. */
  capitalMovements?: CapitalMovement[];
  /** When true, hide initial bankroll edit and show as "Lucro acumulado no período" (e.g. for dashboard period view). */
  readOnly?: boolean;
  /** Optional: chart container height (responsive). */
  chartHeight?: number;
}

export const BankrollEvolutionChart: React.FC<BankrollEvolutionChartProps> = ({
  bets,
  initialBankroll,
  onUpdateBankroll,
  capitalMovements = [],
  readOnly = false,
  chartHeight = 300,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempBankroll, setTempBankroll] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (initialBankroll) {
      setTempBankroll(initialBankroll.toString());
    }
  }, [initialBankroll]);

  const chartData = useMemo(() => {
    const startAmount = initialBankroll || 0;

    const betEvents: { date: Date; profit: number; label: string }[] = bets
      .filter((bet) => ['won', 'lost', 'cashout', 'half_won', 'half_lost'].includes(bet.status))
      .map((bet) => {
        let profit = 0;
        if (bet.status === 'won') profit = bet.potential_return - bet.stake_amount;
        else if (bet.status === 'lost') profit = -bet.stake_amount;
        else if (bet.status === 'cashout' && bet.cashout_amount) profit = bet.cashout_amount - bet.stake_amount;
        else if (bet.status === 'half_won') profit = (bet.stake_amount + bet.potential_return) / 2 - bet.stake_amount;
        else if (bet.status === 'half_lost') profit = bet.stake_amount / 2 - bet.stake_amount;
        return { date: new Date(bet.bet_date), profit, label: bet.bet_description };
      });

    const movementEvents: { date: Date; profit: number; label: string }[] = capitalMovements
      .filter((m) => m.affects_balance)
      .map((m) => ({
        date: new Date(m.movement_date),
        profit: m.type === 'deposit' ? m.amount : -m.amount,
        label: m.type === 'deposit' ? 'Aporte' : 'Resgate',
      }));

    const allEvents = [...betEvents, ...movementEvents].sort((a, b) => a.date.getTime() - b.date.getTime());

    if (allEvents.length === 0) return [];

    let currentBankroll = startAmount;
    const data: { date: string; fullDate: string; bankroll: number; profit: number }[] = [
      { date: 'Início', fullDate: 'Início', bankroll: startAmount, profit: 0 },
    ];

    allEvents.forEach((ev) => {
      currentBankroll += ev.profit;
      const formattedDate = ev.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      data.push({
        date: formattedDate,
        fullDate: ev.date.toLocaleDateString('pt-BR'),
        bankroll: Number(currentBankroll.toFixed(2)),
        profit: ev.profit,
      });
    });

    return data;
  }, [bets, initialBankroll, capitalMovements]);

  const handleSave = async () => {
    const amount = parseFloat(tempBankroll);
    if (isNaN(amount) || amount < 0) return;

    setIsUpdating(true);
    const success = await onUpdateBankroll(amount);
    if (success) {
      setIsEditing(false);
    }
    setIsUpdating(false);
  };

  const currentBankroll = chartData.length > 0 ? chartData[chartData.length - 1].bankroll : (initialBankroll || 0);
  const totalProfit = currentBankroll - (initialBankroll || 0);
  const profitPercentage = initialBankroll ? (totalProfit / initialBankroll) * 100 : 0;

  const formatBRL = (value: number) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="terminal-container p-4 mb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="section-title flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-terminal-green" />
            {readOnly ? 'LUCRO ACUMULADO NO PERÍODO' : 'EVOLUÇÃO DA BANCA'}
          </h3>
          <p className="text-xs opacity-60 mt-1">
            {readOnly ? 'Evolução do lucro no intervalo selecionado' : 'Acompanhe o crescimento do seu capital'}
          </p>
        </div>

        <div className="flex items-center gap-4 bg-terminal-dark-gray/50 p-2 rounded border border-terminal-border-subtle">
          {!readOnly && (
            <>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase opacity-50">Banca Inicial</span>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={tempBankroll}
                      onChange={(e) => setTempBankroll(e.target.value)}
                      className="w-24 bg-terminal-black border border-terminal-border text-xs p-1 rounded text-terminal-text"
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isUpdating}
                      className="p-1 hover:text-terminal-green transition-colors"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-terminal-text">
                      R$ {initialBankroll != null ? formatBRL(initialBankroll) : '0,00'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="p-1 opacity-50 hover:opacity-100 hover:text-terminal-blue transition-opacity"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <div className="h-8 w-px bg-terminal-border-subtle mx-2" />
            </>
          )}

          <div className="flex flex-col">
            <span className="text-[10px] uppercase opacity-50">{readOnly ? 'Lucro no período' : 'Banca Atual'}</span>
            <span className={`font-mono font-bold ${totalProfit >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
              R$ {formatBRL(currentBankroll)}
            </span>
          </div>

          <div className="flex flex-col text-right">
            <span className="text-[10px] uppercase opacity-50">Lucro</span>
            <span className={`font-mono text-xs ${totalProfit >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
              {totalProfit >= 0 ? '+' : ''}{formatBRL(totalProfit)}
              {!readOnly && initialBankroll ? ` (${profitPercentage >= 0 ? '+' : ''}${profitPercentage.toFixed(1)}%)` : ''}
            </span>
          </div>
        </div>
      </div>

      <div style={{ height: chartHeight }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorBankroll" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#666"
              tick={{ fill: 'var(--terminal-text)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={30}
            />
            <YAxis
              stroke="#666"
              tick={{ fill: 'var(--terminal-text)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `R$${formatBRL(value)}`}
              domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.05)]}
              allowDataOverflow={false}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#0a0a0a', 
                border: '1px solid #333',
                borderRadius: '4px',
                color: '#fff'
              }}
              itemStyle={{ color: '#00d4ff' }}
              formatter={(value: number) => [`R$ ${formatBRL(value)}`, 'Banca']}
              labelFormatter={(label, payload) => {
                if (payload && payload.length > 0) {
                  return payload[0].payload.fullDate;
                }
                return label;
              }}
            />
            <Area
              type="monotone"
              dataKey="bankroll"
              stroke="#00d4ff"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorBankroll)"
              animationDuration={500}
              animationEasing="ease-in-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
