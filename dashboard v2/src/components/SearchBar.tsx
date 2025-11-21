import React from 'react';
import { SearchIcon } from 'lucide-react';
export const SearchBar = () => {
  return <div className="terminal-container p-4 mb-3">
      <div className="flex justify-between items-center mb-2">
        <div className="flex space-x-1.5">
          <button className="terminal-button py-1 px-3 text-xs font-medium">
            Points
          </button>
          <button className="terminal-button py-1 px-3 text-xs font-medium">
            All Games
          </button>
        </div>
      </div>
      <div className="relative">
        <input type="text" placeholder="SEARCH PLAYERS OR TEAMS..." className="terminal-input w-full py-2 px-3 pl-9 text-xs font-medium" />
        <SearchIcon size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 opacity-40" />
      </div>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1.5">
        <div className="flex items-center p-2 border border-terminal-border-subtle bg-terminal-light-gray">
          <div className="w-7 h-7 bg-terminal-gray flex items-center justify-center mr-2 border border-terminal-border-subtle">
            <span className="text-[10px] font-semibold">GSW</span>
          </div>
          <div className="flex-1 font-medium text-sm">Warriors</div>
          <div className="text-[10px] opacity-50">9:00 PM</div>
        </div>
        <div className="flex items-center p-2 border border-terminal-border-subtle bg-terminal-light-gray">
          <div className="w-7 h-7 bg-terminal-gray flex items-center justify-center mr-2 border border-terminal-border-subtle">
            <span className="text-[10px] font-semibold">LAL</span>
          </div>
          <div className="flex-1 font-medium text-sm">Lakers</div>
          <div className="text-[10px] opacity-50">10:30 PM</div>
        </div>
      </div>
    </div>;
};