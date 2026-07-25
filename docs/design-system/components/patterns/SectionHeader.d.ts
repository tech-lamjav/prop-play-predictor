import React from "react";

export interface SectionHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  /** Muted count shown after the title. */
  count?: number | string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

/** List-section header — uppercase eyebrow + title + optional action link. */
export function SectionHeader(props: SectionHeaderProps): JSX.Element;
