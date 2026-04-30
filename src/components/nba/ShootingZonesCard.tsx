import React, { useState } from 'react';
import { ChevronDown, Target } from 'lucide-react';
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

/**
 * Cor do matchup baseada no rank defensivo do adversario na zona:
 *   #1-#10  → adversario eh ELITE na zona — ruim pro jogador (vermelho)
 *   #11-#20 → media (amarelo)
 *   #21-#30 → adversario CEDE muito na zona — bom pro jogador (verde)
 *
 * Mesma escala usada em NextGamesCard.getMatchupColor.
 */
function matchupColor(rank: number | null | undefined): string {
  if (rank == null) return '#4b5563';
  if (rank >= 21) return '#22c55e';
  if (rank >= 11) return '#eab308';
  return '#ef4444';
}

// Nomes em PT-BR — versao curta pro badge SVG (uppercase, cabe em 64px)
// e versao longa pro overlay de matchup (mixed case).
const ZONE_LABELS_SHORT_PT = {
  restricted_area:     'SOB O ARO',
  in_the_paint_non_ra: 'GARRAFÃO',
  mid_range:           'MEIA DIST',
  corner_3:            '3PT CANTO',
  above_the_break_3:   '3PT FRONT',
} as const;

const ZONE_LABELS_LONG_PT = {
  restricted_area:     'Sob o aro',
  in_the_paint_non_ra: 'Garrafão',
  mid_range:           'Meia distância',
  corner_3:            '3pts do canto',
  above_the_break_3:   '3pts frontal',
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

// Mapping zone-key → opp data (pct + rank). Centraliza pra cada ZoneBadge
// pegar oppPct/oppRank do que cede o adversario na zona correspondente.
function oppForZone(
  opp: TeamOppShootingZones | null | undefined,
  zone: 'restricted_area' | 'in_the_paint_non_ra' | 'mid_range' | 'corner_3' | 'above_the_break_3'
): { pct: number | null; rank: number | null } {
  if (!opp) return { pct: null, rank: null };
  const map = {
    restricted_area:     { pct: opp.opp_restricted_area_fg_pct,     rank: opp.opp_restricted_area_fg_pct_rank },
    in_the_paint_non_ra: { pct: opp.opp_in_the_paint_non_ra_fg_pct, rank: opp.opp_in_the_paint_non_ra_fg_pct_rank },
    mid_range:           { pct: opp.opp_mid_range_fg_pct,           rank: opp.opp_mid_range_fg_pct_rank },
    corner_3:            { pct: opp.opp_corner_3_fg_pct,            rank: opp.opp_corner_3_fg_pct_rank },
    above_the_break_3:   { pct: opp.opp_above_the_break_3_fg_pct,   rank: opp.opp_above_the_break_3_fg_pct_rank },
  };
  return map[zone];
}

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

      {/* Matchup vs proximo adversario — so renderiza se tem dado.
          Insight-first: ordenado por qualidade do matchup (rank desc),
          headline com a melhor zona, e grupos labeled (Favoravel/Neutro/
          Defesa forte) usando text + cor + bullet — cor nao eh sozinha. */}
      {oppShootingZones && opponentAbbreviation && (() => {
        const rawZones = [
          { label: ZONE_LABELS_LONG_PT.above_the_break_3,   key: 'above_the_break_3' as const,   playerPct: d.above_the_break_3_fg_pct },
          { label: ZONE_LABELS_LONG_PT.mid_range,           key: 'mid_range' as const,           playerPct: d.mid_range_fg_pct },
          { label: ZONE_LABELS_LONG_PT.corner_3,            key: 'corner_3' as const,            playerPct: (d.left_corner_3_fg_pct + d.right_corner_3_fg_pct) / 2 },
          { label: ZONE_LABELS_LONG_PT.in_the_paint_non_ra, key: 'in_the_paint_non_ra' as const, playerPct: d.in_the_paint_non_ra_fg_pct },
          { label: ZONE_LABELS_LONG_PT.restricted_area,     key: 'restricted_area' as const,     playerPct: d.restricted_area_fg_pct },
        ];

        type Zone = { label: string; key: string; playerPct: number; oppPct: number; rank: number };
        const zones: Zone[] = rawZones
          .map((z) => {
            const opp = oppForZone(oppShootingZones, z.key);
            return { ...z, oppPct: opp.pct, rank: opp.rank };
          })
          .filter((z): z is Zone => z.oppPct != null && z.rank != null);

        if (zones.length === 0) return null;

        // Sort: maior rank (= adversario cede mais) primeiro
        const sorted = [...zones].sort((a, b) => b.rank - a.rank);
        const best = sorted[0];
        const favoraveis = sorted.filter((z) => z.rank >= 21);
        const neutros = sorted.filter((z) => z.rank >= 11 && z.rank <= 20);
        const fortes = sorted.filter((z) => z.rank <= 10);
        const bestColor = matchupColor(best.rank);

        const renderRow = (z: Zone) => {
          const c = matchupColor(z.rank);
          return (
            <div key={z.key} className="flex items-center gap-2 py-1 text-[11px]">
              {/* Rank com denominador (#27/30) — escala fica obvia */}
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums shrink-0 min-w-[44px] text-center"
                style={{ color: c, backgroundColor: `${c}1f`, border: `1px solid ${c}55` }}
              >
                #{z.rank}/30
              </span>
              {/* Zona */}
              <span className="flex-1 min-w-0 truncate text-terminal-text/80">{z.label}</span>
              {/* Opp cede — labelado explicito */}
              <span className="opacity-50 shrink-0 text-[10px]">cede</span>
              <span className="font-semibold tabular-nums shrink-0 w-9 text-right" style={{ color: c }}>
                {Math.round(z.oppPct * 100)}%
              </span>
              {/* Player — labelado explicito */}
              <span className="opacity-30 shrink-0 text-[10px]">·  você</span>
              <span className="opacity-50 tabular-nums shrink-0 w-9 text-right">
                {Math.round(z.playerPct * 100)}%
              </span>
            </div>
          );
        };

        const renderGroup = (
          items: Zone[],
          dotColor: string,
          label: string,
          sub: string,
        ) => {
          if (items.length === 0) return null;
          return (
            <div className="mb-3 last:mb-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: dotColor }}>
                  {label}
                </span>
                <span className="text-[10px] opacity-50">— {sub}</span>
              </div>
              {items.map(renderRow)}
            </div>
          );
        };

        // Action label do headline depende do rank do melhor matchup
        const headlineAction =
          best.rank >= 21 ? 'Atacar aqui' :
          best.rank >= 11 ? 'Melhor zona disponível' :
          'Defesa elite em todas zonas';

        return (
          <div className="mt-3 pt-3 border-t border-terminal-border-subtle">
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-60 mb-2">
              Matchup vs {opponentAbbreviation}
            </div>

            {/* Headline: melhor zona pra atacar (= mais favoravel)
                Linguagem natural: "DEN cede X% (defesa #N de 30)" em vez
                de string compactada que exige decoder mental. */}
            <div
              className="mb-3 p-3 rounded border-l-2"
              style={{
                borderLeftColor: bestColor,
                backgroundColor: `${bestColor}0d`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Target className="w-3 h-3" style={{ color: bestColor }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: bestColor }}>
                  {headlineAction}
                </span>
              </div>
              <div className="text-[15px] font-bold mb-1" style={{ color: bestColor }}>
                {best.label}
              </div>
              <div className="text-[11px] opacity-70 leading-relaxed">
                {opponentAbbreviation} cede{' '}
                <span className="font-semibold text-terminal-text">
                  {Math.round(best.oppPct * 100)}%
                </span>{' '}
                nessa zona — defesa{' '}
                <span className="font-semibold text-terminal-text">
                  #{best.rank} de 30
                </span>
                . Você acerta{' '}
                <span className="font-semibold text-terminal-text">
                  {Math.round(best.playerPct * 100)}%
                </span>{' '}
                aí.
              </div>
            </div>

            {/* Grupos por qualidade — so renderiza grupos com items.
                Labels acionaveis (verbos) em vez de adjetivos. */}
            {renderGroup(favoraveis, '#22c55e', 'Atacar', 'DEN é vulnerável (rank 21–30)')}
            {renderGroup(neutros,    '#eab308', 'Neutro', 'rank na média (11–20)')}
            {renderGroup(fortes,     '#ef4444', 'Evitar', 'DEN é elite (rank 1–10)')}
          </div>
        );
      })()}

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
