import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Radar, Star, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { getPlayerPhotoUrl, tryNextPlayerPhotoUrl, getTeamLogoUrl, teamAbbrToName } from '@/utils/team-logos';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAnalise360Data } from '@/hooks/use-analise360';
import AnalyticsNav from '@/components/AnalyticsNav';

// --- Types ---

interface BackupSatellite {
  backupPlayerId: number;
  backupPlayerName: string;
  avgCom: number;
  avgSem: number;
  gap: number;
  gapPct: number;
  score: number | null;
  jogosCom: number | null;
  jogosSem: number | null;
  lineValue: number | null;
  gapVsLine: number | null;
  gapVsLinePct: number | null;
  cvSem: number | null;
  stddevSem: number | null;
  ratingStars: number;
  statType: string;
  isFallback: boolean;
}

interface TriggerInfo {
  triggerPlayerId: number;
  triggerName: string;
  triggerStatus: string;
  triggerTeamAbbr: string;
  triggerDaysOut: number | null;
  ratingStars: number;
  gameLabel: string;
  gameDate: string;
  homeTeamAbbr: string;
  visitorTeamAbbr: string;
  opponentAbbr: string | null;
  opponentDefRank: number | null;
  opponentOffRank: number | null;
  isHome: boolean;
  isB2b: boolean;
  gameTime: string | null;
}

// --- Constants ---

const STAT_TABS = [
  { key: 'player_points', label: 'PTS' },
  { key: 'player_assists', label: 'AST' },
  { key: 'player_rebounds', label: 'REB' },
] as const;

const MAX_VISIBLE_SATELLITES = 8;

const STAT_SHORT_LABEL: Record<string, string> = {
  player_points: 'PTS',
  player_assists: 'AST',
  player_rebounds: 'REB',
  player_points_rebounds_assists: 'PRA',
  player_points_assists: 'P+A',
  player_points_rebounds: 'P+R',
  player_rebounds_assists: 'R+A',
  player_blocks_steals: 'B+S',
  player_threes: '3PT',
  player_steals: 'STL',
  player_blocks: 'BLK',
};

// --- Helpers ---

function slugify(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
}

function getGapColor(gapPct: number): string {
  if (gapPct >= 20) return 'text-emerald-400';
  if (gapPct >= 10) return 'text-terminal-green';
  if (gapPct >= 5) return 'text-lime-400';
  if (gapPct > -3) return 'text-terminal-text/50';
  return 'text-terminal-red';
}

function getGapBgColor(gapPct: number): string {
  if (gapPct >= 20) return 'bg-emerald-400';
  if (gapPct >= 10) return 'bg-terminal-green';
  if (gapPct >= 5) return 'bg-lime-400';
  if (gapPct > -3) return 'bg-terminal-text/20';
  return 'bg-terminal-red';
}

// Subtle, low-opacity lines — data nodes are the hero, not connections
function getLineStroke(gapPct: number): string {
  if (gapPct >= 20) return 'rgba(52, 211, 153, 0.35)';   // emerald
  if (gapPct >= 10) return 'rgba(74, 222, 128, 0.25)';   // green
  if (gapPct >= 5) return 'rgba(163, 230, 53, 0.20)';    // lime
  if (gapPct > -3) return 'rgba(255, 255, 255, 0.06)';   // neutral
  return 'rgba(239, 68, 68, 0.20)';                       // red
}

function getLineWidth(gapPct: number): number {
  const absGap = Math.abs(gapPct);
  return Math.max(0.3, Math.min(1.2, 0.3 + (absGap / 40) * 0.9));
}

// Glow color for satellite ring
function getRingGlow(gapPct: number): string {
  if (gapPct >= 20) return 'ring-emerald-400/40 shadow-[0_0_12px_rgba(52,211,153,0.25)]';
  if (gapPct >= 10) return 'ring-terminal-green/30 shadow-[0_0_10px_rgba(74,222,128,0.20)]';
  if (gapPct >= 5) return 'ring-lime-400/25 shadow-[0_0_8px_rgba(163,230,53,0.15)]';
  if (gapPct > -3) return 'ring-terminal-border/30';
  return 'ring-terminal-red/30 shadow-[0_0_8px_rgba(239,68,68,0.15)]';
}

function getTriggerStatusBadge(status: string): { text: string; cls: string } {
  const s = status.toLowerCase();
  if (s === 'out' || s.includes('out')) return { text: 'OUT', cls: 'bg-terminal-red/15 text-terminal-red border-terminal-red/25' };
  if (s.includes('doubtful')) return { text: 'DTD', cls: 'bg-orange-400/15 text-orange-400 border-orange-400/25' };
  return { text: 'Q', cls: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/25' };
}

// --- Player Photo Component ---

function PlayerPhoto({ name, teamAbbr, size = 'md' }: { name: string; teamAbbr: string; size?: 'sm' | 'md' | 'lg' | 'xl' | 'center' }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const sizeClass = {
    center: 'w-[88px] h-[88px]',
    xl: 'w-16 h-16',
    lg: 'w-14 h-14',
    md: 'w-14 h-14',
    sm: 'w-9 h-9',
  }[size];
  const textClass = {
    center: 'text-2xl',
    xl: 'text-base',
    lg: 'text-sm',
    md: 'text-sm',
    sm: 'text-[10px]',
  }[size];

  return (
    <div className={`${sizeClass} rounded-full overflow-hidden bg-terminal-gray shrink-0 flex items-center justify-center relative`}>
      <img
        src={getPlayerPhotoUrl(name, teamAbbr)}
        alt={name}
        className="w-[115%] h-[115%] object-cover object-top absolute top-0 left-1/2 -translate-x-1/2"
        loading="lazy"
        data-player-photo-index="0"
        onError={(e) => {
          const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, name, teamAbbr);
          if (!didTry) {
            const el = e.target as HTMLImageElement;
            el.style.display = 'none';
            const parent = el.parentElement;
            if (parent) parent.innerHTML = `<span class="${textClass} font-bold text-terminal-text opacity-50">${initials}</span>`;
          }
        }}
      />
    </div>
  );
}

// --- Mandala View (Desktop) ---

function MandalaView({
  satellites,
  trigger,
  onSatelliteClick,
  selectedBackup,
  onCloseTooltip,
}: {
  satellites: BackupSatellite[];
  trigger: TriggerInfo;
  onSatelliteClick: (sat: BackupSatellite) => void;
  selectedBackup: number | null;
  onCloseTooltip: () => void;
}) {
  const visible = satellites.slice(0, MAX_VISIBLE_SATELLITES);
  const count = visible.length;
  const radius = 36;

  return (
    <div className="relative w-full" style={{ paddingBottom: '95%', maxWidth: '750px', margin: '0 auto' }}>
      <div className="absolute inset-0">

        {/* Subtle orbit ring */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="18" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.2" />
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.2" strokeDasharray="1.5 1.5" />
        </svg>

        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
          {visible.map((sat, i) => {
            const angle = (2 * Math.PI / count) * i - Math.PI / 2;
            const x2 = 50 + radius * Math.cos(angle);
            const y2 = 50 + radius * Math.sin(angle);
            const isActive = selectedBackup === sat.backupPlayerId;
            return (
              <line
                key={sat.backupPlayerId}
                x1="50" y1="50"
                x2={x2} y2={y2}
                stroke={getLineStroke(sat.gapPct)}
                strokeWidth={isActive ? getLineWidth(sat.gapPct) * 2 : getLineWidth(sat.gapPct)}
                strokeOpacity={isActive ? 1 : (selectedBackup ? 0.3 : 1)}
                className="transition-all duration-500 ease-out"
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Center node */}
        <div
          className="absolute flex flex-col items-center z-10"
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-terminal-border/10 animate-pulse scale-[1.4]" />
            <PlayerPhoto name={trigger.triggerName} teamAbbr={trigger.triggerTeamAbbr} size="center" />
            <span className={`absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap bg-terminal-dark-gray/90 backdrop-blur-sm ${getTriggerStatusBadge(trigger.triggerStatus).cls}`}>
              {getTriggerStatusBadge(trigger.triggerStatus).text}
            </span>
          </div>
          <span className="text-sm font-semibold text-terminal-text/80 mt-5 text-center max-w-[130px] leading-tight">
            {trigger.triggerName}
          </span>
          <span className="text-[9px] text-terminal-blue/40 mt-1">Clique nos jogadores para detalhes</span>
        </div>

        {/* Satellite nodes */}
        {visible.map((sat, i) => {
          const angle = (2 * Math.PI / count) * i - Math.PI / 2;
          const x = 50 + radius * Math.cos(angle);
          const y = 50 + radius * Math.sin(angle);
          const isSelected = selectedBackup === sat.backupPlayerId;
          const isPositive = sat.gapPct > 0;
          const isDimmed = selectedBackup != null && !isSelected;

          return (
            <button
              key={sat.backupPlayerId}
              className={`absolute flex flex-col items-center cursor-pointer group mandala-satellite-enter ${isSelected ? 'z-20' : 'z-10'} transition-opacity duration-300 ${isDimmed ? 'opacity-40' : 'opacity-100'}`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                animationDelay: `${i * 60}ms`,
              }}
              onClick={() => onSatelliteClick(sat)}
            >
              <div className={`relative transition-all duration-200 ease-out ${isSelected ? 'scale-115' : 'group-hover:scale-105'} group-active:scale-95`}>
                <div className={`rounded-full ring-2 ${getRingGlow(sat.gapPct)} ${sat.isFallback ? 'opacity-60' : ''}`}>
                  <PlayerPhoto name={sat.backupPlayerName} teamAbbr={trigger.triggerTeamAbbr} size="md" />
                </div>
                {/* Gap badge */}
                <span className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm ${
                  isPositive
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-400/20'
                    : sat.gapPct <= -3
                    ? 'bg-red-950/80 text-red-400 border border-red-400/20'
                    : 'bg-terminal-dark-gray/80 text-terminal-text/50 border border-terminal-border-subtle'
                }`}>
                  {isPositive ? '+' : ''}{sat.gapPct.toFixed(0)}%
                </span>
              </div>

              {/* Player name */}
              <span className={`text-[13px] mt-2.5 text-center max-w-[110px] leading-tight transition-colors ${
                isSelected ? 'text-terminal-text font-semibold' : 'text-terminal-text/60 group-hover:text-terminal-text/80'
              }`}>
                {sat.backupPlayerName.split(' ').length > 2
                  ? sat.backupPlayerName.split(' ').slice(-2).join(' ')
                  : sat.backupPlayerName}
              </span>

              {/* Fallback stat indicator */}
              {sat.isFallback && (
                <span className="text-[10px] text-terminal-text/30 uppercase tracking-wider">
                  {STAT_SHORT_LABEL[sat.statType] ?? sat.statType}
                </span>
              )}
            </button>
          );
        })}

        {/* Click-outside backdrop */}
        {selectedBackup && (
          <div className="fixed inset-0 z-[5]" onClick={onCloseTooltip} />
        )}
      </div>
    </div>
  );
}

// --- Mobile Ranked List ---

function MobileRankedList({
  satellites,
  trigger,
  onSatelliteClick,
}: {
  satellites: BackupSatellite[];
  trigger: TriggerInfo;
  onSatelliteClick: (sat: BackupSatellite) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_SHOW = 6;
  const visible = showAll ? satellites : satellites.slice(0, INITIAL_SHOW);
  const hasMore = satellites.length > INITIAL_SHOW;
  const maxGapPct = Math.max(...satellites.map(s => Math.abs(s.gapPct)), 1);

  return (
    <div className="space-y-1.5">
      {visible.map((sat, i) => {
        const isPositive = sat.gapPct > 0;
        const barWidth = Math.min(100, (Math.abs(sat.gapPct) / maxGapPct) * 100);

        return (
          <button
            key={sat.backupPlayerId}
            onClick={() => onSatelliteClick(sat)}
            className="w-full bg-terminal-dark-gray/60 border border-terminal-border-subtle/50 rounded-lg p-3 hover:border-terminal-blue/30 active:scale-[0.99] transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-terminal-text/20 w-4 text-right font-mono tabular-nums">{i + 1}</span>
              <div className={`rounded-full ring-1 ${getRingGlow(sat.gapPct)}`}>
                <PlayerPhoto name={sat.backupPlayerName} teamAbbr={trigger.triggerTeamAbbr} size="sm" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-xs font-medium truncate ${sat.isFallback ? 'text-terminal-text/50' : 'text-terminal-text/90'}`}>
                      {sat.backupPlayerName}
                    </span>
                    {sat.isFallback && (
                      <span className="text-[8px] text-terminal-text/25 bg-terminal-gray/40 px-1 py-0.5 rounded shrink-0 uppercase tracking-wider">
                        {STAT_SHORT_LABEL[sat.statType] ?? sat.statType}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-bold shrink-0 ml-2 tabular-nums ${getGapColor(sat.gapPct)}`}>
                    {isPositive ? '+' : ''}{sat.gapPct.toFixed(1)}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1 bg-terminal-gray/40 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${getGapBgColor(sat.gapPct)}`}
                    style={{ width: `${barWidth}%`, opacity: 0.7 }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-terminal-text/30 tabular-nums">
                    com: {sat.avgCom.toFixed(1)} · sem: {sat.avgSem.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </button>
        );
      })}

      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2.5 text-[10px] text-terminal-blue/60 hover:text-terminal-blue flex items-center justify-center gap-1 transition-colors"
        >
          <ChevronDown className="w-3 h-3" />
          Ver mais {satellites.length - INITIAL_SHOW} jogadores
        </button>
      )}
      {hasMore && showAll && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full py-2.5 text-[10px] text-terminal-text/30 hover:text-terminal-text/50 flex items-center justify-center gap-1 transition-colors"
        >
          <ChevronUp className="w-3 h-3" />
          Recolher
        </button>
      )}
    </div>
  );
}

// --- Satellite Detail Panel ---

function SatelliteDetail({
  satellite,
  trigger,
  onClose,
}: {
  satellite: BackupSatellite;
  trigger: TriggerInfo;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const isPositive = satellite.gapPct > 0;
  const slug = slugify(satellite.backupPlayerName);
  const triggerLastName = trigger.triggerName.split(' ').pop();

  return (
    <div className="bg-terminal-dark-gray/80 backdrop-blur-sm border border-terminal-border-subtle/60 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`rounded-full ring-1 ${getRingGlow(satellite.gapPct)}`}>
            <PlayerPhoto name={satellite.backupPlayerName} teamAbbr={trigger.triggerTeamAbbr} size="sm" />
          </div>
          <div>
            <span className="text-sm font-semibold text-terminal-text block">{satellite.backupPlayerName}</span>
            <span className="text-[9px] text-terminal-text/30 uppercase tracking-wider">
              {STAT_SHORT_LABEL[satellite.statType] ?? satellite.statType}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="text-terminal-text/20 hover:text-terminal-text/50 transition-colors p-1">
          <span className="text-sm">&#x2715;</span>
        </button>
      </div>

      {/* Stats comparison */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-terminal-gray/30 rounded-lg p-2.5 text-center">
          <span className="text-[9px] text-terminal-text/30 uppercase tracking-wider block mb-1">Com {triggerLastName}</span>
          <span className="text-base font-bold text-terminal-text/70 tabular-nums">{satellite.avgCom.toFixed(1)}</span>
        </div>
        <div className="bg-terminal-gray/30 rounded-lg p-2.5 text-center">
          <span className="text-[9px] text-terminal-text/30 uppercase tracking-wider block mb-1">Sem {triggerLastName}</span>
          <span className="text-base font-bold text-terminal-text tabular-nums">{satellite.avgSem.toFixed(1)}</span>
        </div>
      </div>

      {/* Gap + metadata */}
      <div className="space-y-1.5 text-xs mb-3">
        <div className="flex justify-between items-center">
          <span className="text-terminal-text/35">Diferenca</span>
          <span className={`font-bold tabular-nums ${getGapColor(satellite.gapPct)}`}>
            {isPositive ? '+' : ''}{satellite.gap.toFixed(1)} ({isPositive ? '+' : ''}{satellite.gapPct.toFixed(1)}%)
          </span>
        </div>
        {satellite.jogosSem != null && (
          <div className="flex justify-between items-center">
            <span className="text-terminal-text/35">Amostra</span>
            <span className="text-terminal-text/60 tabular-nums">{satellite.jogosSem} jogos sem</span>
          </div>
        )}
        {satellite.score != null && (
          <div className="flex justify-between items-center">
            <span className="text-terminal-text/35">Score</span>
            <span className="text-terminal-text/60 tabular-nums">{satellite.score}/100</span>
          </div>
        )}
        {satellite.cvSem != null && (
          <div className="flex justify-between items-center">
            <span className="text-terminal-text/35">Consistencia</span>
            <span className={`tabular-nums font-medium ${
              satellite.cvSem <= 30 ? 'text-terminal-green/70' : satellite.cvSem <= 50 ? 'text-terminal-yellow/70' : 'text-terminal-red/70'
            }`}>
              {satellite.cvSem <= 30 ? 'Alta' : satellite.cvSem <= 50 ? 'Media' : 'Baixa'}
              <span className="text-terminal-text/25 ml-1">({satellite.cvSem.toFixed(0)}%)</span>
            </span>
          </div>
        )}
      </div>

      {/* Line + gap vs line */}
      {satellite.lineValue != null && (
        <div className="border-t border-terminal-border-subtle/30 pt-2.5 mb-3 space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-terminal-text/35">Linha</span>
            <span className="text-terminal-text/60 tabular-nums">{satellite.lineValue.toFixed(1)}</span>
          </div>
          {satellite.gapVsLinePct != null && (
            <div className="flex justify-between items-center">
              <span className="text-terminal-text/35">Gap vs Linha</span>
              <span className={`font-bold tabular-nums ${satellite.gapVsLinePct > 0 ? 'text-terminal-green/80' : 'text-terminal-red/70'}`}>
                {satellite.gapVsLinePct > 0 ? '+' : ''}{satellite.gapVsLinePct.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}

      <a
        href={`/nba-dashboard/${slug}?stat=${satellite.statType}&trigger=${encodeURIComponent(trigger.triggerName)}`}
        onClick={(e) => { if (!e.ctrlKey && !e.metaKey && e.button === 0) { e.preventDefault(); navigate(`/nba-dashboard/${slug}?stat=${satellite.statType}&trigger=${encodeURIComponent(trigger.triggerName)}`); } }}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold text-terminal-blue/80 hover:text-terminal-blue bg-terminal-blue/5 hover:bg-terminal-blue/10 rounded-lg border border-terminal-blue/15 transition-all active:scale-[0.98] no-underline"
      >
        Ver Dashboard
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

// --- Main Page ---

export default function Analise360Detail() {
  const { triggerPlayerId } = useParams<{ triggerPlayerId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const { data, isLoading, error } = useAnalise360Data();
  const opportunities = data?.opportunities ?? [];
  const playerStarsMap = data?.playerStarsMap ?? new Map<number, number>();
  const [selectedStat, setSelectedStat] = useState<string>('player_points');
  const [selectedBackup, setSelectedBackup] = useState<BackupSatellite | null>(null);

  const triggerIdNum = Number(triggerPlayerId);

  const triggerOpps = useMemo(() => {
    return opportunities.filter(o => o.trigger_player_id === triggerIdNum);
  }, [opportunities, triggerIdNum]);

  const triggerInfo = useMemo((): TriggerInfo | null => {
    if (triggerOpps.length === 0) return null;
    const first = triggerOpps[0];
    return {
      triggerPlayerId: first.trigger_player_id,
      triggerName: first.trigger_name,
      triggerStatus: first.trigger_status,
      triggerTeamAbbr: first.trigger_team_abbr,
      triggerDaysOut: first.trigger_days_out,
      ratingStars: playerStarsMap.get(first.trigger_player_id) ?? 0,
      gameLabel: `${first.home_team_abbr} vs ${first.visitor_team_abbr}`,
      gameDate: first.game_date,
      homeTeamAbbr: first.home_team_abbr,
      visitorTeamAbbr: first.visitor_team_abbr,
      opponentAbbr: first.opponent_abbr,
      opponentDefRank: first.opponent_def_rank,
      opponentOffRank: first.opponent_off_rank,
      isHome: first.is_home,
      isB2b: first.is_b2b,
      gameTime: first.game_time,
    };
  }, [triggerOpps, playerStarsMap]);

  const satellites = useMemo((): BackupSatellite[] => {
    const byBackup = new Map<number, DailyOpportunity[]>();
    triggerOpps.forEach(o => {
      if (o.backup_player_id == null) return;
      if (!byBackup.has(o.backup_player_id)) byBackup.set(o.backup_player_id, []);
      byBackup.get(o.backup_player_id)!.push(o);
    });

    const sats: BackupSatellite[] = [];
    byBackup.forEach((opps, backupId) => {
      let pick = opps.find(o => o.stat_type === selectedStat);
      const isFallback = !pick;
      if (!pick) {
        pick = opps.reduce((best, o) => (o.gap_pct > (best?.gap_pct ?? -Infinity) ? o : best), opps[0]);
      }
      sats.push({
        backupPlayerId: backupId,
        backupPlayerName: pick.backup_player_name,
        avgCom: pick.avg_com,
        avgSem: pick.avg_sem,
        gap: pick.gap,
        gapPct: pick.gap_pct,
        score: pick.score,
        jogosCom: pick.jogos_com,
        jogosSem: pick.jogos_sem,
        lineValue: pick.line_value,
        gapVsLine: pick.gap_vs_line,
        gapVsLinePct: pick.gap_vs_line_pct,
        cvSem: pick.cv_sem,
        stddevSem: pick.stddev_sem,
        ratingStars: pick.rating_stars,
        statType: pick.stat_type,
        isFallback,
      });
    });

    sats.sort((a, b) => b.gapPct - a.gapPct);
    return sats;
  }, [triggerOpps, selectedStat]);

  const availableTabs = useMemo(() => {
    const statTypes = new Set(triggerOpps.map(o => o.stat_type));
    return STAT_TABS.filter(t => statTypes.has(t.key));
  }, [triggerOpps]);

  useEffect(() => {
    setSelectedBackup(null);
  }, [selectedStat]);

  const handleSatelliteClick = (sat: BackupSatellite) => {
    setSelectedBackup(prev => prev?.backupPlayerId === sat.backupPlayerId ? null : sat);
  };


  return (
    <div className="min-h-screen bg-terminal-black text-terminal-text font-mono">
      <AnalyticsNav />

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Back */}
        <button
          onClick={() => navigate('/analise-360')}
          className="flex items-center gap-1.5 text-xs text-terminal-text/40 hover:text-terminal-blue mb-5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-terminal-green opacity-60" />
            <span className="text-sm text-terminal-text/30">Carregando...</span>
          </div>
        ) : error ? (
          <div className="text-center py-20 text-sm text-terminal-red/60">{error?.message ?? 'Falha ao carregar dados'}</div>
        ) : !triggerInfo ? (
          <div className="text-center py-20">
            <Radar className="w-8 h-8 text-terminal-text/15 mx-auto mb-3" />
            <p className="text-sm text-terminal-text/30">Nenhum dado encontrado para este jogador</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
              <PlayerPhoto name={triggerInfo.triggerName} teamAbbr={triggerInfo.triggerTeamAbbr} size="xl" />
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <h1 className="text-lg font-bold text-terminal-text">{triggerInfo.triggerName}</h1>
                  <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border ${getTriggerStatusBadge(triggerInfo.triggerStatus).cls}`}>
                    {getTriggerStatusBadge(triggerInfo.triggerStatus).text}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <img
                    src={getTeamLogoUrl(teamAbbrToName(triggerInfo.triggerTeamAbbr))}
                    alt={triggerInfo.triggerTeamAbbr}
                    className="w-4 h-4 object-contain opacity-70"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-[10px] text-terminal-text/40">{triggerInfo.triggerTeamAbbr}</span>
                  <span className="text-[10px] text-terminal-text/15">·</span>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: Math.min(triggerInfo.ratingStars, 5) }).map((_, i) => (
                      <Star key={i} className="w-2.5 h-2.5 text-terminal-yellow fill-terminal-yellow" />
                    ))}
                  </div>
                  {triggerInfo.triggerDaysOut != null && triggerInfo.triggerDaysOut > 0 && (
                    <>
                      <span className="text-[10px] text-terminal-text/15">·</span>
                      <span className="text-[10px] text-terminal-red/60">Fora ha {triggerInfo.triggerDaysOut} {triggerInfo.triggerDaysOut === 1 ? 'dia' : 'dias'}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Stat tabs */}
            <div className="flex items-center gap-0.5 mb-2 bg-terminal-dark-gray/60 rounded-lg p-1 w-fit border border-terminal-border-subtle/30">
              {availableTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedStat(tab.key)}
                  className={`px-5 py-1.5 text-[11px] font-bold rounded-md transition-all duration-200 ${
                    selectedStat === tab.key
                      ? 'bg-terminal-blue/90 text-white shadow-sm'
                      : 'text-terminal-text/40 hover:text-terminal-text/70 hover:bg-terminal-gray/20'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {satellites.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-terminal-text/30">Sem dados para esta stat</p>
              </div>
            ) : isMobile ? (
              <>
                <MobileRankedList
                  satellites={satellites}
                  trigger={triggerInfo}
                  onSatelliteClick={handleSatelliteClick}
                />
                {selectedBackup && triggerInfo && (
                  <div className="mt-4">
                    <SatelliteDetail
                      satellite={selectedBackup}
                      trigger={triggerInfo}
                      onClose={() => setSelectedBackup(null)}
                    />
                  </div>
                )}
              </>
            ) : (
              /* Desktop: mandala + side panel */
              <div className="flex gap-6 items-start">
                {/* Left: Mandala */}
                <div className="flex-1 min-w-0">
                  <MandalaView
                    satellites={satellites}
                    trigger={triggerInfo}
                    onSatelliteClick={handleSatelliteClick}
                    selectedBackup={selectedBackup?.backupPlayerId ?? null}
                    onCloseTooltip={() => setSelectedBackup(null)}
                  />
                </div>

                {/* Right: Side Panel */}
                <div className="w-[320px] shrink-0 space-y-4 relative z-10">
                  {/* Game context card */}
                  <div className="bg-terminal-dark-gray border border-terminal-border-subtle/50 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] text-terminal-text/30 uppercase tracking-wider font-semibold">Proximo Jogo</span>
                      <span className="text-[10px] text-terminal-text/30 tabular-nums">
                        {triggerInfo.gameDate}{triggerInfo.gameTime ? ` · ${triggerInfo.gameTime}` : ''}
                      </span>
                    </div>
                    {/* Matchup with logos */}
                    <div className="flex items-center justify-center gap-5 mb-3">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 rounded-xl bg-white/90 flex items-center justify-center p-1.5">
                          <img
                            src={getTeamLogoUrl(teamAbbrToName(triggerInfo.homeTeamAbbr))}
                            alt={triggerInfo.homeTeamAbbr}
                            className="w-full h-full object-contain"
                            onError={(e) => { const el = e.target as HTMLImageElement; el.style.display = 'none'; el.parentElement!.innerHTML = `<span class="text-[10px] font-bold text-terminal-text/50">${triggerInfo.homeTeamAbbr}</span>`; }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-terminal-text/20 font-semibold">vs</span>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 rounded-xl bg-white/90 flex items-center justify-center p-1.5">
                          <img
                            src={getTeamLogoUrl(teamAbbrToName(triggerInfo.visitorTeamAbbr))}
                            alt={triggerInfo.visitorTeamAbbr}
                            className="w-full h-full object-contain"
                            onError={(e) => { const el = e.target as HTMLImageElement; el.style.display = 'none'; el.parentElement!.innerHTML = `<span class="text-[10px] font-bold text-terminal-text/50">${triggerInfo.visitorTeamAbbr}</span>`; }}
                          />
                        </div>
                      </div>
                    </div>
                    {/* B2B flag only */}
                    {triggerInfo.isB2b && (
                      <div className="flex justify-center">
                        <span className="text-[10px] px-2 py-0.5 rounded-full border text-orange-400/80 border-orange-400/20 bg-orange-400/5">
                          Back-to-Back
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-terminal-dark-gray border border-terminal-border-subtle/50 rounded-lg p-3 text-center">
                      <span className="text-lg font-bold text-terminal-text tabular-nums">{satellites.length}</span>
                      <span className="text-[9px] text-terminal-text/30 uppercase tracking-wider block mt-0.5">Jogadores</span>
                    </div>
                    <div className="bg-terminal-dark-gray border border-terminal-border-subtle/50 rounded-lg p-3 text-center">
                      <span className={`text-lg font-bold tabular-nums ${getGapColor(Math.round(satellites.reduce((s, sat) => s + sat.gapPct, 0) / satellites.length))}`}>
                        +{Math.round(satellites.reduce((s, sat) => s + sat.gapPct, 0) / satellites.length)}%
                      </span>
                      <span className="text-[9px] text-terminal-text/30 uppercase tracking-wider block mt-0.5">Gap Medio</span>
                    </div>
                    <div className="bg-terminal-dark-gray border border-terminal-border-subtle/50 rounded-lg p-3 text-center">
                      <span className={`text-lg font-bold tabular-nums ${getGapColor(satellites[0]?.gapPct ?? 0)}`}>
                        +{satellites[0]?.gapPct.toFixed(0) ?? 0}%
                      </span>
                      <span className="text-[9px] text-terminal-text/30 uppercase tracking-wider block mt-0.5">Maior</span>
                    </div>
                  </div>

                  {/* Selected player detail OR ranking */}
                  {selectedBackup && triggerInfo ? (
                    <SatelliteDetail
                      satellite={selectedBackup}
                      trigger={triggerInfo}
                      onClose={() => setSelectedBackup(null)}
                    />
                  ) : (
                    /* Ranking list */
                    <div className="bg-terminal-dark-gray border border-terminal-border-subtle/50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] text-terminal-text/30 uppercase tracking-wider font-semibold">Ranking de Impacto</span>
                        <span className="text-[9px] text-terminal-blue/50">Clique para ver detalhes</span>
                      </div>
                      <div className="space-y-1">
                        {satellites.map((sat, i) => {
                          const isPositive = sat.gapPct > 0;
                          const maxGap = Math.max(...satellites.map(s => Math.abs(s.gapPct)), 1);
                          const barWidth = Math.min(100, (Math.abs(sat.gapPct) / maxGap) * 100);
                          return (
                            <button
                              key={sat.backupPlayerId}
                              onClick={() => handleSatelliteClick(sat)}
                              className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-terminal-gray/20 active:scale-[0.99] transition-all text-left group"
                            >
                              <span className="text-[10px] text-terminal-text/20 w-4 text-right font-mono tabular-nums">{i + 1}</span>
                              <PlayerPhoto name={sat.backupPlayerName} teamAbbr={triggerInfo.triggerTeamAbbr} size="sm" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] text-terminal-text/70 truncate group-hover:text-terminal-text transition-colors">
                                    {sat.backupPlayerName}
                                  </span>
                                  <span className={`text-[11px] font-bold tabular-nums shrink-0 ml-2 ${getGapColor(sat.gapPct)}`}>
                                    {isPositive ? '+' : ''}{sat.gapPct.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="w-full h-1 bg-terminal-gray/30 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${getGapBgColor(sat.gapPct)}`}
                                    style={{ width: `${barWidth}%`, opacity: 0.6 }}
                                  />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
