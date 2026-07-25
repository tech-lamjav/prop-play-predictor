import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds hover shadow + green border tint; use for clickable cards. */
  interactive?: boolean;
  /** Inner padding in px. Rebrand default is 20 (p-5); use 24 for roomier cards. */
  padding?: number;
  children?: React.ReactNode;
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title?: React.ReactNode;
  /** Right-aligned action element (link / button). */
  action?: React.ReactNode;
}

/**
 * The signature Smart Betting card — white, hairline border, 20px radius.
 * @startingPoint section="Core" subtitle="White card with hairline border, 20px radius" viewport="700x220"
 */
export function Card(props: CardProps): JSX.Element;
export function CardHeader(props: CardHeaderProps): JSX.Element;
