import React from 'react';
import { GamePlayerStats } from '@/services/nba-data.service';

interface ComparisonTableProps {
  gameStats: GamePlayerStats[];
  playerName: string;
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({ gameStats, playerName }) => {
  // Get last 10 games
  const recentGames = gameStats.slice(0, 10);

  if (recentGames.length === 0) {
    return (
      <div className="terminal-container p-4">
        <h3 className="section-title mb-3">RECENT GAMES</h3>
        <div className="text-center py-8 text-terminal-text opacity-50">
          <p>No game data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-container p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="section-title">RECENT GAMES</h3>
        <span className="text-[10px] opacity-50">24/25 SEASON</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-terminal-border-subtle">
              <th className="text-left py-2 px-2 data-label">DATE</th>
              <th className="text-left py-2 px-2 data-label">OPP</th>
              <th className="text-left py-2 px-2 data-label">LOC</th>
              <th className="text-right py-2 px-2 data-label">STAT</th>
              <th className="text-right py-2 px-2 data-label">LINE</th>
              <th className="text-right py-2 px-2 data-label">RESULT</th>
            </tr>
          </thead>
          <tbody>
            {recentGames.map((game, index) => {
              const isOver = game.stat_vs_line === 'Over';
              const statValue = game.stat_value ?? 0;
              const lineValue = game.line ?? 0;
              const diff = statValue - lineValue;
              const diffPercent = lineValue > 0 ? ((diff / lineValue) * 100).toFixed(0) : '0';
              
              return (
                <tr 
                  key={index}
                  className="border-b border-terminal-border-subtle hover:bg-terminal-light-gray transition-colors"
                >
                  <td className="py-2 px-2">
                    {new Date(game.game_date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </td>
                  <td className="py-2 px-2 font-medium">
                    {game.played_against}
                  </td>
                  <td className="py-2 px-2">
                    <span className={`text-[10px] px-1.5 py-0.5 ${
                      game.home_away === 'Home' 
                        ? 'bg-terminal-gray' 
                        : 'bg-terminal-dark-gray'
                    }`}>
                      {game.home_away === 'Home' ? 'H' : 'A'}
                    </span>
                  </td>
                  <td className="text-right py-2 px-2">
                    <span className={`px-2 py-0.5 bg-terminal-light-gray font-medium ${
                      isOver ? 'stat-positive' : 'stat-negative'
                    }`}>
                      {statValue.toFixed(1)}
                    </span>
                  </td>
                  <td className="text-right py-2 px-2 opacity-60">
                    {lineValue.toFixed(1)}
                  </td>
                  <td className="text-right py-2 px-2">
                    <span className={`font-medium ${
                      isOver ? 'stat-positive' : 'stat-negative'
                    }`}>
                      {diff > 0 ? '+' : ''}{diffPercent}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 pt-3 border-t border-terminal-border-subtle flex justify-between text-[10px] opacity-60">
        <span>SHOWING {recentGames.length} GAMES</span>
        <span>
          HIT RATE: {' '}
          <span className="stat-positive font-medium">
            {((recentGames.filter(g => g.stat_vs_line === 'Over').length / recentGames.length) * 100).toFixed(0)}%
          </span>
        </span>
      </div>
    </div>
  );
};
