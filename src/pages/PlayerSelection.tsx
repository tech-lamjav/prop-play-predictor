import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthenticatedLayout from '../components/AuthenticatedLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, User, TrendingUp, Star, Target } from 'lucide-react';
import { bigQueryService } from '@/services/bigquery.service';

interface Player {
  id: number;
  name: string;
  team_name: string;
  position: string;
  current_status: string;
  games_played: number;
  minutes: number;
  team_rating_rank: number;
}

export default function PlayerSelection() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [teams, setTeams] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load players and teams
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log('Loading players data...');
        
        const [playersResult, teamsResult] = await Promise.all([
          bigQueryService.getAllPlayers(),
          bigQueryService.getAvailableTeams()
        ]);

        console.log('Players result:', playersResult);
        console.log('Teams result:', teamsResult);

        if (playersResult.success && playersResult.data) {
          console.log('Setting players:', playersResult.data);
          // Remove duplicates based on player ID and name
          const uniquePlayers = playersResult.data.filter((player, index, self) => 
            index === self.findIndex(p => p.id === player.id && p.name === player.name)
          );
          console.log('Unique players:', uniquePlayers.length);
          setPlayers(uniquePlayers);
          setFilteredPlayers(uniquePlayers);
        } else {
          console.error('Players error:', playersResult.error);
          setError(playersResult.error || 'Failed to load players');
        }

        if (teamsResult.success && teamsResult.data) {
          console.log('Setting teams:', teamsResult.data);
          setTeams(teamsResult.data);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load player data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Filter players based on search term and team
  useEffect(() => {
    console.log('Filtering players. Total players:', players.length);
    let filtered = players;

    if (searchTerm) {
      filtered = filtered.filter(player =>
        player.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedTeam) {
      filtered = filtered.filter(player => player.team_name === selectedTeam);
    }

    console.log('Filtered players:', filtered.length);
    setFilteredPlayers(filtered);
  }, [players, searchTerm, selectedTeam]);

  const handlePlayerSelect = (playerId: number) => {
    navigate(`/dashboard?playerId=${playerId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'questionable':
        return 'bg-yellow-100 text-yellow-800';
      case 'doubtful':
        return 'bg-orange-100 text-orange-800';
      case 'out':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'PG':
        return 'bg-blue-100 text-blue-800';
      case 'SG':
        return 'bg-purple-100 text-purple-800';
      case 'SF':
        return 'bg-green-100 text-green-800';
      case 'PF':
        return 'bg-orange-100 text-orange-800';
      case 'C':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <AuthenticatedLayout>
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-300">Loading players...</p>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (error) {
    return (
      <AuthenticatedLayout>
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 text-xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-white mb-2">Error Loading Players</h2>
            <p className="text-slate-300 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-slate-900">
        {/* Header */}
        <header className="bg-slate-800 border-b border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Prop Play Predictor</h1>
                <p className="text-slate-400 text-sm">NBA Player Analytics</p>
              </div>
            </div>
          </div>
        </header>

      <div className="container mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Select a Player
          </h2>
          <p className="text-lg text-slate-300">
            Choose a player to view detailed prop betting analysis
          </p>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="md:w-64">
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Teams</option>
                {teams.map((team, index) => (
                  <option key={`team-${index}-${team}`} value={team}>{team}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Players Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPlayers.map((player, index) => (
            <Card 
              key={`${player.id}-${index}`} 
              className="bg-slate-800 border-slate-700 hover:bg-slate-750 hover:border-slate-600 transition-all cursor-pointer"
              onClick={() => handlePlayerSelect(player.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-white">
                    {player.name}
                  </CardTitle>
                  <Badge className={getPositionColor(player.position)}>
                    {player.position}
                  </Badge>
                </div>
                <p className="text-slate-300">{player.team_name}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Status</span>
                    <Badge className={getStatusColor(player.current_status)}>
                      {player.current_status || 'Unknown'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Games Played</span>
                    <span className="text-sm font-medium text-white">{player.games_played}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Minutes</span>
                    <span className="text-sm font-medium text-white">{player.minutes?.toFixed(1)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Team Rating</span>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 text-yellow-500 mr-1" />
                      <span className="text-sm font-medium text-white">#{player.team_rating_rank}</span>
                    </div>
                  </div>
                </div>
                
                <Button 
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white border-0"
                  variant="outline"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  View Analysis
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredPlayers.length === 0 && (
          <div className="text-center py-12">
            <User className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No players found</h3>
            <p className="text-slate-400">
              Try adjusting your search terms or team filter
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="mt-8 text-center text-slate-400">
          Showing {filteredPlayers.length} of {players.length} players
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
