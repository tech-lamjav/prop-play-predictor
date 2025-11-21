import React from 'react';
import { UserIcon, BarChartIcon } from 'lucide-react';
export const Header = () => {
  return <div className="terminal-header p-3 flex justify-between items-center">
      <div className="flex items-center">
        <span className="text-base font-semibold mr-6 text-terminal-green tracking-wide">
          STATIX NBA
        </span>
        <div className="hidden sm:flex space-x-2">
          <button className="terminal-button px-3 py-1 text-xs font-medium">
            NBA
          </button>
          <button className="terminal-button px-3 py-1 text-xs font-medium opacity-40">
            WNBA
          </button>
          <button className="terminal-button px-3 py-1 text-xs font-medium opacity-40">
            NFL
          </button>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button className="terminal-button p-1.5">
          <BarChartIcon size={16} />
        </button>
        <button className="terminal-button p-1.5">
          <UserIcon size={16} />
        </button>
      </div>
    </div>;
};