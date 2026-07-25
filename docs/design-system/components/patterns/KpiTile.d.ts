import React from "react";

export interface KpiTileProps {
  /** Uppercase micro-label. */
  label: string;
  /** Big tabular value (number or string). */
  value: React.ReactNode;
  /** Secondary hint line under the value. */
  hint?: string;
  /** Colors the value. */
  tone?: "ink" | "forest" | "amber" | "danger";
  style?: React.CSSProperties;
}

/**
 * Metric tile — uppercase label, 30px tabular value, hint. The briefing-strip KPI.
 * @startingPoint section="Patterns" subtitle="KPI metric tile with tabular value" viewport="700x160"
 */
export function KpiTile(props: KpiTileProps): JSX.Element;
