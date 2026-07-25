import React from "react";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Color tone. `forest` is the default brand chip. */
  tone?: "forest" | "amber" | "neutral" | "outline" | "success" | "warning" | "danger" | "info";
  /** Square (rounded-sm) instead of the default pill. */
  square?: boolean;
  children?: React.ReactNode;
}

/** Small status pill / tag. Forest chip by default; semantic status tones available. */
export function Badge(props: BadgeProps): JSX.Element;
