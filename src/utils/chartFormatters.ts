/**
 * Format numeric values for chart axis labels (abbreviated: K, M).
 * Keeps tooltip with full value; use this only for axis tickFormatter.
 */
export function formatChartAxis(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const sign = value < 0 ? '-' : '';
    return `${sign}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const sign = value < 0 ? '-' : '';
    return `${sign}${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}
