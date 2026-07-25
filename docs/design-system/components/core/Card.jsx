import React from "react";

/** Signature Smart Betting card: white surface, hairline border, 20px radius.
 * Hierarchy comes from border + background, not drop-shadow. */
export function Card({ interactive = false, padding = 20, children, style = {}, ...props }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      style={{
        background: "var(--surface-card)", border: "1px solid var(--line)",
        borderRadius: "var(--radius-xl)", padding, fontFamily: "var(--font-sans)",
        color: "var(--ink)", transition: "box-shadow .15s, border-color .15s",
        boxShadow: hover ? "var(--shadow-card-hover)" : "none",
        borderColor: hover ? "rgba(10,61,46,0.3)" : "var(--line)",
        cursor: interactive ? "pointer" : "default", ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ eyebrow, title, action, style = {}, ...props }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12, ...style }} {...props}>
      <div>
        {eyebrow && <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 600, color: "var(--ink-2)" }}>{eyebrow}</div>}
        {title && <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4, color: "var(--ink)" }}>{title}</div>}
      </div>
      {action}
    </div>
  );
}
