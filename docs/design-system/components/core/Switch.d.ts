import React from "react";

export interface SwitchProps {
  /** Controlled on/off state. */
  checked?: boolean;
  /** Initial state when uncontrolled. */
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

/** Toggle switch — forest when on. */
export function Switch(props: SwitchProps): JSX.Element;
