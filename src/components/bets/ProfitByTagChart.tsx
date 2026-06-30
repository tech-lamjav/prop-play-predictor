import React, { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Bet } from '@/hooks/use-bets';
import { aggregateTagPivot, type BetWithTags } from '@/utils/dashboardAggregations';

export type { BetWithTags };

interface ProfitByTagChartProps {
  bets: BetWithTags[];
  formatValue?: (value: number) => string;
  /** @deprecated mantido pra compatibilidade; o componente agora dimensiona-se pelo número de linhas. */
  chartHeight?: number;
  /** Quando passado, mostra "Analisar X tag(s)" ao selecionar ≥1 tag. */
  onAnalyzeTags?: (tagNames: string[]) => void;
}

const MAX_DEFAULT = 8;

export const ProfitByTagChart: React.FC<ProfitByTagChartProps> = ({
  bets,
  formatValue = (v) => `R$ ${v.toFixed(0)}`,
  onAnalyzeTags,
}) => {
  const allEntries = useMemo(() => aggregateTagPivot(bets), [bets]);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);

  const displayEntries = useMemo(() => {
    if (selectedTagNames.length === 0) {
      // top by absolute profit
      return [...allEntries]
        .sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit))
        .slice(0, MAX_DEFAULT);
    }
    return allEntries.filter((e) => selectedTagNames.includes(e.name));
  }, [allEntries, selectedTagNames]);

  const maxAbsProfit = useMemo(
    () => Math.max(...displayEntries.map((e) => Math.abs(e.profit)), 1),
    [displayEntries]
  );

  const toggleTag = (name: string) => {
    setSelectedTagNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : prev.length >= 8 ? prev : [...prev, name]
    );
  };

  const clearSelection = () => setSelectedTagNames([]);

  if (allEntries.length === 0) {
    return (
      <div className="bg-white border border-line rounded-xl p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-amber-700 font-bold">Pivot dinâmico</div>
        <h2 className="text-[16px] font-extrabold tracking-tight text-ink mt-1">Performance pelas tags que você criou</h2>
        <p className="text-[13px] text-ink-2 py-8 text-center">Nenhuma aposta com tag no período</p>
      </div>
    );
  }

  const hasSelection = selectedTagNames.length > 0;

  return (
    <div className="bg-white border border-line rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-1">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-amber-700 font-bold">Pivot dinâmico</div>
          <h2 className="text-[16px] font-extrabold tracking-tight text-ink mt-1">Performance pelas tags que você criou</h2>
          <p className="text-[12px] text-ink-2 mt-0.5">
            {hasSelection
              ? `${selectedTagNames.length} ${selectedTagNames.length === 1 ? 'tag selecionada' : 'tags selecionadas'} (máx 8)`
              : `Top ${Math.min(MAX_DEFAULT, allEntries.length)} por valor absoluto. Selecione tags pra comparar.`}
          </p>
        </div>
        {hasSelection && onAnalyzeTags && (
          <button
            type="button"
            onClick={() => onAnalyzeTags(selectedTagNames)}
            className="h-9 px-3 inline-flex items-center gap-1.5 text-[12px] font-extrabold text-forest bg-amber-400 hover:bg-amber-300 rounded-md transition-colors shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Analisar{' '}
            {selectedTagNames.length === 1
              ? selectedTagNames[0]
              : `${selectedTagNames.length} tags`}
          </button>
        )}
      </div>

      {/* Tag chips */}
      <div className="flex flex-wrap gap-1.5 my-4 pb-4 border-b border-line">
        {allEntries.map((entry) => {
          const selected = selectedTagNames.includes(entry.name);
          return (
            <button
              key={entry.name}
              type="button"
              onClick={() => toggleTag(entry.name)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                selected
                  ? 'bg-forest text-white border-forest'
                  : 'bg-white text-ink border-line hover:border-forest/50'
              }`}
            >
              {selected && <span aria-hidden="true">✓</span>}
              {entry.color && (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
              )}
              <span>{entry.name}</span>
              <span className={`tabular text-[9px] ${selected ? 'text-amber-300' : 'text-ink-2'}`}>n={entry.n}</span>
            </button>
          );
        })}
        {hasSelection && (
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border border-line bg-white text-ink-2 hover:text-status-danger hover:border-status-danger transition-colors"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Mini-legenda: ponto da tag = identidade da tag, cor da barra = desempenho */}
      {displayEntries.length > 0 && (
        <div className="flex items-center justify-end gap-3 text-[10px] text-ink-2 mb-2 -mt-1">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-ink-3 border border-line" /> identidade da tag
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-1.5 rounded-sm bg-forest" /> lucro
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-1.5 rounded-sm bg-rose-700" /> prejuízo
          </span>
        </div>
      )}

      {/* Bars */}
      {displayEntries.length === 0 ? (
        <p className="text-[12px] text-ink-2 py-4 text-center">Nenhum dado para as tags selecionadas</p>
      ) : (
        <>
          {/* Desktop: diverging bars (centered on zero) */}
          <div className="hidden md:block space-y-2">
            {displayEntries.map((entry) => {
              const pct = (Math.abs(entry.profit) / maxAbsProfit) * 50; // half of bar
              const positive = entry.profit >= 0;
              return (
                <div
                  key={entry.name}
                  className="grid items-center gap-3 text-[11px]"
                  style={{ gridTemplateColumns: '140px 1fr 80px 50px' }}
                >
                  <div className="text-ink font-bold truncate flex items-center gap-1.5" title={entry.name}>
                    {entry.color && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                    )}
                    <span className="truncate">{entry.name}</span>
                  </div>
                  <div className="relative h-5 bg-ink-3/40 rounded overflow-hidden">
                    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-line" />
                    {positive ? (
                      <div
                        className="absolute top-0.5 bottom-0.5 bg-forest rounded-r"
                        style={{ left: '50%', width: `${pct}%` }}
                      />
                    ) : (
                      <div
                        className="absolute top-0.5 bottom-0.5 bg-rose-700 rounded-l"
                        style={{ right: '50%', width: `${pct}%` }}
                      />
                    )}
                  </div>
                  <div
                    className={`text-right tabular font-bold ${
                      positive ? 'text-forest' : 'text-rose-700'
                    }`}
                    title={`${entry.profit > 0 ? '+' : ''}${formatValue(entry.profit)} · ROI ${entry.roi.toFixed(1)}%`}
                  >
                    {entry.roi > 0 ? '+' : ''}{entry.roi.toFixed(1)}%
                  </div>
                  <div className="text-right text-ink-2 tabular">n={entry.n}</div>
                </div>
              );
            })}
          </div>

          {/* Mobile: stacked layout (single-direction bar, color indica sinal) */}
          <div className="md:hidden space-y-3">
            {displayEntries.map((entry) => {
              const maxRoi = Math.max(...displayEntries.map((e) => Math.abs(e.roi)), 1);
              const width = (Math.abs(entry.roi) / maxRoi) * 100;
              const positive = entry.roi >= 0;
              return (
                <div key={entry.name}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {entry.color && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: entry.color }}
                        />
                      )}
                      <span className="text-[12px] font-bold text-ink truncate">{entry.name}</span>
                    </div>
                    <span
                      className={`text-[12px] font-bold tabular shrink-0 ${
                        positive ? 'text-forest' : 'text-rose-700'
                      }`}
                    >
                      {entry.roi > 0 ? '+' : ''}{entry.roi.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-ink-3/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${positive ? 'bg-forest' : 'bg-rose-700'}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-ink-2 tabular">
                    <span>n={entry.n}</span>
                    <span title={`Lucro · ROI ${entry.roi.toFixed(1)}%`}>
                      {entry.profit > 0 ? '+' : ''}{formatValue(entry.profit)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
