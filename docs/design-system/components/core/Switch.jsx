import React from "react";

/** On/off switch. Forest when checked, line-gray track when off. */
export function Switch({ checked, defaultChecked = false, onChange, disabled = false, style = {}, ...props }) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(defaultChecked);
  const on = isControlled ? checked : internal;
  const toggle = () => {
    if (disabled) return;
    if (!isControlled) setInternal(!on);
    onChange && onChange(!on);
  };
  return (
    <button
      type="button" role="switch" aria-checked={on} disabled={disabled} onClick={toggle}
      style={{
        width: 44, height: 24, borderRadius: "var(--radius-full)", border: "none",
        padding: 2, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        background: on ? "var(--forest)" : "var(--line-2)",
        transition: "background .15s", display: "inline-flex", alignItems: "center", ...style,
      }}
      {...props}
    >
      <span style={{
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        transform: on ? "translateX(20px)" : "translateX(0)", transition: "transform .15s",
      }} />
    </button>
  );
}
