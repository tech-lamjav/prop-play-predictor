import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnalyticsNav from '@/components/AnalyticsNav';
import { nbaDataService, Game } from '@/services/nba-data.service';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap, BarChart3, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2, AlertCircle, FileText } from 'lucide-react';
import { InjuryReportModal } from '@/components/nba/InjuryReportModal';
import { useSubscription } from '@/hooks/use-subscription';
import { FreePropCard } from '@/components/nba/FreePropCard';
import { getTeamLogoUrl } from '@/utils/team-logos';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

interface Filters {
  date: string;
}

const ITEMS_PER_PAGE = 12;
const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

const getSaoPauloTodayISO = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
};

const toSaoPauloISO = (date: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

// Add N days to an ISO date string (timezone-safe)
const addDaysToISO = (isoDate: string, days: number): string => {
  const d = parseGameDate(isoDate);
  const ts = d.getTime() + days * 24 * 60 * 60 * 1000;
  return toSaoPauloISO(new Date(ts));
};

// Helper to parse date without timezone issues
const parseGameDate = (dateString: string): Date => {
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return new Date(`${dateString}T12:00:00-03:00`);
  }
  return new Date(dateString);
};

// Format date for display (day of week + date)
const formatGameDate = (dateString: string): string => {
  const date = parseGameDate(dateString);
  return date.toLocaleDateString('pt-BR', {
    timeZone: SAO_PAULO_TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
};

// Check if game is finished
const isGameFinished = (game: Game): boolean => {
  return game.winner_team_id !== null;
};

// Componente para mostrar últimos resultados (V/D)
const LastResults: React.FC<{ results: string; teamAbbr: string }> = ({ results }) => {
  if (!results) return null;

  const cleanResults = results.replace(/\s/g, '');
  // Reverse so oldest is on left, most recent on right (natural timeline direction)
  const last3 = cleanResults.slice(0, 3).split('').reverse();

  return (
    <div className="flex items-center gap-0.5">
      {last3.map((result, idx) => {
        const isWin = result === 'V' || result === 'W';
        // idx 0 = oldest, idx 2 = most recent — progressive opacity
        const opacities = ['opacity-40', 'opacity-70', 'opacity-100'];
        const opacity = opacities[idx] ?? 'opacity-100';
        return (
          <span
            key={idx}
            title={isWin ? 'Vitória' : 'Derrota'}
            className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded cursor-default ${opacity} ${
              isWin
                ? 'bg-green-500/20 text-green-500 border border-green-500/30'
                : 'bg-red-500/20 text-red-500 border border-red-500/30'
            }`}
          >
            {isWin ? 'V' : 'D'}
          </span>
        );
      })}
    </div>
  );
};

// Cache: date → games list (persists across navigations, shared with GameDetail)
export const gamesCache = new Map<string, Game[]>();
let lastResolvedDate: string | null = null;

export default function Games() {
  const navigate = useNavigate();
  const { isPremium } = useSubscription();
  const [games, setGames] = useState<Game[]>(() => {
    if (lastResolvedDate && gamesCache.has(lastResolvedDate)) {
      return gamesCache.get(lastResolvedDate)!;
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(!lastResolvedDate);
  const [error, setError] = useState<string | null>(null);

  const today = getSaoPauloTodayISO();
  const [filters, setFilters] = useState<Filters>({
    date: lastResolvedDate || today,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [sidebarCalendarOpen, setSidebarCalendarOpen] = useState(false);
  const [injuryReportOpen, setInjuryReportOpen] = useState(false);
  const hasMounted = useRef(false);

  const loadGames = async (overrideDate?: string) => {
    const date = overrideDate ?? filters.date;
    const cacheKey = `${date}`;
    const cached = gamesCache.get(cacheKey);
    if (cached) {
      setGames(cached);
      setCurrentPage(1);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await nbaDataService.getGames({
        gameDate: date || undefined,
      });

      setGames(data);
      gamesCache.set(cacheKey, data);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error loading games', err);
      setError('Não foi possível carregar os jogos.');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateDate = (days: number) => {
    const newDate = addDaysToISO(filters.date, days);
    setFilters((prev) => ({ ...prev, date: newDate }));
    loadGames(newDate);
  };

  // Initial load: use cache or find first date with games
  useEffect(() => {
    if (lastResolvedDate && games.length > 0) {
      hasMounted.current = true;
      return;
    }

    let cancelled = false;
    const maxDaysAhead = 14;

    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);
        let dateToUse = getSaoPauloTodayISO();
        let data = await nbaDataService.getGames({ gameDate: dateToUse });

        for (let i = 1; data.length === 0 && i <= maxDaysAhead; i++) {
          if (cancelled) return;
          dateToUse = addDaysToISO(getSaoPauloTodayISO(), i);
          data = await nbaDataService.getGames({ gameDate: dateToUse });
        }

        if (cancelled) return;
        setGames(data);
        setFilters((prev) => ({ ...prev, date: dateToUse }));
        setCurrentPage(1);
        lastResolvedDate = dateToUse;
        gamesCache.set(dateToUse, data);
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading games', err);
          setError('Não foi possível carregar os jogos.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredGames = useMemo(() => {
    return [...games].sort((a, b) => {
      const END_OF_DAY_MS = 23 * 60 * 60 * 1000;
      const dateA = a.game_datetime_brasilia
        ? new Date(a.game_datetime_brasilia).getTime()
        : parseGameDate(a.game_date || '').getTime() + END_OF_DAY_MS;
      const dateB = b.game_datetime_brasilia
        ? new Date(b.game_datetime_brasilia).getTime()
        : parseGameDate(b.game_date || '').getTime() + END_OF_DAY_MS;
      const dateCompare = dateA - dateB;
      if (dateCompare !== 0) return dateCompare;
      return a.home_team_name.localeCompare(b.home_team_name);
    });
  }, [games]);

  const totalPages = Math.ceil(filteredGames.length / ITEMS_PER_PAGE);
  const paginatedGames = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredGames.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredGames, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const dateFormatted = parseGameDate(filters.date).toLocaleDateString('pt-BR', {
    timeZone: SAO_PAULO_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const makeCalendarNode = (onClose: () => void) => (
    <Calendar
      mode="single"
      selected={parseGameDate(filters.date)}
      onSelect={(date) => {
        if (!date) return;
        const newDate = toSaoPauloISO(date);
        setFilters((prev) => ({ ...prev, date: newDate }));
        onClose();
        loadGames(newDate);
      }}
      initialFocus
      className="bg-terminal-dark-gray text-terminal-text"
      classNames={{
        caption_label: 'text-sm font-semibold text-terminal-text',
        head_cell: 'text-terminal-text/60 rounded-md w-9 font-medium text-[0.75rem]',
        day: 'h-9 w-9 p-0 font-normal text-terminal-text hover:bg-terminal-gray/40',
        day_selected: 'bg-terminal-green text-terminal-black hover:bg-terminal-green/90',
        day_today: 'bg-terminal-gray text-terminal-text',
        nav_button: 'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 border border-terminal-border-subtle',
      }}
    />
  );

  return (
    <div className="min-h-screen bg-terminal-black text-terminal-text font-mono">
      <AnalyticsNav />

      <main className="container mx-auto px-4 py-4">
        {error && (
          <div className="bg-terminal-dark-gray border border-terminal-red p-3 rounded text-terminal-red text-sm mb-4">
            {error}
          </div>
        )}

        {/* Mobile: FreePropCard + Injury Report button */}
        <div className="lg:hidden mb-4 flex flex-col gap-3">
          <FreePropCard layout="vertical" />
          <button
            onClick={() => setInjuryReportOpen(true)}
            className="w-full flex items-center justify-between gap-3 bg-terminal-yellow/5 border border-terminal-yellow/30 rounded-lg px-3 py-3 hover:bg-terminal-yellow/10 hover:border-terminal-yellow/50 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-terminal-yellow flex-shrink-0" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-semibold text-terminal-yellow font-mono leading-tight">Injury Report</span>
                <span className="text-[11px] text-terminal-text/40 font-mono leading-tight">lesões dos jogos de hoje</span>
              </div>
            </div>
            <span className="text-[10px] text-terminal-yellow/60 font-mono group-hover:text-terminal-yellow transition-colors">→</span>
          </button>
          <button
            onClick={() => navigate('/report')}
            className="w-full flex items-center justify-between gap-3 bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg px-3 py-3 hover:border-terminal-green/40 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-terminal-green flex-shrink-0" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-semibold text-terminal-green font-mono leading-tight">Relatório do Dia</span>
                <span className="text-[11px] text-terminal-text/40 font-mono leading-tight">veja as melhores props</span>
              </div>
            </div>
            <span className="text-[10px] text-terminal-green/60 font-mono group-hover:text-terminal-green transition-colors">→</span>
          </button>
        </div>

        {/* Desktop 2-column layout */}
        <div className="lg:flex lg:gap-4 lg:items-start">

          {/* ── Games Column ── */}
          <div className="lg:flex-1 min-w-0 bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg p-3">

            {/* Games column title */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] uppercase tracking-widest text-terminal-text opacity-70 font-mono flex items-center gap-2">
                Jogos NBA
                <span className="hidden lg:contents">
                  <span className="opacity-40">·</span>
                  <span className="normal-case tracking-normal">
                    {parseGameDate(filters.date).toLocaleDateString('pt-BR', {
                      timeZone: SAO_PAULO_TIMEZONE,
                      weekday: 'long',
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </span>
                </span>
              </h2>
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-terminal-green opacity-60" />
              ) : filteredGames.length > 0 ? (
                <span className="text-[10px] text-terminal-text opacity-30 font-mono">
                  {filteredGames.length} jogos
                </span>
              ) : null}
            </div>

            {/* Mobile: date nav (hidden on desktop — lives in sidebar) */}
            <div className="lg:hidden mb-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => navigateDate(-1)}
                  className="terminal-button h-8 w-8 p-0 flex-shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="terminal-input flex-1 h-8 text-sm justify-center border-terminal-border-subtle bg-terminal-gray/30 hover:bg-terminal-gray/40"
                    >
                      {isLoading
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin opacity-70" />
                        : <CalendarIcon className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                      }
                      {dateFormatted}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-terminal-dark-gray border-terminal-border-subtle" align="center">
                    {makeCalendarNode(() => setCalendarOpen(false))}
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => navigateDate(1)}
                  className="terminal-button h-8 w-8 p-0 flex-shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Games list */}
            {isLoading ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={`skel-game-${i}`} className="bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <Skeleton className="w-8 h-8 rounded-full bg-terminal-gray" />
                        <Skeleton className="h-4 w-28 bg-terminal-gray" />
                      </div>
                      <Skeleton className="h-3 w-16 bg-terminal-gray mx-2" />
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <Skeleton className="h-4 w-28 bg-terminal-gray" />
                        <Skeleton className="w-8 h-8 rounded-full bg-terminal-gray" />
                      </div>
                    </div>
                    <div className="flex justify-between mt-2 pt-2 border-t border-terminal-border-subtle">
                      <Skeleton className="h-3 w-16 bg-terminal-gray" />
                      <Skeleton className="h-3 w-16 bg-terminal-gray" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredGames.length === 0 ? (
              <div className="bg-terminal-dark-gray border border-terminal-border-subtle p-6 rounded text-center text-terminal-text opacity-60">
                <p className="text-sm mb-2">NENHUM JOGO ENCONTRADO</p>
                <p className="text-xs opacity-60">Tente ajustar os filtros</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                  {paginatedGames.map((game) => {
                    const finished = isGameFinished(game);
                    const dateDisplay = formatGameDate(game.game_date);
                    const homeWon = finished && game.winner_team_id === game.home_team_id;
                    const visitorWon = finished && game.winner_team_id === game.visitor_team_id;
                    const winnerAbbr = homeWon
                      ? game.home_team_abbreviation
                      : visitorWon
                        ? game.visitor_team_abbreviation
                        : null;

                    return (
                      <div
                        key={game.game_id}
                        onClick={() => navigate(`/game/${game.game_id}?date=${game.game_date}`)}
                        className="bg-terminal-gray border border-terminal-border-subtle rounded-lg p-2.5 hover:border-terminal-green/50 transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          {/* Home Team */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                              <img
                                src={getTeamLogoUrl(game.home_team_name)}
                                alt={game.home_team_abbreviation}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `<span class="text-[10px] font-bold text-terminal-text">${game.home_team_abbreviation}</span>`;
                                  }
                                }}
                              />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-xs font-bold leading-tight break-words ${homeWon ? 'text-terminal-green' : 'text-terminal-text'}`}>
                                  {game.home_team_name}
                                </span>
                                {game.home_team_is_b2b_game && (
                                  <span className="text-[8px] bg-terminal-yellow/20 text-terminal-yellow px-1 rounded flex-shrink-0">B2B</span>
                                )}
                              </div>
                              {finished && (
                                <span className={`text-sm font-bold tabular-nums ${homeWon ? 'text-terminal-green' : 'text-terminal-text opacity-50'}`}>
                                  {game.home_team_score}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Center: Date (desktop only), Time and FT */}
                          <div className="flex flex-col items-center gap-0.5 px-2 flex-shrink-0">
                            <div className="hidden lg:block text-[9px] text-terminal-text opacity-50 whitespace-nowrap">
                              {dateDisplay}
                            </div>
                            {game.game_datetime_brasilia && !finished && (
                              <div className="text-[11px] text-terminal-green opacity-100 whitespace-nowrap font-mono">
                                {new Date(game.game_datetime_brasilia).toLocaleTimeString('pt-BR', {
                                  timeZone: SAO_PAULO_TIMEZONE,
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            )}
                            {finished && (
                              <span className="text-[10px] bg-terminal-gray/30 text-terminal-text px-1.5 py-0.5 rounded">
                                FT
                              </span>
                            )}
                            {finished && winnerAbbr && (
                              <span className="text-[10px] bg-terminal-green/20 text-terminal-green px-1.5 py-0.5 rounded border border-terminal-green/30">
                                {winnerAbbr} VENCEU
                              </span>
                            )}
                          </div>

                          {/* Visitor Team */}
                          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                            <div className="flex flex-col items-end min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                {game.visitor_team_is_b2b_game && (
                                  <span className="text-[8px] bg-terminal-yellow/20 text-terminal-yellow px-1 rounded flex-shrink-0">B2B</span>
                                )}
                                <span className={`text-xs font-bold leading-tight break-words text-right ${visitorWon ? 'text-terminal-green' : 'text-terminal-text'}`}>
                                  {game.visitor_team_name}
                                </span>
                              </div>
                              {finished && (
                                <span className={`text-sm font-bold tabular-nums ${visitorWon ? 'text-terminal-green' : 'text-terminal-text opacity-50'}`}>
                                  {game.visitor_team_score}
                                </span>
                              )}
                            </div>
                            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                              <img
                                src={getTeamLogoUrl(game.visitor_team_name)}
                                alt={game.visitor_team_abbreviation}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `<span class="text-[10px] font-bold text-terminal-text">${game.visitor_team_abbreviation}</span>`;
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Last 5 Results */}
                        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-terminal-border">
                          <LastResults results={game.home_team_last_five || ''} teamAbbr={game.home_team_abbreviation} />
                          <LastResults results={game.visitor_team_last_five || ''} teamAbbr={game.visitor_team_abbreviation} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="terminal-button h-8 w-8 p-0"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          if (page === 1 || page === totalPages) return true;
                          if (Math.abs(page - currentPage) <= 1) return true;
                          return false;
                        })
                        .map((page, idx, arr) => {
                          const prevPage = arr[idx - 1];
                          const showEllipsis = prevPage && page - prevPage > 1;
                          return (
                            <React.Fragment key={page}>
                              {showEllipsis && (
                                <span className="text-terminal-text opacity-30 px-1">...</span>
                              )}
                              <Button
                                variant={currentPage === page ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handlePageChange(page)}
                                className={`h-8 w-8 p-0 text-xs ${
                                  currentPage === page
                                    ? 'bg-terminal-green text-terminal-black'
                                    : 'terminal-button'
                                }`}
                              >
                                {page}
                              </Button>
                            </React.Fragment>
                          );
                        })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="terminal-button h-8 w-8 p-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>

                    <span className="text-[10px] text-terminal-text opacity-50 ml-2">
                      {currentPage}/{totalPages}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Sidebar (desktop only) ── */}
          <div className="hidden lg:flex lg:flex-col w-80 gap-3 flex-shrink-0 min-w-0">

            {/* Date nav — arrows + clickable date opens calendar popover */}
            <div className="bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg p-3 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => navigateDate(-1)}
                  className="terminal-button h-7 w-7 p-0 flex-shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>

                <Popover open={sidebarCalendarOpen} onOpenChange={setSidebarCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 text-sm text-terminal-text hover:text-terminal-green transition-colors font-mono cursor-pointer px-2 py-1 rounded hover:bg-terminal-gray/30">
                      {isLoading && <Loader2 className="w-3 h-3 animate-spin text-terminal-green opacity-70" />}
                      {dateFormatted}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-terminal-dark-gray border-terminal-border-subtle" align="center">
                    {makeCalendarNode(() => setSidebarCalendarOpen(false))}
                  </PopoverContent>
                </Popover>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  onClick={() => navigateDate(1)}
                  className="terminal-button h-7 w-7 p-0 flex-shrink-0"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* FreePropCard — vertical layout respects sidebar width */}
            <div className="min-w-0 overflow-hidden">
              <FreePropCard layout="vertical" />
            </div>

            {/* Injury Report button */}
            <button
              onClick={() => setInjuryReportOpen(true)}
              className="w-full flex items-center justify-between gap-3 bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg px-3 py-3 hover:border-terminal-yellow/40 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-terminal-yellow flex-shrink-0" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold text-terminal-yellow font-mono leading-tight">
                    Injury Report
                  </span>
                  <span className="text-[11px] text-terminal-text/40 font-mono leading-tight">
                    lesões dos jogos de hoje
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-terminal-yellow/60 font-mono group-hover:text-terminal-yellow transition-colors">→</span>
            </button>

            {/* Reports button */}
            <button
              onClick={() => navigate('/report')}
              className="w-full flex items-center justify-between gap-3 bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg px-3 py-3 hover:border-terminal-green/40 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-terminal-green flex-shrink-0" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold text-terminal-green font-mono leading-tight">
                    Relatório do Dia
                  </span>
                  <span className="text-[11px] text-terminal-text/40 font-mono leading-tight">
                    veja as melhores props
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-terminal-green/60 font-mono group-hover:text-terminal-green transition-colors">→</span>
            </button>

          </div>

        </div>

        {/* Conversion Banner */}
        {!isPremium && (
          <section className="bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg p-4 mt-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-terminal-green/20 border border-terminal-green rounded-full flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-terminal-green" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-terminal-green">
                    Desbloqueie Análises Completas
                  </h2>
                  <p className="text-[10px] text-terminal-text opacity-70">
                    Acesse estatísticas avançadas de todos os times
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate('/paywall-platform')}
                size="sm"
                className="terminal-button bg-terminal-green hover:bg-terminal-green/80 text-terminal-black font-bold"
              >
                <Zap className="w-4 h-4 mr-1" />
                ASSINAR
              </Button>
            </div>
          </section>
        )}
      </main>

      <InjuryReportModal
        open={injuryReportOpen}
        onClose={() => setInjuryReportOpen(false)}
        games={filteredGames}
      />
    </div>
  );
}
