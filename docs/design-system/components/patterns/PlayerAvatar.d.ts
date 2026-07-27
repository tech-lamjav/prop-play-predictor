import React from "react";

export interface PlayerAvatarProps {
  /** Full name — used for initials fallback + alt text. */
  name: string;
  /** Photo URL. Falls back to initials on error / when omitted. */
  src?: string;
  /** Team abbreviation for the corner badge. */
  teamAbbr?: string;
  /** Pixel size (square). */
  size?: number;
  /** `circle` = list/search avatar; `square` = hero photo block (forest gradient). */
  shape?: "circle" | "square";
  /** Show the team-abbr badge in the corner (square/hero use). */
  showTeamBadge?: boolean;
  style?: React.CSSProperties;
}

/** Player/team avatar — circular list avatar or square hero photo block. */
export function PlayerAvatar(props: PlayerAvatarProps): JSX.Element;
