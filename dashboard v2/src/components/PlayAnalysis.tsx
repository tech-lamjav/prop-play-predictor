import React from 'react';
export const PlayAnalysis = () => {
  return <div className="terminal-container p-4 mb-3">
      <div className="flex justify-between items-center mb-3">
        <h3 className="section-title">PLAY TYPE ANALYSIS</h3>
        <span className="section-subtitle">24/25 SEASON</span>
      </div>
      <table className="terminal-table w-full">
        <thead>
          <tr>
            <th className="text-left py-2 px-2">PLAY TYPE</th>
            <th className="text-right py-2 px-2">POINTS</th>
            <th className="text-right py-2 px-2">EFF RANK</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-2 px-2">Transition</td>
            <td className="text-right py-2 px-2">6 (22%)</td>
            <td className="text-right py-2 px-2">
              <span className="stat-positive px-2 py-0.5 bg-terminal-light-gray font-medium text-xs">
                50
              </span>
            </td>
          </tr>
          <tr>
            <td className="py-2 px-2">Free Throws</td>
            <td className="text-right py-2 px-2">3.9 (14%)</td>
            <td className="text-right py-2 px-2">
              <span className="stat-neutral px-2 py-0.5 bg-terminal-light-gray font-medium text-xs">
                15
              </span>
            </td>
          </tr>
          <tr>
            <td className="py-2 px-2">Isolation</td>
            <td className="text-right py-2 px-2">3.7 (13%)</td>
            <td className="text-right py-2 px-2">
              <span className="stat-neutral px-2 py-0.5 bg-terminal-light-gray font-medium text-xs">
                20
              </span>
            </td>
          </tr>
          <tr>
            <td className="py-2 px-2">P&R Ball Handler</td>
            <td className="text-right py-2 px-2">3.5 (12%)</td>
            <td className="text-right py-2 px-2">
              <span className="stat-negative px-2 py-0.5 bg-terminal-light-gray font-medium text-xs">
                -2
              </span>
            </td>
          </tr>
          <tr>
            <td className="py-2 px-2">Post Up</td>
            <td className="text-right py-2 px-2">2.9 (10%)</td>
            <td className="text-right py-2 px-2">
              <span className="stat-neutral px-2 py-0.5 bg-terminal-light-gray font-medium text-xs">
                18
              </span>
            </td>
          </tr>
          <tr>
            <td className="py-2 px-2">Spot Up</td>
            <td className="text-right py-2 px-2">2.8 (10%)</td>
            <td className="text-right py-2 px-2">
              <span className="stat-neutral px-2 py-0.5 bg-terminal-light-gray font-medium text-xs">
                23
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>;
};