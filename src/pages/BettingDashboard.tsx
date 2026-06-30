import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useBets } from '@/hooks/use-bets';
import { useUserUnit } from '@/hooks/use-user-unit';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBetinhoPremium } from '@/hooks/use-betinho-premium';
import { createClient } from '@/integrations/supabase/client';
import { BetsHeader } from '@/components/bets/BetsHeader';
import { ProfitByTagChart } from '@/components/bets/ProfitByTagChart';
import { Sparkline } from '@/components/dashboard/Sparkline';
import { BigHeatmap, type HeatmapMetric } from '@/components/dashboard/BigHeatmap';
import { DrillDown } from '@/components/dashboard/DrillDown';
import { OddsHistogram } from '@/components/dashboard/OddsHistogram';
import { CalendarHeatmap } from '@/components/dashboard/CalendarHeatmap';
import { BetinhoNarrative } from '@/components/dashboard/BetinhoNarrative';
import { InsightCards } from '@/components/dashboard/InsightCards';
import { SliceAnalysisModal } from '@/components/dashboard/SliceAnalysisModal';
import { HeroKPIMobile } from '@/components/dashboard/HeroKPIMobile';
import { AIPeriodModal } from '@/components/dashboard/AIPeriodModal';
import { AILoadingModal } from '@/components/dashboard/AILoadingModal';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  aggregateHeatmap,
  aggregateOddsDistribution,
  applyFocus,
  composeNarrative,
  composeSliceNarrative,
  composeTagNarrative,
  deriveInsights,
  EMPTY_FOCUS,
  focusLabel,
  getFocusOptions,
  isEmptyFocus,
  isSettled,
  profitForBet,
  type BetWithTags,
  type FocusFilter,
} from '@/utils/dashboardAggregations';
import {
  getDateRangeForPreset,
  filterBetsByDateRange,
  statsForDateRange,
  previousPeriod,
  compareTrend,
  type DateRangePreset,
} from '@/utils/bettingStats';
import { exportBetsToCSV } from '@/utils/exportBetsToCSV';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { UnitConfigurationModal } from '@/components/UnitConfigurationModal';
import { ChevronRight, DollarSign, Target, Download, AlertCircle, Calendar as CalendarIcon, Crown, AlertTriangle, Lightbulb, Shield, Lock, Edit, Settings, BarChart3, X, type LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PERIOD_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: 'month', label: 'Este mês' },
  { value: 'ytd', label: 'Este ano (YTD)' },
  { value: 'all', label: 'Período total' },
  { value: 'custom', label: 'Personalizado' },
];

export default function BettingDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { bets, isLoading: betsLoading } = useBets(user?.id ?? '');
  const { toUnits, formatUnits, formatCurrency, isConfigured, refetchConfig, config } = useUserUnit();
  const { isPremium } = useBetinhoPremium();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [period, setPeriod] = useState<DateRangePreset>('30');
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [fromPopoverOpen, setFromPopoverOpen] = useState(false);
  const [toPopoverOpen, setToPopoverOpen] = useState(false);
  const [showUnitsView, setShowUnitsView] = useState(false);
  const [unitConfigOpen, setUnitConfigOpen] = useState(false);
  const [betsWithTags, setBetsWithTags] = useState<BetWithTags[]>([]);
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>('roi');
  const [selectedCell, setSelectedCell] = useState<{ l: number; m: number; league: string; market: string } | null>(null);
  const [sliceModalOpen, setSliceModalOpen] = useState(false);
  const [aiPeriodModalOpen, setAiPeriodModalOpen] = useState(false);
  const [aiLoadingModalOpen, setAiLoadingModalOpen] = useState(false);
  const [aiLoadingBetCount, setAiLoadingBetCount] = useState(0);
  const [currentFocus, setCurrentFocus] = useState<FocusFilter>(EMPTY_FOCUS);
  const [tagAnalysisModalOpen, setTagAnalysisModalOpen] = useState(false);
  const [tagAnalysisTags, setTagAnalysisTags] = useState<string[]>([]);
  const [exampleModalOpen, setExampleModalOpen] = useState(false);
  const formatValue = showUnitsView
    ? (value: number) => {
        const u = toUnits(value);
        return u !== null ? formatUnits(u) : formatCurrency(value);
      }
    : formatCurrency;

  useEffect(() => {
    if (!bets.length) {
      setBetsWithTags([]);
      return;
    }
    const supabase = createClient();
    Promise.all(
      bets.map(async (bet) => {
        const { data: tags } = await supabase.rpc('get_bet_tags', {
          p_bet_id: bet.id,
        });
        return { ...bet, tags: (tags || []) as { id: string; name: string; color?: string }[] };
      })
    ).then(setBetsWithTags);
  }, [bets]);

  const { from, to } = useMemo(() => {
    if (period === 'custom' && customFrom && customTo) {
      const fromDate = new Date(customFrom);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(customTo);
      toDate.setHours(23, 59, 59, 999);
      return { from: fromDate.toISOString(), to: toDate.toISOString() };
    }
    if (period === 'custom') {
      return getDateRangeForPreset('all');
    }
    return getDateRangeForPreset(period);
  }, [period, customFrom, customTo]);
  const currentBets = useMemo(
    () => filterBetsByDateRange(bets, from, to),
    [bets, from, to]
  );
  const currentStats = useMemo(
    () => statsForDateRange(currentBets),
    [currentBets]
  );
  const currentBetsWithTags = useMemo(
    () => filterBetsByDateRange(betsWithTags, from, to) as BetWithTags[],
    [betsWithTags, from, to]
  );

  const showTrend = period !== 'all' && !(period === 'custom' && (!customFrom || !customTo));
  const { from: prevFrom, to: prevTo } = useMemo(
    () => (showTrend ? previousPeriod(from, to) : { from, to }),
    [showTrend, from, to]
  );
  const previousBets = useMemo(
    () => (showTrend ? filterBetsByDateRange(bets, prevFrom, prevTo) : []),
    [showTrend, bets, prevFrom, prevTo]
  );
  const previousStats = useMemo(
    () => statsForDateRange(previousBets),
    [previousBets]
  );

  const profitTrend = useMemo(
    () =>
      showTrend
        ? compareTrend(currentStats.profit, previousStats.profit, true)
        : { trend: 'neutral' as const, pctChange: 0 },
    [showTrend, currentStats.profit, previousStats.profit]
  );
  const roiTrend = useMemo(
    () =>
      showTrend
        ? compareTrend(currentStats.roi, previousStats.roi, true)
        : { trend: 'neutral' as const, pctChange: 0 },
    [showTrend, currentStats.roi, previousStats.roi]
  );

  const heatmapData = useMemo(
    () => aggregateHeatmap(currentBets, isMobile ? 5 : 6, isMobile ? 4 : 5),
    [currentBets, isMobile]
  );
  const oddsData = useMemo(() => aggregateOddsDistribution(currentBets), [currentBets]);

  const periodLabel = useMemo(() => {
    if (period === 'custom' && customFrom && customTo) return 'período personalizado';
    if (period === '7') return 'últimos 7 dias';
    if (period === '30') return 'últimos 30 dias';
    if (period === '90') return 'últimos 90 dias';
    if (period === 'month') return 'este mês';
    if (period === 'ytd') return 'este ano';
    if (period === 'all') return 'período total';
    return 'período';
  }, [period, customFrom, customTo]);

  // Focus filter applies ONLY to narrative + insights (heatmap/charts/StatusStrip ignoram).
  const focusedBets = useMemo(
    () => applyFocus(currentBetsWithTags, currentFocus),
    [currentBetsWithTags, currentFocus]
  );
  const focusedStats = useMemo(() => statsForDateRange(focusedBets), [focusedBets]);
  const focusedHeatmap = useMemo(() => aggregateHeatmap(focusedBets), [focusedBets]);
  const focusOptions = useMemo(
    () => getFocusOptions(currentBetsWithTags),
    [currentBetsWithTags]
  );

  const narrative = useMemo(
    () =>
      composeNarrative(
        focusedBets,
        {
          profit: focusedStats.profit,
          roi: focusedStats.roi,
          totalBets: focusedStats.totalBets,
          totalStaked: focusedStats.totalStaked,
          winRate: focusedStats.winRate,
        },
        focusedHeatmap,
        isEmptyFocus(currentFocus) ? periodLabel : `${focusLabel(currentFocus)} · ${periodLabel}`,
        formatValue
      ),
    [focusedBets, focusedStats, focusedHeatmap, currentFocus, periodLabel, formatValue]
  );
  const insights = useMemo(
    () => deriveInsights(focusedBets, focusedHeatmap, formatValue),
    [focusedBets, focusedHeatmap, formatValue]
  );
  const sliceNarrative = useMemo(
    () =>
      selectedCell
        ? composeSliceNarrative(currentBets, selectedCell.league, selectedCell.market, formatValue)
        : null,
    [selectedCell, currentBets, formatValue]
  );
  const tagNarrative = useMemo(
    () =>
      tagAnalysisTags.length > 0
        ? composeTagNarrative(currentBetsWithTags, tagAnalysisTags, formatValue)
        : null,
    [tagAnalysisTags, currentBetsWithTags, formatValue]
  );

  // Reset selected cell when period changes (cell indices may not match new heatmap).
  // Focus persiste (é um filtro sticky); usuário pode trocar via AIPeriodModal.
  useEffect(() => {
    setSelectedCell(null);
  }, [period, customFrom, customTo]);

  const initialBankroll = config?.bank_amount ?? 0;
  const allTimeProfit = useMemo(
    () => bets.filter(isSettled).reduce((s, b) => s + profitForBet(b), 0),
    [bets]
  );
  const currentBankroll = initialBankroll + allTimeProfit;
  const bankrollGrowthPct = initialBankroll > 0 ? (allTimeProfit / initialBankroll) * 100 : 0;

  const sparklineData = useMemo(() => {
    const settled = currentBets
      .filter((b) => ['won', 'lost', 'cashout', 'half_won', 'half_lost', 'void'].includes(b.status))
      .sort((a, b) => new Date(a.bet_date).getTime() - new Date(b.bet_date).getTime());
    if (settled.length === 0) return [];
    let cum = 0;
    const series: number[] = [0];
    settled.forEach((bet) => {
      let p = 0;
      if (bet.status === 'won') p = bet.potential_return - bet.stake_amount;
      else if (bet.status === 'lost') p = -bet.stake_amount;
      else if (bet.status === 'cashout' && bet.cashout_amount != null) p = bet.cashout_amount - bet.stake_amount;
      else if (bet.status === 'half_won') p = (bet.stake_amount + bet.potential_return) / 2 - bet.stake_amount;
      else if (bet.status === 'half_lost') p = bet.stake_amount / 2 - bet.stake_amount;
      cum += p;
      series.push(cum);
    });
    return series;
  }, [currentBets]);

  if (authLoading) {
    return (
      <div className="theme-rebrand min-h-screen bg-canvas flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="theme-rebrand min-h-screen bg-canvas text-ink flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-status-danger" />
          <p className="text-[14px] text-ink-2">Por favor, faça login para ver o dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-rebrand w-full min-h-screen bg-canvas text-ink">
      <BetsHeader showBack />

      {/* Page Header */}
      <div className="bg-white border-b border-line">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold tracking-[0.2em] text-amber-700 uppercase">Diagnóstico</div>
            <h1 className="text-[24px] md:text-[28px] font-extrabold tracking-tight text-ink mt-1" style={{ letterSpacing: '-0.02em' }}>
              Onde você <span className="text-forest">ganha</span> e onde <span className="text-rose-700">perde</span>?
            </h1>
            <p className="text-[13px] text-ink-2 mt-1">Veja a performance da sua banca por esporte, liga, mercado e tag.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Tier badge — informativo, não clicável (vira link se houver página de billing) */}
            {isPremium ? (
              <span
                className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded text-[10px] font-bold uppercase tracking-[0.14em] bg-forest text-amber-400 border border-forest"
                role="status"
                aria-label="Plano Pro ativo"
                title="Plano Pro ativo"
              >
                <Crown className="w-3 h-3" aria-hidden="true" />
                Pro
              </span>
            ) : (
              <span
                className="h-7 px-2.5 inline-flex items-center rounded text-[10px] font-bold uppercase tracking-[0.14em] bg-ink-3 text-ink-2 border border-line"
                role="status"
                aria-label="Plano Free"
                title="Plano Free"
              >
                Free
              </span>
            )}

            {/* Toggle R$ / u */}
            <div className="h-9 inline-flex items-center p-0.5 bg-ink-3 border border-line rounded-md">
              <button
                type="button"
                onClick={() => setShowUnitsView(false)}
                className={`h-7 px-3 text-[12px] font-bold rounded transition-colors ${
                  !showUnitsView ? 'bg-white text-ink shadow-sm border border-line' : 'text-ink-2 hover:text-ink'
                }`}
              >
                R$
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isConfigured()) {
                    setUnitConfigOpen(true);
                    return;
                  }
                  setShowUnitsView(true);
                }}
                title={!isConfigured() ? 'Configure sua unidade pra ver em u' : undefined}
                className={`h-7 px-3 text-[12px] font-bold rounded transition-colors ${
                  showUnitsView ? 'bg-white text-ink shadow-sm border border-line' : 'text-ink-2 hover:text-ink'
                }`}
              >
                u
              </button>
            </div>

            {/* 1u = R$ X chip */}
            <button
              type="button"
              onClick={() => setUnitConfigOpen(true)}
              className="h-9 px-2 md:px-2.5 inline-flex items-center gap-1.5 text-[11px] text-ink-2 hover:text-ink border border-line bg-white hover:bg-ink-3/40 rounded-md transition-colors"
              title={isConfigured() && config?.unit_value ? `1u = ${formatCurrency(config.unit_value)}` : 'Configurar unidade'}
            >
              {isConfigured() && config?.unit_value ? (
                <>
                  <span className="hidden md:inline text-[10px] uppercase tracking-[0.1em] font-bold">1u =</span>
                  <span className="hidden md:inline tabular text-ink font-bold">{formatCurrency(config.unit_value)}</span>
                  <Edit className="w-3.5 h-3.5 md:w-3 md:h-3 text-ink-2" />
                </>
              ) : (
                <>
                  <Settings className="w-3.5 h-3.5 text-forest" />
                  <span className="hidden md:inline text-forest font-bold">Configurar unidade</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => exportBetsToCSV(currentBets, formatValue)}
              className="h-9 px-2 md:px-3 inline-flex items-center gap-2 text-[13px] font-medium text-ink-2 hover:text-ink border border-line bg-white hover:bg-ink-3/40 rounded-md transition-colors"
              title="Exportar CSV"
              aria-label="Exportar CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Exportar</span>
            </button>

            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as DateRangePreset)}
            >
              <SelectTrigger className="theme-rebrand h-9 w-[180px] bg-white border-line text-ink text-[13px] focus:ring-2 focus:ring-forest/10">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="theme-rebrand bg-white border-line text-ink">
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-ink text-[13px] focus:bg-ink-3/60 focus:text-ink"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {period === 'custom' && (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Popover open={fromPopoverOpen} onOpenChange={setFromPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-9 px-3 inline-flex items-center gap-2 text-[13px] bg-white border border-line text-ink hover:bg-ink-3/40 rounded-md w-full sm:w-[150px]"
                    >
                      <CalendarIcon className="w-3.5 h-3.5 text-forest" />
                      <span className={customFrom ? 'tabular' : 'text-ink-2'}>
                        {customFrom ? format(customFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'De'}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="theme-rebrand w-auto p-0 bg-white border-line shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                    <CalendarComponent
                      mode="single"
                      selected={customFrom}
                      onSelect={(date) => {
                        setCustomFrom(date);
                        setFromPopoverOpen(false);
                        setToPopoverOpen(true);
                      }}
                      disabled={(date) => (customTo ? date > customTo : false)}
                      initialFocus
                      className="bg-white"
                      classNames={{
                        caption_label: 'text-sm font-bold text-ink',
                        nav_button: 'h-7 w-7 bg-white border border-line text-ink-2 hover:bg-ink-3/40 hover:text-ink rounded-md inline-flex items-center justify-center',
                        head_cell: 'text-ink-2 rounded-md w-9 font-medium text-[0.7rem] uppercase tracking-[0.08em]',
                        day: 'h-9 w-9 p-0 font-normal text-ink hover:bg-ink-3/40 rounded-md aria-selected:opacity-100',
                        day_selected: 'bg-forest text-white hover:bg-forest hover:text-white focus:bg-forest focus:text-white',
                        day_today: 'bg-ink-3 text-ink font-bold',
                        day_outside: 'text-ink-2 opacity-40',
                        day_disabled: 'text-ink-2 opacity-30',
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <Popover open={toPopoverOpen} onOpenChange={setToPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-9 px-3 inline-flex items-center gap-2 text-[13px] bg-white border border-line text-ink hover:bg-ink-3/40 rounded-md w-full sm:w-[150px]"
                    >
                      <CalendarIcon className="w-3.5 h-3.5 text-forest" />
                      <span className={customTo ? 'tabular' : 'text-ink-2'}>
                        {customTo ? format(customTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Até'}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="theme-rebrand w-auto p-0 bg-white border-line shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]">
                    <CalendarComponent
                      mode="single"
                      selected={customTo}
                      onSelect={(date) => {
                        setCustomTo(date);
                        setToPopoverOpen(false);
                      }}
                      disabled={(date) => (customFrom ? date < customFrom : false)}
                      initialFocus
                      className="bg-white"
                      classNames={{
                        caption_label: 'text-sm font-bold text-ink',
                        nav_button: 'h-7 w-7 bg-white border border-line text-ink-2 hover:bg-ink-3/40 hover:text-ink rounded-md inline-flex items-center justify-center',
                        head_cell: 'text-ink-2 rounded-md w-9 font-medium text-[0.7rem] uppercase tracking-[0.08em]',
                        day: 'h-9 w-9 p-0 font-normal text-ink hover:bg-ink-3/40 rounded-md aria-selected:opacity-100',
                        day_selected: 'bg-forest text-white hover:bg-forest hover:text-white focus:bg-forest focus:text-white',
                        day_today: 'bg-ink-3 text-ink font-bold',
                        day_outside: 'text-ink-2 opacity-40',
                        day_disabled: 'text-ink-2 opacity-30',
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile headline */}
      <div className="md:hidden px-4 pt-4">
        <div className="text-[18px] font-extrabold tracking-tight">
          Seu período tá{' '}
          <span
            className={
              currentStats.profit > 0
                ? 'text-forest'
                : currentStats.profit < 0
                  ? 'text-rose-700'
                  : 'text-ink'
            }
          >
            {currentStats.profit > 0 ? 'green' : currentStats.profit < 0 ? 'red' : 'neutro'}
          </span>
        </div>
      </div>

      {/* Mobile hero KPI (substitui StatusStrip no mobile) */}
      <HeroKPIMobile
        profit={currentStats.profit}
        roi={currentStats.roi}
        winRate={currentStats.winRate}
        totalBets={currentStats.totalBets}
        sparklineData={sparklineData}
        formatValue={formatValue}
        periodLabel={periodLabel}
        showTrend={showTrend}
        profitTrendPct={profitTrend.pctChange}
        roiTrendPct={roiTrend.pctChange}
      />

      {/* StatusStrip — desktop only */}
      <div className="bg-white border-b border-line hidden md:block">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-6 flex-wrap">
          {/* Banca big + delta + sparkline */}
          <div className="flex items-center gap-4 shrink-0">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-2 font-bold">
                {initialBankroll > 0 ? 'Banca atual' : `Lucro · ${periodLabel}`}
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <div
                  className={`text-[26px] font-extrabold tracking-tight tabular leading-none ${
                    initialBankroll > 0
                      ? 'text-ink'
                      : currentStats.profit >= 0
                        ? 'text-forest'
                        : 'text-rose-700'
                  }`}
                  style={{ letterSpacing: '-0.02em' }}
                >
                  {initialBankroll > 0
                    ? formatValue(currentBankroll)
                    : formatValue(currentStats.profit)}
                </div>
                {/* Sem delta na Banca Atual — é saldo absoluto, não comparável com a janela de período dos demais KPIs */}
              </div>
            </div>
            {sparklineData.length >= 2 && (
              <>
                <div className="w-px h-10 bg-line" />
                <Sparkline
                  data={sparklineData}
                  width={120}
                  height={36}
                  color={currentStats.profit >= 0 ? '#0a3d2e' : '#be123c'}
                />
              </>
            )}
          </div>

          <div className="w-px h-10 bg-line" />

          {/* Mini KPIs: Lucro · ROI · Win rate · Apostas */}
          <div className="grid grid-cols-4 gap-4 lg:gap-6 flex-1 min-w-[280px]">
            <div>
              <div className="text-[9px] uppercase tracking-[0.14em] text-ink-2 font-bold">Lucro</div>
              <div
                className={`text-[15px] font-extrabold tabular mt-0.5 ${
                  currentStats.profit >= 0 ? 'text-forest' : 'text-rose-700'
                }`}
              >
                {currentStats.profit >= 0 ? '+' : ''}
                {formatValue(currentStats.profit)}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.14em] text-ink-2 font-bold">ROI</div>
              <div
                className={`text-[15px] font-extrabold tabular mt-0.5 ${
                  currentStats.roi >= 0 ? 'text-ink' : 'text-rose-700'
                }`}
              >
                {currentStats.roi >= 0 ? '+' : ''}
                {currentStats.roi.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.14em] text-ink-2 font-bold">Win rate</div>
              <div className="text-[15px] font-extrabold tabular text-ink mt-0.5">
                {currentStats.winRate.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.14em] text-ink-2 font-bold">Apostas</div>
              <div className="text-[15px] font-extrabold tabular text-ink mt-0.5">{currentStats.totalBets}</div>
            </div>
          </div>

        </div>
      </div>

      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 py-6 space-y-4 focus:outline-none">
        {betsLoading ? (
          <div className="bg-white border border-line rounded-xl p-8 text-center text-[13px] text-ink-2">
            Carregando apostas...
          </div>
        ) : (
          <>
            {/* Tier-aware: Upsell (Free) ou Betinho Narrative + Insight cards (Pro) */}
            {isPremium ? (
              <>
                <BetinhoNarrative
                  narrative={narrative}
                  onRefresh={() => setAiPeriodModalOpen(true)}
                />
                {narrative.hasEnoughData && insights.length > 0 && (
                  <InsightCards
                    insights={insights}
                    onApplyInsight={(insight) => {
                      // Opportunity/warning carry a `league · market` title — try to map to a cell.
                      if (insight.type === 'opportunity' || insight.type === 'warning') {
                        const [league, market] = insight.title.split(' · ');
                        const l = heatmapData.leagues.indexOf(league);
                        const m = heatmapData.markets.indexOf(market);
                        if (l !== -1 && m !== -1) {
                          setSelectedCell({ l, m, league, market });
                        }
                      }
                      // Discipline: no slice to select, just open AI period modal for re-analysis.
                      if (insight.type === 'discipline') {
                        setAiPeriodModalOpen(true);
                      }
                    }}
                  />
                )}
              </>
            ) : (
              <UpsellCard
                onUpgrade={() => navigate('/paywall-dashboard')}
                onSeeExample={() => setExampleModalOpen(true)}
              />
            )}

            {/* Heatmap liga × mercado + DrillDown lateral */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <BigHeatmap
                  data={heatmapData}
                  selectedCell={selectedCell ? { l: selectedCell.l, m: selectedCell.m } : null}
                  onSelectCell={setSelectedCell}
                  metric={heatmapMetric}
                  onMetricChange={setHeatmapMetric}
                  formatValue={(v) => formatValue(v)}
                  compact={isMobile}
                />
              </div>
              <div className="lg:col-span-1">
                <DrillDown
                  bets={currentBets}
                  selectedCell={selectedCell}
                  isPremium={isPremium}
                  formatValue={(v) => formatValue(v)}
                  onViewAllBets={() => {
                    if (selectedCell) {
                      const params = new URLSearchParams();
                      params.set('league', selectedCell.league);
                      params.set('market', selectedCell.market);
                      navigate(`/bets?${params.toString()}`);
                    } else {
                      navigate('/bets');
                    }
                  }}
                  onUpgrade={() => navigate('/paywall-dashboard')}
                  onAnalyzeWithAI={isPremium && selectedCell ? () => setSliceModalOpen(true) : undefined}
                />
              </div>
            </div>

            {/* Tag pivot diverging full width */}
            <ProfitByTagChart
              bets={currentBetsWithTags}
              formatValue={(v) => formatValue(v)}
              onAnalyzeTags={(tagNames) => {
                setTagAnalysisTags(tagNames);
                setTagAnalysisModalOpen(true);
              }}
            />

            {/* Odds + Tempo */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7">
                <OddsHistogram data={oddsData} formatValue={(v) => formatValue(v)} />
              </div>
              <div className="lg:col-span-5">
                <CalendarHeatmap bets={bets} />
              </div>
            </div>

            {/* CTAs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <button
                type="button"
                onClick={() => navigate('/bets')}
                className="w-full bg-white border border-line hover:border-forest/40 rounded-xl p-4 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-forest-tint grid place-items-center group-hover:bg-forest/10 transition-colors">
                    <Target className="w-5 h-5 text-forest" />
                  </div>
                  <div className="text-left">
                    <div className="text-[14px] font-bold text-ink">Ver apostas</div>
                    <div className="text-[12px] text-ink-2">Lista completa e filtros</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-forest opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/bankroll')}
                className="w-full bg-white border border-line hover:border-forest/40 rounded-xl p-4 flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-forest-tint grid place-items-center group-hover:bg-forest/10 transition-colors">
                    <DollarSign className="w-5 h-5 text-forest" />
                  </div>
                  <div className="text-left">
                    <div className="text-[14px] font-bold text-ink">Fluxo de caixa</div>
                    <div className="text-[12px] text-ink-2">Histórico detalhado de transações</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-forest opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          </>
        )}
      </main>

      <UnitConfigurationModal
        open={unitConfigOpen}
        onOpenChange={(open) => {
          setUnitConfigOpen(open);
          if (!open) refetchConfig();
        }}
      />

      <SliceAnalysisModal
        open={sliceModalOpen}
        onOpenChange={setSliceModalOpen}
        narrative={sliceNarrative}
        onViewAllBets={() => {
          if (selectedCell) {
            const params = new URLSearchParams();
            params.set('league', selectedCell.league);
            params.set('market', selectedCell.market);
            navigate(`/bets?${params.toString()}`);
          } else {
            navigate('/bets');
          }
        }}
      />

      <SliceAnalysisModal
        open={tagAnalysisModalOpen}
        onOpenChange={setTagAnalysisModalOpen}
        narrative={tagNarrative}
        onViewAllBets={() => {
          if (tagAnalysisTags.length > 0) {
            // /bets filtra por tag ID. Resolve nome → ID via tags carregadas nos bets.
            const nameToId = new Map<string, string>();
            currentBetsWithTags.forEach((b) => {
              (b.tags ?? []).forEach((t) => {
                if (t.name && t.id) nameToId.set(t.name, t.id);
              });
            });
            const ids = tagAnalysisTags
              .map((name) => nameToId.get(name))
              .filter((id): id is string => Boolean(id));
            const params = new URLSearchParams();
            ids.forEach((id) => params.append('tag', id));
            navigate(ids.length > 0 ? `/bets?${params.toString()}` : '/bets');
          } else {
            navigate('/bets');
          }
        }}
      />

      <AIPeriodModal
        open={aiPeriodModalOpen}
        onOpenChange={setAiPeriodModalOpen}
        bets={bets}
        betsWithTags={betsWithTags}
        focusOptions={focusOptions}
        currentPeriod={period}
        currentFocus={currentFocus}
        onConfirm={(newPeriod, newFocus) => {
          const { from: newFrom, to: newTo } = getDateRangeForPreset(newPeriod);
          const inPeriod = filterBetsByDateRange(betsWithTags, newFrom, newTo);
          const focused = applyFocus(inPeriod, newFocus);
          const count = focused.filter(isSettled).length;
          setAiLoadingBetCount(count);
          setPeriod(newPeriod);
          setCurrentFocus(newFocus);
          setAiPeriodModalOpen(false);
          setAiLoadingModalOpen(true);
        }}
      />

      <AILoadingModal
        open={aiLoadingModalOpen}
        onOpenChange={setAiLoadingModalOpen}
        betCount={aiLoadingBetCount}
      />

      {/* Modal: exemplo de análise Pro (preview com dados reais do usuário) */}
      <Dialog open={exampleModalOpen} onOpenChange={setExampleModalOpen}>
        <DialogContent className="theme-rebrand bg-canvas border-line p-0 overflow-hidden max-w-3xl max-h-[90vh] flex flex-col [&>button]:hidden">
          {/* Header forest */}
          <div className="relative overflow-hidden bg-forest text-white px-6 py-5 shrink-0">
            <div
              className="absolute inset-0 opacity-[0.06] pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                backgroundSize: '8px 8px',
              }}
            />
            <div className="relative flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-amber-400 text-forest grid place-items-center text-[18px] font-bold shrink-0">
                B
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400 font-extrabold">
                  Exemplo · Betinho Pro
                </div>
                <DialogTitle className="text-[18px] font-extrabold tracking-tight leading-tight mt-0.5">
                  Como sua análise vai ficar no Pro
                </DialogTitle>
                <DialogDescription className="text-[11px] text-white/70 mt-1">
                  Preview gerado com seus dados reais ({focusedStats.totalBets}{' '}
                  {focusedStats.totalBets === 1 ? 'aposta' : 'apostas'})
                </DialogDescription>
              </div>
              <button
                type="button"
                onClick={() => setExampleModalOpen(false)}
                className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 grid place-items-center shrink-0 transition-colors"
                aria-label="Fechar"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>

          {/* Body — narrativa + insights */}
          <div className="overflow-y-auto p-6 space-y-4 flex-1 min-h-0">
            <BetinhoNarrative narrative={narrative} />
            {narrative.hasEnoughData && insights.length > 0 && (
              <InsightCards insights={insights} />
            )}
            {!narrative.hasEnoughData && (
              <div className="bg-white border border-line rounded-xl p-5 text-center">
                <p className="text-[13px] text-ink-2">
                  Você ainda tem poucas apostas no período pra gerar uma análise sólida. Cadastre pelo menos 5 e
                  veja o que o Betinho identifica.
                </p>
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="border-t border-line bg-white p-5 flex flex-col sm:flex-row gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setExampleModalOpen(false)}
              className="h-10 px-4 rounded-md border border-line text-[12px] font-bold text-ink-2 hover:text-ink hover:bg-ink-3/40 transition-colors flex-1"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => {
                setExampleModalOpen(false);
                navigate('/paywall-dashboard');
              }}
              className="h-10 px-5 rounded-md bg-amber-400 text-forest font-extrabold text-[12px] hover:bg-amber-300 transition-colors flex-[2]"
            >
              Assinar Pro · R$ 14,90/mês
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

interface UpsellCardProps {
  onUpgrade: () => void;
  onSeeExample: () => void;
}

const UpsellCard: React.FC<UpsellCardProps> = ({ onUpgrade, onSeeExample }) => (
  <div className="relative overflow-hidden rounded-xl bg-forest text-white">
    <div
      className="absolute inset-0 opacity-[0.06] pointer-events-none"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
        backgroundSize: '8px 8px',
      }}
    />
    <div className="relative p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
      <div className="md:col-span-7">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-full bg-amber-400/20 grid place-items-center">
            <span className="text-amber-400 text-[18px] font-bold">B</span>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400 font-bold inline-flex items-center gap-1.5"><Lock className="w-3 h-3" />Desbloqueie o Betinho Pro</div>
            <div className="text-[12px] text-white/70">
              Disponível no plano <span className="font-bold text-amber-400">Pro · R$ 14,90/mês</span>
            </div>
          </div>
        </div>

        <h2 className="text-[20px] md:text-[22px] font-bold tracking-tight leading-tight">
          Pare de olhar gráfico.<br />
          Receba <span className="text-amber-400">recomendações práticas</span> sobre suas apostas.
        </h2>

        <p className="text-[13px] text-white/80 leading-relaxed mt-3 max-w-md">
          O Betinho cruza suas apostas e destaca onde você ganha, onde perde e o que ajustar.
          Atualiza automaticamente conforme você registra novas apostas.
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-5">
          <button
            type="button"
            onClick={onUpgrade}
            className="h-10 px-5 rounded-md bg-amber-400 text-forest font-bold text-[13px] hover:bg-amber-300 transition-colors"
          >
            Assinar Pro · R$ 14,90/mês
          </button>
          <button
            type="button"
            onClick={onSeeExample}
            className="h-10 px-4 rounded-md bg-white/10 border border-white/20 text-white font-bold text-[12px] hover:bg-white/15 transition-colors"
          >
            Ver exemplo de análise
          </button>
        </div>
      </div>

      <div className="md:col-span-5 space-y-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-amber-400 font-bold mb-1">Você terá:</div>
        {([
          { Icon: BarChart3, t: 'Diagnóstico completo da banca', s: 'Onde você ganha e onde perde por liga, mercado e tag.' },
          { Icon: AlertTriangle, t: 'Detector de vazamentos', s: 'Fatias com ROI negativo destacadas como prioridade pra revisar.' },
          { Icon: Lightbulb, t: 'Análise por fatia ou tag', s: 'Clique numa fatia do mapa e veja sequências, odd média e padrões.' },
          { Icon: Shield, t: 'Insights de disciplina', s: 'Alertas sobre variância de stake e faixa de odd fora da zona estável.' },
        ] as { Icon: LucideIcon; t: string; s: string }[]).map((b, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-2.5 flex gap-2.5">
            <div className="w-7 h-7 rounded-md bg-amber-400/15 grid place-items-center shrink-0">
              <b.Icon className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="text-[12px] font-bold leading-tight">{b.t}</div>
              <div className="text-[11px] text-white/65 leading-snug mt-0.5">{b.s}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
