import React from "react";

/** Player / team avatar. Circular by default (player), or rounded-square for the
 * hero photo block with a forest gradient fallback + initials. Team abbr badge
 * optional. Falls back to initials when no image / on error. */
export function PlayerAvatar({ name = "", src, teamAbbr, size = 40, shape = "circle", showTeamBadge = false, style = {} }) {
  const [err, setErr] = React.useState(false);
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const radius = shape === "circle" ? "50%" : "var(--radius-lg)";
  const showImg = src && !err;
  return (
    <div style={{
      position: "relative", width: size, height: size, borderRadius: radius, overflow: "hidden",
      flexShrink: 0, display: "grid", placeItems: "center",
      background: shape === "circle" ? "var(--ink-3)" : "var(--gradient-photo)",
      border: shape === "circle" ? "1px solid var(--line)" : "1px solid rgba(255,255,255,0.1)",
      color: shape === "circle" ? "var(--ink-2)" : "rgba(255,255,255,0.5)",
      fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: Math.max(10, size * 0.32), ...style,
    }}>
      {showImg
        ? <img src={src} alt={name} onError={() => setErr(true)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
        : <span>{initials}</span>}
      {showTeamBadge && teamAbbr && (
        <span style={{
          position: "absolute", bottom: 6, right: 6, height: 18, padding: "0 5px",
          display: "inline-flex", alignItems: "center", borderRadius: 4,
          fontSize: 10, fontWeight: 700, background: "rgba(0,0,0,0.4)", color: "#fff",
        }}>{teamAbbr}</span>
      )}
    </div>
  );
}
