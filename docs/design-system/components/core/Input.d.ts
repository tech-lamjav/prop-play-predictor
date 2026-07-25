import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Icon shown inside the field, left-aligned (e.g. a lucide Search glyph). */
  leadingIcon?: React.ReactNode;
  /** Style for the wrapping element (width, etc.). */
  wrapperStyle?: React.CSSProperties;
}

/** Text / search input — white surface, hairline border, forest focus ring. */
export function Input(props: InputProps): JSX.Element;
