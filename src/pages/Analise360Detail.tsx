import { useEffect, useMemo, useState } from 'react';
import { usePostHog } from '@posthog/react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight, Calendar, Info, Loader2, Radar, Star,
} from 'lucide-react';
import {
  getPlayerPhotoUrl, getTeamLogoUrl, teamAbbrToName, tryNextPlayerPhotoUrl,
} from '@/utils/team-logos';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAnalise360Data } from '@/hooks/use-analise360';
import AnalyticsNav from '@/components/AnalyticsNav';
import type { DailyOpportunity } from '@/services/nba-data.service';

// ─── Types ───────────────────────────────────────────────────────────────

interface BackupRow {
  statType: string;
  avgCom: number;
  avgSem: number;
  gap: number;
  gapPct: number;
  lineValue: number | null;
  gapVsLine: number | null;
  gapVsLinePct: number | null;
  score: number | null;
  cvSem: number | null;
  jogosCom: number | null;
  jogosSem: number | null;
}

interface BackupAggregate {
  backupPlayerId: number;
  backupPlayerName: string;
  rows: BackupRow[];
  // top stat (used quando o tab "todas" está ativo / mandala)
  topRow: BackupRow;
}

interface TriggerInfo {
  triggerPlayerId: number;
  triggerName: string;
  triggerStatus: string;
  triggerTeamAbbr: string;
  triggerDaysOut: number | null;
  ratingStars: number;
  homeTeamAbbr: string;
  visitorTeamAbbr: string;
  gameDate: string;
  gameTime: string | null;
  isB2b: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────

const STAT_LABEL_PT: Record<string, string> = {
  player_points: 'Pontos',
  player_assists: 'Assistências',
  player_rebounds: 'Rebotes',
  player_points_rebounds_assists: 'PRA',
  player_points_assists: 'P+A',
  player_points_rebounds: 'P+R',
  player_rebounds_assists: 'R+A',
  player_blocks_steals: 'B+R',
  player_threes: '3PT',
  player_steals: 'Roubos',
  player_blocks: 'Tocos',
};

const TAB_OPTIONS = [
  { key: 'all', label: 'Todas stats' },
  { key: 'player_points', label: 'Pontos' },
  { key: 'player_assists', label: 'Assistências' },
  { key: 'player_rebounds', label: 'Rebotes' },
  { key: 'player_points_rebounds_assists', label: 'PRA' },
] as const;

const STATUS_WORD_PT: Record<string, string> = {
  out: 'fora',
  doubtful: 'duvidoso',
  questionable: 'dúvida',
  probable: 'provável',
};

const STATUS_BADGE: Record<string, { short: string; cls: string }> = {
  out: { short: 'OUT', cls: 'bg-status-danger text-white' },
  doubtful: { short: 'DTD', cls: 'bg-status-warning text-white' },
  questionable: { short: 'Q', cls: 'bg-amber-500 text-white' },
  probable: { short: 'P', cls: 'bg-lime-500 text-white' },
};

function normalizeStatus(status: string): keyof typeof STATUS_BADGE {
  const s = (status ?? '').toLowerCase();
  if (s === 'out' || s.includes('out')) return 'out';
  if (s.includes('doubtful')) return 'doubtful';
  if (s.includes('questionable')) return 'questionable';
  return 'probable';
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function statLabel(statType: string): string {
  return STAT_LABEL_PT[statType] ?? statType.replace(/^player_/, '');
}

function lastName(fullName: string): string {
  const parts = fullName.split(' ');
  return parts.length > 1 ? parts[parts.length - 1] : fullName;
}

function gapTone(pct: number): 'pos-strong' | 'pos' | 'neutral' | 'neg' {
  if (pct >= 20) return 'pos-strong';
  if (pct >= 5) return 'pos';
  if (pct > -3) return 'neutral';
  return 'neg';
}

function gapTextColor(pct: number): string {
  switch (gapTone(pct)) {
    case 'pos-strong': return 'text-emerald-700';
    case 'pos': return 'text-forest';
    case 'neg': return 'text-status-danger';
    default: return 'text-ink-2';
  }
}

function gapBarColor(pct: number): string {
  switch (gapTone(pct)) {
    case 'pos-strong': return 'bg-emerald-500';
    case 'pos': return 'bg-forest';
    case 'neg': return 'bg-status-danger';
    default: return 'bg-ink-2/40';
  }
}

function scoreColor(score: number | null): string {
  if (score == null) return 'bg-ink-3 text-ink-2';
  if (score >= 75) return 'bg-emerald-100 text-emerald-700';
  if (score >= 60) return 'bg-amber-100 text-amber-700';
  return 'bg-ink-3 text-ink-2';
}

function getSatelliteRing(pct: number): string {
  switch (gapTone(pct)) {
    case 'pos-strong': return 'ring-2 ring-emerald-400/60 shadow-[0_0_0_3px_rgba(16,185,129,0.10)]';
    case 'pos': return 'ring-2 ring-forest/40';
    case 'neg': return 'ring-2 ring-status-danger/40';
    default: return 'ring-1 ring-line';
  }
}

function getLineStroke(pct: number): string {
  switch (gapTone(pct)) {
    case 'pos-strong': return 'rgba(16,185,129,0.45)';
    case 'pos': return 'rgba(10,61,46,0.30)';
    case 'neg': return 'rgba(184,52,28,0.30)';
    default: return 'rgba(0,0,0,0.08)';
  }
}

function slugify(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-');
}

function formatGameDateBR(iso: string): string {
  // espera "YYYY-MM-DD"
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── PlayerPhoto ─────────────────────────────────────────────────────────

function PlayerPhoto({
  name, teamAbbr, size = 'md', ringClass,
}: {
  name: string;
  teamAbbr: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'center';
  ringClass?: string;
}) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const sizeClass = {
    center: 'w-[72px] h-[72px]',
    xl: 'w-16 h-16',
    lg: 'w-14 h-14',
    md: 'w-10 h-10',
    sm: 'w-8 h-8',
  }[size];
  const textClass = {
    center: 'text-xl',
    xl: 'text-base',
    lg: 'text-sm',
    md: 'text-[11px]',
    sm: 'text-[10px]',
  }[size];

  return (
    <div className={`${sizeClass} rounded-full overflow-hidden bg-ink-3 border border-line shrink-0 flex items-center justify-center ${ringClass ?? ''}`}>
      <img
        src={getPlayerPhotoUrl(name, teamAbbr)}
        alt={name}
        className="w-full h-full object-cover object-top"
        loading="lazy"
        data-player-photo-index="0"
        onError={(e) => {
          const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, name, teamAbbr);
          if (!didTry) {
            const el = e.target as HTMLImageElement;
            el.style.display = 'none';
            const parent = el.parentElement;
            if (parent) parent.innerHTML = `<span class="${textClass} font-semibold text-ink-2">${initials}</span>`;
          }
        }}
      />
    </div>
  );
}

// ─── MandalaView (light) ─────────────────────────────────────────────────

function MandalaView({
  satellites, trigger, hoverId, onHover,
}: {
  satellites: BackupAggregate[];
  trigger: TriggerInfo;
  hoverId: number | null;
  onHover: (id: number | null) => void;
}) {
  const MAX_VISIBLE = 8;
  const visible = satellites.slice(0, MAX_VISIBLE);
  const overflow = satellites.length - visible.length;
  const count = visible.length;

  // Layout fixo em pixels — controle absoluto, sem distorção
  const SIZE = 380;
  const CENTER_R = 30;   // raio do avatar central (size 'lg' = 56px diâmetro → r=28; deixa folga 30)
  const SAT_R = 22;      // raio do avatar satélite (size 'md' = 40px → r=20; folga 22)
  const ORBIT = 130;     // distância do centro ao centro do satélite (px)
  const HALF = SIZE / 2;
  const statusKey = normalizeStatus(trigger.triggerStatus);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {/* Lines */}
        <svg
          width={SIZE}
          height={SIZE}
          className="absolute inset-0 pointer-events-none"
        >
          {visible.map((sat, i) => {
            const angle = (2 * Math.PI / count) * i - Math.PI / 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            // Linha do raio do trigger até o raio do satélite — encosta nas bordas, sem gap visual
            const x1 = HALF + CENTER_R * cos;
            const y1 = HALF + CENTER_R * sin;
            const x2 = HALF + (ORBIT - SAT_R) * cos;
            const y2 = HALF + (ORBIT - SAT_R) * sin;
            const isActive = hoverId === sat.backupPlayerId;
            return (
              <line
                key={sat.backupPlayerId}
                x1={x1} y1={y1}
                x2={x2} y2={y2}
                stroke={getLineStroke(sat.topRow.gapPct)}
                strokeWidth={isActive ? 3 : 1.8}
                strokeOpacity={hoverId && !isActive ? 0.3 : 0.95}
                strokeLinecap="round"
                className="transition-all duration-200"
              />
            );
          })}
        </svg>

        {/* Center node (trigger) */}
        <div
          className="absolute flex flex-col items-center z-10"
          style={{ left: HALF, top: HALF, transform: 'translate(-50%, -50%)' }}
        >
          <div className="relative">
            <PlayerPhoto name={trigger.triggerName} teamAbbr={trigger.triggerTeamAbbr} size="lg" ringClass="ring-[3px] ring-amber-300 shadow-md" />
            <span className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[statusKey].cls}`}>
              {STATUS_BADGE[statusKey].short}
            </span>
          </div>
        </div>

        {/* Satellites */}
        {visible.map((sat, i) => {
          const angle = (2 * Math.PI / count) * i - Math.PI / 2;
          const x = HALF + ORBIT * Math.cos(angle);
          const y = HALF + ORBIT * Math.sin(angle);
          const isHovered = hoverId === sat.backupPlayerId;
          const isDimmed = hoverId != null && !isHovered;
          const pct = sat.topRow.gapPct;
          const isPos = pct > 0;

          const hasCard = sat.rows.some(r => r.gapPct > 0);
          return (
            <button
              key={sat.backupPlayerId}
              type="button"
              className={`absolute flex flex-col items-center group transition-opacity duration-200 ${isDimmed ? 'opacity-40' : 'opacity-100'} ${isHovered ? 'z-20' : 'z-10'} ${hasCard ? 'cursor-pointer' : 'cursor-default'}`}
              style={{
                left: x,
                top: y,
                transform: 'translate(-50%, -50%)',
              }}
              onMouseEnter={() => onHover(sat.backupPlayerId)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(sat.backupPlayerId)}
              onBlur={() => onHover(null)}
              onClick={hasCard ? () => scrollToCompanion(sat.backupPlayerId) : undefined}
            >
              <div className={`relative transition-transform duration-150 ${isHovered ? 'scale-110' : 'group-hover:scale-105'}`}>
                <PlayerPhoto
                  name={sat.backupPlayerName}
                  teamAbbr={trigger.triggerTeamAbbr}
                  size="md"
                  ringClass={getSatelliteRing(pct)}
                />
                <span className={`absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                  isPos
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : pct < -3
                    ? 'bg-status-danger/10 text-status-danger border border-status-danger/20'
                    : 'bg-ink-3 text-ink-2 border border-line'
                }`}>
                  {isPos ? '+' : ''}{pct.toFixed(0)}%
                </span>
              </div>
              <span className="text-[11px] mt-4 text-center max-w-[120px] leading-tight text-ink-2 group-hover:text-ink">
                {sat.backupPlayerName}
              </span>
            </button>
          );
        })}

        {/* Hover popover */}
        {hoverId != null && (() => {
          const sat = visible.find(s => s.backupPlayerId === hoverId);
          if (!sat) return null;
          const idx = visible.indexOf(sat);
          const angle = (2 * Math.PI / count) * idx - Math.PI / 2;
          const x = HALF + ORBIT * Math.cos(angle);
          const y = HALF + ORBIT * Math.sin(angle);
          return (
            <div
              className="absolute z-30 pointer-events-none"
              style={{
                left: x,
                top: y,
                transform: 'translate(-50%, calc(-100% - 32px))',
              }}
            >
              <div className="bg-white border border-line rounded-lg shadow-md px-3 py-2 min-w-[200px]">
                <div className="flex items-center gap-2 mb-1.5">
                  <PlayerPhoto name={sat.backupPlayerName} teamAbbr={trigger.triggerTeamAbbr} size="sm" />
                  <span className="text-[11px] font-semibold text-ink truncate">{sat.backupPlayerName}</span>
                </div>
                <div className="space-y-1">
                  {[...sat.rows].sort((a, b) => b.gapPct - a.gapPct).map(r => (
                    <div key={r.statType} className="flex items-center justify-between gap-3 text-[10px]">
                      <span className="text-ink-2">{statLabel(r.statType)}</span>
                      <span className="text-ink tabular-nums">
                        {r.avgCom.toFixed(1)} → <span className="font-semibold">{r.avgSem.toFixed(1)}</span>
                        <span className={`ml-1 ${gapTextColor(r.gapPct)}`}>
                          {r.gapPct > 0 ? '+' : ''}{r.gapPct.toFixed(0)}%
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {overflow > 0 && (
        <p className="text-[11px] text-ink-2 text-center mt-2">
          +{overflow} {overflow === 1 ? 'companheiro' : 'companheiros'} impactado{overflow === 1 ? '' : 's'} fora da cadeia visível
        </p>
      )}
    </div>
  );
}

// ─── Scroll para o card do companion correspondente ─────────────────────

function scrollToCompanion(backupPlayerId: number) {
  const el = document.getElementById(`companion-${backupPlayerId}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── Card do próximo jogo (usado mobile inline + sidebar desktop) ────────

function NextGameCard({ trigger }: { trigger: TriggerInfo }) {
  return (
    <div className="bg-white border border-line rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">Próximo jogo</span>
        <span className="text-[10px] text-ink-2 tabular-nums">
          <Calendar className="w-3 h-3 inline-block -mt-0.5 mr-1" />
          {formatGameDateBR(trigger.gameDate)}{trigger.gameTime ? ` · ${trigger.gameTime}` : ''}
        </span>
      </div>
      <div className="flex items-center justify-center gap-5">
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-xl bg-canvas-2 flex items-center justify-center p-1.5">
            <img
              src={getTeamLogoUrl(teamAbbrToName(trigger.homeTeamAbbr))}
              alt={trigger.homeTeamAbbr}
              className="w-full h-full object-contain"
              onError={(e) => { const el = e.target as HTMLImageElement; el.style.display = 'none'; }}
            />
          </div>
          <span className="text-[10px] text-ink-2 font-semibold">{trigger.homeTeamAbbr}</span>
        </div>
        <span className="text-[12px] text-ink-2 font-semibold">vs</span>
        <div className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-xl bg-canvas-2 flex items-center justify-center p-1.5">
            <img
              src={getTeamLogoUrl(teamAbbrToName(trigger.visitorTeamAbbr))}
              alt={trigger.visitorTeamAbbr}
              className="w-full h-full object-contain"
              onError={(e) => { const el = e.target as HTMLImageElement; el.style.display = 'none'; }}
            />
          </div>
          <span className="text-[10px] text-ink-2 font-semibold">{trigger.visitorTeamAbbr}</span>
        </div>
      </div>
      {trigger.isB2b && (
        <div className="flex justify-center mt-3">
          <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
            Back-to-Back
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Mobile chain: trigger fixo + satélites em scroll horizontal ─────────

function MobileChain({
  satellites, trigger,
}: {
  satellites: BackupAggregate[];
  trigger: TriggerInfo;
}) {
  const statusKey = normalizeStatus(trigger.triggerStatus);
  return (
    <div className="flex items-start gap-2 py-2">
      {/* Trigger - fixo à esquerda */}
      <div className="shrink-0 flex flex-col items-center">
        <div className="relative">
          <PlayerPhoto name={trigger.triggerName} teamAbbr={trigger.triggerTeamAbbr} size="lg" ringClass="ring-2 ring-amber-300" />
          <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[statusKey].cls}`}>
            {STATUS_BADGE[statusKey].short}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-ink mt-3 max-w-[68px] text-center truncate">
          {lastName(trigger.triggerName)}
        </span>
      </div>

      {/* Seta — alinhada ao centro vertical da foto do trigger */}
      <ArrowRight className="w-4 h-4 text-ink-2 shrink-0 mt-[22px]" />

      {/* Satélites — row rolável */}
      <div className="relative flex-1 min-w-0">
        <div className="flex items-start gap-3 overflow-x-auto pb-1 pr-1 snap-x snap-mandatory">
          {satellites.map(sat => {
            const pct = sat.topRow.gapPct;
            const isPos = pct > 0;
            const hasCard = sat.rows.some(r => r.gapPct > 0);
            return (
              <button
                key={sat.backupPlayerId}
                type="button"
                onClick={hasCard ? () => scrollToCompanion(sat.backupPlayerId) : undefined}
                disabled={!hasCard}
                className={`flex flex-col items-center shrink-0 w-[60px] snap-start text-left ${
                  hasCard ? 'cursor-pointer transition-transform active:scale-95' : 'cursor-default'
                }`}
              >
                <PlayerPhoto
                  name={sat.backupPlayerName}
                  teamAbbr={trigger.triggerTeamAbbr}
                  size="md"
                  ringClass={getSatelliteRing(pct)}
                />
                <span className={`mt-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                  isPos
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : pct < -3
                    ? 'bg-status-danger/10 text-status-danger border border-status-danger/20'
                    : 'bg-ink-3 text-ink-2 border border-line'
                }`}>
                  {isPos ? '+' : ''}{pct.toFixed(0)}%
                </span>
                <span className="text-[10px] text-ink-2 mt-1 text-center leading-tight truncate w-full">
                  {lastName(sat.backupPlayerName)}
                </span>
              </button>
            );
          })}
        </div>
        {/* Hint de scroll — fade no canto direito quando há overflow potencial */}
        {satellites.length > 3 && (
          <div className="pointer-events-none absolute top-0 right-0 bottom-1 w-8 bg-gradient-to-l from-white to-transparent" />
        )}
      </div>
    </div>
  );
}

// ─── Ranking list (painel direito) ───────────────────────────────────────

function RankingList({ satellites }: { satellites: BackupAggregate[] }) {
  if (satellites.length === 0) return null;
  const maxGap = Math.max(...satellites.map(s => Math.abs(s.topRow.gapPct)), 1);
  return (
    <div className="bg-white border border-line rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">Ranking de impacto</span>
        <span className="text-[10px] text-ink-2">melhor stat de cada</span>
      </div>
      <div className="space-y-2">
        {satellites.map((sat, i) => {
          const pct = sat.topRow.gapPct;
          const isPos = pct > 0;
          const barW = Math.min(100, (Math.abs(pct) / maxGap) * 100);
          return (
            <div key={sat.backupPlayerId} className="flex items-center gap-2">
              <span className="text-[10px] text-ink-2 w-4 text-right tabular-nums">{i + 1}</span>
              <span className="text-[12px] text-ink truncate flex-1">{lastName(sat.backupPlayerName)}</span>
              <div className="w-24 h-1.5 bg-canvas-2 rounded-full overflow-hidden shrink-0">
                <div className={`h-full rounded-full ${gapBarColor(pct)}`} style={{ width: `${barW}%`, opacity: 0.85 }} />
              </div>
              <span className={`text-[11px] font-semibold tabular-nums shrink-0 w-12 text-right ${gapTextColor(pct)}`}>
                {isPos ? '+' : ''}{pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Companion Card ──────────────────────────────────────────────────────

function CompanionCard({
  agg,
  trigger,
  onOpenDashboard,
}: {
  agg: BackupAggregate;
  trigger: TriggerInfo;
  onOpenDashboard: () => void;
}) {
  // Apenas linhas com gap_pct positivo significativo (valorizadas)
  const valuedRows = agg.rows.filter(r => r.gapPct > 0).sort((a, b) => b.gapPct - a.gapPct);
  if (valuedRows.length === 0) return null;
  const maxGap = Math.max(...valuedRows.map(r => Math.abs(r.gapPct)), 1);

  return (
    <div
      id={`companion-${agg.backupPlayerId}`}
      className="bg-white border border-line rounded-xl p-4 scroll-mt-20"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <PlayerPhoto name={agg.backupPlayerName} teamAbbr={trigger.triggerTeamAbbr} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-semibold text-ink truncate">{agg.backupPlayerName}</span>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Star key={i} className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                ))}
              </div>
            </div>
            <span className="text-[11px] text-ink-2">
              {trigger.triggerTeamAbbr} · {valuedRows.length} {valuedRows.length === 1 ? 'stat valorizado' : 'stats valorizados'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenDashboard}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-forest text-white text-[11px] font-semibold hover:bg-forest-soft transition-colors"
        >
          Dashboard
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-2.5">
        {valuedRows.map(row => {
          const isPos = row.gapPct > 0;
          const barW = Math.min(100, (Math.abs(row.gapPct) / maxGap) * 100);
          return (
            <div key={row.statType} className="border-t border-line pt-2.5 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span className="text-ink-2 font-medium">{statLabel(row.statType)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-ink-2 tabular-nums">{row.avgCom.toFixed(1)}</span>
                  <span className="text-ink-2">→</span>
                  <span className="text-ink font-semibold tabular-nums">{row.avgSem.toFixed(1)}</span>
                  <span className={`font-semibold tabular-nums ${gapTextColor(row.gapPct)}`}>
                    {isPos ? '+' : ''}{row.gapPct.toFixed(0)}%
                  </span>
                </div>
              </div>
              {row.lineValue != null && (
                <div className="flex items-center justify-between text-[11px] mb-1 text-ink-2">
                  <span>Linha {row.lineValue.toFixed(1)} · proj {row.avgSem.toFixed(1)}</span>
                  {row.gapVsLinePct != null && (
                    <span className={`tabular-nums ${gapTextColor(row.gapVsLinePct)}`}>
                      {row.gapVsLinePct > 0 ? '+' : ''}{row.gapVsLinePct.toFixed(0)}% vs linha
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-canvas-2 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${gapBarColor(row.gapPct)}`} style={{ width: `${barW}%`, opacity: 0.85 }} />
                </div>
                {row.score != null && (
                  <span className={`shrink-0 inline-flex items-center px-1.5 h-5 rounded text-[10px] font-bold tabular-nums ${scoreColor(row.score)}`}>
                    {row.score}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function Analise360Detail() {
  const { triggerPlayerId } = useParams<{ triggerPlayerId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const posthog = usePostHog();
  const { data, isLoading, error } = useAnalise360Data();
  const opportunities = data?.opportunities ?? [];
  const playerStarsMap = data?.playerStarsMap ?? new Map<number, number>();

  const [selectedStat, setSelectedStat] = useState<string>('all');
  const [hoverBackup, setHoverBackup] = useState<number | null>(null);

  // Analytics: visualização da Análise 360 (Marco 3 — retenção por superfície, N3).
  useEffect(() => {
    posthog?.capture('nba_analise360_viewed', { product: 'nba', player_id: triggerPlayerId });
  }, [triggerPlayerId, posthog]);

  const triggerIdNum = Number(triggerPlayerId);
  const triggerOpps = useMemo(() => opportunities.filter(o => o.trigger_player_id === triggerIdNum), [opportunities, triggerIdNum]);

  const triggerInfo = useMemo<TriggerInfo | null>(() => {
    if (triggerOpps.length === 0) return null;
    const first = triggerOpps[0];
    return {
      triggerPlayerId: first.trigger_player_id,
      triggerName: first.trigger_name,
      triggerStatus: first.trigger_status,
      triggerTeamAbbr: first.trigger_team_abbr,
      triggerDaysOut: first.trigger_days_out,
      ratingStars: playerStarsMap.get(first.trigger_player_id) ?? first.rating_stars ?? 0,
      homeTeamAbbr: first.home_team_abbr,
      visitorTeamAbbr: first.visitor_team_abbr,
      gameDate: first.game_date,
      gameTime: first.game_time,
      isB2b: first.is_b2b,
    };
  }, [triggerOpps, playerStarsMap]);

  // Agrega por backup, com filtro de stat
  const backupAggs = useMemo<BackupAggregate[]>(() => {
    const byBackup = new Map<number, DailyOpportunity[]>();
    triggerOpps.forEach(o => {
      if (o.backup_player_id == null) return;
      if (!byBackup.has(o.backup_player_id)) byBackup.set(o.backup_player_id, []);
      byBackup.get(o.backup_player_id)!.push(o);
    });

    const aggs: BackupAggregate[] = [];
    byBackup.forEach((opps, backupId) => {
      const allRows: BackupRow[] = opps.map(o => ({
        statType: o.stat_type,
        avgCom: o.avg_com,
        avgSem: o.avg_sem,
        gap: o.gap,
        gapPct: o.gap_pct,
        lineValue: o.line_value,
        gapVsLine: o.gap_vs_line,
        gapVsLinePct: o.gap_vs_line_pct,
        score: o.score,
        cvSem: o.cv_sem,
        jogosCom: o.jogos_com,
        jogosSem: o.jogos_sem,
      }));

      let displayRows = allRows;
      let topRow: BackupRow | undefined;

      if (selectedStat === 'all') {
        // Mostra todas as rows mas escolhe a top como o melhor gap_pct
        topRow = allRows.reduce((best, r) => r.gapPct > best.gapPct ? r : best, allRows[0]);
      } else {
        // Filtra apenas o stat selecionado
        displayRows = allRows.filter(r => r.statType === selectedStat);
        if (displayRows.length === 0) return; // backup não tem esse stat: descarta
        topRow = displayRows[0];
      }

      if (!topRow) return;

      aggs.push({
        backupPlayerId: backupId,
        backupPlayerName: opps[0].backup_player_name,
        rows: displayRows,
        topRow,
      });
    });

    aggs.sort((a, b) => b.topRow.gapPct - a.topRow.gapPct);
    return aggs;
  }, [triggerOpps, selectedStat]);

  // KPIs
  const kpis = useMemo(() => {
    const positives = backupAggs.filter(a => a.topRow.gapPct > 0);
    const avgGap = positives.length === 0
      ? 0
      : positives.reduce((s, a) => s + a.topRow.gapPct, 0) / positives.length;
    const maxGap = positives.length === 0
      ? 0
      : Math.max(...positives.map(a => a.topRow.gapPct));
    return {
      valued: positives.length,
      avgGap: Math.round(avgGap),
      maxGap: Math.round(maxGap),
    };
  }, [backupAggs]);

  // Tabs: sempre as 5 fixas (Todas / Pontos / Assistências / Rebotes / PRA)
  const availableTabs = TAB_OPTIONS;

  useEffect(() => { setHoverBackup(null); }, [selectedStat]);

  const status = triggerInfo ? normalizeStatus(triggerInfo.triggerStatus) : 'out';
  const badge = STATUS_BADGE[status];

  return (
    <>
      <Helmet>
        <title>{triggerInfo ? `${triggerInfo.triggerName} · Análise 360°` : 'Análise 360°'} — Smart Betting</title>
      </Helmet>

      <div className="theme-rebrand min-h-screen bg-canvas text-ink">
        <AnalyticsNav variant="rebrand" showBack backTo="/analise-360" />

        {isLoading ? (
          <div className="flex items-center justify-center py-32 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-forest opacity-70" />
            <span className="text-sm text-ink-2">Carregando...</span>
          </div>
        ) : error ? (
          <div className="text-center py-32 text-sm text-status-danger">
            {(error as Error)?.message ?? 'Falha ao carregar dados'}
          </div>
        ) : !triggerInfo ? (
          <div className="text-center py-32">
            <Radar className="w-8 h-8 text-ink-2/40 mx-auto mb-3" />
            <p className="text-sm text-ink-2">Nenhum dado encontrado para este jogador.</p>
          </div>
        ) : (
          <>
            {/* Page header (bg-white) */}
            <div className="bg-white border-b border-line">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 md:py-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <PlayerPhoto name={triggerInfo.triggerName} teamAbbr={triggerInfo.triggerTeamAbbr} size="lg" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-[22px] md:text-[28px] font-semibold tracking-tight text-ink leading-none">
                          {triggerInfo.triggerName}
                        </h1>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${badge.cls}`}>
                          {badge.short}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-[12px] text-ink-2 flex-wrap">
                        <span className="font-medium text-ink-2">{teamAbbrToName(triggerInfo.triggerTeamAbbr)}</span>
                        <span className="text-line">·</span>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: Math.max(0, Math.min(triggerInfo.ratingStars, 5)) }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 text-amber-500 fill-amber-500" />
                          ))}
                        </div>
                        {triggerInfo.triggerDaysOut != null && triggerInfo.triggerDaysOut > 0 && (
                          <>
                            <span className="text-line">·</span>
                            <span>fora há {triggerInfo.triggerDaysOut}d</span>
                          </>
                        )}
                        <span className="text-line">·</span>
                        <span>{STATUS_WORD_PT[status] ?? status}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stat tabs (segmented control) */}
                  <div className="inline-flex items-center bg-canvas-2 rounded-lg p-1 shrink-0">
                    {availableTabs.map(tab => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setSelectedStat(tab.key)}
                        className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                          selectedStat === tab.key
                            ? 'bg-white text-ink shadow-[0_1px_2px_-1px_rgba(0,0,0,0.08)]'
                            : 'text-ink-2 hover:text-ink'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
              {/* ─── Coluna esquerda ─── */}
              <section className="min-w-0 flex flex-col gap-6">
                {/* Cadeia de impacto */}
                <div className="bg-white border border-line rounded-xl p-4 md:p-6">
                  <div className="mb-4">
                    <div className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">Cadeia de impacto</div>
                    <p className="text-[11px] text-ink-2 mt-0.5 hidden sm:block">passe o mouse nos jogadores para detalhes</p>
                    <p className="text-[11px] text-ink-2 mt-0.5 sm:hidden">toque em um jogador para ver a análise</p>
                  </div>
                  {backupAggs.length === 0 ? (
                    <p className="text-sm text-ink-2 text-center py-10">Sem dados para esta stat.</p>
                  ) : isMobile ? (
                    <MobileChain satellites={backupAggs} trigger={triggerInfo} />
                  ) : (
                    <MandalaView
                      satellites={backupAggs}
                      trigger={triggerInfo}
                      hoverId={hoverBackup}
                      onHover={setHoverBackup}
                    />
                  )}
                </div>

                {/* Painel de contexto — apenas mobile, entre cadeia e companions
                    (no desktop esse conteúdo vive na sidebar à direita) */}
                <div className="lg:hidden flex flex-col gap-4">
                  <NextGameCard trigger={triggerInfo} />

                  {/* KPIs */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white border border-line rounded-lg p-3 text-center">
                      <div className="text-[20px] font-semibold text-ink tabular-nums leading-none">{kpis.valued}</div>
                      <div className="text-[9px] uppercase tracking-wider text-ink-2 font-semibold mt-1">Valorizados</div>
                    </div>
                    <div className="bg-white border border-line rounded-lg p-3 text-center">
                      <div className={`text-[20px] font-semibold tabular-nums leading-none ${kpis.avgGap > 0 ? 'text-forest' : 'text-ink-2'}`}>
                        {kpis.avgGap > 0 ? '+' : ''}{kpis.avgGap}%
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-ink-2 font-semibold mt-1">Gap médio</div>
                    </div>
                    <div className="bg-white border border-line rounded-lg p-3 text-center">
                      <div className={`text-[20px] font-semibold tabular-nums leading-none ${kpis.maxGap > 0 ? 'text-emerald-700' : 'text-ink-2'}`}>
                        {kpis.maxGap > 0 ? '+' : ''}{kpis.maxGap}%
                      </div>
                      <div className="text-[9px] uppercase tracking-wider text-ink-2 font-semibold mt-1">Maior</div>
                    </div>
                  </div>

                  {/* Ranking */}
                  <RankingList satellites={backupAggs} />

                  {/* Por que isso importa */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Info className="w-3.5 h-3.5 text-amber-700" />
                      <span className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Por que isso importa</span>
                    </div>
                    <p className="text-[12px] text-ink leading-snug">
                      Sem {lastName(triggerInfo.triggerName)}, minutos e posses redistribuem entre os companheiros.
                      Quanto maior o gap %, maior a chance de o backup superar a linha de mercado nesta partida.
                    </p>
                  </div>
                </div>

                {/* Companheiros valorizados */}
                {backupAggs.filter(a => a.rows.some(r => r.gapPct > 0)).length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="text-[16px] font-semibold text-ink">Companheiros valorizados</h2>
                        <p className="text-[12px] text-ink-2 mt-0.5">
                          {kpis.valued} {kpis.valued === 1 ? 'jogador' : 'jogadores'} · {backupAggs.flatMap(a => a.rows.filter(r => r.gapPct > 0)).length} oportunidades destravadas
                        </p>
                      </div>
                      <span className="text-[11px] text-ink-2 hidden sm:block">ordenados por maior gap</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {backupAggs.map(agg => (
                        <CompanionCard
                          key={agg.backupPlayerId}
                          agg={agg}
                          trigger={triggerInfo}
                          onOpenDashboard={() => {
                            const slug = slugify(agg.backupPlayerName);
                            const stat = selectedStat === 'all' ? agg.topRow.statType : selectedStat;
                            navigate(`/nba-dashboard/${slug}?stat=${stat}&trigger=${encodeURIComponent(triggerInfo.triggerName)}`);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* ─── Coluna direita (desktop) — no mobile esse conteúdo aparece
                   inline entre cadeia e companions ─── */}
              <aside className="hidden lg:flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
                <NextGameCard trigger={triggerInfo} />

                {/* KPIs */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white border border-line rounded-lg p-3 text-center">
                    <div className="text-[20px] font-semibold text-ink tabular-nums leading-none">{kpis.valued}</div>
                    <div className="text-[9px] uppercase tracking-wider text-ink-2 font-semibold mt-1">Valorizados</div>
                  </div>
                  <div className="bg-white border border-line rounded-lg p-3 text-center">
                    <div className={`text-[20px] font-semibold tabular-nums leading-none ${kpis.avgGap > 0 ? 'text-forest' : 'text-ink-2'}`}>
                      {kpis.avgGap > 0 ? '+' : ''}{kpis.avgGap}%
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-ink-2 font-semibold mt-1">Gap médio</div>
                  </div>
                  <div className="bg-white border border-line rounded-lg p-3 text-center">
                    <div className={`text-[20px] font-semibold tabular-nums leading-none ${kpis.maxGap > 0 ? 'text-emerald-700' : 'text-ink-2'}`}>
                      {kpis.maxGap > 0 ? '+' : ''}{kpis.maxGap}%
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-ink-2 font-semibold mt-1">Maior</div>
                  </div>
                </div>

                {/* Ranking */}
                <RankingList satellites={backupAggs} />

                {/* Por que isso importa */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-700" />
                    <span className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Por que isso importa</span>
                  </div>
                  <p className="text-[12px] text-ink leading-snug">
                    Sem {lastName(triggerInfo.triggerName)}, minutos e posses redistribuem entre os companheiros.
                    Quanto maior o gap %, maior a chance de o backup superar a linha de mercado nesta partida.
                  </p>
                </div>
              </aside>
            </main>
          </>
        )}
      </div>
    </>
  );
}
