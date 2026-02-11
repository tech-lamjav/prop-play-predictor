import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnalyticsNav from '@/components/AnalyticsNav';
import { nbaDataService, Game } from '@/services/nba-data.service';
import { Button } from '@/components/ui/button';
import { RefreshCw, Lock, Zap, BarChart3, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';
import { useToast } from '@/hooks/use-toast';
import { TeamAutocomplete } from '@/components/nba/TeamAutocomplete';
import { FreePropCard } from '@/components/nba/FreePropCard';
import { getTeamLogoUrl } from '@/utils/team-logos';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

interface Filters {
  date: string;
  teamAbbreviation: string;
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

// Helper to parse date without timezone issues
const parseGameDate = (dateString: string): Date => {
  // If dateString is in format YYYY-MM-DD, parse as Sao Paulo midday to avoid timezone drift
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
  // Prefer winner_team_id as the source of truth to avoid showing FT for 0-0 scheduled games
  return game.winner_team_id !== null;
};

// Componente para mostrar últimos resultados (V/D)
const LastResults: React.FC<{ results: string; teamAbbr: string }> = ({ results, teamAbbr }) => {
  if (!results) return null;
  
  // results vem como "D D V V V" (com espaços, em português)
  const cleanResults = results.replace(/\s/g, ''); // Remove espaços
  const last3 = cleanResults.slice(0, 3).split('');
  
  return (
    <div className="flex items-center gap-0.5">
      {last3.map((result, idx) => {
        const isWin = result === 'V' || result === 'W';
        return (
          <span 
            key={idx}
            className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded ${
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

export default function Games() {
  const navigate = useNavigate();
  const { isPremium } = useSubscription();
  const { toast } = useToast();
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Default to today's date in Sao Paulo timezone (GMT-3)
  const today = getSaoPauloTodayISO();
  const [filters, setFilters] = useState<Filters>({ date: today, teamAbbreviation: '' });
  const [currentPage, setCurrentPage] = useState(1);

  const loadGames = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await nbaDataService.getGames({
        gameDate: filters.date || undefined,
        teamAbbreviation: filters.teamAbbreviation || undefined,
      });

      setGames(data);
      setCurrentPage(1); // Reset to first page on new load
    } catch (err) {
      console.error('Error loading games', err);
      setError('Não foi possível carregar os jogos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredGames = useMemo(() => {
    return [...games].sort((a, b) => {
      // Sort by date first
      const dateA = parseGameDate(a.game_date || '');
      const dateB = parseGameDate(b.game_date || '');
      const dateCompare = dateA.getTime() - dateB.getTime();
      if (dateCompare !== 0) return dateCompare;
      
      // If same date, sort by home team name
      return a.home_team_name.localeCompare(b.home_team_name);
    });
  }, [games]);

  // Paginação
  const totalPages = Math.ceil(filteredGames.length / ITEMS_PER_PAGE);
  const paginatedGames = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredGames.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredGames, currentPage]);

  const handleTeamNavigate = (teamAbbreviation: string) => {
    if (!isPremium) {
      toast({
        title: 'Acesso Premium Necessário',
        description: 'Assine o plano premium para acessar análises completas dos times.',
        variant: 'default',
      });
      navigate('/paywall-platform');
      return;
    }
    navigate(`/nba-players?team=${encodeURIComponent(teamAbbreviation)}`);
  };

  const handleApplyFilters = async () => {
    await loadGames();
  };

  const handleResetFilters = async () => {
    setFilters({ date: today, teamAbbreviation: '' });
    await nbaDataService.getGames({ gameDate: today }).then(setGames).catch((err) => {
      console.error('Error reloading games', err);
      setError('Não foi possível carregar os jogos.');
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-terminal-black text-terminal-text font-mono">
      <AnalyticsNav />
      
      <main className="container mx-auto px-4 py-4 space-y-4">
        {error && (
          <div className="bg-terminal-dark-gray border border-terminal-red p-3 rounded text-terminal-red text-sm">
            {error}
          </div>
        )}

        {/* Games List and Free Prop Card */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Games List */}
            <div className="lg:col-span-3">
              <div className="bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg p-3 mb-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="hidden lg:block pt-0.5">
                    <div className="text-[10px] uppercase tracking-wide text-terminal-text opacity-70">Filtros</div>
                    <div className="text-xs text-terminal-text opacity-50 mt-1 leading-tight">Data e time para refinar os jogos</div>
                  </div>
                  <div className="flex flex-col lg:flex-row lg:items-end gap-3">
                  <div className="w-full lg:w-[220px]">
                    <label className="text-[10px] uppercase tracking-wide text-terminal-text opacity-70 mb-1 block">
                      Data
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="terminal-input h-9 text-sm w-full justify-start border-terminal-border-subtle bg-terminal-gray/30 hover:bg-terminal-gray/40"
                        >
                          <CalendarIcon className="w-4 h-4 mr-2 opacity-70" />
                          {parseGameDate(filters.date).toLocaleDateString('pt-BR', {
                            timeZone: SAO_PAULO_TIMEZONE,
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-terminal-dark-gray border-terminal-border-subtle" align="end">
                        <Calendar
                          mode="single"
                          selected={parseGameDate(filters.date)}
                          onSelect={(date) => {
                            if (!date) return;
                            setFilters({ ...filters, date: toSaoPauloISO(date) });
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
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="w-full lg:w-[220px]">
                    <label className="text-[10px] uppercase tracking-wide text-terminal-text opacity-70 mb-1 block">
                      Time
                    </label>
                    <TeamAutocomplete
                      value={filters.teamAbbreviation}
                      onValueChange={(value) => setFilters({ ...filters, teamAbbreviation: value })}
                      placeholder="Buscar time..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleApplyFilters} 
                      disabled={isLoading} 
                      size="sm"
                      className="terminal-button bg-terminal-green hover:bg-terminal-green/80 text-terminal-black font-bold"
                    >
                      {isLoading ? '...' : 'Filtrar'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleResetFilters} 
                      disabled={isLoading}
                      size="sm" 
                      className="terminal-button"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
              </div>

              {isLoading ? (
            <div className="bg-terminal-dark-gray border border-terminal-border-subtle p-6 rounded text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-terminal-green mx-auto mb-2"></div>
              <p className="text-terminal-text text-sm">Carregando jogos...</p>
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="bg-terminal-dark-gray border border-terminal-border-subtle p-6 rounded text-center text-terminal-text opacity-60">
              <p className="text-sm mb-2">NENHUM JOGO ENCONTRADO</p>
              <p className="text-xs opacity-60">Tente ajustar os filtros</p>
            </div>
          ) : (
            <>
              {/* Games grid: 1 column mobile, 2 columns on larger screens */}
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
                      onClick={() => navigate(`/game/${game.game_id}`)}
                      className={`bg-terminal-dark-gray border rounded-lg p-3 hover:border-terminal-green/50 transition-all cursor-pointer ${
                        finished ? 'border-terminal-border-subtle' : 'border-terminal-border-subtle'
                      }`}
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
                              <span className={`text-xs font-bold truncate ${
                                homeWon ? 'text-terminal-green' : 'text-terminal-text'
                              }`}>
                                {game.home_team_name}
                              </span>
                              {game.home_team_is_b2b_game && (
                                <span className="text-[8px] bg-terminal-yellow/20 text-terminal-yellow px-1 rounded flex-shrink-0">B2B</span>
                              )}
                            </div>
                            {finished && (
                              <span className={`text-sm font-bold tabular-nums ${
                                homeWon ? 'text-terminal-green' : 'text-terminal-text opacity-50'
                              }`}>
                                {game.home_team_score}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Center: Date and FT only when finished */}
                        <div className="flex flex-col items-center gap-0.5 px-2 flex-shrink-0">
                          <div className="text-[9px] text-terminal-text opacity-50 whitespace-nowrap">
                            {dateDisplay}
                          </div>
                          {finished && (
                            <span className="text-[8px] bg-terminal-gray/30 text-terminal-text px-1.5 py-0.5 rounded">
                              FT
                            </span>
                          )}
                          {finished && winnerAbbr && (
                            <span className="text-[8px] bg-terminal-green/20 text-terminal-green px-1.5 py-0.5 rounded border border-terminal-green/30">
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
                              <span className={`text-xs font-bold truncate ${
                                visitorWon ? 'text-terminal-green' : 'text-terminal-text'
                              }`}>
                                {game.visitor_team_name}
                              </span>
                            </div>
                            {finished && (
                              <span className={`text-sm font-bold tabular-nums ${
                                visitorWon ? 'text-terminal-green' : 'text-terminal-text opacity-50'
                              }`}>
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
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-terminal-border-subtle">
                        <div className="flex items-center gap-2">
                          <LastResults results={game.home_team_last_five || ''} teamAbbr={game.home_team_abbreviation} />
                        </div>
                        <div className="flex items-center gap-2">
                          <LastResults results={game.visitor_team_last_five || ''} teamAbbr={game.visitor_team_abbreviation} />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-2 pt-2 border-t border-terminal-border-subtle" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          size="sm"
                          className={`flex-1 text-[10px] h-6 ${
                            !isPremium 
                              ? 'bg-terminal-gray/50 text-terminal-text/50' 
                              : 'terminal-button hover:border-terminal-green'
                          }`}
                          onClick={() => handleTeamNavigate(game.home_team_abbreviation)}
                        >
                          {game.home_team_abbreviation}
                          {!isPremium && <Lock className="w-2.5 h-2.5 ml-1 text-terminal-yellow" />}
                        </Button>
                        <Button 
                          size="sm"
                          className={`flex-1 text-[10px] h-6 ${
                            !isPremium 
                              ? 'bg-terminal-gray/50 text-terminal-text/50' 
                              : 'terminal-button hover:border-terminal-green'
                          }`}
                          onClick={() => handleTeamNavigate(game.visitor_team_abbreviation)}
                        >
                          {game.visitor_team_abbreviation}
                          {!isPremium && <Lock className="w-2.5 h-2.5 ml-1 text-terminal-yellow" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paginação */}
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
                      .filter(page => {
                        // Mostrar: primeira, última, atual e adjacentes
                        if (page === 1 || page === totalPages) return true;
                        if (Math.abs(page - currentPage) <= 1) return true;
                        return false;
                      })
                      .map((page, idx, arr) => {
                        // Adicionar "..." entre gaps
                        const prevPage = arr[idx - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;
                        
                        return (
                          <React.Fragment key={page}>
                            {showEllipsis && (
                              <span className="text-terminal-text opacity-30 px-1">...</span>
                            )}
                            <Button
                              variant={currentPage === page ? "default" : "outline"}
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

            {/* Free Prop Card Sidebar */}
            <div className="lg:col-span-1">
              <FreePropCard />
            </div>
          </div>
        </section>

        {/* Conversion Banner - Mais compacto */}
        {!isPremium && (
          <section className="bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg p-4">
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
    </div>
  );
}
