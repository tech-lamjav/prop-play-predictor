import React, { useMemo, useState, useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { fmtPct } from '@/utils/formato';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useBets } from '@/hooks/use-bets';
import { useUserUnit } from '@/hooks/use-user-unit';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBetinhoPremium } from '@/hooks/use-betinho-premium';
import { createClient } from '@/integrations/supabase/client';
import AnalyticsNav from '@/components/AnalyticsNav';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import { useOnboardingTour } from '@/components/onboarding/useOnboardingTour';
import { BETINHO_DASH_TOUR_ID, makeBetinhoDashboardSteps } from '@/components/onboarding/tours';
import { DemoRibbon, DemoBadge } from '@/components/onboarding/DemoRibbon';
import { demoBets } from '@/components/onboarding/demo/betinho';
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
import { localeDoDateFns } from '@/utils/locale-do-date-fns';

const PERIOD_OPTIONS: { value: DateRangePreset; chave: string }[] = [
  { value: '7', chave: 'painel.periodo.d7' },
  { value: '30', chave: 'painel.periodo.d30' },
  { value: '90', chave: 'painel.periodo.d90' },
  { value: 'month', chave: 'painel.periodo.mes' },
  { value: 'ytd', chave: 'painel.periodo.ano' },
  { value: 'all', chave: 'painel.periodo.total' },
  { value: 'custom', chave: 'painel.periodo.personalizado' },
];

/* O PREÇO NÃO ENTRA NO CATÁLOGO, pelo mesmo motivo do #540 em Planos.tsx:
   moeda e preço por país são decisão comercial e estão fora do escopo do
   #532. O catálogo traduz o texto AO REDOR do preço — "Assinar Pro", "/mês" —
   e recebe o valor por interpolação. */
const PRECO_PRO = 'R$ 14,90';

export default function BettingDashboard() {
  const { t } = useTranslation('apostas');
  const { user, isLoading: authLoading } = useAuth();
  const { bets: realBets, isLoading: betsLoading } = useBets(user?.id ?? '');
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
  const [realBetsWithTags, setRealBetsWithTags] = useState<BetWithTags[]>([]);
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

  const dashTour = useOnboardingTour(BETINHO_DASH_TOUR_ID, { enabled: !!user && !betsLoading, delay: 900 });
  const isDemo = dashTour.run; // durante o tour, preenche com exemplo
  const bets = isDemo ? (demoBets as unknown as typeof realBets) : realBets;
  const betsWithTags = isDemo ? (demoBets as unknown as BetWithTags[]) : realBetsWithTags;
  const dashSteps = useMemo(() => makeBetinhoDashboardSteps({ isMobile }), [isMobile]);

  useEffect(() => {
    if (!realBets.length) {
      setRealBetsWithTags([]);
      return;
    }
    const supabase = createClient();
    Promise.all(
      realBets.map(async (bet) => {
        const { data: tags } = await supabase.rpc('get_bet_tags', {
          p_bet_id: bet.id,
        });
        return { ...bet, tags: (tags || []) as { id: string; name: string; color?: string }[] };
      })
    ).then(setRealBetsWithTags);
  }, [realBets]);

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
    if (period === 'custom' && customFrom && customTo) return t('painel.periodoTexto.personalizado');
    if (period === '7') return t('painel.periodoTexto.d7');
    if (period === '30') return t('painel.periodoTexto.d30');
    if (period === '90') return t('painel.periodoTexto.d90');
    if (period === 'month') return t('painel.periodoTexto.mes');
    if (period === 'ytd') return t('painel.periodoTexto.ano');
    if (period === 'all') return t('painel.periodoTexto.total');
    return t('painel.periodoTexto.generico');
  }, [period, customFrom, customTo, t]);

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
        isEmptyFocus(currentFocus)
          ? periodLabel
          : `${focusLabel(currentFocus, t)} · ${periodLabel}`,
        t,
        formatValue
      ),
    [focusedBets, focusedStats, focusedHeatmap, currentFocus, periodLabel, t, formatValue]
  );
  const insights = useMemo(
    () => deriveInsights(focusedBets, focusedHeatmap, t, formatValue),
    [focusedBets, focusedHeatmap, t, formatValue]
  );
  const sliceNarrative = useMemo(
    () =>
      selectedCell
        ? composeSliceNarrative(
            currentBets,
            selectedCell.league,
            selectedCell.market,
            t,
            formatValue,
          )
        : null,
    [selectedCell, currentBets, t, formatValue]
  );
  const tagNarrative = useMemo(
    () =>
      tagAnalysisTags.length > 0
        ? composeTagNarrative(currentBetsWithTags, tagAnalysisTags, t, formatValue)
        : null,
    [tagAnalysisTags, currentBetsWithTags, t, formatValue]
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
      <div className="theme-bolao min-h-screen bg-canvas flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="theme-bolao min-h-screen bg-canvas text-ink flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-status-danger" />
          <p className="text-[14px] text-ink-2">{t('painel.login')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-bolao w-full min-h-screen bg-canvas text-ink">
      <AnalyticsNav variant="rebrand" showBack />
      <OnboardingTour tourId={BETINHO_DASH_TOUR_ID} steps={dashSteps} run={dashTour.run} onFinish={dashTour.finish} />

      {/* Page Header */}
      <div className="bg-white border-b border-line">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold tracking-[0.2em] text-amber-700 uppercase flex items-center gap-2">{t('painel.etiqueta')}{isDemo && <DemoBadge />}</div>
            <h1 className="text-[24px] md:text-[28px] font-extrabold tracking-tight text-ink mt-1" style={{ letterSpacing: '-0.02em' }}>
              <Trans
                t={t}
                i18nKey="painel.titulo"
                components={[<span className="text-forest" key="ganha" />, <span className="text-rose-700" key="perde" />]}
              />
            </h1>
            <p className="text-[13px] text-ink-2 mt-1">{t('painel.subtitulo')}</p>
          </div>
          <div data-tour="dash-header" className="flex flex-wrap items-center gap-2">
            {/* Tier badge — informativo, não clicável (vira link se houver página de billing) */}
            {isPremium ? (
              <span
                className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded text-[10px] font-bold uppercase tracking-[0.14em] bg-forest text-amber-400 border border-forest"
                role="status"
                aria-label={t('painel.planoPro')}
                title={t('painel.planoPro')}
              >
                <Crown className="w-3 h-3" aria-hidden="true" />
                Pro
              </span>
            ) : (
              <span
                className="h-7 px-2.5 inline-flex items-center rounded text-[10px] font-bold uppercase tracking-[0.14em] bg-canvas-2 text-ink-2 border border-line"
                role="status"
                aria-label={t('painel.planoFree')}
                title={t('painel.planoFree')}
              >
                Free
              </span>
            )}

            {/* Toggle R$ / u */}
            <div className="h-9 inline-flex items-center p-0.5 bg-canvas-2 border border-line rounded-md">
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
                title={!isConfigured() ? t('painel.unidade.configurePara') : undefined}
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
              className="h-9 px-2 md:px-2.5 inline-flex items-center gap-1.5 text-[11px] text-ink-2 hover:text-ink border border-line bg-white hover:bg-canvas-2 rounded-md transition-colors"
              title={isConfigured() && config?.unit_value ? `1u = ${formatCurrency(config.unit_value)}` : t('painel.unidade.configurar')}
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
                  <span className="hidden md:inline text-forest font-bold">{t('painel.unidade.configurar')}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => exportBetsToCSV(currentBets, formatValue)}
              className="h-9 px-2 md:px-3 inline-flex items-center gap-2 text-[13px] font-medium text-ink-2 hover:text-ink border border-line bg-white hover:bg-canvas-2 rounded-md transition-colors"
              title={t('painel.acoes.exportarCsv')}
              aria-label={t('painel.acoes.exportarCsv')}
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">{t('painel.acoes.exportar')}</span>
            </button>

            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as DateRangePreset)}
            >
              <SelectTrigger className="theme-rebrand h-9 w-[180px] bg-white border-line text-ink text-[13px] focus:ring-2 focus:ring-forest/10">
                <SelectValue placeholder={t('painel.periodo.placeholder')} />
              </SelectTrigger>
              <SelectContent className="theme-rebrand bg-white border-line text-ink">
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-ink text-[13px] focus:bg-canvas-2 focus:text-ink"
                  >
                    {t(opt.chave)}
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
                      className="h-9 px-3 inline-flex items-center gap-2 text-[13px] bg-white border border-line text-ink hover:bg-canvas-2 rounded-md w-full sm:w-[150px]"
                    >
                      <CalendarIcon className="w-3.5 h-3.5 text-forest" />
                      <span className={customFrom ? 'tabular' : 'text-ink-2'}>
                        {customFrom ? format(customFrom, 'dd/MM/yyyy', { locale: localeDoDateFns() }) : t('painel.periodo.de')}
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
                        nav_button: 'h-7 w-7 bg-white border border-line text-ink-2 hover:bg-canvas-2 hover:text-ink rounded-md inline-flex items-center justify-center',
                        head_cell: 'text-ink-2 rounded-md w-9 font-medium text-[0.7rem] uppercase tracking-[0.08em]',
                        day: 'h-9 w-9 p-0 font-normal text-ink hover:bg-canvas-2 rounded-md aria-selected:opacity-100',
                        day_selected: 'bg-forest text-white hover:bg-forest hover:text-white focus:bg-forest focus:text-white',
                        day_today: 'bg-canvas-2 text-ink font-bold',
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
                      className="h-9 px-3 inline-flex items-center gap-2 text-[13px] bg-white border border-line text-ink hover:bg-canvas-2 rounded-md w-full sm:w-[150px]"
                    >
                      <CalendarIcon className="w-3.5 h-3.5 text-forest" />
                      <span className={customTo ? 'tabular' : 'text-ink-2'}>
                        {customTo ? format(customTo, 'dd/MM/yyyy', { locale: localeDoDateFns() }) : t('painel.periodo.ate')}
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
                        nav_button: 'h-7 w-7 bg-white border border-line text-ink-2 hover:bg-canvas-2 hover:text-ink rounded-md inline-flex items-center justify-center',
                        head_cell: 'text-ink-2 rounded-md w-9 font-medium text-[0.7rem] uppercase tracking-[0.08em]',
                        day: 'h-9 w-9 p-0 font-normal text-ink hover:bg-canvas-2 rounded-md aria-selected:opacity-100',
                        day_selected: 'bg-forest text-white hover:bg-forest hover:text-white focus:bg-forest focus:text-white',
                        day_today: 'bg-canvas-2 text-ink font-bold',
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
          {t('painel.mobile.periodoEsta')}{' '}
          <span
            className={
              currentStats.profit > 0
                ? 'text-forest'
                : currentStats.profit < 0
                  ? 'text-rose-700'
                  : 'text-ink'
            }
          >
            {currentStats.profit > 0
              ? t('painel.mobile.green')
              : currentStats.profit < 0
                ? t('painel.mobile.red')
                : t('painel.mobile.neutro')}
          </span>
        </div>
      </div>

      {/* Mobile hero KPI (substitui StatusStrip no mobile) */}
      <div data-tour="dash-stats-m" className="md:hidden">
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
      </div>

      {/* StatusStrip — desktop only */}
      <div data-tour="dash-stats" className="bg-white border-b border-line hidden md:block">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-6 flex-wrap">
          {/* Banca big + delta + sparkline */}
          <div className="flex items-center gap-4 shrink-0">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-2 font-bold">
                {initialBankroll > 0 ? t('painel.kpi.bancaAtual') : t('painel.kpi.lucroDoPeriodo', { periodo: periodLabel })}
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
              <div className="text-[9px] uppercase tracking-[0.14em] text-ink-2 font-bold">{t('painel.kpi.lucro')}</div>
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
              <div className="text-[9px] uppercase tracking-[0.14em] text-ink-2 font-bold">{t('painel.kpi.roi')}</div>
              <div
                className={`text-[15px] font-extrabold tabular mt-0.5 ${
                  currentStats.roi >= 0 ? 'text-ink' : 'text-rose-700'
                }`}
              >
                {currentStats.roi >= 0 ? '+' : ''}
                {fmtPct(currentStats.roi / 100, 1)}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.14em] text-ink-2 font-bold">{t('painel.kpi.taxaDeAcerto')}</div>
              <div className="text-[15px] font-extrabold tabular text-ink mt-0.5">
                {fmtPct(currentStats.winRate / 100, 1)}
              </div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-[0.14em] text-ink-2 font-bold">{t('painel.kpi.apostas')}</div>
              <div className="text-[15px] font-extrabold tabular text-ink mt-0.5">{currentStats.totalBets}</div>
            </div>
          </div>

        </div>
      </div>

      <main id="main-content" tabIndex={-1} className="max-w-7xl mx-auto px-4 py-6 space-y-4 focus:outline-none">
        {betsLoading ? (
          <div className="bg-white border border-line rounded-xl p-8 text-center text-[13px] text-ink-2">
            {t('painel.carregando')}
          </div>
        ) : (
          <>
            {isDemo && <DemoRibbon show />}
            {/* Tier-aware: Upsell (Free) ou Betinho Narrative + Insight cards (Pro) */}
            <div data-tour="dash-diagnostico" className="space-y-4">
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
                onUpgrade={() => navigate('/planos')}
                onSeeExample={() => setExampleModalOpen(true)}
              />
            )}
            </div>

            {/* Heatmap liga × mercado + DrillDown lateral */}
            <div data-tour="dash-heatmap" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                  onUpgrade={() => navigate('/planos')}
                  onAnalyzeWithAI={isPremium && selectedCell ? () => setSliceModalOpen(true) : undefined}
                />
              </div>
            </div>

            {/* Tag pivot diverging full width */}
            <div data-tour="dash-tags">
              <ProfitByTagChart
                bets={currentBetsWithTags}
                formatValue={(v) => formatValue(v)}
                onAnalyzeTags={(tagNames) => {
                  setTagAnalysisTags(tagNames);
                  setTagAnalysisModalOpen(true);
                }}
              />
            </div>

            {/* Odds + Tempo */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div data-tour="dash-odds" className="lg:col-span-7">
                <OddsHistogram data={oddsData} formatValue={(v) => formatValue(v)} />
              </div>
              <div data-tour="dash-atividade" className="lg:col-span-5">
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
                    <div className="text-[14px] font-bold text-ink">{t('painel.cta.verApostas')}</div>
                    <div className="text-[12px] text-ink-2">{t('painel.cta.verApostasTexto')}</div>
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
                    <div className="text-[14px] font-bold text-ink">{t('painel.cta.fluxoDeCaixa')}</div>
                    <div className="text-[12px] text-ink-2">{t('painel.cta.fluxoDeCaixaTexto')}</div>
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
                  {t('painel.exemplo.etiqueta')}
                </div>
                <DialogTitle className="text-[18px] font-extrabold tracking-tight leading-tight mt-0.5">
                  {t('painel.exemplo.titulo')}
                </DialogTitle>
                <DialogDescription className="text-[11px] text-white/70 mt-1">
                  {t('painel.exemplo.previa', { count: focusedStats.totalBets })}
                </DialogDescription>
              </div>
              <button
                type="button"
                onClick={() => setExampleModalOpen(false)}
                className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 grid place-items-center shrink-0 transition-colors"
                aria-label={t('painel.acoes.fechar')}
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
                  {t('painel.exemplo.poucasApostas')}
                </p>
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="border-t border-line bg-white p-5 flex flex-col sm:flex-row gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setExampleModalOpen(false)}
              className="h-10 px-4 rounded-md border border-line text-[12px] font-bold text-ink-2 hover:text-ink hover:bg-canvas-2 transition-colors flex-1"
            >
              {t('painel.acoes.fechar')}
            </button>
            <button
              type="button"
              onClick={() => {
                setExampleModalOpen(false);
                navigate('/planos');
              }}
              className="h-10 px-5 rounded-md bg-amber-400 text-forest font-extrabold text-[12px] hover:bg-amber-300 transition-colors flex-[2]"
            >
              {t('painel.exemplo.assinar', { valor: PRECO_PRO })}
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

/* Os benefícios guardam CHAVE e não texto: o ícone é código, o rótulo é
   catálogo. A pintura logo abaixo é quem traduz. */
const BENEFICIOS: { Icon: LucideIcon; chave: string }[] = [
  { Icon: BarChart3, chave: 'raioX' },
  { Icon: AlertTriangle, chave: 'vazamentos' },
  { Icon: Lightbulb, chave: 'fatia' },
  { Icon: Shield, chave: 'disciplina' },
];

const UpsellCard: React.FC<UpsellCardProps> = ({ onUpgrade, onSeeExample }) => {
  const { t } = useTranslation('apostas');
  return (
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
            <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400 font-bold inline-flex items-center gap-1.5"><Lock className="w-3 h-3" />{t('painel.upsell.desbloqueie')}</div>
            <div className="text-[12px] text-white/70">
              {t('painel.upsell.disponivelNoPlano')} <span className="font-bold text-amber-400">{t('painel.upsell.proPreco', { valor: PRECO_PRO })}</span>
            </div>
          </div>
        </div>

        <h2 className="text-[20px] md:text-[22px] font-bold tracking-tight leading-tight">
          {t('painel.upsell.tituloLinhaUm')}<br />
          <Trans
            t={t}
            i18nKey="painel.upsell.tituloLinhaDois"
            components={[<span className="text-amber-400" key="destaque" />]}
          />
        </h2>

        <p className="text-[13px] text-white/80 leading-relaxed mt-3 max-w-md">
          {t('painel.upsell.texto')}
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-5">
          <button
            type="button"
            onClick={onUpgrade}
            className="h-10 px-5 rounded-md bg-amber-400 text-forest font-bold text-[13px] hover:bg-amber-300 transition-colors"
          >
            {t('painel.upsell.assinar', { valor: PRECO_PRO })}
          </button>
          <button
            type="button"
            onClick={onSeeExample}
            className="h-10 px-4 rounded-md bg-white/10 border border-white/20 text-white font-bold text-[12px] hover:bg-white/15 transition-colors"
          >
            {t('painel.upsell.verExemplo')}
          </button>
        </div>
      </div>

      <div className="md:col-span-5 space-y-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-amber-400 font-bold mb-1">{t('painel.upsell.voceTera')}</div>
        {BENEFICIOS.map((b) => (
          <div key={b.chave} className="bg-white/5 border border-white/10 rounded-lg p-2.5 flex gap-2.5">
            <div className="w-7 h-7 rounded-md bg-amber-400/15 grid place-items-center shrink-0">
              <b.Icon className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="text-[12px] font-bold leading-tight">{t(`painel.upsell.beneficios.${b.chave}.titulo`)}</div>
              <div className="text-[11px] text-white/65 leading-snug mt-0.5">{t(`painel.upsell.beneficios.${b.chave}.texto`)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
  );
};
