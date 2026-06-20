import React from 'react';
import { Sparkles, ArrowRight, MousePointer2 } from 'lucide-react';
import { Sparkline } from './Sparkline';
import { computeDrillDown } from '@/utils/dashboardAggregations';
import type { Bet } from '@/hooks/use-bets';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DrillDownProps {
  bets: Bet[];
  selectedCell: { league: string; market: string } | null;
  isPremium: boolean;
  formatValue?: (value: number) => string;
  onViewAllBets?: () => void;
  onAnalyzeWithAI?: () => void;
  onUpgrade?: () => void;
}

export const DrillDown: React.FC<DrillDownProps> = ({
  bets,
  selectedCell,
  isPremium,
  formatValue = (v) => `R$ ${v.toFixed(2)}`,
  onViewAllBets,
  onAnalyzeWithAI,
  onUpgrade,
}) => {
  if (!selectedCell) {
    return (
      <div className="bg-white border-2 border-dashed border-forest/40 rounded-xl p-5 h-full flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-forest-tint grid place-items-center mb-3">
          <MousePointer2 className="w-5 h-5 text-forest" />
        </div>
        <div className="text-[13px] font-bold text-ink">Selecione uma fatia</div>
        <p className="text-[12px] text-ink-2 mt-1 max-w-[220px]">
          Clique numa célula do mapa pra ver as apostas, padrão temporal e estatísticas dessa fatia.
        </p>
      </div>
    );
  }

  const stats = computeDrillDown(bets, selectedCell.league, selectedCell.market);

  if (stats.n === 0) {
    return (
      <div className="bg-white border-2 border-forest rounded-xl p-5 relative">
        <div className="absolute -top-2.5 left-5 px-2 py-0.5 bg-forest text-white text-[9px] uppercase tracking-[0.18em] font-bold rounded">
          Fatia selecionada
        </div>
        <div className="text-[11px] text-ink-2 font-bold">
          {selectedCell.league} · {selectedCell.market}
        </div>
        <p className="text-[12px] text-ink-2 mt-4">Nenhuma aposta nesta fatia no período.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-forest rounded-xl p-5 relative">
      <div className="absolute -top-2.5 left-5 px-2 py-0.5 bg-forest text-white text-[9px] uppercase tracking-[0.18em] font-bold rounded">
        Fatia selecionada
      </div>

      {/* Header: liga · mercado + ROI + lucro */}
      <div className="text-[11px] text-ink-2 font-bold truncate" title={`${selectedCell.league} · ${selectedCell.market}`}>
        {selectedCell.league} · {selectedCell.market}
      </div>
      <div className="flex items-baseline gap-3 mt-1">
        <div className={`text-[32px] font-extrabold tabular leading-none ${stats.roi >= 0 ? 'text-forest' : 'text-rose-700'}`}>
          {stats.roi > 0 ? '+' : ''}{stats.roi.toFixed(1)}%
        </div>
        <div className={`text-[13px] font-extrabold tabular ${stats.profit >= 0 ? 'text-forest' : 'text-rose-700'}`}>
          {stats.profit > 0 ? '+' : ''}{formatValue(stats.profit)}
        </div>
      </div>
      <div className="text-[11px] text-ink-2 mt-1 tabular">
        {stats.n} {stats.n === 1 ? 'aposta' : 'apostas'} · stake {formatValue(stats.totalStaked)}
      </div>

      {/* Counts: greens / reds / outras */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="bg-forest-tint/60 rounded-lg p-2 border border-line/60">
          <div className="text-[9px] uppercase tracking-[0.14em] text-ink-2 font-bold">Greens</div>
          <div className="text-[14px] font-bold tabular text-forest leading-none mt-1">{stats.won}</div>
        </div>
        <div className="bg-rose-50 rounded-lg p-2 border border-line/60">
          <div className="text-[9px] uppercase tracking-[0.14em] text-ink-2 font-bold">Reds</div>
          <div className="text-[14px] font-bold tabular text-rose-700 leading-none mt-1">{stats.lost}</div>
        </div>
        <div className="bg-ink-3/40 rounded-lg p-2 border border-line/60">
          <div className="text-[9px] uppercase tracking-[0.14em] text-ink-2 font-bold">Outras</div>
          <div className="text-[14px] font-bold tabular text-ink leading-none mt-1">{stats.other}</div>
        </div>
      </div>

      {/* Sparkline tendência semanal */}
      {stats.weeklySparkline.length >= 2 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-2 font-bold mb-2">Tendência (semanal)</div>
          <Sparkline
            data={stats.weeklySparkline}
            width={280}
            height={50}
            color={stats.profit >= 0 ? '#0a3d2e' : '#be123c'}
            className="w-full"
          />
        </div>
      )}

      {/* Últimas 3 apostas */}
      {stats.lastThree.length > 0 && (
        <div className="mt-4 pt-3 border-t border-line">
          <div className="text-[10px] uppercase tracking-[0.14em] text-ink-2 font-bold mb-2">
            {stats.lastThree.length === 1 ? 'Última aposta' : `Últimas ${stats.lastThree.length} apostas`}
          </div>
          <div className="space-y-1.5">
            {stats.lastThree.map((b) => {
              const isWin = b.status === 'won' || b.status === 'half_won';
              const isLoss = b.status === 'lost' || b.status === 'half_lost';
              let p = 0;
              if (b.status === 'won') p = b.potential_return - b.stake_amount;
              else if (b.status === 'lost') p = -b.stake_amount;
              else if (b.status === 'cashout' && b.cashout_amount != null) p = b.cashout_amount - b.stake_amount;
              else if (b.status === 'half_won') p = (b.stake_amount + b.potential_return) / 2 - b.stake_amount;
              else if (b.status === 'half_lost') p = b.stake_amount / 2 - b.stake_amount;
              return (
                <div key={b.id} className="flex items-center gap-2 text-[11px]">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isWin ? 'bg-forest' : isLoss ? 'bg-rose-700' : 'bg-ink-2'
                    }`}
                  />
                  <span className="text-ink-2 tabular w-10 shrink-0">
                    {format(new Date(b.bet_date), 'dd/MM', { locale: ptBR })}
                  </span>
                  <span className="text-ink font-bold flex-1 truncate" title={b.match_description || b.bet_description}>
                    {b.match_description || b.bet_description}
                  </span>
                  <span className={`tabular font-bold shrink-0 ${p > 0 ? 'text-forest' : p < 0 ? 'text-rose-700' : 'text-ink-2'}`}>
                    {p > 0 ? '+' : ''}{formatValue(p)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CTA: análise ou upgrade */}
      <div className="mt-4 space-y-2">
        {isPremium ? (
          <button
            type="button"
            onClick={onAnalyzeWithAI}
            disabled={!onAnalyzeWithAI}
            className="w-full h-9 rounded-md bg-amber-400 text-forest text-[12px] font-bold flex items-center justify-center gap-1.5 hover:bg-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={!onAnalyzeWithAI ? 'Análise em breve' : undefined}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {onAnalyzeWithAI ? 'Gerar análise dessa fatia' : 'Análise em breve'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onUpgrade}
            className="w-full h-9 rounded-md bg-ink-3/60 border border-line text-[11px] font-bold text-ink-2 hover:bg-ink-3 hover:text-ink transition-colors flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3 h-3" />
            Análise dessa fatia · Disponível no Pro
          </button>
        )}
        {onViewAllBets && (
          <button
            type="button"
            onClick={onViewAllBets}
            className="w-full h-9 rounded-md border border-line bg-white text-[12px] font-bold text-ink hover:bg-ink-3/40 transition-colors flex items-center justify-center gap-1.5"
          >
            {stats.n === 1 ? 'Ver a aposta' : `Ver todas as ${stats.n} apostas`}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
