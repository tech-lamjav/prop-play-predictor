import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { Input } from '@/components/ui/input';
import { nbaDataService, Game } from '@/services/nba-data.service';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, RefreshCw } from 'lucide-react';

interface Filters {
  date: string;
  teamAbbreviation: string;
}

export default function Games() {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ date: '', teamAbbreviation: '' });

  const loadGames = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await nbaDataService.getGames({
        gameDate: filters.date || undefined,
        teamAbbreviation: filters.teamAbbreviation || undefined,
      });

      setGames(data);
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

  const handleTeamNavigate = (teamAbbreviation: string) => {
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

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-terminal-black text-terminal-text font-mono">
        <header className="terminal-header p-4 sticky top-0 z-10">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-terminal-green/20 border border-terminal-green rounded flex items-center justify-center">
                <Calendar className="w-4 h-4 text-terminal-green" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-wider text-terminal-green">NEXT GAMES</h1>
                <p className="text-[10px] text-terminal-text opacity-60">PRÓXIMOS CONFRONTOS POR MANDANTE</p>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6 space-y-6">
          <section className="terminal-container p-4 rounded">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1">
                <label className="text-[11px] uppercase tracking-wide opacity-70">Data</label>
                <Input
                  type="date"
                  value={filters.date}
                  onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                  className="terminal-input mt-1"
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] uppercase tracking-wide opacity-70">Time (sigla)</label>
                <Input
                  placeholder="Ex: BOS, LAL"
                  value={filters.teamAbbreviation}
                  onChange={(e) => setFilters({ ...filters, teamAbbreviation: e.target.value })}
                  className="terminal-input mt-1"
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleApplyFilters} disabled={isLoading} className="terminal-button">
                  {isLoading ? 'CARREGANDO...' : 'FILTRAR'}
                </Button>
                <Button variant="outline" onClick={handleResetFilters} disabled={isLoading} className="terminal-button">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Limpar
                </Button>
              </div>
            </div>
          </section>

          {error && (
            <div className="terminal-container p-4 rounded border border-terminal-red text-terminal-red">
              {error}
            </div>
          )}

          <section className="space-y-3">
            {isLoading ? (
              <div className="terminal-container p-6 rounded text-center">Carregando jogos...</div>
            ) : filteredGames.length === 0 ? (
              <div className="terminal-container p-6 rounded text-center text-terminal-text opacity-60">
                Nenhum jogo encontrado.
              </div>
            ) : (
              filteredGames.map((game) => (
                <div key={game.game_id} className="terminal-container rounded p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-xs text-terminal-text opacity-70 mb-1">{game.game_date}</div>
                    <div className="text-lg font-bold text-terminal-green">
                      {game.home_team_name} vs {game.visitor_team_name}
                    </div>
                    <div className="text-[11px] text-terminal-text opacity-60 flex items-center space-x-2">
                      <MapPin className="w-3 h-3" />
                      <span>Mandante: {game.home_team_abbreviation}</span>
                      {game.home_team_is_b2b_game && <span className="text-terminal-yellow">• B2B</span>}
                      {game.home_team_is_next_game && <span className="text-terminal-green">• Próximo</span>}
                    </div>
                    <div className="text-[11px] text-terminal-text opacity-60 flex items-center space-x-2">
                      <MapPin className="w-3 h-3" />
                      <span>Visitante: {game.visitor_team_abbreviation}</span>
                      {game.visitor_team_is_b2b_game && <span className="text-terminal-yellow">• B2B</span>}
                      {game.visitor_team_is_next_game && <span className="text-terminal-green">• Próximo</span>}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button className="terminal-button" onClick={() => handleTeamNavigate(game.home_team_abbreviation)}>
                      Ver {game.home_team_abbreviation}
                    </Button>
                    <Button className="terminal-button" onClick={() => handleTeamNavigate(game.visitor_team_abbreviation)}>
                      Ver {game.visitor_team_abbreviation}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </section>
        </main>
      </div>
    </AuthenticatedLayout>
  );
}

