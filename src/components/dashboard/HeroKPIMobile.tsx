import React from 'react';
import { useTranslation } from 'react-i18next';
import { fmtPct } from '@/utils/formato';
import { Sparkline } from './Sparkline';
import type { DateRangePreset } from '@/utils/bettingStats';

interface HeroKPIMobileProps {
  profit: number;
  roi: number;
  winRate: number;
  totalBets: number;
  sparklineData: number[];
  formatValue: (v: number) => string;
  periodLabel: string;
  showTrend?: boolean;
  profitTrendPct?: number;
  roiTrendPct?: number;
  /** Período atual + callback pra trocar via chips inline. Quando ausente, chips não aparecem. */
  currentPeriod?: DateRangePreset;
  onPeriodChange?: (period: DateRangePreset) => void;
}

/* Tabela fora do componente: guarda CHAVE, nunca texto. */
const PERIOD_CHIPS: { value: DateRangePreset; chave: string }[] = [
  { value: '7', chave: 'painel.heroMobile.chips.d7' },
  { value: '30', chave: 'painel.heroMobile.chips.d30' },
  { value: '90', chave: 'painel.heroMobile.chips.d90' },
];

export const HeroKPIMobile: React.FC<HeroKPIMobileProps> = ({
  profit,
  roi,
  winRate,
  totalBets,
  sparklineData,
  formatValue,
  periodLabel,
  showTrend = false,
  profitTrendPct = 0,
  roiTrendPct = 0,
  currentPeriod,
  onPeriodChange,
}) => {
  const { t } = useTranslation('apostas');
  const isPositive = profit >= 0;

  return (
    <div className="relative overflow-hidden rounded-xl bg-forest text-white p-5 mx-4 mt-4 md:hidden">
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '8px 8px',
        }}
      />

      <div className="relative">
        {/* Eyebrow + period chips */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] uppercase tracking-[0.18em] font-extrabold text-amber-400 min-w-0 truncate">
            ROI · {periodLabel}
          </div>
          {onPeriodChange && (
            <div className="flex gap-1 shrink-0">
              {PERIOD_CHIPS.map((chip) => {
                const isOn = currentPeriod === chip.value;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => onPeriodChange(chip.value)}
                    className={`h-5 px-1.5 text-[9px] font-extrabold rounded transition-colors ${
                      isOn ? 'bg-amber-400 text-forest' : 'bg-white/10 text-white/60 hover:text-white/80'
                    }`}
                  >
                    {t(chip.chave)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Big ROI + delta */}
        <div className="flex items-end justify-between mt-1.5 gap-3">
          <div className="flex items-baseline gap-2 min-w-0">
            <div
              className={`text-[38px] font-bold tabular leading-none ${
                roi >= 0 ? 'text-amber-400' : 'text-rose-300'
              }`}
              style={{ letterSpacing: '-0.02em' }}
            >
              {roi >= 0 ? '+' : ''}
              {fmtPct(roi / 100, 1)}
            </div>
            {showTrend && Math.abs(roiTrendPct) >= 0.01 && (
              <div
                className={`text-[11px] font-bold tabular ${
                  roiTrendPct >= 0 ? 'text-amber-400' : 'text-rose-300'
                }`}
              >
                {roiTrendPct >= 0 ? '+' : ''}
                {fmtPct(roiTrendPct / 100, 1)}
              </div>
            )}
          </div>
          {sparklineData.length >= 2 && (
            <Sparkline
              data={sparklineData}
              width={110}
              height={32}
              color={isPositive ? '#fbbf24' : '#fda4af'}
              strokeWidth={1.5}
              className="shrink-0"
            />
          )}
        </div>

        {/* Mini KPIs */}
        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-3">
          <div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-white/60 font-bold">{t('painel.heroMobile.lucro')}</div>
            <div
              className={`text-[15px] font-bold tabular mt-0.5 ${
                profit >= 0 ? 'text-amber-400' : 'text-rose-300'
              }`}
            >
              {profit >= 0 ? '+' : ''}
              {formatValue(profit)}
            </div>
            {showTrend && Math.abs(profitTrendPct) >= 0.01 && (
              <div
                className={`text-[10px] tabular ${
                  profitTrendPct >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {profitTrendPct >= 0 ? '+' : ''}
                {fmtPct(profitTrendPct / 100, 1)}
              </div>
            )}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-white/60 font-bold">{t('painel.heroMobile.taxaDeAcerto')}</div>
            <div className="text-[15px] font-bold tabular text-white mt-0.5">{fmtPct(winRate / 100, 0)}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[0.14em] text-white/60 font-bold">{t('painel.heroMobile.apostas')}</div>
            <div className="text-[15px] font-bold tabular text-white mt-0.5">{totalBets}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
