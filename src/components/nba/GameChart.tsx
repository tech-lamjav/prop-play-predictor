import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, ReferenceLine, Label, Tooltip } from 'recharts';
import { GamePlayerStats, TeamPlayer } from '@/services/nba-data.service';
import { RotateCcw, Info, Globe, Home, Plane, Users, X, ChevronDown, Star } from 'lucide-react';
import { Tooltip as UITooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';
import { TeammateFilter } from '@/components/nba/TeammateFilterBar';
import { STAT_TYPES_BASIC, STAT_TYPES_COMBOS } from '@/components/nba/StatTypeSelector';

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
        {/* Opponent + result row */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-terminal-text">
            {data.opponent}
          </span>
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

        {/* Score */}
        {hasScore && (
          <div className="text-[10px] text-terminal-text/40 mb-2">
            {data.playerScore} – {data.oppScore}
          </div>
        )}

        {/* Stat + line side by side */}
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
  
  return (
    <g transform={`translate(${x},${y})`}>
      <text 
        x={0} 
        y={0} 
        dy={12} 
        textAnchor="middle" 
        fill="#7a9bb5" 
        fontSize={11} 
        fontWeight={600}
      >
        {gameData?.opponent}
      </text>
      <text 
        x={0} 
        y={0} 
        dy={24} 
        textAnchor="middle" 
        fill="#8a9585" 
        fontSize={9}
      >
        {gameData?.date}
      </text>
    </g>
  );
};

export const GameChart: React.FC<GameChartProps> = ({ gameStats, currentLine, seasonAvg, lastNGames, homeAway, onLastNGamesChange, onHomeAwayChange, totalGamesAvailable, teammates = [], currentPlayerId, teamName = '', teammateFilter, onTeammateFilterChange, teammateFilterLoading, selectedStatType, onStatTypeChange, b2bOnly, onB2BChange, h2hOnly, onH2HChange, nextOpponent }) => {
  const [adjustedLine, setAdjustedLine] = useState<number | null>(currentLine ?? null);
  const [isDragging, setIsDragging] = useState(false);
  const [teammateOpen, setTeammateOpen] = useState(false);
  const teammateDropdownRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartBoundsRef = useRef<{ top: number; bottom: number; minY: number; maxY: number } | null>(null);

  // Close teammate dropdown on outside click
  useEffect(() => {
    if (!teammateOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (teammateDropdownRef.current && !teammateDropdownRef.current.contains(e.target as Node)) {
        setTeammateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [teammateOpen]);

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

  // Calcular domain do eixo Y
  const maxValue = Math.max(...chartData.map(d => d.value), adjustedLine || 0);
  const yAxisMax = Math.ceil(maxValue * 1.15);
  const yAxisMin = 0;

  // Shared helper: compute chart bounds and check proximity to line
  const computeChartBounds = useCallback(() => {
    if (!chartContainerRef.current) return null;
    const rect = chartContainerRef.current.getBoundingClientRect();
    return {
      top: rect.top + 5,
      bottom: rect.bottom - 80,
      minY: yAxisMin,
      maxY: yAxisMax,
    };
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

  // Handler para início do drag (mouse)
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

  // Handler para movimento do drag (mouse)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    applyDragPosition(e.clientY);
  }, [isDragging, applyDragPosition]);

  // Handler para fim do drag (mouse)
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handler para mouse sair da área
  const handleMouseLeave = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
    }
  }, [isDragging]);

  // Handler para início do drag (touch)
  // No mobile não exige toque próximo à linha — qualquer toque no gráfico inicia o drag
  // e já posiciona a linha onde o dedo tocou (sem offset inicial)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (adjustedLine === null) return;
    const bounds = computeChartBounds();
    if (!bounds) return;
    chartBoundsRef.current = bounds;
    setIsDragging(true);
    // Move a linha imediatamente para onde o dedo tocou
    const touch = e.touches[0];
    const { top, bottom, minY, maxY } = bounds;
    const chartHeight = bottom - top;
    const relativeY = Math.max(0, Math.min(1, (touch.clientY - top) / chartHeight));
    const newValue = maxY - relativeY * (maxY - minY);
    const roundedValue = Math.round(newValue * 2) / 2;
    setAdjustedLine(Math.max(0.5, roundedValue));
  }, [adjustedLine, computeChartBounds]);

  // Handler para fim do drag (touch)
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // touchmove precisa ser não-passivo para chamar preventDefault() e bloquear scroll
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

  const handleReset = () => {
    setAdjustedLine(currentLine ?? null);
  };

  if (chartData.length === 0) {
    return (
      <div className="terminal-container p-4 mb-3">
        <h3 className="section-title mb-3">GRÁFICO DE DESEMPENHO</h3>
        <div className="h-72 flex items-center justify-center text-terminal-text opacity-50">
          <p>Nenhum dado de jogo disponível</p>
        </div>
      </div>
    );
  }

  const isLineModified = currentLine !== null && adjustedLine !== currentLine;

  return (
    <div className="terminal-container p-4 mb-3">
      {/* Stat type tabs */}
      <div className="overflow-x-auto -mx-4 px-4 border-b border-white/10 mb-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex items-end min-w-max gap-0">
          {STAT_TYPES_BASIC.map(stat => (
            <button
              key={stat.id}
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

      {/* Filters — two rows */}
      {/* Filters: single row on desktop, wraps on mobile */}
      <div className="relative flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Last N */}
          <div className="flex gap-1">
            {gameOptions.map((opt) => {
              const isDisabled = typeof opt.value === 'number' && opt.value > totalGamesAvailable;
              const isActive = lastNGames === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => !isDisabled && onLastNGamesChange(opt.value)}
                  disabled={isDisabled}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded border transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-terminal-green/20 border-terminal-green text-terminal-green'
                      : isDisabled
                      ? 'border-terminal-green/10 text-terminal-text/30 cursor-not-allowed'
                      : 'border-terminal-green/30 text-terminal-text hover:border-terminal-green/50 hover:bg-terminal-green/5'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-terminal-green/20" />

          {/* Home/Away */}
          <div className="flex gap-1">
            {locationOptions.map((opt) => {
              const isActive = homeAway === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => onHomeAwayChange(opt.value)}
                  title={opt.value === 'all' ? 'Todos' : opt.value === 'home' ? 'Casa' : 'Fora'}
                  className={`w-6 h-6 flex items-center justify-center rounded border transition-all ${
                    isActive
                      ? 'bg-terminal-green/20 border-terminal-green text-terminal-green'
                      : 'border-terminal-green/30 text-terminal-text hover:border-terminal-green/50 hover:bg-terminal-green/5'
                  }`}
                >
                  {opt.icon}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-px bg-terminal-green/20" />

          {/* B2B */}
          <button
            onClick={() => onB2BChange(!b2bOnly)}
            title="Apenas jogos back-to-back"
            className={`px-2 py-0.5 text-[11px] font-medium rounded border transition-all ${
              b2bOnly
                ? 'bg-terminal-yellow/20 border-terminal-yellow text-terminal-yellow'
                : 'border-terminal-green/30 text-terminal-text hover:border-terminal-green/50 hover:bg-terminal-green/5'
            }`}
          >
            B2B
          </button>

          {/* H2H */}
          {nextOpponent && (
            <button
              onClick={() => onH2HChange(!h2hOnly)}
              title={`Histórico contra ${nextOpponent}`}
              className={`px-2 py-0.5 text-[11px] font-medium rounded border transition-all ${
                h2hOnly
                  ? 'bg-terminal-blue/20 border-terminal-blue text-terminal-blue'
                  : 'border-terminal-green/30 text-terminal-text hover:border-terminal-green/50 hover:bg-terminal-green/5'
              }`}
            >
              vs {nextOpponent}
            </button>
          )}

          <div className="h-4 w-px bg-terminal-green/20" />

          {/* Teammate filter */}
          {availableTeammates.length > 0 && (() => {
            const TeammateRow = ({ t }: { t: typeof availableTeammates[0] }) => {
              const photoUrl = getPlayerPhotoUrl(t.player_name, teamName);
              const initials = t.player_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-terminal-gray/40 border-b border-terminal-border-subtle/30 last:border-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-terminal-gray border border-terminal-border-subtle shrink-0 flex items-center justify-center">
                    {photoUrl ? (
                      <img src={photoUrl} alt={t.player_name} data-player-photo-index="0"
                        className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, t.player_name, teamName);
                          if (!didTry) {
                            const el = e.target as HTMLImageElement;
                            el.style.display = 'none';
                            const parent = el.parentElement;
                            if (parent) parent.innerHTML = `<span class="text-[9px] font-bold text-terminal-text opacity-60">${initials}</span>`;
                          }
                        }}
                      />
                    ) : (
                      <span className="text-[9px] font-bold text-terminal-text opacity-60">{initials}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-terminal-text truncate">{t.player_name}</span>
                      {t.rating_stars > 0 && Array.from({ length: t.rating_stars }).map((_, i) => (
                        <Star key={i} className="w-2.5 h-2.5 fill-terminal-yellow text-terminal-yellow shrink-0" />
                      ))}
                    </div>
                    <div className="text-[10px] opacity-50 flex items-center gap-1">
                      <span>{t.position}</span>
                      {t.current_status && t.current_status.toLowerCase() !== 'active' && (
                        <span className="text-terminal-red">{t.current_status}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => { onTeammateFilterChange({ playerId: t.player_id, playerName: t.player_name, mode: 'with' }); setTeammateOpen(false); }}
                      className="px-2.5 py-1 text-[11px] rounded border border-terminal-green/40 text-terminal-green hover:bg-terminal-green/15 transition-colors">
                      COM
                    </button>
                    <button onClick={() => { onTeammateFilterChange({ playerId: t.player_id, playerName: t.player_name, mode: 'without' }); setTeammateOpen(false); }}
                      className="px-2.5 py-1 text-[11px] rounded border border-terminal-red/40 text-terminal-red hover:bg-terminal-red/15 transition-colors">
                      SEM
                    </button>
                  </div>
                </div>
              );
            };

            return (
              <div className="relative" ref={teammateDropdownRef}>
                {/* Button / active badge */}
                {teammateFilter ? (
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
                      teammateFilter.mode === 'with'
                        ? 'bg-terminal-green/15 border-terminal-green/50 text-terminal-green'
                        : 'bg-terminal-red/15 border-terminal-red/50 text-terminal-red'
                    }`}>
                      {teammateFilter.mode === 'with' ? 'COM' : 'SEM'} {teammateFilter.playerName.split(' ').pop()}
                    </span>
                    <button onClick={() => onTeammateFilterChange(null)}
                      className="w-5 h-5 flex items-center justify-center rounded border border-white/20 text-white/40 hover:text-white/80 hover:border-white/40 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setTeammateOpen(v => !v)} disabled={teammateFilterLoading}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border border-terminal-green/30 text-terminal-text hover:border-terminal-green/50 hover:bg-terminal-green/5 transition-all disabled:opacity-40">
                    <Users className="w-3 h-3" />
                    <span>Companheiro</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${teammateOpen ? 'rotate-180' : ''}`} />
                  </button>
                )}

                {teammateOpen && (
                  <>
                    {/* Mobile: backdrop + centered modal */}
                    <div className="sm:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setTeammateOpen(false)} />
                    <div className="sm:hidden fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-terminal-dark-gray border border-terminal-border-subtle rounded-xl shadow-2xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border-subtle/30">
                        <span className="text-[11px] font-bold text-terminal-text uppercase tracking-wider">Filtrar por companheiro</span>
                        <button onClick={() => setTeammateOpen(false)} className="text-white/40 hover:text-white/80 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="max-h-[60vh] overflow-y-auto">
                        {availableTeammates.map(t => <TeammateRow key={t.player_id} t={t} />)}
                      </div>
                    </div>

                    {/* Desktop: dropdown */}
                    <div className="hidden sm:block absolute top-full right-0 mt-1 z-50 bg-terminal-dark-gray border border-terminal-border-subtle rounded shadow-lg min-w-[280px] max-h-[260px] overflow-y-auto
                      [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent
                      [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full
                      [&::-webkit-scrollbar-thumb:hover]:bg-white/40">
                      {availableTeammates.map(t => <TeammateRow key={t.player_id} t={t} />)}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>

        {/* LINE — hidden on mobile */}
        {adjustedLine !== null && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
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

      <div
        ref={chartContainerRef}
        className={`h-72 ${isDragging ? 'cursor-grabbing' : adjustedLine !== null ? 'cursor-grab' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ userSelect: 'none', touchAction: 'pan-x' }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData} 
            margin={{
              top: 5,
              right: 30,
              left: -20,
              bottom: 5
            }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#3a3d3a" 
              vertical={false} 
            />
            <XAxis 
              dataKey="game" 
              tick={<CustomXAxisTick data={chartData} />} 
              axisLine={{
                stroke: '#3a3d3a'
              }} 
              height={50} 
            />
            <YAxis 
              domain={[yAxisMin, yAxisMax]}
              tick={{
                fill: '#c5d0c0',
                fontSize: 11
              }} 
              axisLine={{
                stroke: '#3a3d3a'
              }} 
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => {
                const isOverLine = adjustedLine !== null ? entry.value > adjustedLine : entry.isOver;
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={isOverLine ? '#22c55e' : '#ef4444'} 
                  />
                );
              })}
            </Bar>
            {adjustedLine !== null && (
              <ReferenceLine 
                y={adjustedLine} 
                stroke={isDragging ? '#ffffff' : isLineModified ? '#e5e5e5' : '#ffffff'}
                strokeWidth={isDragging ? 3 : 2}
                style={{ cursor: 'ns-resize' }}
              >
                <Label 
                  value={adjustedLine.toFixed(1)} 
                  position="right" 
                  fill="#ffffff"
                  fontSize={11}
                  fontWeight={700}
                />
              </ReferenceLine>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Footer */}
      <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px]">
        {/* Legenda */}
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
        {/* Médias */}
        <div className="flex items-center gap-3 opacity-50">
          <span>Média <span className="font-medium text-terminal-text opacity-100">{average}</span></span>
          {seasonAvg !== undefined && seasonAvg !== null && (
            <span>Média da Temporada <span className="font-medium text-terminal-text opacity-100">{Number(seasonAvg).toFixed(1)}</span></span>
          )}
        </div>
      </div>
    </div>
  );
};
