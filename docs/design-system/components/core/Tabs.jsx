import React from "react";

/** Segmented tab control. Two looks: `segmented` (pill group on canvas-2, the
 * rebrand toggle) and `underline` (forest underline on active). */
export function Tabs({ items = [], value, defaultValue, onChange, variant = "segmented", style = {} }) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? (items[0] && items[0].value));
  const active = isControlled ? value : internal;
  const select = (v) => { if (!isControlled) setInternal(v); onChange && onChange(v); };

  if (variant === "underline") {
    return (
      <div style={{ display: "inline-flex", gap: 20, borderBottom: "1px solid var(--line)", ...style }}>
        {items.map((it) => {
          const on = it.value === active;
          return (
            <button key={it.value} type="button" onClick={() => select(it.value)}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: "8px 0",
                fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
                color: on ? "var(--forest)" : "var(--ink-2)",
                borderBottom: `2px solid ${on ? "var(--forest)" : "transparent"}`,
                marginBottom: -1, transition: "color .15s, border-color .15s",
              }}>
              {it.label}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "var(--canvas-2)", borderRadius: "var(--radius-md)", ...style }}>
      {items.map((it) => {
        const on = it.value === active;
        return (
          <button key={it.value} type="button" onClick={() => select(it.value)}
            style={{
              background: on ? "var(--white)" : "transparent", border: "none", cursor: "pointer",
              padding: "6px 14px", borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600,
              color: on ? "var(--ink)" : "var(--ink-2)",
              boxShadow: on ? "var(--shadow-sm)" : "none", transition: "all .15s",
            }}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
