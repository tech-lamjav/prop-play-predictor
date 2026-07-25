import React from "react";

export interface ChipProps {
  /** `amberSoft` = gatilho highlight; `onDark` = chip on the forest hero. */
  tone?: "neutral" | "forest" | "amberSoft" | "onDark" | "outline";
  leadingIcon?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Compact metadata chip (h-24, rounded-sm) — gatilho / stat / linha tags. */
export function Chip(props: ChipProps): JSX.Element;
