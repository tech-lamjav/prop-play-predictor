import React from "react";

/**
 * Smart Betting Button. Rebrand variants use forest (primary) + amber (CTA).
 * Styling is driven entirely by design-system CSS custom properties.
 */
const SIZES = {
  sm: { height: 36, padding: "0 12px", fontSize: 13 },
  default: { height: 40, padding: "0 16px", fontSize: 13 },
  lg: { height: 44, padding: "0 32px", fontSize: 14 },
  icon: { height: 40, width: 40, padding: 0, fontSize: 14 },
};

function variantStyle(variant, hover) {
  switch (variant) {
    case "amber":
      return { background: hover ? "var(--amber-2)" : "var(--amber)", color: "var(--ink)", border: "1px solid transparent" };
    case "amber-bright": // hero CTA on dark surfaces
      return { background: hover ? "var(--amber-light)" : "var(--amber-bright)", color: "var(--ink)", border: "1px solid transparent" };
    case "outline-forest":
      return { background: hover ? "var(--forest)" : "transparent", color: hover ? "#fff" : "var(--forest)", border: "1px solid var(--forest)" };
    case "secondary":
      return { background: hover ? "var(--canvas-2)" : "var(--white)", color: "var(--ink)", border: "1px solid var(--line)" };
    case "ghost":
      return { background: hover ? "var(--canvas-2)" : "transparent", color: "var(--ink)", border: "1px solid transparent" };
    case "link":
      return { background: "transparent", color: "var(--forest)", border: "1px solid transparent", textDecoration: hover ? "underline" : "none", padding: 0, height: "auto" };
    case "destructive":
      return { background: hover ? "#a12e18" : "var(--status-danger)", color: "#fff", border: "1px solid transparent" };
    case "forest":
    default:
      return { background: hover ? "var(--forest-2)" : "var(--forest)", color: "#fff", border: "1px solid transparent" };
  }
}

export function Button({
  variant = "forest",
  size = "default",
  disabled = false,
  leadingIcon = null,
  trailingIcon = null,
  children,
  style = {},
  ...props
}) {
  const [hover, setHover] = React.useState(false);
  const sz = SIZES[size] || SIZES.default;
  const vs = variantStyle(variant, hover && !disabled);
  return (
    <button
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        whiteSpace: "nowrap", fontFamily: "var(--font-sans)", fontWeight: 600,
        borderRadius: "var(--radius-md)", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, transition: "background .15s, color .15s, border-color .15s",
        width: sz.width, height: sz.height, padding: sz.padding, fontSize: sz.fontSize,
        ...vs, ...style,
      }}
      {...props}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}
