import React from "react";

/** KPI tile — white card, uppercase label, big tabular value, hint.
 * Tone colors the value: ink (default), forest (positive), amber (attention). */
const TONE = { ink: "var(--ink)", forest: "var(--forest)", amber: "var(--status-warning)", danger: "var(--status-danger)" };

export function KpiTile({ label, value, hint, tone = "ink", style = {} }) {
  return (
    <div style={{
      background: "var(--white)", border: "1px solid var(--line)",
      borderRadius: "var(--radius-xl)", padding: "12px 12px 8px",
      fontFamily: "var(--font-sans)", minWidth: 120, ...style,
    }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 600, color: "var(--ink-2)" }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1, marginTop: 8, fontVariantNumeric: "tabular-nums", color: TONE[tone] || TONE.ink }}>{value}</div>
      {hint && <div style={{ fontSize: 11, marginTop: 6, color: "var(--ink-dim)" }}>{hint}</div>}
    </div>
  );
}
