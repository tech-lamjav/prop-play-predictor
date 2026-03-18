import React, { useState, useMemo, useEffect } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { TrendingUp, Save, Edit2, ChevronRight, BarChart3, DollarSign } from 'lucide-react';
import { Bet } from '@/hooks/use-bets';
import type { CapitalMovement } from '@/hooks/use-capital-movements';

interface BankrollEvolutionChartProps {
  bets: Bet[];
  initialBankroll: number | null;
  onUpdateBankroll: (amount: number) => Promise<boolean>;
  capitalMovements?: CapitalMovement[];
  readOnly?: boolean;
  chartHeight?: number;
  onAporte?: () => void;
  onResgate?: () => void;
  onNavigateCashFlow?: () => void;
  onNavigateDashboard?: () => void;
}

export const BankrollEvolutionChart: React.FC<BankrollEvolutionChartProps> = ({
  bets,
  initialBankroll,
  onUpdateBankroll,
  capitalMovements = [],
  readOnly = false,
  chartHeight = 300,
  onAporte,
  onResgate,
  onNavigateCashFlow,
  onNavigateDashboard,
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

  const lineColor = totalProfit >= 0 ? '#4ade80' : '#e57373';

  return (
    <div className="terminal-container p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Chart - left */}
        <div className="md:w-3/4 min-w-0 pb-4 border-b border-terminal-border-subtle md:pb-0 md:border-b-0">
          <h3 className="section-title flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-terminal-green" />
            {readOnly ? 'LUCRO ACUMULADO NO PERÍODO' : 'EVOLUÇÃO DA BANCA'}
          </h3>

          <div style={{ height: chartHeight }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorBankroll" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={lineColor} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
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
                  itemStyle={{ color: lineColor }}
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
                  stroke={lineColor}
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

        {/* Side panel - right */}
        {!readOnly && (
          <div className="md:w-1/4 flex flex-col justify-between bg-terminal-dark-gray rounded-md p-4 md:border-l md:border-terminal-border-subtle">
            {/* Top section: title + banca info */}
            <div>
              {/* Panel title */}
              <h3 className="section-title flex items-center gap-2 mb-4">
                GESTÃO DA BANCA
              </h3>

              {/* Banca info - vertical rows */}
              <div className="flex flex-col gap-3">
                {/* Banca Inicial */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase opacity-50">Banca Inicial</span>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={tempBankroll}
                        onChange={(e) => setTempBankroll(e.target.value)}
                        className="w-24 bg-terminal-black border border-terminal-border text-sm p-1 rounded text-terminal-text text-right"
                        placeholder="0.00"
                      />
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isUpdating}
                        className="p-1 hover:text-terminal-green transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-terminal-text text-sm whitespace-nowrap">
                        R$ {initialBankroll != null ? formatBRL(initialBankroll) : '0,00'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="p-0.5 opacity-40 hover:opacity-100 hover:text-terminal-blue transition-all"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Banca Atual */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase opacity-50">Banca Atual</span>
                  <span className={`font-bold text-sm whitespace-nowrap ${totalProfit >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                    R$ {formatBRL(currentBankroll)}
                  </span>
                </div>

                {/* Lucro */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase opacity-50">Lucro</span>
                  <span className={`font-bold text-sm whitespace-nowrap ${totalProfit >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                    {totalProfit >= 0 ? '+' : '-'}R$ {formatBRL(Math.abs(totalProfit))}
                    {initialBankroll ? ` (${profitPercentage >= 0 ? '+' : ''}${profitPercentage.toFixed(1)}%)` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Middle section: Aporte / Resgate buttons */}
            {(onAporte || onResgate) && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                {onAporte && (
                  <button
                    type="button"
                    onClick={onAporte}
                    className="py-2 px-3 text-xs font-bold text-terminal-green bg-terminal-light-gray border border-terminal-green/60 rounded hover:bg-terminal-green/20 hover:border-terminal-green/90 hover:brightness-125 active:scale-95 transition-all text-center"
                  >
                    + Aporte
                  </button>
                )}
                {onResgate && (
                  <button
                    type="button"
                    onClick={onResgate}
                    className="py-2 px-3 text-xs font-bold text-terminal-red bg-terminal-light-gray border border-terminal-red/60 rounded hover:bg-terminal-red/20 hover:border-terminal-red/90 hover:brightness-125 active:scale-95 transition-all text-center"
                  >
                    − Resgate
                  </button>
                )}
              </div>
            )}

            {/* Bottom section: Navigation */}
            {(onNavigateCashFlow || onNavigateDashboard) && (
              <div className="flex flex-col gap-1.5 border-t border-terminal-border-subtle mt-4 pt-4">
                {onNavigateCashFlow && (
                  <button
                    type="button"
                    onClick={onNavigateCashFlow}
                    className="flex items-center justify-between py-2 px-2.5 text-xs text-terminal-text/70 hover:text-terminal-text transition-colors group rounded bg-terminal-gray border border-terminal-border-subtle hover:border-terminal-border"
                  >
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 opacity-50 group-hover:opacity-90 transition-opacity" />
                      <div className="text-left">
                        <div className="font-semibold text-sm">Fluxo de Caixa</div>
                        <div className="text-[10px] opacity-60">Histórico detalhado de transações</div>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-80 transition-opacity" />
                  </button>
                )}
                {onNavigateDashboard && (
                  <button
                    type="button"
                    onClick={onNavigateDashboard}
                    className="flex items-center justify-between py-2 px-2.5 text-xs text-terminal-text/70 hover:text-terminal-text transition-colors group rounded bg-terminal-gray border border-terminal-border-subtle hover:border-terminal-border"
                  >
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-3.5 h-3.5 opacity-50 group-hover:opacity-90 transition-opacity" />
                      <div className="text-left">
                        <div className="font-semibold text-sm">Dashboard</div>
                        <div className="text-[10px] opacity-60">KPIs e gráficos por período</div>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-30 group-hover:opacity-60 transition-opacity" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Read-only mode info */}
        {readOnly && (
          <div className="md:w-48 flex flex-col justify-center gap-2 md:border-l md:border-terminal-border-subtle md:pl-4">
            <div>
              <span className="text-[10px] uppercase opacity-50 block mb-0.5">Lucro no período</span>
              <span className={`font-mono font-bold ${totalProfit >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                R$ {formatBRL(currentBankroll)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase opacity-50 block mb-0.5">Lucro</span>
              <span className={`font-mono text-xs ${totalProfit >= 0 ? 'text-terminal-green' : 'text-terminal-red'}`}>
                {totalProfit >= 0 ? '+' : ''}{formatBRL(totalProfit)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
