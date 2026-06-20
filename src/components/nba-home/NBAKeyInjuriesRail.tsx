import React from 'react';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';

const STAT_LABEL_SHORT: Record<string, string> = {
  player_points: 'pts',
  player_assists: 'ast',
  player_rebounds: 'reb',
  player_threes: '3pts',
  player_steals: 'stl',
  player_blocks: 'blk',
  player_points_rebounds_assists: 'pts+reb+ast',
  player_points_assists: 'pts+ast',
  player_points_rebounds: 'pts+reb',
  player_rebounds_assists: 'reb+ast',
};

export interface KeyInjuryData {
  id: number;
  name: string;
  teamAbbr: string;
  status: string;
  impactedCount: number;
  /** Maior impacto observado entre os backups deste trigger */
  topImpact: {
    playerName: string;
    statType: string;
    gapPct: number;
  } | null;
}

interface NBAKeyInjuriesRailProps {
  injuries: KeyInjuryData[];
  onSelect: (injuryId: number) => void;
  /** Abre a Análise 360° (lista completa de gatilhos analisados) */
  onOpenAll?: () => void;
  /** Abre o modal de Injury Report com todas as lesões dos jogos do dia */
  onOpenInjuryReport?: () => void;
  /** Limite de cards exibidos no rail (default 2) */
  maxItems?: number;
}

function statusBadgeCls(status: string): { text: string; cls: string } {
  const s = status.toLowerCase();
  if (s === 'out' || s.includes('out')) return { text: 'OUT', cls: 'bg-rose-100 text-rose-700' };
  if (s.includes('doubtful')) return { text: 'DTD', cls: 'bg-orange-100 text-orange-700' };
  return { text: 'Q', cls: 'bg-amber-100 text-amber-700' };
}

function PlayerThumb({ name, teamAbbr }: { name: string; teamAbbr: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div
      className="w-11 h-11 rounded-full grid place-items-center text-[12px] font-semibold shrink-0 overflow-hidden border border-line"
      style={{ background: 'linear-gradient(135deg, #eef0ec, #d7dcd2)', color: '#5a625a' }}
    >
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
            if (parent) parent.insertAdjacentHTML('beforeend', `<span>${initials}</span>`);
          }
        }}
      />
    </div>
  );
}

const KeyInjuryCard: React.FC<{ inj: KeyInjuryData; onClick: () => void }> = ({ inj, onClick }) => {
  const badge = statusBadgeCls(inj.status);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg p-3.5 flex items-center gap-3 transition-colors bg-white border border-line hover:border-forest/30 hover:bg-canvas"
    >
      <PlayerThumb name={inj.name} teamAbbr={inj.teamAbbr} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold tracking-tight truncate text-ink">{inj.name}</span>
          <span className={`px-1.5 h-5 inline-flex items-center rounded text-[10px] font-bold tabular ${badge.cls}`}>{badge.text}</span>
        </div>
        <div className="text-[11px] mt-0.5 text-ink-2">
          {inj.teamAbbr} · <span className="font-semibold text-forest">{inj.impactedCount} impactados</span>
        </div>
        {inj.topImpact && (
          <div className="text-[10px] mt-1 text-ink-2/70 truncate">
            ex: <span className="font-semibold text-ink">{inj.topImpact.playerName}</span>{' '}
            +{Math.round(inj.topImpact.gapPct)}% em {STAT_LABEL_SHORT[inj.topImpact.statType] ?? inj.topImpact.statType}
          </div>
        )}
      </div>
      <span className="shrink-0 text-[11px] font-semibold inline-flex items-center gap-1 text-forest">
        Ver impacto
        <ArrowRight className="w-3 h-3" />
      </span>
    </button>
  );
};

export const NBAKeyInjuriesRail: React.FC<NBAKeyInjuriesRailProps> = ({
  injuries,
  onSelect,
  onOpenAll,
  onOpenInjuryReport,
  maxItems = 2,
}) => {
  if (injuries.length === 0) return null;
  const visible = injuries.slice(0, maxItems);
  const totalCount = injuries.length;
  return (
    <section
      aria-label="Lesões chave do dia"
      className="rounded-xl bg-canvas-2 border border-line"
    >
      <header className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-semibold text-ink-2">Lesões chave</div>
          <div className="text-[14px] font-semibold tracking-tight mt-0.5 text-ink">
            {totalCount} {totalCount === 1 ? 'jogador' : 'jogadores'} no injury report
          </div>
        </div>
        <span className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-bold uppercase tracking-widest bg-amber-400 text-ink">
          360°
        </span>
      </header>

      <div className="px-3 pb-3 flex flex-col gap-2">
        {visible.map(inj => (
          <KeyInjuryCard key={inj.id} inj={inj} onClick={() => onSelect(inj.id)} />
        ))}
      </div>

      <div className="px-3 pb-3 flex flex-col gap-2 border-t border-line pt-3">
        {onOpenAll && (
          <button
            type="button"
            onClick={onOpenAll}
            className="h-10 rounded-md text-[13px] font-semibold inline-flex items-center justify-center gap-2 bg-amber-400 text-ink hover:bg-amber-300 transition-colors w-full"
          >
            <span>Abrir Análise 360°</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
        {onOpenInjuryReport && (
          <button
            type="button"
            onClick={onOpenInjuryReport}
            className="h-9 rounded-md text-[12px] font-semibold inline-flex items-center justify-center gap-2 bg-white border border-line text-ink-2 hover:text-ink hover:border-forest/30 transition-colors w-full"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Ver Injury Report completo</span>
          </button>
        )}
      </div>
    </section>
  );
};
