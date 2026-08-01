import React from "react";

/** Compact meta chip — the px-2 h-6 rounded pill used across cards for
 * gatilho / stat / linha metadata. Tones map to the app's chip styles. */
const TONE = {
  neutral: { background: "var(--canvas-2)", color: "var(--ink-2)", border: "transparent" },
  forest: { background: "var(--forest)", color: "#fff", border: "transparent" },
  amberSoft: { background: "rgba(212,160,23,0.16)", color: "#8a5a12", border: "rgba(212,160,23,0.3)" },
  onDark: { background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.85)", border: "transparent" },
  outline: { background: "transparent", color: "var(--ink)", border: "var(--line)" },
};

export function Chip({ tone = "neutral", leadingIcon = null, children, style = {} }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, height: 24, padding: "0 8px",
      borderRadius: "var(--radius-sm)", fontFamily: "var(--font-sans)", fontSize: 11,
      fontWeight: 600, lineHeight: 1, background: t.background, color: t.color,
      border: `1px solid ${t.border}`, ...style,
    }}>
      {leadingIcon}{children}
    </span>
  );
}
