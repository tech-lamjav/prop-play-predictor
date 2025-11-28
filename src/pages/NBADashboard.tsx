import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nbaDataService, Player, GamePlayerStats, PropPlayer, TeamPlayer, Team } from '@/services/nba-data.service';
import { NBAHeader } from '@/components/nba/NBAHeader';
import { GameChart } from '@/components/nba/GameChart';
import { ComparisonTable } from '@/components/nba/ComparisonTable';
import { StatTypeSelector } from '@/components/nba/StatTypeSelector';
import { PlayerHeader } from '@/components/nba/PlayerHeader';
import { PropInsightsCard } from '@/components/nba/PropInsightsCard';
import { TeammatesCard } from '@/components/nba/TeammatesCard';
import { NextGamesCard } from '@/components/nba/NextGamesCard';
import { SeasonStatsHeader } from '@/components/nba/SeasonStatsHeader';
import { QuickFiltersBar } from '@/components/nba/QuickFiltersBar';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function NBADashboard() {
  const { playerName } = useParams<{ playerName: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [player, setPlayer] = useState<Player | null>(null);
  const [gameStats, setGameStats] = useState<GamePlayerStats[]>([]);
  const [propPlayers, setPropPlayers] = useState<PropPlayer[]>([]);
  const [teammates, setTeammates] = useState<TeamPlayer[]>([]);
  const [teamData, setTeamData] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatType, setSelectedStatType] = useState<string>('player_points');
  const [lastNGames, setLastNGames] = useState<number | 'all'>('all');
  const [homeAway, setHomeAway] = useState<'all' | 'home' | 'away'>('all');

  useEffect(() => {
    loadPlayer();
  }, [playerName]);

  const loadPlayer = async () => {
    if (!playerName) return;
    
    try {
      setLoading(true);
      const playerData = await nbaDataService.getPlayerByName(playerName);
      
      if (!playerData) {
        toast({
          title: 'Player not found',
          description: `Could not find player "${playerName.replace(/-/g, ' ')}"`,
          variant: 'destructive',
        });
        navigate('/nba-players');
        return;
      }
      
      setPlayer(playerData);
      
      // Load all data in parallel for better performance
      const results = await Promise.allSettled([
        nbaDataService.getPlayerGameStats(playerData.player_id, 10), // Reduced from 30 to 10 for faster initial load
        nbaDataService.getPlayerProps(playerData.player_id),
        nbaDataService.getTeamPlayers(playerData.team_id),
        nbaDataService.getTeamById(playerData.team_id),
      ]);

      // Handle game stats
      if (results[0].status === 'fulfilled') {
        setGameStats(results[0].value);
      } else {
        console.error('Error loading game stats:', results[0].reason);
      }

      // Handle prop data
      if (results[1].status === 'fulfilled') {
        setPropPlayers(results[1].value);
      } else {
        console.error('Error loading prop data:', results[1].reason);
      }

      // Handle teammates
      if (results[2].status === 'fulfilled') {
        setTeammates(results[2].value);
      } else {
        console.error('Error loading teammates:', results[2].reason);
      }

      // Handle team data
      if (results[3].status === 'fulfilled') {
        setTeamData(results[3].value);
      } else {
        console.error('Error loading team data:', results[3].reason);
      }
    } catch (error) {
      console.error('Error loading player:', error);
      toast({
        title: 'Error',
        description: 'Failed to load player data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate season averages from all game stats
  // Must be before conditional returns to comply with Rules of Hooks
  const seasonAverages = React.useMemo(() => {
    const pointsGames = gameStats.filter(g => g.stat_type === 'player_points');
    const assistsGames = gameStats.filter(g => g.stat_type === 'player_assists');
    const reboundsGames = gameStats.filter(g => g.stat_type === 'player_rebounds');

    return {
      points: pointsGames.length > 0 
        ? pointsGames.reduce((sum, g) => sum + (g.stat_value ?? 0), 0) / pointsGames.length 
        : 0,
      assists: assistsGames.length > 0 
        ? assistsGames.reduce((sum, g) => sum + (g.stat_value ?? 0), 0) / assistsGames.length 
        : 0,
      rebounds: reboundsGames.length > 0 
        ? reboundsGames.reduce((sum, g) => sum + (g.stat_value ?? 0), 0) / reboundsGames.length 
        : 0,
    };
  }, [gameStats]);

  // Filter game stats based on selected filters
  const filteredGameStats = useMemo(() => {
    let filtered = gameStats.filter(g => g.stat_type === selectedStatType);

    // Apply home/away filter
    if (homeAway !== 'all') {
      filtered = filtered.filter(g => {
        const location = g.home_away?.toLowerCase();
        if (homeAway === 'home') {
          return location === 'home' || location === 'h' || location === 'casa';
        }
        return location === 'away' || location === 'a' || location === 'fora';
      });
    }

    // Apply last N games filter
    if (lastNGames !== 'all') {
      filtered = filtered.slice(0, lastNGames);
    }

    return filtered;
  }, [gameStats, selectedStatType, homeAway, lastNGames]);

  // Calculate stats for SeasonStatsHeader
  const seasonStatsData = useMemo(() => {
    const allStatsForType = gameStats.filter(g => g.stat_type === selectedStatType);
    
    const seasonAvg = allStatsForType.length > 0
      ? allStatsForType.reduce((sum, g) => sum + (g.stat_value ?? 0), 0) / allStatsForType.length
      : 0;

    const graphAvg = filteredGameStats.length > 0
      ? filteredGameStats.reduce((sum, g) => sum + (g.stat_value ?? 0), 0) / filteredGameStats.length
      : 0;

    const gamesOver = filteredGameStats.filter(g => g.stat_vs_line === 'Over').length;
    const hitRate = filteredGameStats.length > 0
      ? (gamesOver / filteredGameStats.length) * 100
      : 0;

    return {
      seasonAvg,
      graphAvg,
      hitRate,
      totalGames: filteredGameStats.length,
      gamesOver,
    };
  }, [gameStats, filteredGameStats, selectedStatType]);

  // Remove full page loading check to allow skeleton rendering
  // if (loading) { ... }

  if (!player && !loading) {
    return null;
  }

  return (
    <div className="w-full min-h-screen bg-terminal-black text-terminal-text">
      <NBAHeader playerName={playerName} />
      <main className="container mx-auto px-3 py-4">
        {/* Player Header */}
        <PlayerHeader 
          player={player || undefined} 
          seasonAverages={seasonAverages} 
          isLoading={loading}
        />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left Sidebar */}
          <div className="lg:col-span-1 space-y-3">
            {/* Next Game Card */}
            <NextGamesCard 
              team={teamData || undefined} 
              isLoading={loading}
            />
            
            {/* Prop Insights */}
            <PropInsightsCard 
              propPlayers={propPlayers} 
              playerName={player?.player_name || ''} 
              isLoading={loading}
            />
            
            {/* Teammates */}
            <TeammatesCard 
              teammates={teammates} 
              currentPlayerId={player?.player_id || 0}
              teamName={player?.team_name || ''}
              isLoading={loading}
            />
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {/* Stat Type Selector */}
            <StatTypeSelector
              availableStats={[]}
              selectedStat={selectedStatType}
              onStatChange={setSelectedStatType}
            />
            
            {/* Season Stats Header */}
            <SeasonStatsHeader
              seasonAvg={seasonStatsData.seasonAvg}
              graphAvg={seasonStatsData.graphAvg}
              hitRate={seasonStatsData.hitRate}
              totalGames={seasonStatsData.totalGames}
              gamesOver={seasonStatsData.gamesOver}
              statType={selectedStatType}
            />

            {/* Quick Filters Bar */}
            <QuickFiltersBar
              lastNGames={lastNGames}
              homeAway={homeAway}
              onLastNGamesChange={setLastNGames}
              onHomeAwayChange={setHomeAway}
              totalGamesAvailable={gameStats.filter(g => g.stat_type === selectedStatType).length}
            />
            
            {/* Game Chart */}
            {loading ? (
              <Skeleton className="h-[400px] w-full bg-terminal-gray mb-6" />
            ) : (
              <GameChart 
                gameStats={filteredGameStats} 
                statType={selectedStatType} 
              />
            )}
            
            {/* Comparison Table */}
            {loading ? (
              <Skeleton className="h-[300px] w-full bg-terminal-gray" />
            ) : (
              <ComparisonTable 
                gameStats={filteredGameStats} 
                playerName={player?.player_name || ''} 
              />
            )}
          </div>
        </div>
      </main>
      
      <footer className="terminal-header p-3 mt-6">
        <div className="container mx-auto flex justify-between items-center text-[10px]">
          <div className="opacity-50">
            © 2025 STATIX NBA - ALL RIGHTS RESERVED
          </div>
          <div className="flex space-x-3 opacity-50">
            <a href="#" className="hover:opacity-100 transition-opacity">
              HELP
            </a>
            <a href="#" className="hover:opacity-100 transition-opacity">
              TERMS
            </a>
            <a href="#" className="hover:opacity-100 transition-opacity">
              PRIVACY
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
