import React, { useMemo, useState } from 'react';
import { compactify, type HeatmapData, type HeatmapCell } from '@/utils/dashboardAggregations';

export type HeatmapMetric = 'roi' | 'profit' | 'volume';

interface BigHeatmapProps {
  data: HeatmapData;
  selectedCell: { l: number; m: number } | null;
  onSelectCell: (cell: { l: number; m: number; league: string; market: string } | null) => void;
  metric?: HeatmapMetric;
  onMetricChange?: (metric: HeatmapMetric) => void;
  formatValue?: (value: number) => string;
  /** Versão compacta pra mobile: cell menor, fontes menores, labels mais curtos. */
  compact?: boolean;
}

const colorForCell = (cell: HeatmapCell, metric: HeatmapMetric, maxAbsProfit: number, maxVolume: number): string => {
  if (cell.n === 0) return '#f1f5f4';
  if (metric === 'volume') {
    const t = Math.min(cell.n / Math.max(maxVolume, 1), 1);
    // gray → forest gradient based on volume
    return `rgb(${Math.round(241 + (10 - 241) * t)},${Math.round(245 + (61 - 245) * t)},${Math.round(244 + (46 - 244) * t)})`;
  }
  const value = metric === 'roi' ? cell.roi : cell.profit;
  if (value == null) return '#f1f5f4';
  if (value > 0) {
    const t = metric === 'roi'
      ? Math.min(value / 25, 1)
      : Math.min(value / Math.max(maxAbsProfit, 1), 1);
    return `rgb(${Math.round(241 + (10 - 241) * t)},${Math.round(245 + (61 - 245) * t)},${Math.round(244 + (46 - 244) * t)})`;
  }
  const t = metric === 'roi'
    ? Math.min(Math.abs(value) / 25, 1)
    : Math.min(Math.abs(value) / Math.max(maxAbsProfit, 1), 1);
  // gray → rose
  return `rgb(${Math.round(241 + (190 - 241) * t)},${Math.round(245 + (18 - 245) * t)},${Math.round(244 + (60 - 244) * t)})`;
};

/**
 * Threshold de contraste alinhado com `colorForCell`: quando a intensidade da cor
 * (t = 0..1) passa de 0.5, o background fica escuro e o texto deve ser branco.
 */
const textColorForCell = (
  cell: HeatmapCell,
  metric: HeatmapMetric,
  maxAbsProfit: number,
  maxVolume: number
): string => {
  if (cell.n === 0) return '#cbd5e1';
  let t = 0;
  if (metric === 'volume') {
    t = maxVolume > 0 ? cell.n / maxVolume : 0;
  } else if (metric === 'profit') {
    t = maxAbsProfit > 0 ? Math.abs(cell.profit) / maxAbsProfit : 0;
  } else if (metric === 'roi' && cell.roi != null) {
    t = Math.min(Math.abs(cell.roi) / 25, 1);
  }
  return t > 0.5 ? '#fff' : '#1a1d1a';
};

const formatRoi = (roi: number) => `${roi > 0 ? '+' : ''}${roi.toFixed(0)}%`;


export const BigHeatmap: React.FC<BigHeatmapProps> = ({
  data,
  selectedCell,
  onSelectCell,
  metric = 'roi',
  onMetricChange,
  formatValue = (v) => `R$ ${v.toFixed(0)}`,
  compact = false,
}) => {
  const [hoveredCell, setHoveredCell] = useState<{ l: number; m: number } | null>(null);
  // Esconde linhas/colunas inteiramente vazias por padrão — usuário mais comum só quer ver o que realmente apostou
  const [hideEmpty, setHideEmpty] = useState(true);

  const { maxAbsProfit, maxVolume } = useMemo(() => {
    let maxP = 0;
    let maxV = 0;
    data.cells.forEach((c) => {
      if (Math.abs(c.profit) > maxP) maxP = Math.abs(c.profit);
      if (c.n > maxV) maxV = c.n;
    });
    return { maxAbsProfit: maxP, maxVolume: maxV };
  }, [data.cells]);

  // Quando hideEmpty = true, descarta ligas/mercados sem nenhuma célula com n > 0.
  // Mantém os índices originais (originalL/originalM) para preservar selectedCell e data.cells.find()
  const { displayLeagueIndices, displayMarketIndices, hiddenCount } = useMemo(() => {
    if (!hideEmpty) {
      return {
        displayLeagueIndices: data.leagues.map((_, l) => l),
        displayMarketIndices: data.markets.map((_, m) => m),
        hiddenCount: 0,
      };
    }
    const leagueIdx = data.leagues
      .map((_, l) => (data.cells.some((c) => c.l === l && c.n > 0) ? l : -1))
      .filter((l) => l !== -1);
    const marketIdx = data.markets
      .map((_, m) => (data.cells.some((c) => c.m === m && c.n > 0) ? m : -1))
      .filter((m) => m !== -1);
    const hidden = (data.leagues.length - leagueIdx.length) + (data.markets.length - marketIdx.length);
    return { displayLeagueIndices: leagueIdx, displayMarketIndices: marketIdx, hiddenCount: hidden };
  }, [data, hideEmpty]);

  if (data.leagues.length === 0 || data.markets.length === 0) {
    return (
      <div className="bg-white border border-line rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-ink-2 font-bold">ROI por liga × mercado</div>
            <div className="text-[12px] text-ink-2 mt-0.5">Green = lucro · red = prejuízo · cinza = sem volume</div>
          </div>
        </div>
        <p className="text-[13px] text-ink-2 py-8 text-center">Nenhuma aposta encerrada no período</p>
      </div>
    );
  }

  const renderCellValue = (cell: HeatmapCell) => {
    if (cell.n === 0) return <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-ink-2`}>{compact ? '—' : 'sem dados'}</span>;
    if (metric === 'roi' && cell.roi != null) {
      return (
        <>
          <div className={`font-bold tabular leading-none ${compact ? 'text-[14px]' : 'text-[18px]'}`}>{formatRoi(cell.roi)}</div>
          <div className={`tabular opacity-80 mt-1 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
            n={cell.n}{compact ? '' : ` · ${cell.profit > 0 ? '+' : ''}${formatValue(cell.profit)}`}
          </div>
        </>
      );
    }
    if (metric === 'profit') {
      const profitStr = compact ? compactify(formatValue(cell.profit)) : formatValue(cell.profit);
      return (
        <>
          <div className={`font-bold tabular leading-none ${compact ? 'text-[11px]' : 'text-[14px]'}`}>{cell.profit > 0 ? '+' : ''}{profitStr}</div>
          <div className={`tabular opacity-80 mt-1 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>n={cell.n}</div>
        </>
      );
    }
    // volume
    return (
      <>
        <div className={`font-bold tabular leading-none ${compact ? 'text-[14px]' : 'text-[18px]'}`}>{cell.n}</div>
        <div className={`tabular opacity-80 mt-1 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>apostas</div>
      </>
    );
  };

  return (
    <div className="bg-white border border-line rounded-xl p-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-ink-2 font-bold">ROI por liga × mercado</div>
          <div className="text-[12px] text-ink-2 mt-0.5">
            {selectedCell
              ? 'Clique novamente pra desselecionar'
              : compact
                ? 'Toque numa célula pra ver detalhes'
                : 'Clique numa célula pra ver detalhes ao lado'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          {/* Toggle "Esconder vazios" — só aparece se há algo a esconder */}
          {(hideEmpty || data.leagues.some((_, l) => !data.cells.some((c) => c.l === l && c.n > 0))
             || data.markets.some((_, m) => !data.cells.some((c) => c.m === m && c.n > 0))) && (
            <button
              type="button"
              onClick={() => setHideEmpty((v) => !v)}
              className={`rounded-md font-medium tracking-tight transition-colors inline-flex items-center gap-1 ${
                compact ? 'h-9 px-2.5 text-[11px]' : 'h-7 px-2.5 text-[11px]'
              } ${
                hideEmpty
                  ? 'bg-forest-tint text-forest border border-forest/30'
                  : 'bg-white text-ink-2 border border-line hover:bg-ink-3/40'
              }`}
              title={hideEmpty ? `${hiddenCount} ${hiddenCount === 1 ? 'linha/coluna oculta' : 'linhas/colunas ocultas'}. Clique para mostrar todas.` : 'Esconder linhas e colunas vazias'}
              aria-pressed={hideEmpty}
            >
              {hideEmpty ? 'Mostrar tudo' : 'Esconder vazios'}
            </button>
          )}
          {onMetricChange && (
            <div className="flex gap-1">
              {(['roi', 'profit', 'volume'] as const).map((m) => {
                const label = compact
                  ? m === 'roi' ? 'ROI' : m === 'profit' ? 'R$' : 'Vol'
                  : m === 'roi' ? 'ROI' : m === 'profit' ? 'Lucro' : 'Volume';
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onMetricChange(m)}
                    className={`rounded-md font-extrabold uppercase tracking-[0.08em] transition-colors ${
                      compact ? 'h-9 px-3 text-[11px]' : 'h-7 px-2.5 text-[10px]'
                    } ${
                      metric === m
                        ? 'bg-forest text-white'
                        : 'bg-white text-ink-2 border border-line hover:bg-ink-3/40'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div
          className={`grid ${compact ? 'gap-1' : 'gap-1.5'}`}
          style={{
            gridTemplateColumns: compact
              ? `minmax(78px, 96px) repeat(${displayMarketIndices.length}, minmax(68px, 1fr))`
              : `minmax(120px, 160px) repeat(${displayMarketIndices.length}, minmax(96px, 1fr))`,
            minWidth: compact ? Math.max(78 + displayMarketIndices.length * 68, 320) : 640,
          }}
        >
          {/* Header row: corner + market labels */}
          <div />
          {displayMarketIndices.map((m) => (
            <div
              key={`mk-${m}`}
              className="pb-2 px-1 min-w-0"
              title={data.markets[m]}
            >
              <div
                className={`font-bold text-ink tabular truncate text-center ${compact ? 'text-[10px]' : 'text-[11px]'}`}
              >
                {data.markets[m]}
              </div>
            </div>
          ))}

          {/* Rows — usa display: contents pra não criar wrapper no grid (Fragment não aceita data-lov-id do plugin lovable) */}
          {displayLeagueIndices.map((l) => {
            const lg = data.leagues[l];
            return (
            <div key={`row-${l}`} className="contents">
              <div
                className={`flex items-center justify-end min-w-0 ${compact ? 'pr-1.5' : 'pr-3'}`}
                title={lg}
              >
                <div
                  className={`w-full font-bold text-ink truncate text-right ${
                    compact ? 'text-[10px]' : 'text-[12px]'
                  }`}
                >
                  {lg}
                </div>
              </div>
              {displayMarketIndices.map((m) => {
                const mk = data.markets[m];
                const cell = data.cells.find((c) => c.l === l && c.m === m);
                if (!cell) return <div key={`c-${l}-${m}`} />;
                const isSelected = selectedCell?.l === l && selectedCell?.m === m;
                const isHovered = hoveredCell?.l === l && hoveredCell?.m === m;
                const clickable = cell.n > 0;
                const bg = colorForCell(cell, metric, maxAbsProfit, maxVolume);
                const fg = textColorForCell(cell, metric, maxAbsProfit, maxVolume);
                return (
                  <button
                    key={`c-${l}-${m}`}
                    type="button"
                    disabled={!clickable}
                    onClick={() => {
                      if (!clickable) return;
                      if (isSelected) {
                        onSelectCell(null);
                      } else {
                        onSelectCell({ l, m, league: lg, market: mk });
                      }
                    }}
                    onMouseEnter={() => clickable && setHoveredCell({ l, m })}
                    onMouseLeave={() => setHoveredCell(null)}
                    className={`relative rounded transition-all flex flex-col items-center justify-center text-center px-1 ${
                      compact ? 'h-[44px]' : 'h-[60px]'
                    } ${clickable ? 'cursor-pointer' : 'cursor-default'} ${
                      isSelected ? 'ring-2 ring-amber-400 ring-offset-1' : isHovered ? 'ring-2 ring-forest' : ''
                    }`}
                    style={{ backgroundColor: bg, color: fg }}
                    title={
                      cell.n === 0
                        ? `${lg} · ${mk} — sem dados`
                        : `${lg} · ${mk} — ${cell.n} apostas, ROI ${cell.roi?.toFixed(1)}%, ${formatValue(cell.profit)}`
                    }
                  >
                    {renderCellValue(cell)}
                  </button>
                );
              })}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
