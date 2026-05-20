import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PlayerShootingZones, TeamOppShootingZones } from '@/services/nba-data.service';
import { Skeleton } from '@/components/ui/skeleton';

interface ShootingZonesCardProps {
  data?: PlayerShootingZones | null;
  isLoading?: boolean;
  playerName?: string;
  /** Defesa por zona do proximo adversario — pra matchup overlay */
  oppShootingZones?: TeamOppShootingZones | null;
  /** Sigla do adversario (PHX, ATL...) — exibida no overlay */
  opponentAbbreviation?: string | null;
}

// Nomes em PT-BR — versao curta pro badge SVG (uppercase, cabe em 64px)
const ZONE_LABELS_SHORT_PT = {
  restricted_area:     'SOB O ARO',
  in_the_paint_non_ra: 'GARRAFÃO',
  mid_range:           'MEIA DIST',
  corner_3:            '3PT CANTO',
  above_the_break_3:   '3PT FRONT',
} as const;

/*
  Court geometry — viewBox "0 0 600 520"
  Basket:    (300, 460)   Baseline: y=500
  Paint:     x=185–415,  y=240–500
  FT arc:    center (300,240), r=90, lower half
  RA circle: center (300,460), r=52
  3pt corner lines: x=80 and x=520, from y=500 to y=295
  3pt arc:   center (300,460), r=275  →  (80,295)…(520,295), top at (300,185)
  Verify: sqrt((300-80)²+(460-295)²) = sqrt(220²+165²) = sqrt(75625) = 275 ✓
*/

function zoneFill(pct: number, fga: number): string {
  if (fga < 0.3) return 'rgba(154,160,151,0.10)';
  if (pct >= 0.55) return 'rgba(10,61,46,0.18)';
  if (pct >= 0.45) return 'rgba(31,86,64,0.16)';
  if (pct >= 0.35) return 'rgba(201,122,26,0.16)';
  return 'rgba(190,18,60,0.14)';
}

function badgeColor(pct: number, fga: number): string {
  if (fga < 0.3) return '#9aa097';
  if (pct >= 0.55) return '#0a3d2e';
  if (pct >= 0.45) return '#1f5640';
  if (pct >= 0.35) return '#c97a1a';
  return '#be123c';
}

function badgeBorder(pct: number, fga: number): string {
  if (fga < 0.3) return '#e3e6e0';
  if (pct >= 0.55) return '#0a3d2e';
  if (pct >= 0.45) return '#1f5640';
  if (pct >= 0.35) return '#c97a1a';
  return '#be123c';
}

interface ZoneBadgeProps {
  x: number;
  y: number;
  pct: number;
  fga: number;
  label?: string;
}

const ZoneBadge: React.FC<ZoneBadgeProps> = ({ x, y, pct, fga, label }) => {
  const color = badgeColor(pct, fga);
  const pctStr = fga >= 0.3 ? `${Math.round(pct * 100)}%` : '—';
  const fgaStr = (Math.round(fga * 10) / 10).toFixed(1);

  return (
    <g>
      <rect
        x={x - 32} y={y - 24}
        width={64} height={48}
        rx={7}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
      {label && (
        <text
          x={x}
          y={y - 10}
          textAnchor="middle"
          fontSize={10}
          fill="#ffffff"
          fontWeight="700"
          letterSpacing="0.5"
          opacity={0.85}
        >
          {label}
        </text>
      )}
      <text x={x} y={y + (label ? 6 : 2)} textAnchor="middle" fontSize={17} fontWeight="bold" fill="#ffffff">
        {pctStr}
      </text>
      <text
        x={x}
        y={y + (label ? 20 : 16)}
        textAnchor="middle"
        fontSize={11}
        fill="#ffffff"
        opacity={0.7}
      >
        {fgaStr} fg/g
      </text>
    </g>
  );
};

export const ShootingZonesCard: React.FC<ShootingZonesCardProps> = ({
  data,
  isLoading = false,
  playerName = '',
  oppShootingZones,
  opponentAbbreviation,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white border border-line overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">Zonas de arremesso</span>
        </div>
        <div className="p-4">
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg bg-white border border-line overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">Zonas de arremesso</span>
        </div>
        <div className="p-4 text-[12px] text-ink-dim">
          Nenhum dado de zonas de arremesso para {playerName || 'o jogador selecionado'}.
        </div>
      </div>
    );
  }

  const d = data;

  return (
    <div className="rounded-lg bg-white border border-line overflow-hidden">
      <button
        type="button"
        className="w-full px-4 py-3 flex items-center justify-between border-b border-line md:cursor-default"
        onClick={() => setExpanded(prev => !prev)}
      >
        <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">Zonas de arremesso</span>
        <ChevronDown className={`w-4 h-4 text-ink-dim transition-transform md:hidden ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div className={`${expanded ? 'block' : 'hidden'} md:block`}>
      <div className="p-4 flex flex-col">

      <svg viewBox="0 0 600 520" className="w-full flex-1" style={{ minHeight: 0 }}>

        {/* ── COURT BACKGROUND ── */}
        <rect x="30" y="10" width="540" height="490" rx="8" fill="#fafbf8" />

        {/*
          ── ZONE FILLS ──
          Layering order (back to front):
          1. Above break 3  → entire court rect (everything outside gets covered)
          2. Mid range       → 3pt arc interior (x=80–520)
          3. Left corner 3   → side rect below arc endpoint
          4. Right corner 3  → side rect below arc endpoint
          5. Paint (non-RA)  → paint box
          6. Restricted area → basket circle
        */}

        {/* 1. Above break 3 — fills entire court; other zones layer on top */}
        <rect x="30" y="10" width="540" height="490"
          fill={zoneFill(d.above_the_break_3_fg_pct, d.above_the_break_3_fga)}
        />

        {/* 2. Mid range: 3pt arc interior (from corner x=80 to x=520) */}
        <path
          d="M 80 500 L 80 295 A 275 275 0 0 1 520 295 L 520 500 Z"
          fill={zoneFill(d.mid_range_fg_pct, d.mid_range_fga)}
        />

        {/* 3. Left corner 3 */}
        <rect x="30" y="295" width="50" height="205"
          fill={zoneFill(d.left_corner_3_fg_pct, d.left_corner_3_fga)}
        />

        {/* 4. Right corner 3 */}
        <rect x="520" y="295" width="50" height="205"
          fill={zoneFill(d.right_corner_3_fg_pct, d.right_corner_3_fga)}
        />

        {/* 5. Paint (non-RA) */}
        <rect x="185" y="240" width="230" height="260"
          fill={zoneFill(d.in_the_paint_non_ra_fg_pct, d.in_the_paint_non_ra_fga)}
        />

        {/* 6. Restricted area */}
        <circle cx="300" cy="460" r="52"
          fill={zoneFill(d.restricted_area_fg_pct, d.restricted_area_fga)}
        />

        {/* ── COURT STRUCTURE ── */}

        {/* Baseline */}
        <line x1="30" y1="500" x2="570" y2="500" stroke="#cdd3c8" strokeWidth="2" />
        {/* Left sideline */}
        <line x1="30" y1="10" x2="30" y2="500" stroke="#cdd3c8" strokeWidth="1.5" />
        {/* Right sideline */}
        <line x1="570" y1="10" x2="570" y2="500" stroke="#cdd3c8" strokeWidth="1.5" />

        {/* Paint box */}
        <rect x="185" y="240" width="230" height="260" fill="none" stroke="#cdd3c8" strokeWidth="1.5" />

        {/* Restricted area circle */}
        <circle cx="300" cy="460" r="52" fill="none" stroke="#cdd3c8" strokeWidth="1.5" />

        {/* Backboard */}
        <line x1="263" y1="492" x2="337" y2="492" stroke="#9aa097" strokeWidth="4" />
        <line x1="300" y1="460" x2="300" y2="492" stroke="#cdd3c8" strokeWidth="1" strokeDasharray="3 2" />

        {/* Basket rim */}
        <circle cx="300" cy="460" r="14" fill="none" stroke="#9aa097" strokeWidth="2.5" />
        <circle cx="300" cy="460" r="4" fill="#9aa097" />

        {/* 3pt corner lines — full height from baseline up to arc start */}
        <line x1="80" y1="500" x2="80" y2="295" stroke="#cdd3c8" strokeWidth="2" />
        <line x1="520" y1="500" x2="520" y2="295" stroke="#cdd3c8" strokeWidth="2" />

        {/* Horizontal lines separating corner 3 from above break at arc start height */}
        <line x1="30" y1="295" x2="80" y2="295" stroke="#cdd3c8" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="520" y1="295" x2="570" y2="295" stroke="#cdd3c8" strokeWidth="1.5" strokeDasharray="4 3" />

        {/* 3pt arc: center (300,460), r=275, from (80,295) to (520,295), going over top */}
        {/* sweep=1 (CW in SVG = small arc going upward through (300,185)) */}
        <path d="M 80 295 A 275 275 0 0 1 520 295" fill="none" stroke="#cdd3c8" strokeWidth="2" />

        {/* ── ZONE BADGES ── */}

        {/* Left corner 3 — inside court, left edge safe */}
        <ZoneBadge x={55} y={410} pct={d.left_corner_3_fg_pct} fga={d.left_corner_3_fga} label={ZONE_LABELS_SHORT_PT.corner_3} />

        {/* Right corner 3 */}
        <ZoneBadge x={545} y={410} pct={d.right_corner_3_fg_pct} fga={d.right_corner_3_fga} label={ZONE_LABELS_SHORT_PT.corner_3} />

        {/* Above the break 3 — center, clearly outside the 3pt arc */}
        <ZoneBadge x={300} y={80} pct={d.above_the_break_3_fg_pct} fga={d.above_the_break_3_fga} label={ZONE_LABELS_SHORT_PT.above_the_break_3} />

        {/* Mid range — left wing, inside court between paint and 3pt arc */}
        <ZoneBadge x={132} y={345} pct={d.mid_range_fg_pct} fga={d.mid_range_fga} label={ZONE_LABELS_SHORT_PT.mid_range} />

        {/* Paint non-RA — center of paint, above RA */}
        <ZoneBadge x={300} y={338} pct={d.in_the_paint_non_ra_fg_pct} fga={d.in_the_paint_non_ra_fga} label={ZONE_LABELS_SHORT_PT.in_the_paint_non_ra} />

        {/* Restricted area — at basket */}
        <ZoneBadge x={300} y={460} pct={d.restricted_area_fg_pct} fga={d.restricted_area_fga} label={ZONE_LABELS_SHORT_PT.restricted_area} />

      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
        {[
          { color: '#0a3d2e', label: '≥55%' },
          { color: '#1f5640', label: '45–54%' },
          { color: '#c97a1a', label: '35–44%' },
          { color: '#be123c', label: '<35%' },
          { color: '#9aa097', label: 'baixo vol.' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-ink-dim">{label}</span>
          </div>
        ))}
      </div>
      </div>
      </div>
    </div>
  );
};
