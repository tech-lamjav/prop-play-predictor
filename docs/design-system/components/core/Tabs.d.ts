import React from "react";

export interface TabItem {
  label: React.ReactNode;
  value: string;
}

export interface TabsProps {
  items: TabItem[];
  /** Controlled active value. */
  value?: string;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** `segmented` = pill group (rebrand toggle); `underline` = forest underline. */
  variant?: "segmented" | "underline";
  style?: React.CSSProperties;
}

/** Tab / segmented control — the "Por Score / Por Gatilho" toggle pattern. */
export function Tabs(props: TabsProps): JSX.Element;
