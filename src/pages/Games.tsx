import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AnalyticsNav from '@/components/AnalyticsNav';
import { Input } from '@/components/ui/input';
import { nbaDataService, Game } from '@/services/nba-data.service';
import { Button } from '@/components/ui/button';
import { RefreshCw, Lock, Zap, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSubscription } from '@/hooks/use-subscription';
import { useToast } from '@/hooks/use-toast';

interface Filters {
  date: string;
  teamAbbreviation: string;
}

const ITEMS_PER_PAGE = 12;

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
  const [filters, setFilters] = useState<Filters>({ date: '', teamAbbreviation: '' });
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
      const dateCompare = (a.game_date || '').localeCompare(b.game_date || '');
      if (dateCompare !== 0) return dateCompare;
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
    setFilters({ date: '', teamAbbreviation: '' });
    await nbaDataService.getGames().then(setGames).catch((err) => {
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
              <Input
                placeholder="Ex: BOS, LAL"
                value={filters.teamAbbreviation}
                onChange={(e) => setFilters({ ...filters, teamAbbreviation: e.target.value })}
                className="terminal-input h-9 text-sm"
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

        {/* Games Grid - Layout Compacto */}
        <section>
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
              {/* Grid de Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {paginatedGames.map((game) => (
                  <div 
                    key={game.game_id} 
                    className="bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg p-3 hover:border-terminal-green/50 transition-all"
                  >
                    {/* Data */}
                    <div className="text-[10px] text-terminal-text opacity-50 mb-2">
                      {new Date(game.game_date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </div>

                    {/* Matchup Principal */}
                    <div className="flex items-center justify-between mb-3">
                      {/* Home Team */}
                      <div className="flex-1 text-center">
                        <div className="text-lg font-bold text-terminal-green mb-1">
                          {game.home_team_abbreviation}
                        </div>
                        <div className="flex items-center justify-center gap-1">
                          {game.home_team_is_b2b_game && (
                            <span className="text-[8px] bg-terminal-yellow/20 text-terminal-yellow px-1 rounded">B2B</span>
                          )}
                          {game.home_team_is_next_game && (
                            <span className="text-[8px] bg-terminal-green/20 text-terminal-green px-1 rounded">NEXT</span>
                          )}
                        </div>
                        {/* Últimos 3 resultados - simulado por enquanto */}
                        <div className="flex justify-center mt-1">
                          <LastResults results={game.home_team_last_five || ''} teamAbbr={game.home_team_abbreviation} />
                        </div>
                      </div>

                      {/* VS */}
                      <div className="px-2 text-terminal-text opacity-30 text-xs">vs</div>

                      {/* Visitor Team */}
                      <div className="flex-1 text-center">
                        <div className="text-lg font-bold text-terminal-text mb-1">
                          {game.visitor_team_abbreviation}
                        </div>
                        <div className="flex items-center justify-center gap-1">
                          {game.visitor_team_is_b2b_game && (
                            <span className="text-[8px] bg-terminal-yellow/20 text-terminal-yellow px-1 rounded">B2B</span>
                          )}
                          {game.visitor_team_is_next_game && (
                            <span className="text-[8px] bg-terminal-green/20 text-terminal-green px-1 rounded">NEXT</span>
                          )}
                        </div>
                        {/* Últimos 3 resultados */}
                        <div className="flex justify-center mt-1">
                          <LastResults results={game.visitor_team_last_five || ''} teamAbbr={game.visitor_team_abbreviation} />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2 border-t border-terminal-border-subtle">
                      <Button 
                        size="sm"
                        className={`flex-1 text-[10px] h-7 ${
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
                        className={`flex-1 text-[10px] h-7 ${
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
                ))}
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
