import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  FileText,
} from 'lucide-react';
import AnalyticsNav from '@/components/AnalyticsNav';
import { InjuryReportModal } from '@/components/nba/InjuryReportModal';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { nbaDataService, type Game } from '@/services/nba-data.service';
import { useAnalise360Data } from '@/hooks/use-analise360';
import { getPlayerPhotoUrl, getTeamLogoUrl, teamAbbrToName, tryNextPlayerPhotoUrl } from '@/utils/team-logos';

// ─── Constants ───────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 12;
const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

const STAT_LABEL_PT: Record<string, string> = {
  player_points: 'Pontos',
  player_assists: 'Assistências',
  player_rebounds: 'Rebotes',
  player_points_rebounds_assists: 'PRA',
};

// Cache compartilhado entre Games e GameDetail
export const gamesCache = new Map<string, Game[]>();
let lastResolvedDate: string | null = null;

// ─── Date helpers ────────────────────────────────────────────────────────

const getSaoPauloTodayISO = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === 'year')?.value ?? '';
  const m = parts.find(p => p.type === 'month')?.value ?? '';
  const d = parts.find(p => p.type === 'day')?.value ?? '';
  return `${y}-${m}-${d}`;
};

const toSaoPauloISO = (date: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);

const parseGameDate = (dateString: string): Date => {
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return new Date(`${dateString}T12:00:00-03:00`);
  }
  return new Date(dateString);
};

const addDaysToISO = (isoDate: string, days: number): string => {
  const d = parseGameDate(isoDate);
  const ts = d.getTime() + days * 24 * 60 * 60 * 1000;
  return toSaoPauloISO(new Date(ts));
};

function formatHeaderDateBR(iso: string): { weekday: string; dayMonth: string; full: string } {
  const d = parseGameDate(iso);
  const weekday = d.toLocaleDateString('pt-BR', { timeZone: SAO_PAULO_TIMEZONE, weekday: 'long' });
  const dayMonth = d.toLocaleDateString('pt-BR', { timeZone: SAO_PAULO_TIMEZONE, day: '2-digit', month: 'long' });
  const full = d.toLocaleDateString('pt-BR', { timeZone: SAO_PAULO_TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
  return { weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1), dayMonth, full };
}

function formatShortDateBR(iso: string): string {
  // "SEG., 30 DE MAR."
  const d = parseGameDate(iso);
  const weekday = d.toLocaleDateString('pt-BR', { timeZone: SAO_PAULO_TIMEZONE, weekday: 'short' }).replace('.', '');
  const day = d.toLocaleDateString('pt-BR', { timeZone: SAO_PAULO_TIMEZONE, day: '2-digit' });
  const month = d.toLocaleDateString('pt-BR', { timeZone: SAO_PAULO_TIMEZONE, month: 'short' }).replace('.', '');
  return `${weekday.toUpperCase()}., ${day} DE ${month.toUpperCase()}.`;
}

const isGameFinished = (g: Game) => g.winner_team_id !== null;

function timeUntil(gameDateTime: string): string {
  const now = Date.now();
  const target = new Date(gameDateTime).getTime();
  const diffMs = target - now;
  if (diffMs <= 0) return '';
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours >= 24) return `EM ${Math.floor(hours / 24)}D`;
  if (hours > 0) return `EM ${hours}H ${minutes}MIN`;
  return `EM ${minutes}MIN`;
}

// ─── LastResults V/D ─────────────────────────────────────────────────────

function LastResults({ results }: { results: string | null }) {
  if (!results) return null;
  const last3 = results.replace(/\s/g, '').slice(0, 3).split('').reverse();
  return (
    <div className="flex items-center gap-0.5">
      {last3.map((r, i) => {
        const isWin = r === 'V' || r === 'W';
        const opacity = ['opacity-40', 'opacity-70', 'opacity-100'][i] ?? 'opacity-100';
        return (
          <span
            key={i}
            title={isWin ? 'Vitória' : 'Derrota'}
            className={`w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded ${opacity} ${
              isWin
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : 'bg-status-danger/10 text-status-danger border border-status-danger/20'
            }`}
          >
            {isWin ? 'V' : 'D'}
          </span>
        );
      })}
    </div>
  );
}

// ─── Game Card (light) ───────────────────────────────────────────────────

function GameCard({ game, onClick }: { game: Game; onClick: () => void }) {
  const finished = isGameFinished(game);
  const homeWon = finished && game.winner_team_id === game.home_team_id;
  const visitorWon = finished && game.winner_team_id === game.visitor_team_id;
  const winnerAbbr = homeWon
    ? game.home_team_abbreviation
    : visitorWon
    ? game.visitor_team_abbreviation
    : null;

  const shortDate = formatShortDateBR(game.game_date);
  const time = game.game_datetime_brasilia
    ? new Date(game.game_datetime_brasilia).toLocaleTimeString('pt-BR', {
        timeZone: SAO_PAULO_TIMEZONE, hour: '2-digit', minute: '2-digit',
      })
    : null;
  const countdown = !finished && game.game_datetime_brasilia ? timeUntil(game.game_datetime_brasilia) : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white border border-line rounded-xl overflow-hidden hover:border-forest/30 hover:shadow-[0_2px_8px_-3px_rgba(10,61,46,0.08)] transition-all group"
    >
      {/* Top strip — date + status badge */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-line bg-canvas-2/50">
        <span className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">
          {shortDate}{finished ? ' · FT' : ''}
        </span>
        {finished && winnerAbbr ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-forest text-white uppercase tracking-wide">
            {winnerAbbr} venceu
          </span>
        ) : countdown ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide">
            {countdown}
          </span>
        ) : (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-ink-3 text-ink-2 uppercase tracking-wide">
            {time ?? '—'}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-3">
          {/* Home */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              <img
                src={getTeamLogoUrl(game.home_team_name)}
                alt={game.home_team_abbreviation}
                className="w-full h-full object-contain"
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  t.style.display = 'none';
                  if (t.parentElement) {
                    t.parentElement.innerHTML = `<span class="text-[10px] font-bold text-ink-2">${game.home_team_abbreviation}</span>`;
                  }
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-[13px] font-semibold truncate ${homeWon ? 'text-forest' : 'text-ink'}`}>
                  {game.home_team_abbreviation}
                </span>
                {game.home_team_is_b2b_game && (
                  <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded shrink-0">B2B</span>
                )}
              </div>
              <div className="mt-1">
                <LastResults results={game.home_team_last_five} />
              </div>
            </div>
          </div>

          {/* Center: score or time */}
          <div className="text-center px-2 shrink-0">
            {finished ? (
              <div className="flex items-baseline gap-1.5">
                <span className={`text-[20px] font-semibold tabular-nums ${homeWon ? 'text-ink' : 'text-ink-2'}`}>
                  {game.home_team_score}
                </span>
                <span className="text-ink-2 text-[12px]">·</span>
                <span className={`text-[20px] font-semibold tabular-nums ${visitorWon ? 'text-ink' : 'text-ink-2'}`}>
                  {game.visitor_team_score}
                </span>
              </div>
            ) : (
              <div className="text-[14px] font-semibold text-ink tabular-nums">
                {time ?? 'vs'}
              </div>
            )}
          </div>

          {/* Visitor */}
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            <div className="min-w-0 text-right">
              <div className="flex items-center justify-end gap-1.5">
                {game.visitor_team_is_b2b_game && (
                  <span className="text-[8px] bg-amber-100 text-amber-700 px-1 rounded shrink-0">B2B</span>
                )}
                <span className={`text-[13px] font-semibold truncate ${visitorWon ? 'text-forest' : 'text-ink'}`}>
                  {game.visitor_team_abbreviation}
                </span>
              </div>
              <div className="mt-1 flex justify-end">
                <LastResults results={game.visitor_team_last_five} />
              </div>
            </div>
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              <img
                src={getTeamLogoUrl(game.visitor_team_name)}
                alt={game.visitor_team_abbreviation}
                className="w-full h-full object-contain"
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  t.style.display = 'none';
                  if (t.parentElement) {
                    t.parentElement.innerHTML = `<span class="text-[10px] font-bold text-ink-2">${game.visitor_team_abbreviation}</span>`;
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Opportunity of the day (sidebar) ────────────────────────────────────

function OpportunityOfDayCard() {
  const navigate = useNavigate();
  const { data } = useAnalise360Data();
  const opps = data?.opportunities ?? [];

  const top = useMemo(() => {
    if (opps.length === 0) return null;
    // Pega a oportunidade com maior score (fallback gap_pct)
    return [...opps].sort((a, b) => {
      const sa = a.score ?? a.gap_pct ?? 0;
      const sb = b.score ?? b.gap_pct ?? 0;
      return sb - sa;
    })[0];
  }, [opps]);

  if (!top) return null;
  const triggerLast = top.trigger_name.split(' ').slice(-1)[0];
  const isPos = top.gap_pct > 0;

  return (
    <div className="bg-white border border-line rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">Oportunidade do dia</span>
        <span className="text-[10px] text-ink-2">1/1</span>
      </div>

      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-ink-3 border border-line shrink-0 flex items-center justify-center">
          <img
            src={getPlayerPhotoUrl(top.backup_player_name, top.trigger_team_abbr)}
            alt={top.backup_player_name}
            className="w-full h-full object-cover object-top"
            loading="lazy"
            onError={(e) => {
              const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, top.backup_player_name, top.trigger_team_abbr);
              if (!didTry) {
                const el = e.target as HTMLImageElement;
                el.style.display = 'none';
                if (el.parentElement) {
                  const initials = top.backup_player_name.split(' ').map(n => n[0]).join('').slice(0, 2);
                  el.parentElement.innerHTML = `<span class="text-[10px] font-semibold text-ink-2">${initials}</span>`;
                }
              }
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[14px] font-semibold text-ink truncate">{top.backup_player_name}</span>
            {top.score != null && (
              <div className="text-right shrink-0">
                <span className="text-[9px] uppercase tracking-wider text-ink-2 font-semibold block leading-none">Score</span>
                <span className="text-[18px] font-semibold text-ink tabular-nums leading-none">{top.score}</span>
              </div>
            )}
          </div>
          <span className="text-[11px] text-ink-2 block">
            {top.trigger_team_abbr} vs {top.home_team_abbr === top.trigger_team_abbr ? top.visitor_team_abbr : top.home_team_abbr}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className="px-2 h-5 inline-flex items-center rounded text-[10px] font-semibold bg-canvas-2 text-ink">
          {STAT_LABEL_PT[top.stat_type] ?? top.stat_type}
        </span>
        <span className="px-2 h-5 inline-flex items-center rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          Sem {triggerLast}
        </span>
      </div>

      <div className="text-[12px] text-ink-2 space-y-1 mb-3">
        <div className="flex items-center justify-between">
          <span>Com {triggerLast}: {top.avg_com.toFixed(1)} · Sem: <span className="text-ink font-semibold">{top.avg_sem.toFixed(1)}</span></span>
          <span className={`font-semibold tabular-nums ${isPos ? 'text-forest' : 'text-status-danger'}`}>
            ({isPos ? '+' : ''}{top.gap_pct.toFixed(1)}%)
          </span>
        </div>
        {top.line_value != null && (
          <div>Linha: <span className="text-ink font-semibold tabular-nums">{top.line_value.toFixed(1)}</span></div>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate(`/analise-360/${top.trigger_player_id}`)}
        className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-md bg-forest text-white text-[12px] font-semibold hover:bg-forest-soft transition-colors"
      >
        Ver análise completa
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Pagination ──────────────────────────────────────────────────────────

function Pagination({ current, total, onPage }: { current: number; total: number; onPage: (n: number) => void }) {
  if (total <= 1) return null;
  const pages = Array.from({ length: total }, (_, i) => i + 1)
    .filter(p => p === 1 || p === total || Math.abs(p - current) <= 1);

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button
        type="button"
        onClick={() => onPage(current - 1)}
        disabled={current === 1}
        className="w-8 h-8 flex items-center justify-center rounded-md border border-line bg-white hover:border-forest/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p, idx) => {
        const prev = pages[idx - 1];
        const ellipsis = prev && p - prev > 1;
        return (
          <React.Fragment key={p}>
            {ellipsis && <span className="text-ink-2 text-xs px-1">…</span>}
            <button
              type="button"
              onClick={() => onPage(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-medium transition-colors ${
                current === p
                  ? 'bg-forest text-white'
                  : 'bg-white border border-line text-ink hover:border-forest/40'
              }`}
            >
              {p}
            </button>
          </React.Fragment>
        );
      })}
      <button
        type="button"
        onClick={() => onPage(current + 1)}
        disabled={current === total}
        className="w-8 h-8 flex items-center justify-center rounded-md border border-line bg-white hover:border-forest/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

export default function Games() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const today = getSaoPauloTodayISO();

  const [games, setGames] = useState<Game[]>(() => {
    if (lastResolvedDate && gamesCache.has(lastResolvedDate)) {
      return gamesCache.get(lastResolvedDate)!;
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(!lastResolvedDate);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<string>(lastResolvedDate || today);
  const [currentPage, setCurrentPage] = useState(1);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [injuryOpen, setInjuryOpen] = useState(false);
  const initialDone = useRef(false);

  const loadGames = async (date: string) => {
    const cached = gamesCache.get(date);
    if (cached) {
      setGames(cached);
      setCurrentPage(1);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const data = await nbaDataService.getGames({ gameDate: date });
      setGames(data);
      gamesCache.set(date, data);
      setCurrentPage(1);
    } catch (e) {
      console.error(e);
      setError('Não foi possível carregar os jogos.');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateDate = (days: number) => {
    const next = addDaysToISO(currentDate, days);
    setCurrentDate(next);
    loadGames(next);
  };

  // Initial load: pula até achar dia com jogos (até 14 dias)
  useEffect(() => {
    if (initialDone.current) return;
    initialDone.current = true;
    if (lastResolvedDate && games.length > 0) return;

    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        setError(null);
        let date = getSaoPauloTodayISO();
        let data = await nbaDataService.getGames({ gameDate: date });
        for (let i = 1; data.length === 0 && i <= 14; i++) {
          if (cancelled) return;
          date = addDaysToISO(getSaoPauloTodayISO(), i);
          data = await nbaDataService.getGames({ gameDate: date });
        }
        if (cancelled) return;
        setGames(data);
        setCurrentDate(date);
        lastResolvedDate = date;
        gamesCache.set(date, data);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError('Não foi possível carregar os jogos.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => {
      const END_OF_DAY = 23 * 60 * 60 * 1000;
      const ta = a.game_datetime_brasilia ? new Date(a.game_datetime_brasilia).getTime() : parseGameDate(a.game_date).getTime() + END_OF_DAY;
      const tb = b.game_datetime_brasilia ? new Date(b.game_datetime_brasilia).getTime() : parseGameDate(b.game_date).getTime() + END_OF_DAY;
      if (ta !== tb) return ta - tb;
      return a.home_team_name.localeCompare(b.home_team_name);
    });
  }, [games]);

  const totalPages = Math.ceil(sortedGames.length / ITEMS_PER_PAGE);
  const pageGames = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedGames.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedGames, currentPage]);

  const handlePage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 200, behavior: 'smooth' });
  };

  const dateNavBlock = (
    <div className="bg-white border border-line rounded-xl flex items-center justify-between p-2">
      <button
        type="button"
        onClick={() => navigateDate(-1)}
        disabled={isLoading}
        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-canvas-2 disabled:opacity-40 transition-colors"
        aria-label="Dia anterior"
      >
        <ChevronLeft className="w-4 h-4 text-ink-2" />
      </button>
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-canvas-2 transition-colors text-[13px] font-semibold text-ink"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-ink-2" />
            {formatHeaderDateBR(currentDate).full}
          </button>
        </PopoverTrigger>
        <PopoverContent className="theme-rebrand w-auto p-0 bg-white border border-line text-ink" align="center">
          <Calendar
            mode="single"
            selected={parseGameDate(currentDate)}
            onSelect={(date) => {
              if (!date) return;
              const next = toSaoPauloISO(date);
              setCurrentDate(next);
              setCalendarOpen(false);
              loadGames(next);
            }}
            initialFocus
            classNames={{
              caption_label: 'text-sm font-semibold text-ink',
              head_cell: 'text-ink-2 w-9 font-medium text-[0.75rem]',
              day: 'h-9 w-9 p-0 font-normal text-ink hover:bg-canvas-2 rounded-md',
              day_selected: 'bg-forest text-white hover:bg-forest-soft hover:text-white focus:bg-forest focus:text-white',
              day_today: 'bg-forest-tint text-forest font-semibold',
              day_outside: 'text-ink-2/40',
              nav_button: 'h-7 w-7 bg-white p-0 border border-line text-ink-2 hover:text-ink hover:bg-canvas-2',
            }}
          />
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={() => navigateDate(1)}
        disabled={isLoading}
        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-canvas-2 disabled:opacity-40 transition-colors"
        aria-label="Próximo dia"
      >
        <ChevronRight className="w-4 h-4 text-ink-2" />
      </button>
    </div>
  );

  const headerDate = formatHeaderDateBR(currentDate);
  const isToday = currentDate === today;
  const finishedCount = sortedGames.filter(isGameFinished).length;
  const subtitle = sortedGames.length === 0
    ? ''
    : finishedCount === sortedGames.length
    ? `${sortedGames.length} ${sortedGames.length === 1 ? 'partida concluída' : 'partidas · concluídas'}`
    : isToday
    ? `${sortedGames.length} ${sortedGames.length === 1 ? 'partida · hoje' : 'partidas · hoje'}`
    : `${sortedGames.length} ${sortedGames.length === 1 ? 'partida' : 'partidas'}`;

  return (
    <>
      <Helmet>
        <title>Jogos NBA — Smart Betting</title>
      </Helmet>

      <div className="theme-rebrand min-h-screen bg-canvas text-ink">
        <AnalyticsNav variant="rebrand" showBack backTo="/home-nba" />

        {/* Page header (bg-white) */}
        <div className="bg-white border-b border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 md:py-6">
            <div className="min-w-0">
              <h1 className="text-[22px] md:text-[28px] font-semibold tracking-tight text-ink leading-none">
                Jogos NBA <span className="text-ink-2 font-normal">· {headerDate.weekday}, {headerDate.dayMonth}</span>
              </h1>
              {subtitle && (
                <p className="text-[13px] text-ink-2 mt-1.5">{subtitle}</p>
              )}
            </div>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* ── Games column ── */}
          <section className="min-w-0">
            {/* Date picker — só renderiza no mobile (uma instância só pra evitar Popover duplicado) */}
            {isMobile && (
              <div className="mb-3">
                {dateNavBlock}
              </div>
            )}

            {error && (
              <div className="bg-status-danger/10 border border-status-danger/30 text-status-danger px-3 py-2 rounded-md text-sm mb-4">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white border border-line rounded-xl p-4">
                    <Skeleton className="h-3 w-32 mb-2 bg-canvas-2" />
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-9 h-9 rounded-full bg-canvas-2" />
                      <Skeleton className="h-4 w-12 bg-canvas-2 flex-1" />
                      <Skeleton className="h-4 w-12 bg-canvas-2" />
                      <Skeleton className="h-4 w-12 bg-canvas-2 flex-1" />
                      <Skeleton className="w-9 h-9 rounded-full bg-canvas-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedGames.length === 0 ? (
              <div className="bg-white border border-line rounded-xl p-10 text-center">
                <p className="text-sm text-ink-2 mb-1">Nenhum jogo encontrado para esta data.</p>
                <p className="text-xs text-ink-2/70">Use as setas para navegar entre os dias.</p>
              </div>
            ) : (
              <>
                <div className={`grid grid-cols-1 ${sortedGames.length > 5 ? 'md:grid-cols-2' : ''} gap-3`}>
                  {pageGames.map(g => (
                    <GameCard
                      key={g.game_id}
                      game={g}
                      onClick={() => navigate(`/game/${g.game_id}?date=${g.game_date}`)}
                    />
                  ))}
                </div>
                <Pagination current={currentPage} total={totalPages} onPage={handlePage} />
              </>
            )}
          </section>

          {/* ── Sidebar ── */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
            {/* Date picker — só renderiza no desktop (mobile aparece acima dos jogos) */}
            {!isMobile && dateNavBlock}

            {/* Oportunidade do dia */}
            <OpportunityOfDayCard />

            {/* Injury report */}
            <button
              type="button"
              onClick={() => setInjuryOpen(true)}
              className="bg-white border border-line rounded-xl p-4 text-left hover:border-amber-300 hover:bg-amber-50/30 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold mb-0.5">Injury Report</div>
                    <div className="text-[13px] font-semibold text-ink leading-tight">Lesões dos jogos de hoje</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-ink-2 group-hover:text-amber-700 transition-colors" />
              </div>
            </button>

            {/* Relatório do dia */}
            <button
              type="button"
              onClick={() => navigate('/report')}
              className="bg-white border border-line rounded-xl p-4 text-left hover:border-forest/30 hover:bg-forest-tint/40 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-start gap-2.5">
                  <FileText className="w-4 h-4 text-forest mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold mb-0.5">Relatório do dia</div>
                    <div className="text-[13px] font-semibold text-ink leading-tight">Veja as melhores props</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-ink-2 group-hover:text-forest transition-colors" />
              </div>
            </button>
          </aside>
        </main>

        <InjuryReportModal
          open={injuryOpen}
          onClose={() => setInjuryOpen(false)}
          games={sortedGames}
        />
      </div>
    </>
  );
}
