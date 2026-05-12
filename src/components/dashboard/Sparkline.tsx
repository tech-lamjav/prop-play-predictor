import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 120,
  height = 32,
  color = '#0a3d2e',
  strokeWidth = 1.5,
  className,
}) => {
  if (!data || data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className={className}
        aria-hidden="true"
      />
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * width;
  const y = (v: number) => height - ((v - min) / range) * height;
  const path = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
  const lastX = x(data.length - 1);
  const lastY = y(data[data.length - 1]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
    >
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
    </svg>
  );
};
