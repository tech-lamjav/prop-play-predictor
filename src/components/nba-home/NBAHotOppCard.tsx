import React from 'react';
import { Star } from 'lucide-react';
import { getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';

const STAT_LABELS_SHORT: Record<string, string> = {
  player_points: 'Pontos', player_assists: 'Assistências', player_rebounds: 'Rebotes',
  player_threes: '3 pontos', player_steals: 'Roubos', player_blocks: 'Bloqueios',
  player_points_rebounds_assists: 'Pts+Reb+Ast', player_points_assists: 'Pts+Ast',
  player_points_rebounds: 'Pts+Reb', player_rebounds_assists: 'Reb+Ast',
};

export interface HotOppData {
  playerName: string;
  teamAbbr: string;
  statType: string;
  triggerName: string;
  triggerStatus: string;
  lineValue: number | null;
  projection: number;
  edgePct: number | null;
  score: number | null;
  ratingStars: number;
  opponentAbbr: string | null;
  isHome: boolean;
  gameTime: string | null;
}

interface NBAHotOppCardProps {
  opp: HotOppData;
  onClick?: () => void;
  href?: string;
}

function lastName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts[parts.length - 1] ?? full;
}

/** Constrói chip de gatilho refletindo o status do jogador lesionado. */
function buildTriggerChip(triggerName: string, status: string): string {
  const last = lastName(triggerName);
  const s = status.toLowerCase();
  if (s === 'out' || s.includes('out')) return `sem ${last}`;
  if (s.includes('doubtful')) return `${last} duvidoso`;
  return `${last} questionável`;
}

function StarRow({ n }: { n: number }) {
  const filled = Math.max(0, Math.min(3, n));
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0">
      {[0, 1, 2].map(i => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < filled ? 'text-amber-400 fill-amber-400' : 'text-ink-3'}`}
        />
      ))}
    </span>
  );
}

function PlayerThumb({ name, teamAbbr }: { name: string; teamAbbr: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="w-10 h-10 rounded-md grid place-items-center text-[11px] font-bold text-white bg-forest overflow-hidden shrink-0">
      <img
        src={getPlayerPhotoUrl(name, teamAbbr)}
        alt={`Foto de ${name}`}
        className="w-full h-full object-cover object-top"
        loading="lazy"
        data-player-photo-index="0"
        onError={(e) => {
          const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, name, teamAbbr);
          if (!didTry) {
            const el = e.target as HTMLImageElement;
            el.style.display = 'none';
            const parent = el.parentElement;
            if (parent) parent.insertAdjacentHTML('beforeend', `<span class="text-white">${initials}</span>`);
          }
        }}
      />
    </div>
  );
}

export const NBAHotOppCard: React.FC<NBAHotOppCardProps> = ({ opp, onClick, href }) => {
  const statShort = STAT_LABELS_SHORT[opp.statType] ?? opp.statType;
  const oppLabel = opp.opponentAbbr ? `${opp.isHome ? 'vs ' : '@'}${opp.opponentAbbr}` : null;
  const whenLabel = [oppLabel, opp.gameTime].filter(Boolean).join(' · ');
  const filterChip = buildTriggerChip(opp.triggerName, opp.triggerStatus);

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <PlayerThumb name={opp.playerName} teamAbbr={opp.teamAbbr} />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold tracking-tight text-ink truncate">{opp.playerName}</div>
            <div className="text-[11px] text-ink-2/70 truncate">{whenLabel || opp.teamAbbr}</div>
          </div>
        </div>
        <StarRow n={opp.ratingStars} />
      </div>

      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        <span className="px-2 h-6 inline-flex items-center rounded text-[11px] font-semibold bg-ink-3 text-ink">{statShort}</span>
        <span className="px-2 h-6 inline-flex items-center rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          {filterChip}
        </span>
      </div>

      <div className="grid grid-cols-4 mt-4 pt-3 gap-2 border-t border-line">
        <div>
          <div className="text-[9px] uppercase tracking-[0.16em] font-semibold text-ink-2/70">Projeção</div>
          <div className="text-[18px] font-semibold tabular tracking-tight mt-0.5 text-ink">{opp.projection.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.16em] font-semibold text-ink-2/70">Linha</div>
          <div className="text-[18px] font-semibold tabular tracking-tight mt-0.5 text-ink">
            {opp.lineValue != null ? opp.lineValue.toFixed(1) : '—'}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.16em] font-semibold text-ink-2/70">Vantagem</div>
          <div className="text-[18px] font-semibold tabular tracking-tight mt-0.5 text-forest">
            {opp.edgePct != null ? `${opp.edgePct > 0 ? '+' : ''}${opp.edgePct.toFixed(0)}%` : '—'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.16em] font-semibold text-ink-2/70">Score</div>
          <div className="text-[18px] font-semibold tabular tracking-tight mt-0.5 text-ink">{opp.score ?? '—'}</div>
        </div>
      </div>
    </>
  );

  const baseCls = 'block bg-white border border-line rounded-xl p-4 hover:border-forest/30 hover:shadow-sm transition-all no-underline text-left';

  if (href) {
    return (
      <a href={href} onClick={(e) => {
        if (!e.ctrlKey && !e.metaKey && e.button === 0 && onClick) {
          e.preventDefault();
          onClick();
        }
      }} className={baseCls}>{content}</a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`${baseCls} w-full`}>{content}</button>
  );
};
