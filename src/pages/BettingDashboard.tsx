import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useBets } from '@/hooks/use-bets';
import { useUserUnit } from '@/hooks/use-user-unit';
import { useIsMobile } from '@/hooks/use-mobile';
import { createClient } from '@/integrations/supabase/client';
import { BetsHeader } from '@/components/bets/BetsHeader';
import { BetStatsCard } from '@/components/bets/BetStatsCard';
import { BankrollEvolutionChart } from '@/components/bets/BankrollEvolutionChart';
import { ProfitBySportChart } from '@/components/bets/ProfitBySportChart';
import { ProfitByMarketChart } from '@/components/bets/ProfitByMarketChart';
import { ProfitByLeagueChart } from '@/components/bets/ProfitByLeagueChart';
import { ProfitByTagChart, type BetWithTags } from '@/components/bets/ProfitByTagChart';
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
import { UnitConfigurationModal } from '@/components/UnitConfigurationModal';
import { BarChart3, ChevronRight, DollarSign, Target, Download, Send, AlertCircle } from 'lucide-react';

const PERIOD_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: 'month', label: 'Este mês' },
  { value: 'ytd', label: 'Este ano (YTD)' },
  { value: 'all', label: 'Período total' },
];

export default function BettingDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { bets, isLoading: betsLoading } = useBets(user?.id ?? '');
  const { toUnits, formatUnits, formatCurrency, isConfigured, refetchConfig } = useUserUnit();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 200 : 280;
  const bankrollChartHeight = isMobile ? 200 : 300;
  const [period, setPeriod] = useState<DateRangePreset>('30');
  const [showUnitsView, setShowUnitsView] = useState(false);
  const [unitConfigOpen, setUnitConfigOpen] = useState(false);
  const [betsWithTags, setBetsWithTags] = useState<BetWithTags[]>([]);
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

  const { from, to } = useMemo(() => getDateRangeForPreset(period), [period]);
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

  const showTrend = period !== 'all';
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
  const winRateTrend = useMemo(
    () =>
      showTrend
        ? compareTrend(currentStats.winRate, previousStats.winRate, true)
        : { trend: 'neutral' as const, pctChange: 0 },
    [showTrend, currentStats.winRate, previousStats.winRate]
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-terminal-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-terminal-green" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-terminal-black text-terminal-text flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-terminal-red" />
          <p>Por favor, faça login para ver o dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-terminal-black text-terminal-text">
      <BetsHeader
        showUnitsView={showUnitsView}
        onShowUnitsViewChange={setShowUnitsView}
        onUnitConfigClick={() => setUnitConfigOpen(true)}
        unitsConfigured={isConfigured()}
      />

      <main className="container mx-auto px-3 py-4 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h1 className="section-title flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-terminal-green" />
            DASHBOARD DE APOSTAS
          </h1>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <button
              type="button"
              onClick={() => exportBetsToCSV(currentBets, formatValue)}
              className="terminal-button px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 border-terminal-border hover:border-terminal-green transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar dados (CSV)
            </button>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as DateRangePreset)}
            >
              <SelectTrigger className="w-full sm:w-[200px] bg-terminal-dark-gray border-terminal-border text-terminal-text">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="bg-terminal-dark-gray border-terminal-border text-terminal-text">
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-terminal-text focus:bg-terminal-gray focus:text-terminal-text"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <BetStatsCard
            label="LUCRO"
            value={formatValue(currentStats.profit)}
            valueColor={
              currentStats.profit >= 0
                ? 'text-terminal-green'
                : 'text-terminal-red'
            }
            trend={
              currentStats.profit > 0
                ? 'up'
                : currentStats.profit < 0
                  ? 'down'
                  : undefined
            }
            subtext={
              showTrend && Math.abs(profitTrend.pctChange) >= 0.01
                ? `vs período anterior: ${profitTrend.pctChange >= 0 ? '+' : ''}${profitTrend.pctChange.toFixed(1)}%`
                : undefined
            }
          />
          <BetStatsCard
            label="ROI"
            value={`${currentStats.roi.toFixed(1)}%`}
            valueColor={
              currentStats.roi >= 0
                ? 'text-terminal-green'
                : 'text-terminal-red'
            }
            trend={
              currentStats.roi > 0
                ? 'up'
                : currentStats.roi < 0
                  ? 'down'
                  : undefined
            }
            subtext={
              showTrend && Math.abs(roiTrend.pctChange) >= 0.01
                ? `vs período anterior: ${roiTrend.pctChange >= 0 ? '+' : ''}${roiTrend.pctChange.toFixed(1)}%`
                : undefined
            }
          />
          <BetStatsCard
            label="TAXA DE ACERTO"
            value={`${currentStats.winRate.toFixed(1)}%`}
            trend={
              currentStats.winRate > 50
                ? 'up'
                : currentStats.winRate < 50
                  ? 'down'
                  : undefined
            }
            subtext={
              showTrend && Math.abs(winRateTrend.pctChange) >= 0.01
                ? `vs período anterior: ${winRateTrend.pctChange >= 0 ? '+' : ''}${winRateTrend.pctChange.toFixed(1)}%`
                : undefined
            }
          />
          <BetStatsCard
            label="TOTAL APOSTADO"
            value={formatValue(currentStats.totalStaked)}
            valueColor="text-terminal-text"
          />
          <BetStatsCard
            label="RETORNO TOTAL"
            value={formatValue(currentStats.totalReturn)}
            valueColor="text-terminal-green"
          />
          <BetStatsCard
            label="APOSTAS"
            value={currentStats.totalBets}
            valueColor="text-terminal-text"
          />
        </div>

        {betsLoading ? (
          <div className="terminal-container p-8 text-center opacity-60">
            Carregando apostas...
          </div>
        ) : (
          <>
            <div className="space-y-6">
              <BankrollEvolutionChart
                bets={currentBets}
                initialBankroll={0}
                onUpdateBankroll={async () => false}
                readOnly
                chartHeight={bankrollChartHeight}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ProfitBySportChart
                  bets={currentBets}
                  formatValue={(v) => formatValue(v)}
                  chartHeight={chartHeight}
                />
                <ProfitByLeagueChart
                  bets={currentBets}
                  formatValue={(v) => formatValue(v)}
                  chartHeight={chartHeight}
                />
                <ProfitByMarketChart
                  bets={currentBets}
                  formatValue={(v) => formatValue(v)}
                  chartHeight={chartHeight}
                />
                <ProfitByTagChart
                  bets={currentBetsWithTags}
                  formatValue={(v) => formatValue(v)}
                  chartHeight={chartHeight}
                />
              </div>

              {/* Links: Ver apostas + Fluxo de caixa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/bets')}
                  className="w-full terminal-container p-4 flex items-center justify-between hover:bg-terminal-dark-gray/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-terminal-green/10 flex items-center justify-center group-hover:bg-terminal-green/20 transition-colors">
                      <Target className="w-5 h-5 text-terminal-green" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-sm text-terminal-green">
                        VER APOSTAS
                      </div>
                      <div className="text-xs opacity-60">
                        Lista completa e filtros
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-terminal-green opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/bankroll')}
                  className="w-full terminal-container p-4 flex items-center justify-between hover:bg-terminal-dark-gray/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                      <DollarSign className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-sm text-blue-400">
                        FLUXO DE CAIXA
                      </div>
                      <div className="text-xs opacity-60">
                        Histórico detalhado de transações
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-blue-400 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>
              </div>
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

      <a
        href="https://t.me/betinho_assistente_bot"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#0088cc] hover:bg-[#006da3] text-white px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105"
        title="Abrir Telegram"
      >
        <Send size={20} />
        <span className="hidden sm:inline text-sm font-medium">Telegram</span>
      </a>
    </div>
  );
}
