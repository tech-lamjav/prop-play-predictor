import React from "react";

/** Badge / status pill. Rebrand default is the forest chip; status tones map to
 * semantic colors. Rounded-full by default (shadcn badge), or square for tags. */
const TONES = {
  forest: { background: "var(--forest)", color: "#fff", border: "transparent" },
  amber: { background: "var(--amber-bright)", color: "var(--ink)", border: "transparent" },
  neutral: { background: "var(--canvas-2)", color: "var(--ink-2)", border: "transparent" },
  outline: { background: "transparent", color: "var(--ink)", border: "var(--line)" },
  success: { background: "#e2efe8", color: "var(--status-success)", border: "transparent" },
  warning: { background: "#fbeccd", color: "#8a5a12", border: "transparent" },
  danger: { background: "#f7dcd6", color: "var(--status-danger)", border: "transparent" },
  info: { background: "#dbe7f7", color: "var(--status-info)", border: "transparent" },
};

export function Badge({ tone = "forest", square = false, children, style = {}, ...props }) {
  const t = TONES[tone] || TONES.forest;
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        height: 22, padding: "0 9px", fontFamily: "var(--font-sans)",
        fontSize: 11, fontWeight: 600, lineHeight: 1,
        borderRadius: square ? "var(--radius-sm)" : "var(--radius-full)",
        background: t.background, color: t.color, border: `1px solid ${t.border}`,
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
}
