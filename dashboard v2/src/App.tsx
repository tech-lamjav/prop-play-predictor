import React from 'react';
import { Header } from './components/Header';
import { PlayerStats } from './components/PlayerStats';
import { GameChart } from './components/GameChart';
import { ShootingZones } from './components/ShootingZones';
import { PlayAnalysis } from './components/PlayAnalysis';
import { ComparisonTable } from './components/ComparisonTable';
import { SearchBar } from './components/SearchBar';
export function App() {
  return <div className="w-full min-h-screen bg-terminal-black text-terminal-text">
      <Header />
      <main className="container mx-auto px-3 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-1">
            <SearchBar />
            <div className="terminal-container p-4 mb-3">
              <h3 className="section-title mb-3">QUICK ACCESS</h3>
              <div className="space-y-1.5">
                {['LeBron James', 'Jarred Vanderbilt', 'Deandre Ayton', 'Luka Doncic'].map((player, index) => <div key={index} className="flex items-center p-2 border border-terminal-border-subtle bg-terminal-light-gray">
                    <div className="w-7 h-7 bg-terminal-gray mr-2 border border-terminal-border-subtle"></div>
                    <div className="flex-1 font-medium text-sm">{player}</div>
                    <button className="terminal-button text-[10px] px-2 py-0.5 font-medium">
                      VIEW
                    </button>
                  </div>)}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <PlayerStats />
            <GameChart />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ShootingZones />
              <PlayAnalysis />
            </div>
            <ComparisonTable />
          </div>
        </div>
      </main>
      <footer className="terminal-header p-3 mt-6">
        <div className="container mx-auto flex justify-between items-center text-[10px]">
          <div className="opacity-50">
            © 2025 STATIX NBA - ALL RIGHTS RESERVED
          </div>
          <div className="flex space-x-3 opacity-50">
            <a href="#" className="hover:opacity-100 transition-opacity">
              HELP
            </a>
            <a href="#" className="hover:opacity-100 transition-opacity">
              TERMS
            </a>
            <a href="#" className="hover:opacity-100 transition-opacity">
              PRIVACY
            </a>
          </div>
        </div>
      </footer>
    </div>;
}