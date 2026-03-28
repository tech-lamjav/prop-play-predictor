import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { GamePlayerStats } from '@/services/nba-data.service';

interface ComparisonTableProps {
  gameStats: GamePlayerStats[];
  playerName: string;
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({ gameStats, playerName }) => {
  const [expanded, setExpanded] = useState(false);
  // Get last 10 games
  const recentGames = gameStats.slice(0, 10);

  if (recentGames.length === 0) {
    return (
      <div className="terminal-container p-4">
        <h3 className="section-title mb-3">JOGOS RECENTES</h3>
        <div className="text-center py-8 text-terminal-text opacity-50">
          <p>Nenhum dado de jogo disponível</p>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-container p-4">
      <button
        className="w-full flex items-center justify-between md:cursor-default"
        onClick={() => setExpanded(prev => !prev)}
      >
        <h3 className="section-title">JOGOS RECENTES</h3>
        <ChevronDown className={`w-4 h-4 text-terminal-text/40 transition-transform md:hidden ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div className={`${expanded ? 'block' : 'hidden'} md:block`}>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-terminal-border-subtle">
              <th className="text-left py-2 px-2 data-label">DATA</th>
              <th className="text-left py-2 px-2 data-label">ADV</th>
              <th className="text-left py-2 px-2 data-label">LOCAL</th>
              <th className="text-right py-2 px-2 data-label">VALOR</th>
              <th className="text-right py-2 px-2 data-label">LINHA</th>
              <th className="text-right py-2 px-2 data-label">RESULTADO</th>
            </tr>
          </thead>
          <tbody>
            {recentGames.map((game, index) => {
              const statValue = game.stat_value ?? 0;
              const lineValue = game.line ?? 0;
              const hasValidLine = lineValue > 0;
              const isOver = hasValidLine && statValue > lineValue;
              const diff = statValue - lineValue;
              const diffPercent = hasValidLine ? ((diff / lineValue) * 100).toFixed(0) : null;
              
              return (
                <tr 
                  key={index}
                  className="border-b border-terminal-border-subtle hover:bg-terminal-light-gray transition-colors"
                >
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1">
                      {new Date(game.game_date).toLocaleDateString('pt-BR', {
                        month: 'short',
                        day: 'numeric'
                      })}
                      {game.is_b2b_game && (
                        <span className="text-[8px] bg-terminal-yellow/20 text-terminal-yellow px-1 rounded" title="Jogo back-to-back">
                          B2B
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 font-medium">
                    {game.played_against}
                  </td>
                  <td className="py-2 px-2">
                    {(() => {
                      const isHome = game.home_away?.toLowerCase() === 'home' || game.home_away?.toLowerCase() === 'h' || game.home_away?.toLowerCase() === 'casa';
                      return (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 ${isHome ? 'bg-terminal-gray' : 'bg-terminal-dark-gray'}`}
                          title={isHome ? 'Jogo em casa' : 'Jogo fora'}
                        >
                          {isHome ? 'Casa' : 'Fora'}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="text-right py-2 px-2">
                    <span className="px-2 py-0.5 bg-terminal-light-gray font-medium text-terminal-text">
                      {statValue.toFixed(1)}
                    </span>
                  </td>
                  <td className="text-right py-2 px-2 opacity-60">
                    {hasValidLine ? lineValue.toFixed(1) : 'N/A'}
                  </td>
                  <td className="text-right py-2 px-2">
                    {diffPercent !== null ? (
                      <span className={`font-medium ${
                        diff > 0 ? 'text-terminal-blue' : 'text-terminal-red'
                      }`}>
                        {diff > 0 ? '+' : ''}{diffPercent}%
                      </span>
                    ) : (
                      <span className="text-terminal-text opacity-50">N/A</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 pt-3 border-t border-terminal-border-subtle flex justify-between text-[10px] opacity-60">
        <span>EXIBINDO {recentGames.length} JOGOS</span>
        <span>
          TAXA DE ACERTO: {' '}
          {(() => {
            const gamesWithValidLine = recentGames.filter(g => (g.line ?? 0) > 0);
            if (gamesWithValidLine.length === 0) return <span>N/A</span>;
            const hits = gamesWithValidLine.filter(g => (g.stat_value ?? 0) > (g.line ?? 0)).length;
            const rate = (hits / gamesWithValidLine.length) * 100;
            return (
              <span className={`font-medium ${rate >= 60 ? 'text-green-500' : rate >= 40 ? 'text-terminal-text' : 'text-red-500'}`}>
                {rate.toFixed(0)}%
              </span>
            );
          })()}
        </span>
      </div>
      </div>
    </div>
  );
};
