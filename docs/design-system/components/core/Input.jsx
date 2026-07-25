import React from "react";

/** Text input. White surface, hairline border, forest focus ring. Optional
 * leading icon (e.g. lucide Search) matches the app's search field. */
export function Input({ leadingIcon = null, style = {}, wrapperStyle = {}, ...props }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center", width: "100%", ...wrapperStyle }}>
      {leadingIcon && (
        <span style={{ position: "absolute", left: 10, display: "inline-flex", color: "var(--ink-2)", pointerEvents: "none" }}>
          {leadingIcon}
        </span>
      )}
      <input
        onFocus={(e) => { setFocus(true); props.onFocus && props.onFocus(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur && props.onBlur(e); }}
        style={{
          height: 40, width: "100%", boxSizing: "border-box",
          padding: leadingIcon ? "0 12px 0 34px" : "0 12px",
          background: "var(--white)", color: "var(--ink)",
          border: `1px solid ${focus ? "var(--forest)" : "var(--line)"}`,
          borderRadius: "var(--radius-md)", fontFamily: "var(--font-sans)",
          fontSize: 13, outline: "none",
          boxShadow: focus ? "0 0 0 3px rgba(10,61,46,0.12)" : "none",
          transition: "border-color .15s, box-shadow .15s", ...style,
        }}
        {...props}
      />
    </div>
  );
}
