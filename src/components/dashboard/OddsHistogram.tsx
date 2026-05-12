import React, { useMemo, useState } from 'react';
import type { OddsBucket } from '@/utils/dashboardAggregations';

interface OddsHistogramProps {
  data: OddsBucket[];
  formatValue?: (value: number) => string;
}

export const OddsHistogram: React.FC<OddsHistogramProps> = ({
  data,
  formatValue = (v) => `R$ ${v.toFixed(0)}`,
}) => {
  const filledBuckets = data.filter((b) => b.n > 0);
  const totalBets = data.reduce((s, b) => s + b.n, 0);
  const totalProfit = data.reduce((s, b) => s + b.profit, 0);
  const maxAbsRoi = Math.max(...data.map((b) => Math.abs(b.roi)), 10);
  // Default: esconde faixas vazias — consistente com BigHeatmap
  const [hideEmpty, setHideEmpty] = useState(true);
  const hasEmpty = data.some((b) => b.n === 0);
  const displayData = hideEmpty ? filledBuckets : data;

  const sweetSpot = useMemo(() => {
    if (filledBuckets.length === 0) return null;
    // Só conta faixa lucrativa: n >= 3 E ROI positivo (senão "mais lucrativa" engana).
    const candidates = filledBuckets.filter((b) => b.n >= 3 && b.roi > 0);
    if (candidates.length === 0) return null;
    return candidates.reduce((best, b) => (b.roi > best.roi ? b : best), candidates[0]);
  }, [filledBuckets]);

  const sweetSpotShare = useMemo(() => {
    if (!sweetSpot || totalBets === 0) return null;
    const volumeShare = (sweetSpot.n / totalBets) * 100;
    const profitShare = totalProfit !== 0 ? (sweetSpot.profit / totalProfit) * 100 : 0;
    return { volumeShare, profitShare };
  }, [sweetSpot, totalBets, totalProfit]);

  if (filledBuckets.length === 0) {
    return (
      <div className="bg-white border border-line rounded-xl p-5 h-full flex flex-col">
        <div className="text-[10px] uppercase tracking-[0.18em] text-amber-700 font-bold">Faixa de odd</div>
        <h2 className="text-[16px] font-extrabold tracking-tight text-ink mt-1">Onde sua banca prospera (e onde sangra)</h2>
        <p className="text-[13px] text-ink-2 py-8 text-center">Nenhuma aposta encerrada no período</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-line rounded-xl p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-amber-700 font-bold">Faixa de odd</div>
          <h2 className="text-[16px] font-extrabold tracking-tight text-ink mt-1">Onde sua banca prospera (e onde sangra)</h2>
        </div>
        {hasEmpty && (
          <button
            type="button"
            onClick={() => setHideEmpty((v) => !v)}
            className={`shrink-0 h-7 px-2.5 text-[11px] font-medium rounded-md inline-flex items-center gap-1 transition-colors ${
              hideEmpty
                ? 'bg-forest-tint text-forest border border-forest/30'
                : 'bg-white text-ink-2 border border-line hover:bg-ink-3/40'
            }`}
            aria-pressed={hideEmpty}
            title={hideEmpty ? 'Mostrar todas as faixas (inclusive vazias)' : 'Esconder faixas sem dados'}
          >
            {hideEmpty ? 'Mostrar tudo' : 'Esconder vazios'}
          </button>
        )}
      </div>

      {/* Bars */}
      <div
        className="grid gap-2 items-end"
        style={{ gridTemplateColumns: `repeat(${displayData.length}, 1fr)` }}
      >
        {displayData.map((b) => {
          const height = b.n === 0 ? 4 : Math.max(8, (Math.abs(b.roi) / maxAbsRoi) * 100);
          const isPositive = b.roi > 0;
          const isEmpty = b.n === 0;
          return (
            <div key={b.range} className="flex flex-col items-center gap-1">
              <div
                className={`text-[10px] tabular font-bold ${
                  isEmpty ? 'text-ink-2/50' : isPositive ? 'text-forest' : 'text-rose-700'
                }`}
              >
                {isEmpty ? '—' : `${b.roi > 0 ? '+' : ''}${b.roi.toFixed(0)}%`}
              </div>
              <div className="w-full h-32 flex items-end">
                <div
                  className={`w-full rounded-t transition-all ${
                    isEmpty ? 'bg-ink-3/40' : isPositive ? 'bg-forest' : 'bg-rose-700'
                  }`}
                  style={{ height: `${height}%` }}
                  title={
                    isEmpty
                      ? `${b.range}: sem dados`
                      : `${b.range}: ${b.n} apostas, ROI ${b.roi.toFixed(1)}%, ${formatValue(b.profit)}`
                  }
                />
              </div>
              <div className="text-[10px] tabular text-ink font-bold">{b.range}</div>
              <div className="text-[9px] tabular text-ink-2">{isEmpty ? '—' : `n=${b.n}`}</div>
            </div>
          );
        })}
      </div>

      {/* Faixa mais lucrativa */}
      <div className="mt-auto pt-3 border-t border-line text-[12px] text-ink-2 leading-relaxed">
        {sweetSpot && sweetSpotShare ? (
          <>
            <span className="text-ink font-bold">Faixa mais lucrativa:</span> apostas entre{' '}
            <span className="text-forest font-bold tabular">{sweetSpot.range}</span> respondem por{' '}
            <span className="text-ink font-bold tabular">{sweetSpotShare.volumeShare.toFixed(0)}%</span> do volume
            {totalProfit > 0 && sweetSpot.profit > 0 ? (
              <>
                {' '}e{' '}
                <span className="text-ink font-bold tabular">{sweetSpotShare.profitShare.toFixed(0)}%</span> do lucro.
              </>
            ) : sweetSpot.profit > 0 ? (
              <>
                {' '}e geram{' '}
                <span className="text-forest font-bold tabular">+{formatValue(sweetSpot.profit)}</span> de lucro (acima da média).
              </>
            ) : (
              <>
                {' '}com ROI{' '}
                <span className="text-forest font-bold tabular">{sweetSpot.roi.toFixed(1)}%</span>.
              </>
            )}
          </>
        ) : (
          <>Nenhuma faixa de odd com volume mínimo (≥3 apostas) e ROI positivo no período.</>
        )}
      </div>
    </div>
  );
};
