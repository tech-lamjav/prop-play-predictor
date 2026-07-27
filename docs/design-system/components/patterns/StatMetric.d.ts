import React from "react";

export interface StatMetricProps {
  /** Tiny uppercase label. */
  label: string;
  value: React.ReactNode;
  /** Small caption under the value. */
  sub?: string;
  /** Amber value (e.g. "Vantagem"). */
  accent?: boolean;
  /** Emphasised value (forest on light / white on dark). */
  highlight?: boolean;
  /** Use light-on-dark colors (for the forest hero strip). */
  onDark?: boolean;
  style?: React.CSSProperties;
}

/** Hero metric cell — label / tabular value / sub. Row them with left borders. */
export function StatMetric(props: StatMetricProps): JSX.Element;
