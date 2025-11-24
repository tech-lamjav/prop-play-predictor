import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedLayout from '../components/AuthenticatedLayout';
import { Input } from '@/components/ui/input';
import { Search, Star, ChevronDown, ChevronRight, Trophy } from 'lucide-react';
import { nbaDataService, Player } from '@/services/nba-data.service';

export default function PlayerSelection() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  // Load players
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const playersData = await nbaDataService.getAllPlayers();

        // Remove duplicates based on player ID
        const uniquePlayers = playersData.filter((player, index, self) => 
          index === self.findIndex(p => p.player_id === player.player_id)
        );
        
        setPlayers(uniquePlayers);
        setFilteredPlayers(uniquePlayers);
        
        // Initially expand all teams
        const allTeams = new Set(uniquePlayers.map(p => p.team_name));
        setExpandedTeams(allTeams);
        
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load player data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter players based on search term
  useEffect(() => {
    let filtered = players;

    if (searchTerm) {
      filtered = filtered.filter(player =>
        player.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.team_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.team_abbreviation.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredPlayers(filtered);
  }, [players, searchTerm]);

  const handlePlayerSelect = (playerId: number) => {
    const player = players.find(p => p.player_id === playerId);
    if (player) {
      const slug = player.player_name.toLowerCase().replace(/\s+/g, '-');
      navigate(`/nba-dashboard/${slug}`);
    }
  };

  const toggleTeam = (teamName: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamName)) {
      newExpanded.delete(teamName);
    } else {
      newExpanded.add(teamName);
    }
    setExpandedTeams(newExpanded);
  };

  // Group players by team
  const playersByTeam = filteredPlayers.reduce((acc, player) => {
    if (!acc[player.team_name]) {
      acc[player.team_name] = [];
    }
    acc[player.team_name].push(player);
    return acc;
  }, {} as Record<string, Player[]>);

  // Sort teams alphabetically
  const sortedTeams = Object.keys(playersByTeam).sort();

  // Get best players (top rated)
  const bestPlayers = [...players]
    .filter(p => (p.rating_stars || 0) > 0)
    .sort((a, b) => (b.rating_stars || 0) - (a.rating_stars || 0))
    .slice(0, 10);

  const scrollToTeam = (teamName: string) => {
    const element = document.getElementById(`team-${teamName}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      if (!expandedTeams.has(teamName)) {
        toggleTeam(teamName);
      }
    }
  };

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="min-h-screen bg-terminal-black flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-terminal-green mx-auto"></div>
            <p className="mt-4 text-terminal-text font-mono">LOADING SYSTEM...</p>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (error) {
    return (
      <AuthenticatedLayout>
        <div className="min-h-screen bg-terminal-black flex items-center justify-center">
          <div className="text-center">
            <div className="text-terminal-red text-xl mb-4">⚠️ SYSTEM ERROR</div>
            <p className="text-terminal-text mb-4 font-mono">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="terminal-button px-4 py-2 rounded"
            >
              RETRY CONNECTION
            </button>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-terminal-black text-terminal-text font-mono">
        {/* Header */}
        <header className="terminal-header p-4 sticky top-0 z-10">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-terminal-green/20 border border-terminal-green rounded flex items-center justify-center">
                <Trophy className="w-4 h-4 text-terminal-green" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-wider text-terminal-green">PLAYER DATABASE</h1>
                <p className="text-[10px] text-terminal-text opacity-60">SECURE CONNECTION ESTABLISHED</p>
              </div>
            </div>
            
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-terminal-text opacity-50 h-4 w-4" />
              <Input
                placeholder="SEARCH DATABASE..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="terminal-input pl-10 h-9 text-xs w-full"
              />
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-6 space-y-8">
          
          {/* Best Players Section */}
          {!searchTerm && bestPlayers.length > 0 && (
            <section>
              <div className="flex items-center space-x-2 mb-4 border-b border-terminal-border-subtle pb-2">
                <Star className="w-4 h-4 text-terminal-green" />
                <h2 className="section-title text-sm">TOP RATED PLAYERS</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {bestPlayers.map((player) => (
                  <div 
                    key={`best-${player.player_id}`}
                    onClick={() => handlePlayerSelect(player.player_id)}
                    className="terminal-button p-3 rounded cursor-pointer group hover:border-terminal-green transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs font-bold text-terminal-green group-hover:text-white transition-colors">
                        {player.player_name}
                      </div>
                      <div className="flex items-center space-x-1 bg-terminal-dark-gray px-1.5 py-0.5 rounded border border-terminal-border-subtle">
                        <span className="text-[10px] font-bold text-terminal-green">{player.rating_stars || 0}</span>
                        <Star className="w-2 h-2 text-terminal-green fill-current" />
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-end">
                      <div className="text-[10px] text-terminal-text opacity-60">
                        {player.team_abbreviation} • {player.position}
                      </div>
                      <div className="text-[10px] text-terminal-text opacity-60">
                        {player.current_status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Team Logos Navigation */}
          {!searchTerm && (
            <section className="py-4 overflow-x-auto scrollbar-hide">
              <div className="flex space-x-4 min-w-max px-2">
                {sortedTeams.map((teamName) => {
                  // Find a player from this team to get the abbreviation
                  const teamAbbr = playersByTeam[teamName][0]?.team_abbreviation || teamName.substring(0, 3).toUpperCase();
                  return (
                    <button
                      key={`nav-${teamName}`}
                      onClick={() => scrollToTeam(teamName)}
                      className="flex flex-col items-center space-y-2 group"
                    >
                      <div className="w-12 h-12 rounded-full bg-terminal-gray border border-terminal-border-subtle flex items-center justify-center group-hover:border-terminal-green group-hover:bg-terminal-dark-gray transition-all">
                        <span className="text-xs font-bold text-terminal-text group-hover:text-terminal-green">
                          {teamAbbr}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* All Players by Team */}
          <section>
            <div className="flex items-center space-x-2 mb-4 border-b border-terminal-border-subtle pb-2">
              <div className="w-2 h-2 bg-terminal-green rounded-full"></div>
              <h2 className="section-title text-sm">ROSTER BY TEAM</h2>
            </div>

            <div className="space-y-4">
              {sortedTeams.map((teamName) => (
                <div key={teamName} id={`team-${teamName}`} className="terminal-container rounded overflow-hidden">
                  <button 
                    onClick={() => toggleTeam(teamName)}
                    className="w-full flex items-center justify-between p-3 bg-terminal-gray hover:bg-terminal-light-gray transition-colors border-b border-terminal-border-subtle"
                  >
                    <div className="flex items-center space-x-3">
                      {expandedTeams.has(teamName) ? (
                        <ChevronDown className="w-4 h-4 text-terminal-green" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-terminal-text opacity-50" />
                      )}
                      <span className="font-mono font-bold text-sm text-terminal-text">
                        {teamName}
                      </span>
                      <span className="text-[10px] bg-terminal-dark-gray px-2 py-0.5 rounded text-terminal-text opacity-60 border border-terminal-border-subtle">
                        {playersByTeam[teamName].length}
                      </span>
                    </div>
                  </button>
                  
                  {expandedTeams.has(teamName) && (
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-terminal-dark-gray">
                      {playersByTeam[teamName].map((player) => (
                        <div 
                          key={player.player_id}
                          onClick={() => handlePlayerSelect(player.player_id)}
                          className="terminal-button p-2 rounded cursor-pointer flex justify-between items-center group hover:border-terminal-green/50"
                        >
                          <div>
                            <div className="text-xs font-medium text-terminal-text group-hover:text-terminal-green transition-colors">
                              {player.player_name}
                            </div>
                            <div className="text-[10px] text-terminal-text opacity-50">
                              {player.position}
                            </div>
                          </div>
                          <div className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            player.current_status?.toLowerCase() === 'active' 
                              ? 'text-terminal-green border-terminal-green/30 bg-terminal-green/10' 
                              : 'text-terminal-red border-terminal-red/30 bg-terminal-red/10'
                          }`}>
                            {player.current_status?.substring(0, 3).toUpperCase() || 'UNK'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {sortedTeams.length === 0 && (
                <div className="text-center py-12 text-terminal-text opacity-50 font-mono">
                  NO DATA FOUND MATCHING QUERY
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
