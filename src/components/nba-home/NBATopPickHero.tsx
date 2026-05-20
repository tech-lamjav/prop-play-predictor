import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';

const STAT_LABELS: Record<string, string> = {
  player_points: 'pontos', player_assists: 'assistências', player_rebounds: 'rebotes',
  player_threes: '3 pontos', player_steals: 'roubos', player_blocks: 'bloqueios',
  player_points_rebounds_assists: 'pts+reb+ast', player_points_assists: 'pts+ast',
  player_points_rebounds: 'pts+reb', player_rebounds_assists: 'reb+ast',
};

const STAT_LABELS_SHORT: Record<string, string> = {
  player_points: 'Pontos', player_assists: 'Assistências', player_rebounds: 'Rebotes',
  player_threes: '3 pontos', player_steals: 'Roubos', player_blocks: 'Bloqueios',
  player_points_rebounds_assists: 'Pts+Reb+Ast', player_points_assists: 'Pts+Ast',
  player_points_rebounds: 'Pts+Reb', player_rebounds_assists: 'Reb+Ast',
};

export interface TopPickData {
  /** Backup player que vai render +X% */
  playerName: string;
  teamAbbr: string;
  /** Stat key (player_points, player_assists, etc.) */
  statType: string;
  /** Trigger (lesionado) */
  triggerName: string;
  triggerStatus: string;
  /** Linha do mercado (pode ser null) */
  lineValue: number | null;
  /** Média histórica com o trigger jogando */
  avgCom: number;
  /** Projeção quando trigger fica fora */
  avgSem: number;
  /** Δ% sem vs com */
  gapPct: number;
  /** Edge: (projeção - linha) / linha % — pode ser null se não há linha */
  edgePct: number | null;
  /** Score 0-100 */
  score: number | null;
  /** Opponent abbr (ex: "MIN") */
  opponentAbbr: string | null;
  isHome: boolean;
  /** Horário do jogo (ex: "21:00") */
  gameTime: string | null;
}

interface NBATopPickHeroProps {
  pick: TopPickData;
  onOpenAnalysis: () => void;
}

function lastName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts[parts.length - 1] ?? full;
}

function statusFull(status: string): string {
  const s = status.toLowerCase();
  if (s === 'out' || s.includes('out')) return 'fora';
  if (s.includes('doubtful')) return 'duvidoso';
  return 'questionável';
}

function PhotoBlock({ name, teamAbbr, size }: { name: string; teamAbbr: string; size: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div
      className="rounded-xl grid place-items-center text-[32px] font-semibold relative overflow-hidden border border-white/10 shrink-0"
      style={{ width: size, height: size, background: 'linear-gradient(135deg, #1f5640, #0a3d2e)' }}
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
            if (parent) parent.insertAdjacentHTML('beforeend', `<span class="text-white/40">${initials}</span>`);
          }
        }}
      />
      <div className="absolute bottom-2 right-2 px-1.5 h-5 rounded text-[10px] font-bold inline-flex items-center bg-black/40 text-white">
        {teamAbbr}
      </div>
    </div>
  );
}

export const NBATopPickHero: React.FC<NBATopPickHeroProps> = ({ pick, onOpenAnalysis }) => {
  const isMobile = useIsMobile();
  const statLong = STAT_LABELS[pick.statType] ?? pick.statType;
  const statShort = STAT_LABELS_SHORT[pick.statType] ?? pick.statType;
  const oppLabel = pick.opponentAbbr ? `${pick.isHome ? 'vs ' : '@'}${pick.opponentAbbr}` : null;
  const whenLabel = [oppLabel, pick.gameTime ? `Hoje · ${pick.gameTime}` : null].filter(Boolean).join(' · ');
  const triggerStatusFull = statusFull(pick.triggerStatus);
  const narrative = `rende +${Math.round(pick.gapPct)}% em ${statLong} quando ${lastName(pick.triggerName)} fica fora${pick.opponentAbbr ? ` — e é o que deve acontecer hoje contra ${pick.opponentAbbr}` : ''}.`;
  const filterChip = `Sem ${lastName(pick.triggerName)} (${triggerStatusFull})`;

  if (isMobile) {
    return (
      <article
        className="rounded-2xl overflow-hidden relative text-white"
        style={{ background: 'linear-gradient(135deg, #0a3d2e 0%, #08321f 60%, #051f12 100%)' }}
      >
        {/* Glow */}
        <div
          className="absolute top-0 right-0 w-[240px] h-[240px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.18), transparent 70%)', transform: 'translate(60px,-80px)' }}
        />

        <div className="relative px-4 pt-4 pb-4 flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-1.5 px-2.5 h-6 rounded-md text-[10px] uppercase tracking-[0.18em] font-bold bg-amber-400 text-ink">
            Destaque do dia
          </span>

          <div className="flex items-start gap-3">
            <PhotoBlock name={pick.playerName} teamAbbr={pick.teamAbbr} size={72} />
            <div className="min-w-0 flex-1">
              <div className="text-[18px] font-semibold tracking-tight leading-tight">{pick.playerName}</div>
              <div className="text-[11px] mt-0.5 text-white/60">{whenLabel || pick.teamAbbr}</div>
              {pick.score != null && (
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className="text-[36px] font-semibold tabular tracking-tight leading-none text-amber-400">{pick.score}</span>
                  <span className="text-[12px] text-white/40">/100</span>
                </div>
              )}
            </div>
          </div>

          <p className="text-[15px] leading-snug font-semibold tracking-tight" style={{ textWrap: 'pretty' as React.CSSProperties['textWrap'] }}>
            <span className="text-white">{pick.playerName}</span>{' '}
            <span className="text-white/85">{narrative}</span>
          </p>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 h-6 inline-flex items-center rounded-md text-[10px] font-semibold bg-amber-400/20 text-amber-200 border border-amber-400/30">
              Gatilho · {filterChip}
            </span>
            <span className="px-2 h-6 inline-flex items-center rounded-md text-[10px] font-semibold bg-white/10 text-white/85">
              {statShort}
            </span>
            {pick.lineValue != null && (
              <span className="px-2 h-6 inline-flex items-center rounded-md text-[10px] font-semibold tabular bg-white/10 text-white/85">
                Linha {pick.lineValue.toFixed(1)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-0 rounded-lg overflow-hidden bg-white/5 border border-white/10">
            <Metric label="Média" value={pick.avgCom.toFixed(1)} sub="temporada" />
            <Metric label="Projeção" value={pick.avgSem.toFixed(1)} sub="c/ filtro" highlight />
            <Metric label="Linha" value={pick.lineValue?.toFixed(1) ?? '—'} sub="mercado" />
            <Metric
              label="Vantagem"
              value={pick.edgePct != null ? `${pick.edgePct > 0 ? '+' : ''}${pick.edgePct.toFixed(0)}%` : '—'}
              sub="vs linha"
              accent
            />
          </div>

          <button
            onClick={onOpenAnalysis}
            className="h-11 rounded-md text-[13px] font-semibold inline-flex items-center justify-center gap-2 bg-amber-400 text-ink hover:bg-amber-300 transition-colors"
          >
            <span>Abrir análise completa</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </article>
    );
  }

  // Desktop
  return (
    <article
      className="rounded-2xl overflow-hidden relative text-white"
      style={{ background: 'linear-gradient(135deg, #0a3d2e 0%, #08321f 60%, #051f12 100%)' }}
    >
      {/* Pattern overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none" viewBox="0 0 800 400" preserveAspectRatio="none" aria-hidden>
        <defs>
          <pattern id="topPickDots" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#fff" />
          </pattern>
        </defs>
        <rect width="800" height="400" fill="url(#topPickDots)" />
      </svg>
      {/* Amber glow */}
      <div
        className="absolute top-0 right-0 w-[280px] h-[280px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.18), transparent 70%)', transform: 'translate(80px,-80px)' }}
      />

      <div className="relative px-8 py-7 grid grid-cols-12 gap-8">
        {/* Left col: badge + photo + name/meta */}
        <div className="col-span-3 flex flex-col items-start gap-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[10px] uppercase tracking-[0.18em] font-bold bg-amber-400 text-ink">
            Destaque do dia
          </span>
          <PhotoBlock name={pick.playerName} teamAbbr={pick.teamAbbr} size={160} />
          <div>
            <div className="text-[22px] font-semibold tracking-tight leading-tight">{pick.playerName}</div>
            <div className="text-[12px] mt-0.5 text-white/60">{whenLabel || pick.teamAbbr}</div>
          </div>
        </div>

        {/* Middle col: narrative + chips + metrics */}
        <div className="col-span-6 flex flex-col">
          <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-white/50">Análise</div>
          <p className="text-[26px] leading-[1.25] font-semibold tracking-tight mt-2" style={{ textWrap: 'pretty' as React.CSSProperties['textWrap'] }}>
            <span className="text-white">{pick.playerName}</span>{' '}
            <span className="text-white/85">{narrative}</span>
          </p>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="px-2.5 h-7 inline-flex items-center rounded-md text-[11px] font-semibold bg-amber-400/20 text-amber-200 border border-amber-400/30">
              Gatilho · {filterChip}
            </span>
            <span className="px-2.5 h-7 inline-flex items-center rounded-md text-[11px] font-semibold bg-white/10 text-white/85">
              {statShort}
            </span>
            {pick.lineValue != null && (
              <span className="px-2.5 h-7 inline-flex items-center rounded-md text-[11px] font-semibold tabular bg-white/10 text-white/85">
                Linha · {pick.lineValue.toFixed(1)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-0 mt-5 rounded-lg overflow-hidden bg-white/5 border border-white/10">
            <Metric label="Média" value={pick.avgCom.toFixed(1)} sub="temporada" />
            <Metric label="Projeção" value={pick.avgSem.toFixed(1)} sub="com filtro" highlight />
            <Metric label="Linha" value={pick.lineValue?.toFixed(1) ?? '—'} sub="mercado" />
            <Metric
              label="Vantagem"
              value={pick.edgePct != null ? `${pick.edgePct > 0 ? '+' : ''}${pick.edgePct.toFixed(0)}%` : '—'}
              sub="sobre linha"
              accent
            />
          </div>
        </div>

        {/* Right col: big score + CTAs */}
        <div className="col-span-3 flex flex-col justify-between">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-white/50">Score</div>
            <div className="flex items-baseline justify-end gap-1 mt-1">
              <span className="text-[88px] font-semibold tabular tracking-tight leading-none text-amber-400">
                {pick.score ?? '—'}
              </span>
              <span className="text-[18px] text-white/40">/100</span>
            </div>
            <div className="text-[11px] mt-1 text-white/55">maior do dia</div>
          </div>
          <div className="flex flex-col gap-2 mt-6">
            <button
              onClick={onOpenAnalysis}
              className="h-11 rounded-md text-[13px] font-semibold inline-flex items-center justify-center gap-2 bg-amber-400 text-ink hover:bg-amber-300 transition-colors"
            >
              <span>Abrir análise completa</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

interface MetricProps {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
  accent?: boolean;
}

const Metric: React.FC<MetricProps> = ({ label, value, sub, highlight, accent }) => {
  const valueColor = accent ? 'text-amber-200' : highlight ? 'text-white' : 'text-white/90';
  return (
    <div className="px-4 py-3 border-l border-white/10 first:border-l-0">
      <div className="text-[9px] uppercase tracking-[0.16em] font-semibold text-white/50">{label}</div>
      <div className={`text-[22px] font-semibold tabular tracking-tight leading-none mt-1.5 ${valueColor}`}>{value}</div>
      <div className="text-[10px] mt-1.5 text-white/45">{sub}</div>
    </div>
  );
};
