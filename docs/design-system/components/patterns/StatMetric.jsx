import React from "react";

/** Stat cell for the hero metric strip — tiny uppercase label, tabular value,
 * sub caption. `accent` (amber) / `highlight` (bright) shift the value color.
 * Designed to sit in a row of cells separated by left borders. */
export function StatMetric({ label, value, sub, accent = false, highlight = false, onDark = false, style = {} }) {
  const valueColor = onDark
    ? (accent ? "var(--amber-light)" : highlight ? "#fff" : "rgba(255,255,255,0.9)")
    : (accent ? "var(--amber-2)" : highlight ? "var(--forest)" : "var(--ink)");
  const labelColor = onDark ? "rgba(255,255,255,0.5)" : "var(--ink-2)";
  const subColor = onDark ? "rgba(255,255,255,0.45)" : "var(--ink-dim)";
  return (
    <div style={{ padding: "12px 16px", fontFamily: "var(--font-sans)", ...style }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 600, color: labelColor }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1, marginTop: 6, fontVariantNumeric: "tabular-nums", color: valueColor }}>{value}</div>
      {sub && <div style={{ fontSize: 10, marginTop: 6, color: subColor }}>{sub}</div>}
    </div>
  );
}
