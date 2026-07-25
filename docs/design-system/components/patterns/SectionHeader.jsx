import React from "react";

/** Section header — uppercase eyebrow + 18px title (+ optional count) with an
 * optional right-aligned action link. The recurring list-section header. */
export function SectionHeader({ eyebrow, title, count, actionLabel, onAction, actionHref, style = {} }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12, fontFamily: "var(--font-sans)", ...style }}>
      <div>
        {eyebrow && <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 600, color: "var(--ink-2)" }}>{eyebrow}</div>}
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4, color: "var(--ink)" }}>
          {title}
          {count != null && <span style={{ color: "var(--ink-dim)", fontWeight: 400, fontSize: 14, marginLeft: 8, fontVariantNumeric: "tabular-nums" }}>{count}</span>}
        </div>
      </div>
      {actionLabel && (
        <a href={actionHref || "#"} onClick={onAction}
          style={{ fontSize: 12, fontWeight: 600, color: "var(--forest)", display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", flexShrink: 0 }}>
          {actionLabel} ›
        </a>
      )}
    </div>
  );
}
