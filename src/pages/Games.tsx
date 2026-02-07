import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Input } from '@/components/ui/input';
import { nbaDataService, Game } from '@/services/nba-data.service';
import { Button } from '@/components/ui/button';
import { RefreshCw, Lock, Zap, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';
import { useToast } from '@/hooks/use-toast';
import { TeamAutocomplete } from '@/components/nba/TeamAutocomplete';
import { FreePropCard } from '@/components/nba/FreePropCard';
import { getTeamLogoUrl } from '@/utils/team-logos';

interface Filters {
  date: string;
  teamAbbreviation: string;
}

const ITEMS_PER_PAGE = 12;

// Helper to parse date without timezone issues
const parseGameDate = (dateString: string): Date => {
  // If dateString is in format YYYY-MM-DD, parse it as local date
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  // Otherwise, parse normally but use UTC to avoid timezone shifts
  const date = new Date(dateString);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

// Format date for display (day of week + date)
const formatGameDate = (dateString: string): string => {
  const date = parseGameDate(dateString);
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
};

// Check if game is finished
const isGameFinished = (game: Game): boolean => {
  return game.home_team_score !== null && game.visitor_team_score !== null;
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
  
  // Default to today's date
  const today = new Date().toISOString().split('T')[0];
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
        {/* Filters Section - Compacto */}
        <section className="bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg p-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wide text-terminal-text opacity-70 mb-1 block">
                DATA
              </label>
              <Input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                className="terminal-input h-9 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wide text-terminal-text opacity-70 mb-1 block">
                TIME
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
                {isLoading ? '...' : 'FILTRAR'}
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
        </section>

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
              {/* Vertical List of Game Cards */}
              <div className="space-y-1.5">
                {paginatedGames.map((game) => {
                  const finished = isGameFinished(game);
                  const gameDate = parseGameDate(game.game_date);
                  const dateDisplay = formatGameDate(game.game_date);
                  
                  return (
                    <div 
                      key={game.game_id} 
                      onClick={() => navigate(`/game/${game.game_id}`)}
                      className={`bg-terminal-dark-gray border rounded-lg p-3 hover:border-terminal-green/50 transition-all cursor-pointer ${
                        finished ? 'opacity-70 border-terminal-border-subtle' : 'border-terminal-border-subtle'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        {/* Home Team */}
                        <div className="flex items-center gap-2 flex-1">
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
                            <span className="text-xs font-bold text-terminal-green truncate">
                              {game.home_team_name}
                            </span>
                            {finished && (
                              <span className={`text-xs font-medium ${
                                game.winner_team_id === game.home_team_id ? 'text-terminal-green' : 'opacity-60'
                              }`}>
                                {game.home_team_score}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Center: Date/Time and Status */}
                        <div className="flex flex-col items-center gap-0.5 px-3 flex-shrink-0">
                          <div className="text-[9px] text-terminal-text opacity-50">
                            {dateDisplay}
                          </div>
                          {finished ? (
                            <span className="text-[8px] bg-terminal-gray/30 text-terminal-text px-1.5 py-0.5 rounded">
                              FT
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              {game.home_team_is_b2b_game && (
                                <span className="text-[8px] bg-terminal-yellow/20 text-terminal-yellow px-1 rounded">B2B</span>
                              )}
                              {game.visitor_team_is_b2b_game && (
                                <span className="text-[8px] bg-terminal-yellow/20 text-terminal-yellow px-1 rounded">B2B</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Visitor Team */}
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          <div className="flex flex-col items-end min-w-0">
                            <span className="text-xs font-bold text-terminal-text truncate">
                              {game.visitor_team_name}
                            </span>
                            {finished && (
                              <span className={`text-xs font-medium ${
                                game.winner_team_id === game.visitor_team_id ? 'text-terminal-green' : 'opacity-60'
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
