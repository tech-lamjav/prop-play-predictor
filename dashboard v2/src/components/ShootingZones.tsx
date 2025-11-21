import React from 'react';
export const ShootingZones = () => {
  return <div className="terminal-container p-4 mb-3">
      <div className="flex justify-between items-center mb-3">
        <h3 className="section-title">SHOOTING ZONES</h3>
        <span className="section-subtitle">24/25 SEASON</span>
      </div>
      <div className="relative h-56 w-full border border-terminal-border-subtle overflow-hidden bg-terminal-light-gray">
        <div className="absolute inset-0 terminal-grid"></div>
        <div className="absolute w-full h-full flex items-center justify-center">
          <div className="relative w-4/5 h-3/5">
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-4/5 h-4/5 border-t border-l border-r border-terminal-border-subtle rounded-t-full"></div>
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/3 h-2/5 border border-terminal-border-subtle"></div>
            <div className="absolute bottom-2/5 left-1/2 transform -translate-x-1/2 w-1/3 h-[20px] border-t border-l border-r border-terminal-border-subtle rounded-t-full"></div>
            <div className="absolute bottom-[5%] left-1/2 transform -translate-x-1/2 w-[16px] h-[16px] rounded-full border border-terminal-green"></div>
            <div className="absolute bottom-[40%] left-[30%] bg-terminal-green opacity-25 w-[40%] h-[30%] flex items-center justify-center">
              <span className="text-terminal-text font-semibold text-xs">
                42%
              </span>
            </div>
            <div className="absolute top-[10%] left-[20%] bg-terminal-green opacity-15 w-[20%] h-[20%] flex items-center justify-center">
              <span className="text-terminal-text font-semibold text-[10px]">
                33%
              </span>
            </div>
            <div className="absolute top-[10%] right-[20%] bg-terminal-green opacity-15 w-[20%] h-[20%] flex items-center justify-center">
              <span className="text-terminal-text font-semibold text-[10px]">
                35%
              </span>
            </div>
            <div className="absolute bottom-[10%] left-[10%] bg-terminal-green opacity-30 w-[25%] h-[25%] flex items-center justify-center">
              <span className="text-terminal-text font-semibold text-[10px]">
                46%
              </span>
            </div>
            <div className="absolute bottom-[10%] right-[10%] bg-terminal-green opacity-30 w-[25%] h-[25%] flex items-center justify-center">
              <span className="text-terminal-text font-semibold text-[10px]">
                48%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>;
};