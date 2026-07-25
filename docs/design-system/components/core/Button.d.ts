import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style. `forest` is the primary action; `amber` the accent CTA. */
  variant?: "forest" | "amber" | "amber-bright" | "outline-forest" | "secondary" | "ghost" | "link" | "destructive";
  /** Control height. `icon` is square. */
  size?: "sm" | "default" | "lg" | "icon";
  disabled?: boolean;
  /** Icon element rendered before the label (e.g. a lucide icon). */
  leadingIcon?: React.ReactNode;
  /** Icon element rendered after the label (e.g. ArrowRight). */
  trailingIcon?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Primary action button for Smart Betting. Forest green primary, amber accent CTA.
 * @startingPoint section="Core" subtitle="Forest + amber action buttons" viewport="700x150"
 */
export function Button(props: ButtonProps): JSX.Element;
