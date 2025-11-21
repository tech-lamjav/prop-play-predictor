import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
export const PlayerStats = () => {
  const statTypes = ['Points', 'Assists', 'Rebounds', 'Threes', 'Pts+Ast', 'Pts+Reb', 'Reb+Ast', 'Pts+Reb+Ast', 'Double Double', 'Triple Double', '1Q Points', '1Q Assists', '1Q Rebounds', '1H Points', 'Steals'];
  return <div className="terminal-container mb-3">
      {/* Stat Type Selector */}
      <div className="border-b border-terminal-border-subtle">
        <div className="flex items-center">
          <button className="p-2 hover:bg-terminal-light-gray border-r border-terminal-border-subtle">
            <ChevronLeftIcon size={14} className="opacity-50" />
          </button>
          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex">
              {statTypes.map((stat, index) => <button key={index} className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-r border-terminal-border-subtle hover:bg-terminal-light-gray transition-colors ${index === 0 ? 'bg-terminal-light-gray text-terminal-green' : 'opacity-60'}`}>
                  {stat}
                </button>)}
            </div>
          </div>
          <button className="p-2 hover:bg-terminal-light-gray border-l border-terminal-border-subtle">
            <ChevronRightIcon size={14} className="opacity-50" />
          </button>
        </div>
      </div>
      {/* Player Info & Stats */}
      <div className="p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-4">
          <div className="flex items-center mb-3 lg:mb-0">
            <div className="w-14 h-14 bg-terminal-light-gray border border-terminal-border-subtle overflow-hidden mr-3 rounded-full">
              <img src="https://cdn.nba.com/headshots/nba/latest/1040x760/2544.png" alt="LeBron James" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center">
                <h2 className="text-lg font-semibold text-terminal-green mr-2">
                  LeBron James
                </h2>
                <span className="text-[10px] px-1.5 py-0.5 bg-terminal-gray border border-terminal-border-subtle font-medium">
                  [F]
                </span>
              </div>
              <div className="data-label mt-1">
                <div>DPT - Transition</div>
                <div>DSZ - Restricted Area</div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <div className="data-label mb-1">SZN AVG</div>
              <div className="data-value stat-positive">24.5</div>
            </div>
            <div className="text-center">
              <div className="data-label mb-1">GRAPH AVG</div>
              <div className="data-value stat-positive">25.1</div>
            </div>
            <div className="text-center">
              <div className="data-label mb-1">HIT RATE</div>
              <div className="data-value stat-positive">
                93.3% <span className="text-xs opacity-60">[28/30]</span>
              </div>
            </div>
            {/* Betting Odds */}
            <div className="flex items-center space-x-3 pl-6 border-l border-terminal-border-subtle">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className="flex space-x-4 text-xs font-medium">
                <div>
                  <div className="opacity-50 mb-0.5">L</div>
                  <div className="text-terminal-green">15.5</div>
                </div>
                <div>
                  <div className="opacity-50 mb-0.5">O</div>
                  <div>-115</div>
                </div>
                <div>
                  <div className="opacity-50 mb-0.5">U</div>
                  <div className="text-red-400">-111</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 text-xs font-medium">
          {/* Season */}
          <div className="lg:col-span-2">
            <div className="data-label mb-1.5">SEASON</div>
            <div className="flex space-x-1">
              <button className="terminal-button flex-1 py-1.5 opacity-60">
                23/24
              </button>
              <button className="terminal-button flex-1 py-1.5 bg-terminal-light-gray">
                24/25
              </button>
              <button className="terminal-button flex-1 py-1.5 opacity-60">
                25/26
              </button>
              <button className="terminal-button flex-1 py-1.5 opacity-60">
                All
              </button>
            </div>
          </div>
          {/* Games */}
          <div className="lg:col-span-2">
            <div className="data-label mb-1.5 flex items-center">
              GAMES
              <svg className="w-3 h-3 ml-1 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="flex items-center space-x-1">
              <button className="terminal-button px-2 py-1.5">-</button>
              <div className="flex-1 text-center py-1.5 border border-terminal-border-subtle bg-terminal-light-gray">
                30
              </div>
              <button className="terminal-button px-2 py-1.5">+</button>
              <button className="terminal-button px-2 py-1.5 opacity-60">
                L15
              </button>
              <button className="terminal-button px-2 py-1.5 opacity-60">
                Max (75)
              </button>
            </div>
          </div>
          {/* With/Out */}
          <div className="lg:col-span-2">
            <div className="data-label mb-1.5">WITH/OUT</div>
            <button className="terminal-button w-full py-1.5 flex items-center justify-between">
              <span>0 selected</span>
              <svg className="w-3 h-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>
          {/* Advanced Filters */}
          <div className="lg:col-span-2">
            <div className="data-label mb-1.5">ADVANCED FILTERS</div>
            <button className="terminal-button w-full py-1.5 flex items-center justify-between">
              <span>0 selected</span>
              <svg className="w-3 h-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>
          {/* Splits */}
          <div className="lg:col-span-2">
            <div className="data-label mb-1.5">SPLITS</div>
            <div className="flex space-x-1">
              <button className="terminal-button flex-1 py-1.5 bg-terminal-light-gray">
                H2H
              </button>
              <button className="terminal-button flex-1 py-1.5 opacity-60">
                Home
              </button>
              <button className="terminal-button flex-1 py-1.5 opacity-60">
                Away
              </button>
              <button className="terminal-button flex-1 py-1.5 opacity-60">
                More
              </button>
            </div>
          </div>
          {/* Rankings */}
          <div className="lg:col-span-2">
            <div className="data-label mb-1.5 flex items-center">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              RANKINGS
            </div>
            <div className="flex space-x-1">
              <button className="terminal-button flex-1 py-1.5 bg-terminal-light-gray">
                All
              </button>
              <button className="terminal-button flex-1 py-1.5 opacity-60">
                L15
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>;
};