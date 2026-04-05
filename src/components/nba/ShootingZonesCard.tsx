import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { PlayerShootingZones } from '@/services/nba-data.service';
import { Skeleton } from '@/components/ui/skeleton';

interface ShootingZonesCardProps {
  data?: PlayerShootingZones | null;
  isLoading?: boolean;
  playerName?: string;
}

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
  if (fga < 0.3) return 'rgba(75,85,99,0.12)';
  if (pct >= 0.55) return 'rgba(34,197,94,0.22)';
  if (pct >= 0.45) return 'rgba(132,204,22,0.20)';
  if (pct >= 0.35) return 'rgba(234,179,8,0.22)';
  return 'rgba(239,68,68,0.18)';
}

function badgeColor(pct: number, fga: number): string {
  if (fga < 0.3) return '#4b5563';
  if (pct >= 0.55) return '#22c55e';
  if (pct >= 0.45) return '#84cc16';
  if (pct >= 0.35) return '#eab308';
  return '#ef4444';
}

function badgeBorder(pct: number, fga: number): string {
  if (fga < 0.3) return '#374151';
  if (pct >= 0.55) return '#16a34a';
  if (pct >= 0.45) return '#65a30d';
  if (pct >= 0.35) return '#ca8a04';
  return '#b91c1c';
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
  const border = badgeBorder(pct, fga);
  const pctStr = fga >= 0.3 ? `${Math.round(pct * 100)}%` : '—';
  const fgaStr = (Math.round(fga * 10) / 10).toFixed(1);

  return (
    <g>
      <rect
        x={x - 32} y={y - 24}
        width={64} height={48}
        rx={7}
        fill="rgba(2,6,18,0.92)"
        stroke={border}
        strokeWidth={1.8}
      />
      {label && (
        <text x={x} y={y - 10} textAnchor="middle" fontSize={10} fill="#6b7280" fontWeight="600" letterSpacing="0.5">
          {label}
        </text>
      )}
      <text x={x} y={y + (label ? 6 : 2)} textAnchor="middle" fontSize={17} fontWeight="bold" fill={color}>
        {pctStr}
      </text>
      <text x={x} y={y + (label ? 20 : 16)} textAnchor="middle" fontSize={11} fill="#4b5563">
        {fgaStr} fg/g
      </text>
    </g>
  );
};

export const ShootingZonesCard: React.FC<ShootingZonesCardProps> = ({
  data,
  isLoading = false,
  playerName = '',
}) => {
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="terminal-container p-4 rounded">
        <h3 className="section-title mb-3">ZONAS DE ARREMESSO</h3>
        <Skeleton className="h-80 w-full bg-terminal-gray" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="terminal-container p-4 rounded">
        <h3 className="section-title mb-3">ZONAS DE ARREMESSO</h3>
        <div className="text-xs text-terminal-text opacity-60">
          Nenhum dado de zonas de arremesso para {playerName || 'o jogador selecionado'}.
        </div>
      </div>
    );
  }

  const d = data;

  return (
    <div className="terminal-container p-4 rounded">
      <button
        className="w-full flex items-center justify-between md:cursor-default"
        onClick={() => setExpanded(prev => !prev)}
      >
        <h3 className="section-title">ZONAS DE ARREMESSO</h3>
        <ChevronDown className={`w-4 h-4 text-terminal-text/40 transition-transform md:hidden ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div className={`${expanded ? 'block' : 'hidden'} md:block`}>
      <div className="mt-3 flex flex-col">

      <svg viewBox="0 0 600 520" className="w-full flex-1" style={{ minHeight: 0 }}>

        {/* ── COURT BACKGROUND ── */}
        <rect x="30" y="10" width="540" height="490" rx="8" fill="#080f1e" />

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
        <line x1="30" y1="500" x2="570" y2="500" stroke="#2d5a8e" strokeWidth="2" />
        {/* Left sideline */}
        <line x1="30" y1="10" x2="30" y2="500" stroke="#2d5a8e" strokeWidth="1.5" />
        {/* Right sideline */}
        <line x1="570" y1="10" x2="570" y2="500" stroke="#2d5a8e" strokeWidth="1.5" />

        {/* Paint box */}
        <rect x="185" y="240" width="230" height="260" fill="none" stroke="#2d5a8e" strokeWidth="1.5" />

        {/* Restricted area circle */}
        <circle cx="300" cy="460" r="52" fill="none" stroke="#2d5a8e" strokeWidth="1.5" />

        {/* Backboard */}
        <line x1="263" y1="492" x2="337" y2="492" stroke="#2d4a6e" strokeWidth="4" />
        <line x1="300" y1="460" x2="300" y2="492" stroke="#2d5a8e" strokeWidth="1" strokeDasharray="3 2" />

        {/* Basket rim */}
        <circle cx="300" cy="460" r="14" fill="none" stroke="#2d4a6e" strokeWidth="2.5" />
        <circle cx="300" cy="460" r="4" fill="#2d4a6e" />

        {/* 3pt corner lines — full height from baseline up to arc start */}
        <line x1="80" y1="500" x2="80" y2="295" stroke="#2d5a8e" strokeWidth="2" />
        <line x1="520" y1="500" x2="520" y2="295" stroke="#2d5a8e" strokeWidth="2" />

        {/* Horizontal lines separating corner 3 from above break at arc start height */}
        <line x1="30" y1="295" x2="80" y2="295" stroke="#2d5a8e" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="520" y1="295" x2="570" y2="295" stroke="#2d5a8e" strokeWidth="1.5" strokeDasharray="4 3" />

        {/* 3pt arc: center (300,460), r=275, from (80,295) to (520,295), going over top */}
        {/* sweep=1 (CW in SVG = small arc going upward through (300,185)) */}
        <path d="M 80 295 A 275 275 0 0 1 520 295" fill="none" stroke="#2d5a8e" strokeWidth="2" />

        {/* ── ZONE BADGES ── */}

        {/* Left corner 3 — inside court, left edge safe */}
        <ZoneBadge x={55} y={410} pct={d.left_corner_3_fg_pct} fga={d.left_corner_3_fga} label="CORNER 3" />

        {/* Right corner 3 */}
        <ZoneBadge x={545} y={410} pct={d.right_corner_3_fg_pct} fga={d.right_corner_3_fga} label="CORNER 3" />

        {/* Above the break 3 — center, clearly outside the 3pt arc */}
        <ZoneBadge x={300} y={80} pct={d.above_the_break_3_fg_pct} fga={d.above_the_break_3_fga} label="ABOVE BREAK" />

        {/* Mid range — left wing, inside court between paint and 3pt arc */}
        <ZoneBadge x={132} y={345} pct={d.mid_range_fg_pct} fga={d.mid_range_fga} label="MID RANGE" />

        {/* Paint non-RA — center of paint, above RA */}
        <ZoneBadge x={300} y={338} pct={d.in_the_paint_non_ra_fg_pct} fga={d.in_the_paint_non_ra_fga} label="PAINT" />

        {/* Restricted area — at basket */}
        <ZoneBadge x={300} y={460} pct={d.restricted_area_fg_pct} fga={d.restricted_area_fga} label="REST. AREA" />

      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-5 mt-2">
        {[
          { color: '#22c55e', label: '≥55%' },
          { color: '#84cc16', label: '45–54%' },
          { color: '#eab308', label: '35–44%' },
          { color: '#ef4444', label: '<35%' },
          { color: '#4b5563', label: 'baixo vol.' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[9px] opacity-50">{label}</span>
          </div>
        ))}
      </div>
      </div>
      </div>
    </div>
  );
};
