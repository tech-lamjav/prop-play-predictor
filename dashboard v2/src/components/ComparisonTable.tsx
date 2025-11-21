import React from 'react';
export const ComparisonTable = () => {
  return <div className="terminal-container p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="section-title">SIMILAR PLAYERS VS JAZZ</h3>
        <span className="section-subtitle">24/25 SEASON</span>
      </div>
      <table className="terminal-table w-full">
        <thead>
          <tr>
            <th className="text-left py-2 px-2">DATE</th>
            <th className="text-left py-2 px-2">TEAM</th>
            <th className="text-left py-2 px-2">PLAYER</th>
            <th className="text-right py-2 px-2">LINE</th>
            <th className="text-right py-2 px-2">+/-</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-2 px-2">Mar 31</td>
            <td className="py-2 px-2">Hornets</td>
            <td className="py-2 px-2">M. Bridges</td>
            <td className="text-right py-2 px-2">
              <span className="stat-positive px-2 py-0.5 bg-terminal-light-gray font-medium text-xs">
                28.5
              </span>
            </td>
            <td className="text-right py-2 px-2">
              <span className="stat-positive font-medium">+9%</span>
            </td>
          </tr>
          <tr>
            <td className="py-2 px-2">Mar 21</td>
            <td className="py-2 px-2">Celtics</td>
            <td className="py-2 px-2">J. Tatum</td>
            <td className="text-right py-2 px-2">
              <span className="stat-negative px-2 py-0.5 bg-terminal-light-gray font-medium text-xs">
                22.5
              </span>
            </td>
            <td className="text-right py-2 px-2">
              <span className="stat-negative font-medium">-5%</span>
            </td>
          </tr>
          <tr>
            <td className="py-2 px-2">Mar 14</td>
            <td className="py-2 px-2">Raptors</td>
            <td className="py-2 px-2">S. Barnes</td>
            <td className="text-right py-2 px-2">
              <span className="stat-positive px-2 py-0.5 bg-terminal-light-gray font-medium text-xs">
                18.5
              </span>
            </td>
            <td className="text-right py-2 px-2">
              <span className="stat-positive font-medium">+6%</span>
            </td>
          </tr>
          <tr>
            <td className="py-2 px-2">Mar 07</td>
            <td className="py-2 px-2">Raptors</td>
            <td className="py-2 px-2">S. Barnes</td>
            <td className="text-right py-2 px-2">
              <span className="stat-positive px-2 py-0.5 bg-terminal-light-gray font-medium text-xs">
                21.5
              </span>
            </td>
            <td className="text-right py-2 px-2">
              <span className="stat-positive font-medium">+2%</span>
            </td>
          </tr>
          <tr>
            <td className="py-2 px-2">Feb 09</td>
            <td className="py-2 px-2">Clippers</td>
            <td className="py-2 px-2">K. Leonard</td>
            <td className="text-right py-2 px-2">
              <span className="stat-negative px-2 py-0.5 bg-terminal-light-gray font-medium text-xs">
                21.5
              </span>
            </td>
            <td className="text-right py-2 px-2">
              <span className="stat-negative font-medium">-32%</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>;
};