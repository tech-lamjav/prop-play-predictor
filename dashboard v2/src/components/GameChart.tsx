import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
const data = [{
  game: 'G1',
  pts: 42,
  isWin: true,
  opponent: 'GSW',
  date: '10/24'
}, {
  game: 'G2',
  pts: 24,
  isWin: true,
  opponent: 'PHX',
  date: '10/26'
}, {
  game: 'G3',
  pts: 18,
  isWin: true,
  opponent: 'SAC',
  date: '10/28'
}, {
  game: 'G4',
  pts: 26,
  isWin: true,
  opponent: 'CLE',
  date: '10/30'
}, {
  game: 'G5',
  pts: 40,
  isWin: true,
  opponent: 'TOR',
  date: '11/01'
}, {
  game: 'G6',
  pts: 25,
  isWin: true,
  opponent: 'MEM',
  date: '11/06'
}, {
  game: 'G7',
  pts: 27,
  isWin: true,
  opponent: 'PHI',
  date: '11/08'
}, {
  game: 'G8',
  pts: 33,
  isWin: true,
  opponent: 'UTA',
  date: '11/12'
}, {
  game: 'G9',
  pts: 28,
  isWin: true,
  opponent: 'SAS',
  date: '11/15'
}, {
  game: 'G10',
  pts: 17,
  isWin: true,
  opponent: 'NOP',
  date: '11/16'
}, {
  game: 'G11',
  pts: 34,
  isWin: true,
  opponent: 'DEN',
  date: '11/23'
}, {
  game: 'G12',
  pts: 31,
  isWin: true,
  opponent: 'OKC',
  date: '11/29'
}, {
  game: 'G13',
  pts: 22,
  isWin: true,
  opponent: 'POR',
  date: '12/08'
}, {
  game: 'G14',
  pts: 17,
  isWin: false,
  opponent: 'MIN',
  date: '12/12'
}, {
  game: 'G15',
  pts: 24,
  isWin: true,
  opponent: 'POR',
  date: '12/15'
}, {
  game: 'G16',
  pts: 13,
  isWin: false,
  opponent: 'DET',
  date: '12/23'
}, {
  game: 'G17',
  pts: 17,
  isWin: true,
  opponent: 'GSW',
  date: '12/25'
}, {
  game: 'G18',
  pts: 25,
  isWin: true,
  opponent: 'SAC',
  date: '12/28'
}];
const CustomXAxisTick = (props: any) => {
  const {
    x,
    y,
    payload
  } = props;
  const gameData = data.find(d => d.game === payload.value);
  return <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#8fb382" fontSize={11} fontWeight={600}>
        {gameData?.opponent}
      </text>
      <text x={0} y={0} dy={24} textAnchor="middle" fill="#8a9585" fontSize={9}>
        {gameData?.date}
      </text>
    </g>;
};
export const GameChart = () => {
  return <div className="terminal-container p-4 mb-3">
      <h3 className="section-title mb-3">PERFORMANCE GRAPH</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{
          top: 5,
          right: 5,
          left: -20,
          bottom: 30
        }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3a3d3a" vertical={false} />
            <XAxis dataKey="game" tick={<CustomXAxisTick />} axisLine={{
            stroke: '#3a3d3a'
          }} height={50} />
            <YAxis tick={{
            fill: '#c5d0c0',
            fontSize: 11
          }} axisLine={{
            stroke: '#3a3d3a'
          }} />
            <Bar dataKey="pts" radius={[2, 2, 0, 0]}>
              {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.isWin ? '#8fb382' : '#d67676'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs flex justify-between opacity-60">
        <span>LAST 18 GAMES</span>
        <span className="font-medium">AVG: 25.1 PTS</span>
      </div>
    </div>;
};