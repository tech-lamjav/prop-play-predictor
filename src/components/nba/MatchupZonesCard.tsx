import React from 'react';
import { Star } from 'lucide-react';
import { PlayerShootingZones, TeamOppShootingZones } from '@/services/nba-data.service';

interface MatchupZonesCardProps {
  data?: PlayerShootingZones | null;
  oppShootingZones?: TeamOppShootingZones | null;
  opponentAbbreviation?: string | null;
  playerName?: string;
}

function matchupColor(rank: number | null | undefined): string {
  if (rank == null) return '#9aa097';
  if (rank >= 21) return '#0a3d2e';
  if (rank >= 11) return '#c97a1a';
  return '#be123c';
}

const ZONE_LABELS_LONG_PT = {
  restricted_area:     'Sob o aro',
  in_the_paint_non_ra: 'Garrafão',
  mid_range:           'Meia distância',
  corner_3:            '3pts do canto',
  above_the_break_3:   '3pts frontal',
} as const;

type ZoneKey = keyof typeof ZONE_LABELS_LONG_PT;

function oppForZone(
  opp: TeamOppShootingZones | null | undefined,
  zone: ZoneKey,
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

export const MatchupZonesCard: React.FC<MatchupZonesCardProps> = ({
  data,
  oppShootingZones,
  opponentAbbreviation,
  playerName,
}) => {
  if (!data || !oppShootingZones || !opponentAbbreviation) return null;

  // Sobrenome do jogador pra usar nas linhas (ex: "Brunson acerta 41%")
  const playerLastName = playerName
    ? playerName.trim().split(/\s+/).pop() ?? playerName
    : 'Você';

  const rawZones: { label: string; key: ZoneKey; playerPct: number }[] = [
    { label: ZONE_LABELS_LONG_PT.above_the_break_3,   key: 'above_the_break_3',   playerPct: data.above_the_break_3_fg_pct },
    { label: ZONE_LABELS_LONG_PT.mid_range,           key: 'mid_range',           playerPct: data.mid_range_fg_pct },
    { label: ZONE_LABELS_LONG_PT.corner_3,            key: 'corner_3',            playerPct: (data.left_corner_3_fg_pct + data.right_corner_3_fg_pct) / 2 },
    { label: ZONE_LABELS_LONG_PT.in_the_paint_non_ra, key: 'in_the_paint_non_ra', playerPct: data.in_the_paint_non_ra_fg_pct },
    { label: ZONE_LABELS_LONG_PT.restricted_area,     key: 'restricted_area',     playerPct: data.restricted_area_fg_pct },
  ];

  type Zone = { label: string; key: ZoneKey; playerPct: number; oppPct: number; rank: number };
  const zones: Zone[] = rawZones
    .map(z => {
      const opp = oppForZone(oppShootingZones, z.key);
      return { ...z, oppPct: opp.pct as number, rank: opp.rank as number };
    })
    .filter((z): z is Zone => z.oppPct != null && z.rank != null);

  if (zones.length === 0) return null;

  const sorted = [...zones].sort((a, b) => b.rank - a.rank);
  const best = sorted[0];
  const favoraveis = sorted.filter(z => z.rank >= 21);
  const neutros = sorted.filter(z => z.rank >= 11 && z.rank <= 20);
  const fortes = sorted.filter(z => z.rank <= 10);
  const bestColor = matchupColor(best.rank);

  const headlineStyle =
    best.rank >= 21
      ? { bg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fadf 100%)', border: '#86d3a3', accent: '#0a3d2e' }
      : best.rank >= 11
      ? { bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '#facc15', accent: '#9a6c00' }
      : { bg: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)', border: '#fb7185', accent: '#be123c' };

  const headlineAction =
    best.rank >= 21 ? 'Atacar aqui' :
    best.rank >= 11 ? 'Melhor zona disponível' :
    'Defesa elite em todas zonas';

  const renderRow = (z: Zone, isLast: boolean) => {
    const c = matchupColor(z.rank);
    return (
      <div
        key={z.key}
        className={`py-2 text-[12px] ${isLast ? '' : 'border-b border-line/60'}`}
      >
        <div className="flex items-center gap-3">
          <span
            className="font-bold tabular shrink-0 w-12 text-[11px]"
            style={{ color: c }}
          >
            #{z.rank}/30
          </span>
          <span className="flex-1 min-w-0 text-ink">{z.label}</span>
          <span className="hidden md:inline-flex items-baseline gap-1 shrink-0 text-ink-dim">
            {opponentAbbreviation} cede
            <span className="font-semibold tabular text-[12px] tracking-tight ml-0.5" style={{ color: c }}>
              {Math.round(z.oppPct * 100)}%
            </span>
          </span>
          <span className="hidden md:inline-flex items-baseline gap-1 shrink-0 text-ink-dim w-36 justify-end">
            {playerLastName} acerta
            <span className="font-semibold tabular text-[12px] text-ink tracking-tight ml-0.5">
              {Math.round(z.playerPct * 100)}%
            </span>
          </span>
        </div>
        {/* Mobile: percentuais em linha separada abaixo do label */}
        <div className="flex md:hidden items-baseline justify-between gap-3 mt-1 pl-[3.75rem]">
          <span className="inline-flex items-baseline gap-1 text-ink-dim">
            {opponentAbbreviation} cede
            <span className="font-semibold tabular text-[12px] tracking-tight ml-0.5" style={{ color: c }}>
              {Math.round(z.oppPct * 100)}%
            </span>
          </span>
          <span className="inline-flex items-baseline gap-1 text-ink-dim">
            {playerLastName} acerta
            <span className="font-semibold tabular text-[12px] text-ink tracking-tight ml-0.5">
              {Math.round(z.playerPct * 100)}%
            </span>
          </span>
        </div>
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
      <div className="mb-4 last:mb-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: dotColor }}>
            {label}
          </span>
          <span className="text-[10px] text-ink-dim">— {sub}</span>
        </div>
        {items.map((z, i) => renderRow(z, i === items.length - 1))}
      </div>
    );
  };

  return (
    <div className="rounded-lg bg-white border border-line overflow-hidden">
      <div className="px-4 py-3 border-b border-line">
        <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">
          Matchup vs {opponentAbbreviation}
        </span>
      </div>
      <div className="p-4">
        <div
          className="mb-4 p-4 rounded-lg border"
          style={{ background: headlineStyle.bg, borderColor: headlineStyle.border }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">
              {headlineAction}
            </span>
          </div>
          <div className="text-[18px] font-semibold tracking-tight text-ink mb-1">
            {best.label}
          </div>
          <div className="text-[11px] text-ink-2 leading-relaxed">
            {opponentAbbreviation} cede{' '}
            <span className="font-semibold" style={{ color: headlineStyle.accent }}>
              {Math.round(best.oppPct * 100)}%
            </span>
            {' '}nessa zona — defesa{' '}
            <span className="font-semibold text-ink">#{best.rank} de 30</span>.
            {' '}Você acerta{' '}
            <span className="font-semibold" style={{ color: headlineStyle.accent }}>
              {Math.round(best.playerPct * 100)}%
            </span> aí.
          </div>
        </div>

        {renderGroup(favoraveis, '#0a3d2e', 'Atacar', `${opponentAbbreviation} é vulnerável (rank 21–30)`)}
        {renderGroup(neutros,    '#c97a1a', 'Neutro', 'rank na média (11–20)')}
        {renderGroup(fortes,     '#be123c', 'Evitar', `${opponentAbbreviation} é elite (rank 1–10)`)}
      </div>

      {/* Legend rodapé */}
      <div className="px-4 py-3 border-t border-line flex items-center justify-start gap-4 flex-wrap">
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
  );
};
