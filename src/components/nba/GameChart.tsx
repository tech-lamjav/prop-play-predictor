import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, ReferenceLine, Label, Tooltip, LabelList } from 'recharts';
import { GamePlayerStats, TeamPlayer } from '@/services/nba-data.service';
import { RotateCcw, Info, Globe, Home, Plane, X, ChevronDown, ChevronLeft, ChevronRight, Star, SlidersHorizontal } from 'lucide-react';
import { Tooltip as UITooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { getPlayerPhotoUrl, tryNextPlayerPhotoUrl, getTeamLogoUrl, teamAbbrToName } from '@/utils/team-logos';
import { TeammateFilter } from '@/components/nba/TeammateFilterBar';
import { STAT_TYPES_BASIC, STAT_TYPES_COMBOS, STAT_TYPES_PERIOD } from '@/components/nba/StatTypeSelector';

const gameOptions: Array<{ value: number | 'all'; label: string }> = [
  { value: 5, label: 'Últ. 5' },
  { value: 10, label: 'Últ. 10' },
  { value: 15, label: 'Últ. 15' },
  { value: 'all', label: 'Todos' },
];

const locationOptions: Array<{ value: 'all' | 'home' | 'away'; icon: React.ReactNode }> = [
  { value: 'all', icon: <Globe className="w-3 h-3" /> },
  { value: 'home', icon: <Home className="w-3 h-3" /> },
  { value: 'away', icon: <Plane className="w-3 h-3" /> },
];

interface GameChartProps {
  gameStats: GamePlayerStats[];
  currentLine?: number | null;
  seasonAvg?: number;
  lastNGames: number | 'all';
  homeAway: 'all' | 'home' | 'away';
  onLastNGamesChange: (value: number | 'all') => void;
  onHomeAwayChange: (value: 'all' | 'home' | 'away') => void;
  totalGamesAvailable: number;
  teammates?: TeamPlayer[];
  currentPlayerId?: number;
  teamName?: string;
  teammateFilter: TeammateFilter;
  onTeammateFilterChange: (filter: TeammateFilter) => void;
  teammateFilterLoading?: boolean;
  selectedStatType: string;
  onStatTypeChange: (statId: string) => void;
  b2bOnly: boolean;
  onB2BChange: (v: boolean) => void;
  h2hOnly: boolean;
  onH2HChange: (v: boolean) => void;
  nextOpponent?: string;
  selectedSeason?: number | 'current';
  onSeasonChange?: (season: number | 'current') => void;
  seasonType?: 'all' | 'regular' | 'playoffs' | 'playin';
  onSeasonTypeChange?: (type: 'all' | 'regular' | 'playoffs' | 'playin') => void;
  chartLoading?: boolean;
  /** Potential assists per game (season). Mostrado no footer quando stat = assists. */
  potentialAstSeason?: number | null;
  /** Rank do potential_ast na liga (1-N). Mostrado entre parens. */
  potentialAstSeasonRank?: number | null;
}

interface ChartDataPoint {
  game: string;
  value: number;
  opponent: string;
  date: string;
  isOver: boolean;
  line: number;
  statVsLine: string;
  homeAway: string;
  isB2B: boolean;
  playerScore: number | null;
  oppScore: number | null;
  gameWon: boolean | null;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ChartDataPoint;
    const hasScore = data.playerScore !== null && data.oppScore !== null;
    const margin = hasScore ? Math.abs((data.playerScore ?? 0) - (data.oppScore ?? 0)) : null;
    const isOver = data.line > 0 ? data.value > data.line : null;
    const statDisplay = data.value % 1 === 0 ? String(data.value) : data.value.toFixed(1);

    return (
      <div className="bg-[#0d1b2e] border border-white/12 rounded-lg shadow-2xl p-3 w-44">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-terminal-text">{data.opponent}</span>
          <div className="flex items-center gap-1">
            {data.isB2B && (
              <span className="text-[9px] px-1 py-px rounded bg-terminal-yellow/20 text-terminal-yellow font-bold">B2B</span>
            )}
            {hasScore && data.gameWon !== null && (
              <span className={`text-[9px] px-1 py-px rounded font-bold ${data.gameWon ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {data.gameWon ? 'W' : 'L'}+{margin}
              </span>
            )}
          </div>
        </div>
        {hasScore && (
          <div className="text-[10px] text-terminal-text/40 mb-2">
            {data.playerScore} – {data.oppScore}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[9px] text-terminal-text/40 uppercase mb-0.5">Estatística</div>
            <div className="text-xl font-bold text-terminal-green leading-none">{statDisplay}</div>
          </div>
          {data.line > 0 && (
            <div className="text-right">
              <div className="text-[9px] text-terminal-text/40 mb-0.5">Linha {data.line.toFixed(1)}</div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isOver ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {isOver ? 'ACIMA' : 'ABAIXO'}
              </span>
            </div>
          )}
        </div>
        <div className="text-[9px] text-terminal-text/25 mt-2">{data.date}</div>
      </div>
    );
  }
  return null;
};

const CustomXAxisTick = (props: any) => {
  const { x, y, payload, data } = props;
  const gameData = data.find((d: ChartDataPoint) => d.game === payload.value);
  const opp = gameData?.opponent ?? '';
  const abbr = opp.replace('@', '').trim().toUpperCase();
  const teamName = teamAbbrToName(abbr);
  const logoUrl = teamName ? getTeamLogoUrl(teamName) : '';
  const LOGO_SIZE = 20;

  return (
    <g transform={`translate(${x},${y})`}>
      {logoUrl ? (
        <image
          href={logoUrl}
          x={-LOGO_SIZE / 2}
          y={2}
          width={LOGO_SIZE}
          height={LOGO_SIZE}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <text x={0} y={0} dy={14} textAnchor="middle" fill="#7a9bb5" fontSize={10} fontWeight={600}>
          {abbr}
        </text>
      )}
      <text
        x={0}
        y={0}
        dy={LOGO_SIZE + 12}
        textAnchor="middle"
        fill="#8a9585"
        fontSize={9}
      >
        {gameData?.date}
      </text>
    </g>
  );
};

export const GameChart: React.FC<GameChartProps> = ({
  gameStats, currentLine, seasonAvg, lastNGames, homeAway, onLastNGamesChange, onHomeAwayChange,
  totalGamesAvailable, teammates = [], currentPlayerId, teamName = '', teammateFilter,
  onTeammateFilterChange, teammateFilterLoading, selectedStatType, onStatTypeChange,
  b2bOnly, onB2BChange, h2hOnly, onH2HChange, nextOpponent,
  selectedSeason = 'current', onSeasonChange, seasonType = 'all', onSeasonTypeChange,
  chartLoading = false,
  potentialAstSeason = null, potentialAstSeasonRank = null,
}) => {
  const [adjustedLine, setAdjustedLine] = useState<number | null>(currentLine ?? null);
  const [isDragging, setIsDragging] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tabScrollState, setTabScrollState] = useState<{ canLeft: boolean; canRight: boolean }>({ canLeft: false, canRight: false });
  const [isMobile, setIsMobile] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartBoundsRef = useRef<{ top: number; bottom: number; minY: number; maxY: number } | null>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const savedTabsScrollLeft = useRef<number>(0);

  // Detect mobile viewport (< md breakpoint = 768px)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  // Update tab scroll state — ResizeObserver covers layout changes (filter panel
  // toggle, font load, content re-render) that scroll/resize events miss.
  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    const updateScroll = () => {
      savedTabsScrollLeft.current = el.scrollLeft;
      setTabScrollState({
        canLeft: el.scrollLeft > 4,
        canRight: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    };
    updateScroll();
    const ro = new ResizeObserver(updateScroll);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener('scroll', updateScroll);
    window.addEventListener('resize', updateScroll);
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
    };
  }, []);

  // Preserve scrollLeft + recompute arrow visibility on every stat/loading change.
  // Without this, switching stats can cause the browser to reset scroll to 0
  // and leave the arrows stale (canLeft/canRight not updated).
  useLayoutEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    if (savedTabsScrollLeft.current > 0 && el.scrollLeft !== savedTabsScrollLeft.current) {
      el.scrollLeft = savedTabsScrollLeft.current;
    }
    setTabScrollState({
      canLeft: el.scrollLeft > 4,
      canRight: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, [selectedStatType, chartLoading]);

  const scrollTabs = (dir: 'left' | 'right') => {
    const el = tabsScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  const availableTeammates = teammates.filter(t => Number(t.player_id) !== Number(currentPlayerId));

  useEffect(() => {
    setAdjustedLine(currentLine ?? null);
  }, [currentLine]);

  const chartData: ChartDataPoint[] = [...gameStats]
    .reverse()
    .map((game, index) => ({
      game: `G${index + 1}`,
      value: game.stat_value ?? 0,
      opponent: game.played_against,
      date: new Date(game.game_date).toLocaleDateString('pt-BR', { month: 'numeric', day: 'numeric' }),
      isOver: game.stat_vs_line === 'Over',
      line: game.line ?? 0,
      statVsLine: game.stat_vs_line || '',
      homeAway: game.home_away || '',
      isB2B: game.is_b2b_game ?? false,
      playerScore: game.player_team_score ?? null,
      oppScore: game.opponent_score ?? null,
      gameWon: game.game_won ?? null,
    }));

  const average = chartData.length > 0
    ? (chartData.reduce((sum, game) => sum + game.value, 0) / chartData.length).toFixed(1)
    : '0.0';

  const hitRate = adjustedLine && chartData.length > 0
    ? {
        hits: chartData.filter(g => g.value > adjustedLine).length,
        total: chartData.length,
        percentage: ((chartData.filter(g => g.value > adjustedLine).length / chartData.length) * 100).toFixed(1)
      }
    : null;

  const maxValue = Math.max(...chartData.map(d => d.value), adjustedLine || 0);
  const yAxisMax = Math.ceil(maxValue * 1.15);
  const yAxisMin = 0;

  const computeChartBounds = useCallback(() => {
    if (!chartContainerRef.current) return null;
    const rect = chartContainerRef.current.getBoundingClientRect();
    return { top: rect.top + 5, bottom: rect.bottom - 80, minY: yAxisMin, maxY: yAxisMax };
  }, [yAxisMin, yAxisMax]);

  const isNearLine = useCallback((clientY: number, bounds: { top: number; bottom: number; minY: number; maxY: number }, tolerance: number) => {
    if (adjustedLine === null) return false;
    const chartHeight = bounds.bottom - bounds.top;
    const lineYPosition = bounds.top + chartHeight * (1 - (adjustedLine - bounds.minY) / (bounds.maxY - bounds.minY));
    return Math.abs(clientY - lineYPosition) < tolerance;
  }, [adjustedLine]);

  const applyDragPosition = useCallback((clientY: number) => {
    if (!chartBoundsRef.current) return;
    const { top, bottom, minY, maxY } = chartBoundsRef.current;
    const chartHeight = bottom - top;
    const relativeY = Math.max(0, Math.min(1, (clientY - top) / chartHeight));
    const newValue = maxY - relativeY * (maxY - minY);
    const roundedValue = Math.round(newValue * 2) / 2;
    setAdjustedLine(Math.max(0.5, roundedValue));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (adjustedLine === null) return;
    const bounds = computeChartBounds();
    if (!bounds) return;
    chartBoundsRef.current = bounds;
    if (isNearLine(e.clientY, bounds, 15)) {
      setIsDragging(true);
      e.preventDefault();
    }
  }, [adjustedLine, computeChartBounds, isNearLine]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    applyDragPosition(e.clientY);
  }, [isDragging, applyDragPosition]);

  const handleMouseUp = useCallback(() => { setIsDragging(false); }, []);
  const handleMouseLeave = useCallback(() => { if (isDragging) setIsDragging(false); }, [isDragging]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (adjustedLine === null) return;
    const bounds = computeChartBounds();
    if (!bounds) return;
    chartBoundsRef.current = bounds;
    setIsDragging(true);
    const touch = e.touches[0];
    const { top, bottom, minY, maxY } = bounds;
    const chartHeight = bottom - top;
    const relativeY = Math.max(0, Math.min(1, (touch.clientY - top) / chartHeight));
    const newValue = maxY - relativeY * (maxY - minY);
    const roundedValue = Math.round(newValue * 2) / 2;
    setAdjustedLine(Math.max(0.5, roundedValue));
  }, [adjustedLine, computeChartBounds]);

  const handleTouchEnd = useCallback(() => { setIsDragging(false); }, []);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      applyDragPosition(e.touches[0].clientY);
    };
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => container.removeEventListener('touchmove', onTouchMove);
  }, [isDragging, applyDragPosition]);

  const handleReset = () => { setAdjustedLine(currentLine ?? null); };

  if (chartData.length === 0) {
    return (
      <div className="terminal-container p-4 mb-3">
        <h3 className="section-title mb-3">GRÁFICO DE DESEMPENHO</h3>
        <div className="h-72 flex items-center justify-center text-terminal-text opacity-50">
          {chartLoading ? (
            <span className="animate-pulse">Carregando...</span>
          ) : (
            <p>Nenhum dado de jogo disponível</p>
          )}
        </div>
      </div>
    );
  }

  const isLineModified = currentLine !== null && adjustedLine !== currentLine;

  // Filters panel content (shared between inline desktop and mobile sheet)
  const renderFiltersContent = () => (
    <div className="space-y-4">
      {onSeasonChange && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-1.5">Temporada</p>
          <div className="flex gap-1 flex-wrap">
            {([
              { value: 'current' as const, label: '25/26' },
              { value: 2024 as const, label: '24/25' },
              { value: 2023 as const, label: '23/24' },
            ]).map(opt => (
              <button key={String(opt.value)} onClick={() => onSeasonChange(opt.value)}
                className={`px-3 py-1 text-xs font-medium rounded border transition-all ${
                  selectedSeason === opt.value
                    ? 'bg-terminal-blue/20 border-terminal-blue text-terminal-blue'
                    : 'border-terminal-blue/30 text-terminal-text hover:border-terminal-blue/50 hover:bg-terminal-blue/5'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-1.5">Últimos jogos</p>
        <div className="flex gap-1 flex-wrap">
          {gameOptions.map(opt => {
            const isDisabled = typeof opt.value === 'number' && opt.value > totalGamesAvailable;
            const isActive = lastNGames === opt.value;
            return (
              <button key={opt.value} onClick={() => !isDisabled && onLastNGamesChange(opt.value)} disabled={isDisabled}
                className={`px-3 py-1 text-xs font-medium rounded border transition-all ${
                  isActive
                    ? 'bg-terminal-blue/20 border-terminal-blue text-terminal-blue'
                    : isDisabled
                      ? 'border-terminal-blue/10 text-terminal-text/30 cursor-not-allowed'
                      : 'border-terminal-blue/30 text-terminal-text hover:border-terminal-blue/50 hover:bg-terminal-blue/5'
                }`}>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-1.5">Local</p>
        <div className="flex gap-1">
          {locationOptions.map(opt => {
            const isActive = homeAway === opt.value;
            const label = opt.value === 'all' ? 'Todos' : opt.value === 'home' ? 'Casa' : 'Fora';
            return (
              <button key={opt.value} onClick={() => onHomeAwayChange(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded border transition-all ${
                  isActive
                    ? 'bg-terminal-blue/20 border-terminal-blue text-terminal-blue'
                    : 'border-terminal-blue/30 text-terminal-text hover:border-terminal-blue/50 hover:bg-terminal-blue/5'
                }`}>
                {opt.icon}<span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-terminal-border-subtle pt-3">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-2">Avançado</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button onClick={() => onB2BChange(!b2bOnly)}
            className={`px-3 py-1 text-xs font-medium rounded border transition-all ${
              b2bOnly
                ? 'bg-terminal-yellow/20 border-terminal-yellow text-terminal-yellow'
                : 'border-terminal-blue/30 text-terminal-text hover:border-terminal-blue/50 hover:bg-terminal-blue/5'
            }`}>B2B</button>
          {nextOpponent && (
            <button onClick={() => onH2HChange(!h2hOnly)}
              className={`px-3 py-1 text-xs font-medium rounded border transition-all ${
                h2hOnly
                  ? 'bg-terminal-blue/20 border-terminal-blue text-terminal-blue'
                  : 'border-terminal-blue/30 text-terminal-text hover:border-terminal-blue/50 hover:bg-terminal-blue/5'
              }`}>vs {nextOpponent}</button>
          )}
        </div>

        {onSeasonTypeChange && selectedSeason !== 'current' && (
          <div className="mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-1.5">Tipo de temporada</p>
            <div className="flex gap-1 flex-wrap">
              {([
                { value: 'all' as const, label: 'Todos' },
                { value: 'regular' as const, label: 'Regular' },
                { value: 'playoffs' as const, label: 'Playoffs' },
                { value: 'playin' as const, label: 'Play-in' },
              ]).map(opt => (
                <button key={opt.value} onClick={() => onSeasonTypeChange(opt.value)}
                  className={`px-3 py-1 text-xs font-medium rounded border transition-all ${
                    seasonType === opt.value
                      ? 'bg-terminal-yellow/20 border-terminal-yellow text-terminal-yellow'
                      : 'border-terminal-blue/30 text-terminal-text hover:border-terminal-blue/50 hover:bg-terminal-blue/5'
                  }`}>{opt.label}</button>
              ))}
            </div>
          </div>
        )}

        {availableTeammates.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-1.5">Companheiros</p>
            <div className="max-h-64 overflow-y-auto minimal-scrollbar border border-terminal-border-subtle rounded">
              {availableTeammates.map(t => {
                const active = teammateFilter?.find(tf => tf.playerId === t.player_id);
                const photoUrl = getPlayerPhotoUrl(t.player_name, teamName);
                const initials = t.player_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const rowHighlight = active?.mode === 'with'
                  ? 'bg-terminal-green/10 border-l-2 border-l-terminal-green'
                  : active?.mode === 'without'
                    ? 'bg-terminal-red/10 border-l-2 border-l-terminal-red'
                    : 'hover:bg-terminal-gray/30';
                return (
                  <div key={t.player_id} className={`flex items-center gap-2 px-2 py-1.5 border-b border-terminal-border-subtle/30 last:border-0 transition-colors ${rowHighlight}`}>
                    <div className="w-7 h-7 rounded-full overflow-hidden bg-terminal-gray border border-terminal-border-subtle shrink-0 flex items-center justify-center">
                      {photoUrl ? (
                        <img src={photoUrl} alt={t.player_name}
                          className="w-full h-full object-cover object-top"
                          onError={(e) => {
                            const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, t.player_name, teamName);
                            if (!didTry) {
                              const el = e.target as HTMLImageElement;
                              el.style.display = 'none';
                              const parent = el.parentElement;
                              if (parent) parent.innerHTML = `<span class="text-[9px] font-bold opacity-60">${initials}</span>`;
                            }
                          }} />
                      ) : (
                        <span className="text-[9px] font-bold opacity-60">{initials}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-terminal-text truncate">{t.player_name}</span>
                        {t.rating_stars > 0 && (
                          <Star className="w-2.5 h-2.5 fill-terminal-yellow text-terminal-yellow shrink-0" />
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => {
                        const entry = { playerId: t.player_id, playerName: t.player_name, mode: 'with' as const };
                        const current = teammateFilter ?? [];
                        const filtered = current.filter(f => f.playerId !== t.player_id);
                        onTeammateFilterChange([...filtered, entry]);
                      }}
                        className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                          active?.mode === 'with'
                            ? 'bg-terminal-green/20 border-terminal-green text-terminal-green'
                            : 'border-terminal-blue/40 text-terminal-blue hover:bg-terminal-blue/10'
                        }`}>COM</button>
                      <button onClick={() => {
                        const entry = { playerId: t.player_id, playerName: t.player_name, mode: 'without' as const };
                        const current = teammateFilter ?? [];
                        const filtered = current.filter(f => f.playerId !== t.player_id);
                        onTeammateFilterChange([...filtered, entry]);
                      }}
                        className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                          active?.mode === 'without'
                            ? 'bg-terminal-red/20 border-terminal-red text-terminal-red'
                            : 'border-terminal-red/40 text-terminal-red hover:bg-terminal-red/10'
                        }`}>SEM</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const activeFilterCount = (lastNGames !== 15 ? 1 : 0)
    + (selectedSeason !== 'current' ? 1 : 0)
    + (homeAway !== 'all' ? 1 : 0)
    + (b2bOnly ? 1 : 0)
    + (h2hOnly ? 1 : 0)
    + (seasonType !== 'all' ? 1 : 0)
    + (teammateFilter && teammateFilter.length > 0 ? 1 : 0);

  return (
    <div className="terminal-container p-4 mb-3">
      {/* Stat type tabs with scroll arrows */}
      <div className="relative mb-3 border-b border-white/10">
        {tabScrollState.canLeft && (
          <button
            type="button"
            onClick={() => scrollTabs('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-7 w-7 flex items-center justify-center rounded-full bg-terminal-dark-gray border border-terminal-border-subtle shadow hover:bg-terminal-gray transition-colors"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="w-4 h-4 text-terminal-text" />
          </button>
        )}
        {tabScrollState.canRight && (
          <button
            type="button"
            onClick={() => scrollTabs('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-7 w-7 flex items-center justify-center rounded-full bg-terminal-dark-gray border border-terminal-border-subtle shadow hover:bg-terminal-gray transition-colors"
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="w-4 h-4 text-terminal-text" />
          </button>
        )}
        <div ref={tabsScrollRef} className="overflow-x-auto -mx-4 px-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex items-end min-w-max gap-0">
            {STAT_TYPES_BASIC.map(stat => (
              <button
                key={stat.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onStatTypeChange(stat.id)}
                className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-all -mb-px ${
                  selectedStatType === stat.id
                    ? 'border-terminal-blue text-terminal-blue'
                    : 'border-transparent text-terminal-text/40 hover:text-terminal-text/70'
                }`}
              >
                {stat.label}
              </button>
            ))}
            <div className="w-px h-4 bg-white/10 mx-2 self-center mb-0.5 -mb-px" />
            {STAT_TYPES_COMBOS.map(stat => (
              <button
                key={stat.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onStatTypeChange(stat.id)}
                className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-all -mb-px ${
                  selectedStatType === stat.id
                    ? 'border-terminal-blue text-terminal-blue'
                    : 'border-transparent text-terminal-text/40 hover:text-terminal-text/70'
                }`}
              >
                {stat.label}
              </button>
            ))}
            <div className="w-px h-4 bg-white/10 mx-2 self-center mb-0.5 -mb-px" />
            {STAT_TYPES_PERIOD.map(stat => (
              <button
                key={stat.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onStatTypeChange(stat.id)}
                className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-all -mb-px ${
                  selectedStatType === stat.id
                    ? 'border-terminal-yellow text-terminal-yellow'
                    : 'border-transparent text-terminal-text/40 hover:text-terminal-text/70'
                }`}
              >
                {stat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 1: title + hit rate */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="section-title">GRÁFICO DE DESEMPENHO</h3>
        {hitRate && (
          <span className={`text-sm font-bold ${parseFloat(hitRate.percentage) >= 50 ? 'text-green-400' : 'text-red-400'}`}>
            TAXA DE ACERTO: {hitRate.percentage}% <span className="text-xs font-normal opacity-70">({hitRate.hits}/{hitRate.total})</span>
          </span>
        )}
      </div>

      {/* Filter bar: single Filtros button + teammate chips inline */}
      <div className="relative mb-3 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFiltersOpen(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-all ${
            filtersOpen || activeFilterCount > 0
              ? 'bg-terminal-blue/20 border-terminal-blue text-terminal-blue'
              : 'border-terminal-blue/30 text-terminal-text hover:border-terminal-blue/50 hover:bg-terminal-blue/5'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="bg-terminal-blue text-terminal-bg rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Active teammate chips with photo */}
        {teammateFilter && teammateFilter.map(f => {
          const photoUrl = getPlayerPhotoUrl(f.playerName, teamName);
          const initials = f.playerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
          const isWith = f.mode === 'with';
          return (
            <div key={f.playerId}
              className={`flex items-center gap-1.5 pl-0.5 pr-1.5 py-0.5 rounded-full border ${
                isWith
                  ? 'bg-terminal-green/10 border-terminal-green/50'
                  : 'bg-terminal-red/10 border-terminal-red/50'
              }`}>
              <div className="w-6 h-6 rounded-full overflow-hidden bg-terminal-gray border border-white/10 shrink-0 flex items-center justify-center">
                {photoUrl ? (
                  <img src={photoUrl} alt={f.playerName}
                    className="w-full h-full object-cover object-top"
                    onError={(e) => {
                      const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, f.playerName, teamName);
                      if (!didTry) {
                        const el = e.target as HTMLImageElement;
                        el.style.display = 'none';
                        const parent = el.parentElement;
                        if (parent) parent.innerHTML = `<span class="text-[8px] font-bold opacity-60">${initials}</span>`;
                      }
                    }}
                  />
                ) : (
                  <span className="text-[8px] font-bold opacity-60">{initials}</span>
                )}
              </div>
              <span className={`text-[11px] font-medium ${isWith ? 'text-terminal-green' : 'text-terminal-red'}`}>
                {isWith ? 'Com' : 'Sem'}: {f.playerName.split(' ').slice(-1)[0]}
              </span>
              <button onClick={() => {
                const updated = teammateFilter.filter(tf => tf.playerId !== f.playerId);
                onTeammateFilterChange(updated.length > 0 ? updated : null);
              }}
                className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 text-white/60 hover:text-white/90 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {/* LINE badge aligned right */}
        {adjustedLine !== null && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0 ml-auto">
            <span className="font-bold text-sm text-white">LINHA: {adjustedLine.toFixed(1)}</span>
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-white/40 hover:text-white/70 transition-colors">
                    <Info className="w-3.5 h-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[180px] text-center">
                  ↕ Arraste a linha para simular diferentes cenários
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
            {isLineModified && (
              <button
                onClick={handleReset}
                className="w-6 h-6 flex items-center justify-center rounded border border-white/50 text-white/70 hover:bg-white/10 transition-colors"
                title={`Resetar para ${currentLine}`}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chart + inline filters panel (desktop) */}
      <div className="relative flex gap-3">
        {(teammateFilterLoading || chartLoading) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <span className="text-sm font-semibold text-terminal-text bg-terminal-dark-gray px-4 py-2 rounded-lg border border-terminal-border-subtle animate-pulse shadow-lg">
              {chartLoading ? 'Carregando...' : 'Recalculando...'}
            </span>
          </div>
        )}
        <div
          ref={chartContainerRef}
          className={`h-72 flex-1 min-w-0 ${isDragging ? 'cursor-grabbing' : adjustedLine !== null ? 'cursor-grab' : ''} ${(teammateFilterLoading || chartLoading) ? 'opacity-30' : ''} transition-opacity duration-200`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ userSelect: 'none', touchAction: 'pan-x' }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3a3d3a" vertical={false} />
              <XAxis
                dataKey="game"
                tick={<CustomXAxisTick data={chartData} />}
                axisLine={{ stroke: '#3a3d3a' }}
                height={50}
                interval={0}
              />
              <YAxis
                domain={[yAxisMin, yAxisMax]}
                tick={{ fill: '#c5d0c0', fontSize: 11 }}
                axisLine={{ stroke: '#3a3d3a' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {chartData.map((entry, index) => {
                  const isOverLine = adjustedLine !== null ? entry.value > adjustedLine : entry.isOver;
                  return (
                    <Cell key={`cell-${index}`} fill={isOverLine ? '#22c55e' : '#ef4444'} />
                  );
                })}
                <LabelList
                  dataKey="value"
                  position="insideBottom"
                  fill="#ffffff"
                  fontSize={11}
                  fontWeight={700}
                  offset={6}
                  formatter={(v: any) => (typeof v === 'number' ? v.toLocaleString('pt-BR') : v)}
                />
              </Bar>
              {adjustedLine !== null && (
                <ReferenceLine
                  y={adjustedLine}
                  stroke={isDragging ? '#ffffff' : isLineModified ? '#e5e5e5' : '#ffffff'}
                  strokeWidth={isDragging ? 3 : 2}
                  style={{ cursor: 'ns-resize' }}
                >
                  <Label value={adjustedLine.toFixed(1)} position="right" fill="#ffffff" fontSize={11} fontWeight={700} />
                </ReferenceLine>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Inline filters panel — desktop only */}
        {filtersOpen && (
          <div className="hidden md:flex w-64 shrink-0 bg-terminal-gray/40 border border-terminal-border rounded-lg max-h-[18rem] flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-terminal-border-subtle bg-terminal-gray/60 rounded-t-lg shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-terminal-text opacity-70 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3 h-3" /> Filtros
              </span>
              <button onClick={() => setFiltersOpen(false)} className="text-white/40 hover:text-white/80">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto minimal-scrollbar p-3">
              {renderFiltersContent()}
            </div>
          </div>
        )}
      </div>

      {/* Mobile filters Sheet (bottom drawer) */}
      <Sheet open={isMobile && filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="bottom"
          className="md:hidden bg-terminal-dark-gray/95 backdrop-blur-sm border-terminal-border max-h-[75vh] p-0 flex flex-col rounded-t-2xl"
        >
          <div className="flex justify-center pt-2 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
          <div className="flex items-center gap-2 px-4 pb-3 shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-terminal-blue" />
            <span className="text-sm font-bold uppercase tracking-wider text-terminal-text">Filtros</span>
          </div>
          <div className="flex-1 overflow-y-auto minimal-scrollbar p-4">
            {renderFiltersContent()}
          </div>
        </SheetContent>
      </Sheet>

      {/* Footer */}
      <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-3">
          <span className="opacity-40">ÚLT. {chartData.length}</span>
          {adjustedLine !== null && (
            <>
              <span className="flex items-center gap-1 text-green-500">
                <span className="w-2 h-2 rounded-sm bg-green-500 shrink-0" /> OVER
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <span className="w-2 h-2 rounded-sm bg-red-500 shrink-0" /> UNDER
              </span>
              <span className="flex items-center gap-1 opacity-60">
                <span className="w-4 h-0.5 bg-white shrink-0" /> LINHA
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 opacity-50 flex-wrap">
          <span>Média <span className="font-medium text-terminal-text opacity-100">{average}</span></span>
          {seasonAvg !== undefined && seasonAvg !== null && (
            <span>Média da Temporada <span className="font-medium text-terminal-text opacity-100">{Number(seasonAvg).toFixed(1)}</span></span>
          )}
          {/* Potential assists (season) — só faz sentido na aba de Assistências.
              balldontlie nao expoe potential_ast game-by-game, entao mostramos
              a media da temporada como info complementar. */}
          {selectedStatType === 'player_assists' && potentialAstSeason != null && (
            <span title="Passes que viraram chances de cesta — independe de o teammate ter convertido. Métrica balldontlie tier season.">
              Potential Ast (season){' '}
              <span className="font-medium text-terminal-text opacity-100">
                {potentialAstSeason.toFixed(1)}
              </span>
              {potentialAstSeasonRank != null && (
                <span className="opacity-70"> · #{potentialAstSeasonRank}</span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
