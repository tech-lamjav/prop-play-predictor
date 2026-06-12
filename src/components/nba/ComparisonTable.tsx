import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { GamePlayerStats } from '@/services/nba-data.service';

interface ComparisonTableProps {
  gameStats: GamePlayerStats[];
  playerName: string;
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({ gameStats }) => {
  const [expanded, setExpanded] = useState(false);
  // Get last 10 games
  const recentGames = gameStats.slice(0, 10);

  if (recentGames.length === 0) {
    return (
      <div className="rounded-lg bg-white border border-line overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">Jogos recentes</span>
        </div>
        <div className="text-center py-8 text-ink-dim text-[12px]">
          Nenhum dado de jogo disponível
        </div>
      </div>
    );
  }

  const gamesWithValidLine = recentGames.filter(g => (g.line ?? 0) > 0);
  const hits = gamesWithValidLine.filter(g => (g.stat_value ?? 0) > (g.line ?? 0)).length;
  const hitRate = gamesWithValidLine.length > 0 ? Math.round((hits / gamesWithValidLine.length) * 100) : null;

  return (
    <div className="rounded-lg bg-white border border-line overflow-hidden">
      <button
        type="button"
        className="w-full px-4 py-3 flex items-center justify-between border-b border-line md:cursor-default"
        onClick={() => setExpanded(prev => !prev)}
      >
        <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">Jogos recentes</span>
        <ChevronDown className={`w-4 h-4 text-ink-dim transition-transform md:hidden ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div className={`${expanded ? 'block' : 'hidden'} md:block`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] md:text-[12px] tabular">
            <thead>
              <tr className="text-[9px] md:text-[10px] uppercase tracking-[0.12em] md:tracking-[0.14em] font-bold text-ink-dim">
                <th className="text-left px-2 md:px-4 pt-2.5 pb-1.5 font-bold">Data</th>
                <th className="text-left px-1 md:px-2 pt-2.5 pb-1.5 font-bold">Adv.</th>
                <th className="text-left px-1 md:px-2 pt-2.5 pb-1.5 font-bold">Local</th>
                <th className="text-right px-1 md:px-2 pt-2.5 pb-1.5 font-bold">Valor</th>
                <th className="text-right px-1 md:px-2 pt-2.5 pb-1.5 font-bold">Linha</th>
                <th className="text-right px-2 md:px-4 pt-2.5 pb-1.5 font-bold">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {recentGames.map((game, index) => {
                const statValue = game.stat_value ?? 0;
                const lineValue = game.line ?? 0;
                const hasValidLine = lineValue > 0;
                const diff = statValue - lineValue;
                const diffPercent = hasValidLine ? Math.round((diff / lineValue) * 100) : null;
                const isHome = game.home_away?.toLowerCase() === 'home'
                  || game.home_away?.toLowerCase() === 'h'
                  || game.home_away?.toLowerCase() === 'casa';
                const d = new Date(game.game_date);
                const dateLong = d.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
                const dateShort = `${d.getDate()}/${d.getMonth() + 1}`;

                return (
                  <tr key={index} className="border-t border-line hover:bg-canvas-2/40 transition-colors">
                    <td className="px-2 md:px-4 py-2 text-ink whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <span className="md:hidden">{dateShort}</span>
                        <span className="hidden md:inline">{dateLong}</span>
                        {game.is_b2b_game && (
                          <span
                            className="px-1 h-4 inline-flex items-center rounded text-[8px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200"
                            title="Jogo back-to-back"
                          >
                            B2B
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-1 md:px-2 py-2 font-semibold text-ink whitespace-nowrap">{game.played_against}</td>
                    <td className="px-1 md:px-2 py-2 text-ink-2 whitespace-nowrap">{isHome ? 'Casa' : 'Fora'}</td>
                    <td className="px-1 md:px-2 py-2 text-right font-semibold text-ink whitespace-nowrap">{statValue.toFixed(1)}</td>
                    <td className="px-1 md:px-2 py-2 text-right text-ink-dim whitespace-nowrap">
                      {hasValidLine ? lineValue.toFixed(1) : 'N/A'}
                    </td>
                    <td className="px-2 md:px-4 py-2 text-right whitespace-nowrap">
                      {diffPercent !== null ? (
                        <span className={`font-semibold ${diff > 0 ? 'text-forest' : diff < 0 ? 'text-rose-700' : 'text-ink-2'}`}>
                          {diff > 0 ? '+' : ''}{diffPercent}%
                        </span>
                      ) : (
                        <span className="text-ink-dim">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-line flex items-center justify-between text-[11px]">
          <span className="text-ink-dim">Exibindo {recentGames.length} jogos</span>
          <span className="text-ink-2">
            Taxa de acerto{' '}
            {hitRate !== null ? (
              <span className={`font-semibold ml-1 ${hitRate >= 60 ? 'text-forest' : hitRate >= 40 ? 'text-amber-700' : 'text-rose-700'}`}>
                {hitRate}%
              </span>
            ) : (
              <span className="text-ink-dim ml-1">N/A</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
