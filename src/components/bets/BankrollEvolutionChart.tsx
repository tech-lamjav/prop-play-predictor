import React, { useState, useMemo, useEffect } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
  Label as RechartsLabel,
} from 'recharts';
import { Save, Edit2, Plus, ArrowDownCircle, ArrowUpCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Bet } from '@/hooks/use-bets';
import type { CapitalMovement } from '@/hooks/use-capital-movements';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface BankrollEvolutionChartProps {
  bets: Bet[];
  initialBankroll: number | null;
  onUpdateBankroll: (amount: number) => Promise<boolean>;
  capitalMovements?: CapitalMovement[];
  readOnly?: boolean;
  chartHeight?: number;
  onAporte?: () => void;
  onResgate?: () => void;
  /** Esconde o botão "Ver banca completa" — usar quando o componente já está dentro da própria página de banca. */
  hideViewFullButton?: boolean;
  /** Formata valor monetário (respeita toggle R$/u quando passado). Default: R$ X,XX. */
  formatValue?: (value: number) => string;
  /** Deprecated — fluxo de caixa agora vive no menu Betinho do BetsHeader. Mantido pra compat. */
  onNavigateCashFlow?: () => void;
  /** Deprecated — dashboard agora vive no menu Betinho do BetsHeader. Mantido pra compat. */
  onNavigateDashboard?: () => void;
}

type ChartPeriod = '7d' | '30d' | '90d' | 'all';

export const BankrollEvolutionChart: React.FC<BankrollEvolutionChartProps> = ({
  bets,
  initialBankroll,
  onUpdateBankroll,
  capitalMovements = [],
  readOnly = false,
  chartHeight = 240,
  onAporte,
  onResgate,
  hideViewFullButton = false,
  formatValue: formatValueProp,
}) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [tempBankroll, setTempBankroll] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [period, setPeriod] = useState<ChartPeriod>('30d');

  useEffect(() => {
    if (initialBankroll) {
      setTempBankroll(initialBankroll.toString());
    }
  }, [initialBankroll]);

  const chartData = useMemo(() => {
    const startAmount = initialBankroll || 0;

    const betEvents: { date: Date; profit: number; label: string }[] = bets
      .filter((bet) => ['won', 'lost', 'cashout', 'half_won', 'half_lost', 'void'].includes(bet.status))
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
    const data: { date: string; fullDate: string; bankroll: number; profit: number; ts: number }[] = [
      { date: 'Início', fullDate: 'Início', bankroll: startAmount, profit: 0, ts: allEvents[0].date.getTime() - 1 },
    ];

    allEvents.forEach((ev) => {
      currentBankroll += ev.profit;
      const formattedDate = ev.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      data.push({
        date: formattedDate,
        fullDate: ev.date.toLocaleDateString('pt-BR'),
        bankroll: Number(currentBankroll.toFixed(2)),
        profit: ev.profit,
        ts: ev.date.getTime(),
      });
    });

    return data;
  }, [bets, initialBankroll, capitalMovements]);

  // Filtra os dados por período (7d, 30d, 90d ou tudo). Mantém o ponto inicial pra preservar a baseline.
  // Quando o filtro resulta em só o ponto Início, retornamos um array vazio pra exibir empty state
  // (em vez de fallback silencioso pro histórico completo, que mascarava o filtro).
  const filteredChartData = useMemo(() => {
    if (chartData.length === 0 || period === 'all') return chartData;
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const filtered = chartData.filter((d, i) => i === 0 || d.ts >= cutoff);
    return filtered.length <= 1 ? [] : filtered;
  }, [chartData, period]);

  const periodHasNoEvents = chartData.length > 0 && filteredChartData.length === 0 && period !== 'all';

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

  // Banca atual usa SEMPRE chartData completo (não filtrado).
  // Não muda quando o usuário troca o período do gráfico.
  const currentBankroll = chartData.length > 0
    ? chartData[chartData.length - 1].bankroll
    : (initialBankroll || 0);
  const totalProfit = currentBankroll - (initialBankroll || 0);
  const profitPercentage = initialBankroll ? (totalProfit / initialBankroll) * 100 : 0;

  // Helpers de formatação — quando formatValueProp passado, respeita o toggle R$/u da página.
  // Sem prop: fallback BRL com prefixo R$.
  const formatV = (value: number): string => {
    if (formatValueProp) return formatValueProp(value);
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  // Versão short pra eixos/labels do chart — sem centavos quando inteiro.
  const formatVShort = (value: number): string => {
    if (formatValueProp) {
      // Remove ",00" final da string formatada se inteira
      const f = formatValueProp(value);
      return f.replace(/[,.]00\b/, '');
    }
    return `R$${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const lineColor = totalProfit >= 0 ? '#0a3d2e' : '#be123c';
  const lastIndex = filteredChartData.length - 1;

  // Sub line — texto descritivo do período
  const periodLabel: Record<ChartPeriod, string> = {
    '7d': 'Últimos 7 dias',
    '30d': 'Últimos 30 dias',
    '90d': 'Últimos 90 dias',
    'all': 'Tudo',
  };

  // Movimentos para info row na sidebar
  const balanceMovements = capitalMovements.filter(m => m.affects_balance);
  const deposits = balanceMovements.filter(m => m.type === 'deposit');
  const withdrawals = balanceMovements.filter(m => m.type === 'withdrawal');
  const netMovements = deposits.reduce((s, m) => s + m.amount, 0) - withdrawals.reduce((s, m) => s + m.amount, 0);

  return (
    <div className="bg-white border border-line rounded-lg overflow-hidden">
      {/* Header — title + sub + period pills */}
      <div className="px-5 py-3 border-b border-line flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold text-ink">
            {readOnly ? 'Lucro acumulado no período' : 'Evolução da banca'}
          </h2>
          <p className="text-[11px] text-ink-2 mt-0.5 tabular">
            {periodLabel[period]} · base {formatV(initialBankroll || 0)}
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1 text-[11px] shrink-0">
            {(['7d', '30d', '90d', 'all'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-2.5 h-7 rounded-md font-medium transition-colors ${
                  p === period ? 'bg-ink-3 text-ink' : 'text-ink-2 hover:text-ink hover:bg-ink-3/60'
                }`}
              >
                {p === 'all' ? 'Tudo' : p}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-[1fr_180px] gap-6 items-stretch">
        {/* Chart — h-full estica para igualar a altura da coluna lateral; min-h preserva o tamanho base no mobile */}
        <div style={{ minHeight: chartHeight }} className="w-full min-w-0 h-full">
          {periodHasNoEvents ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center px-4">
              <div className="text-[11px] uppercase tracking-[0.14em] text-ink-2 font-semibold">Sem movimentos no período</div>
              <p className="text-[13px] text-ink-2 mt-2 max-w-[280px]">
                Nenhuma aposta liquidada ou movimento de banca nos {period === '7d' ? 'últimos 7 dias' : period === '30d' ? 'últimos 30 dias' : 'últimos 90 dias'}.
              </p>
              <button
                type="button"
                onClick={() => setPeriod('all')}
                className="mt-4 h-8 px-3 inline-flex items-center text-[12px] font-semibold text-forest border border-forest/30 hover:bg-forest-tint rounded-md transition-colors"
              >
                Ver histórico completo
              </button>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredChartData} margin={{ top: 20, right: 60, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorBankroll" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={lineColor} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="#e3e6e0" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#9aa097"
                tick={{ fill: '#5a625a', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                minTickGap={30}
              />
              <YAxis
                stroke="#9aa097"
                tick={{ fill: '#5a625a', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatVShort(value)}
                domain={[(dataMin: number) => Math.floor(dataMin * 0.95), (dataMax: number) => Math.ceil(dataMax * 1.05)]}
                allowDataOverflow={false}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e3e6e0',
                  borderRadius: '6px',
                  color: '#1a1d1a',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.15)',
                  fontSize: 12,
                }}
                itemStyle={{ color: lineColor, fontWeight: 600 }}
                labelStyle={{ color: '#5a625a', fontSize: 11 }}
                formatter={(value: number) => [formatV(value), 'Banca']}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0) {
                    return payload[0].payload.fullDate;
                  }
                  return label;
                }}
              />
              {/* Baseline pontilhada */}
              {initialBankroll != null && initialBankroll > 0 && (
                <ReferenceLine
                  y={initialBankroll}
                  stroke="#9aa097"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                >
                  <RechartsLabel
                    value={`Base ${formatVShort(initialBankroll)}`}
                    position="insideRight"
                    fill="#9aa097"
                    fontSize={10}
                    offset={5}
                  />
                </ReferenceLine>
              )}
              <Area
                type="monotone"
                dataKey="bankroll"
                stroke={lineColor}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorBankroll)"
                animationDuration={500}
                animationEasing="ease-in-out"
                dot={{ fill: '#fff', stroke: lineColor, strokeWidth: 1.5, r: 2.5 }}
                activeDot={{ fill: lineColor, stroke: '#fff', strokeWidth: 2, r: 5 }}
                label={(props: { x?: number; y?: number; index?: number; value?: number }) => {
                  const { x, y, index, value } = props;
                  if (index === lastIndex && typeof x === 'number' && typeof y === 'number' && typeof value === 'number') {
                    return (
                      <g>
                        <circle cx={x} cy={y} r={5} fill={lineColor} />
                        <text
                          x={x}
                          y={y - 12}
                          textAnchor="middle"
                          fill={lineColor}
                          fontSize={11}
                          fontWeight={700}
                          fontFamily="Inter, system-ui, sans-serif"
                        >
                          {formatVShort(value)}
                        </text>
                      </g>
                    );
                  }
                  return <g />;
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </div>

        {/* Side panel — Banca atual + Movimentos */}
        {!readOnly && (
          <div className="flex flex-col gap-4 min-w-[160px]">
            {/* Banca atual */}
            <div className="border-l-2 border-forest pl-3">
              <div className="text-[10px] uppercase tracking-[0.14em] text-ink-2 font-semibold">Banca atual</div>
              <div className="text-[22px] font-semibold tabular text-ink mt-0.5 leading-tight">
                {formatV(currentBankroll)}
              </div>
              <div className={`text-[11px] tabular font-semibold mt-0.5 ${totalProfit >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                {totalProfit >= 0 ? '+' : '-'}{formatV(Math.abs(totalProfit))}
                {initialBankroll ? ` · ${profitPercentage >= 0 ? '+' : ''}${profitPercentage.toFixed(1)}%` : ''}
              </div>
            </div>

            {/* Movimentos */}
            {balanceMovements.length > 0 && (
              <div className="border-l-2 border-line pl-3">
                <div className="text-[10px] uppercase tracking-[0.14em] text-ink-2 font-semibold">Movimentos</div>
                <div className={`text-[14px] tabular font-semibold mt-0.5 ${netMovements >= 0 ? 'text-ink' : 'text-status-danger'}`}>
                  {netMovements >= 0 ? '+' : ''}{formatV(netMovements)}
                </div>
                <div className="text-[11px] text-ink-2 tabular mt-0.5">
                  {deposits.length} depósito{deposits.length !== 1 ? 's' : ''} · {withdrawals.length} saque{withdrawals.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}

            {/* Bloco de CTAs — empurrado para o fim do card via mt-auto, evita gap visual */}
            <div className="mt-auto flex flex-col gap-2">

            {/* Gerenciar banca — dropdown agrupando aporte/resgate/edição da banca inicial */}
            {(onAporte || onResgate) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-8 px-3 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-forest border border-forest/30 hover:bg-forest-tint rounded-md transition-colors"
                  >
                    Gerenciar banca
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="theme-rebrand bg-white border-line text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] w-48">
                  {onAporte && (
                    <DropdownMenuItem
                      onClick={onAporte}
                      className="cursor-pointer focus:bg-status-success/10 focus:text-status-success"
                    >
                      <ArrowDownCircle className="w-4 h-4 mr-2 text-status-success" />
                      Aporte
                    </DropdownMenuItem>
                  )}
                  {onResgate && (
                    <DropdownMenuItem
                      onClick={onResgate}
                      className="cursor-pointer focus:bg-status-danger/10 focus:text-status-danger"
                    >
                      <ArrowUpCircle className="w-4 h-4 mr-2 text-status-danger" />
                      Resgate
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-line" />
                  <DropdownMenuItem
                    onClick={() => setIsEditing(true)}
                    className="cursor-pointer focus:bg-ink-3/60"
                  >
                    <Edit2 className="w-4 h-4 mr-2 text-ink-2" />
                    Editar banca inicial
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Abrir tela de gestão de banca completa — escondido quando já estamos nessa tela */}
            {!hideViewFullButton && (
              <button
                type="button"
                onClick={() => navigate('/bankroll')}
                className="h-8 px-3 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-ink-2 hover:text-forest hover:bg-forest-tint border border-line hover:border-forest/30 rounded-md transition-colors"
              >
                Ver banca completa
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Editor inline da banca inicial — só aparece quando acionado pelo dropdown */}
            {isEditing && (
              <div className="flex flex-col gap-1 mt-1">
                <span className="text-[10px] uppercase tracking-[0.1em] text-ink-2 font-semibold">Banca inicial</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={tempBankroll}
                    onChange={(e) => setTempBankroll(e.target.value)}
                    className="flex-1 h-8 bg-white border border-line text-[12px] px-2 rounded text-ink text-right tabular focus:outline-none focus:border-forest"
                    placeholder="0.00"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isUpdating}
                    className="h-8 w-8 inline-flex items-center justify-center text-forest hover:bg-forest-tint rounded transition-colors"
                    aria-label="Salvar banca inicial"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            </div>{/* end Bloco de CTAs */}
          </div>
        )}

        {/* Read-only mode info */}
        {readOnly && (
          <div className="flex flex-col justify-center gap-2 border-l border-line pl-4">
            <div>
              <span className="text-[10px] uppercase tracking-[0.1em] text-ink-2 font-semibold block mb-0.5">Lucro no período</span>
              <span className={`font-semibold tabular ${totalProfit >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                {formatV(currentBankroll)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-[0.1em] text-ink-2 font-semibold block mb-0.5">Variação</span>
              <span className={`text-xs tabular ${totalProfit >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                {totalProfit >= 0 ? '+' : ''}{formatV(totalProfit)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
