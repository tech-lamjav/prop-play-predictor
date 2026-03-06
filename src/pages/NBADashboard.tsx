import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation, Navigate } from 'react-router-dom';
import { nbaDataService, Player, GamePlayerStats, PropPlayer, TeamPlayer, Team, PlayerShootingZones } from '@/services/nba-data.service';
import AnalyticsNav from '@/components/AnalyticsNav';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShootingZonesCard } from '@/components/nba/ShootingZonesCard';
import { useSubscription } from '@/hooks/use-subscription';
import { useAuth } from '@/hooks/use-auth';
import { isFreePlayer } from '@/config/freemium';

const VALID_STAT_TYPES = ['player_points', 'player_assists', 'player_rebounds', 'player_points_rebounds_assists', 'player_points_assists', 'player_rebounds_assists'];

// In-memory cache — persists across navigations, clears on page refresh
interface PlayerCache {
  player: Player;
  gameStats: GamePlayerStats[];
  propPlayers: PropPlayer[];
  teammates: TeamPlayer[];
  teamData: Team | null;
  shootingZones: PlayerShootingZones | null;
}
const dashboardCache = new Map<string, PlayerCache>();

export default function NBADashboard() {
  const { playerName } = useParams<{ playerName: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const { isPremium, isLoading: subscriptionLoading } = useSubscription();
  // Initialize from cache if available — zero loading flash on revisit
  const initCache = playerName ? dashboardCache.get(playerName) : undefined;
  const [player, setPlayer] = useState<Player | null>(initCache?.player ?? null);
  const [gameStats, setGameStats] = useState<GamePlayerStats[]>(initCache?.gameStats ?? []);
  const [propPlayers, setPropPlayers] = useState<PropPlayer[]>(initCache?.propPlayers ?? []);
  const [teammates, setTeammates] = useState<TeamPlayer[]>(initCache?.teammates ?? []);
  const [teamData, setTeamData] = useState<Team | null>(initCache?.teamData ?? null);
  const [shootingZones, setShootingZones] = useState<PlayerShootingZones | null>(initCache?.shootingZones ?? null);
  const [statsLoading, setStatsLoading] = useState(!initCache);
  const [propsLoading, setPropsLoading] = useState(!initCache);
  const [teammatesLoading, setTeammatesLoading] = useState(!initCache);
  const [teamLoading, setTeamLoading] = useState(!initCache);
  const [shootingZonesLoading, setShootingZonesLoading] = useState(!initCache);
  const [playerLookupDone, setPlayerLookupDone] = useState(!!initCache);
  const initialStat = searchParams.get('stat');
  const statFromUrl = initialStat && VALID_STAT_TYPES.includes(initialStat) ? initialStat : 'player_points';
  const [selectedStatType, setSelectedStatType] = useState<string>(statFromUrl);
  const [lastNGames, setLastNGames] = useState<number | 'all'>('all');
  const [homeAway, setHomeAway] = useState<'all' | 'home' | 'away'>('all');

  useEffect(() => {
    loadPlayer();
  }, [playerName]);

  // PLG freemium: deslogado só acessa jogadores FREE_PLAYERS; outros → login
  const isFree = player ? isFreePlayer(player.player_name) : false;
  if (!authLoading && !user && player && !isFree) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Logado mas não premium: jogador não grátis → paywall
  useEffect(() => {
    if (!subscriptionLoading && user && player && !isPremium && !isFree) {
      const playerFullName = player.player_name;
      toast({
        title: 'Acesso Premium Necessário',
        description: `Análises completas de ${playerFullName} estão disponíveis apenas para assinantes premium.`,
        variant: 'default',
      });
      setTimeout(() => {
        navigate('/paywall-platform');
      }, 2000);
    }
  }, [player, user, isPremium, isFree, subscriptionLoading, navigate, toast]);

  const loadPlayer = async () => {
    if (!playerName) return;

    const cached = dashboardCache.get(playerName);

    // Cache hit → set states and skip fetch
    if (cached) {
      console.log(`[dashboard] cache hit: ${playerName}`);
      setPlayer(cached.player);
      setGameStats(cached.gameStats);
      setPropPlayers(cached.propPlayers);
      setTeammates(cached.teammates);
      setTeamData(cached.teamData);
      setShootingZones(cached.shootingZones);
      setPlayerLookupDone(true);
      setStatsLoading(false);
      setPropsLoading(false);
      setTeammatesLoading(false);
      setTeamLoading(false);
      setShootingZonesLoading(false);
      return;
    }

    console.log(`[dashboard] fetching: ${playerName}`);

    try {
      setStatsLoading(true);
      setPropsLoading(true);
      setTeammatesLoading(true);
      setTeamLoading(true);
      setShootingZonesLoading(true);
      setPlayerLookupDone(false);

      // 1. Player name → header renders immediately
      const playerData = await nbaDataService.getPlayerByName(playerName);

      if (!playerData) {
        setPlayerLookupDone(true);
        setStatsLoading(false);
        setPropsLoading(false);
        setTeammatesLoading(false);
        setTeamLoading(false);
        setShootingZonesLoading(false);
        toast({
          title: 'Player not found',
          description: `Could not find player "${playerName.replace(/-/g, ' ')}"`,
          variant: 'destructive',
        });
        navigate('/home-players');
        return;
      }

      setPlayer(playerData);
      setPlayerLookupDone(true);

      // Each call sequential — component appears as soon as its data arrives
      let loadedStats: GamePlayerStats[] = [];
      let loadedProps: PropPlayer[] = [];
      let loadedTeammates: TeamPlayer[] = [];
      let loadedTeam: Team | null = null;
      let loadedZones: PlayerShootingZones | null = null;

      // 2. Chart + table
      try {
        loadedStats = await nbaDataService.getPlayerGameStats(playerData.player_id, 100);
        setGameStats(loadedStats);
      } catch (e) { console.error('Error loading game stats:', e); }
      setStatsLoading(false);

      // 3. Prop insights
      try {
        loadedProps = await nbaDataService.getPlayerProps(playerData.player_id);
        setPropPlayers(loadedProps);
      } catch (e) { console.error('Error loading props:', e); }
      setPropsLoading(false);

      // 4. Teammates
      try {
        loadedTeammates = await nbaDataService.getTeamPlayers(playerData.team_id);
        setTeammates(loadedTeammates);
      } catch (e) { console.error('Error loading teammates:', e); }
      setTeammatesLoading(false);

      // 5. Team / next game
      try {
        loadedTeam = await nbaDataService.getTeamById(playerData.team_id);
        setTeamData(loadedTeam);
      } catch (e) { console.error('Error loading team:', e); }
      setTeamLoading(false);

      // 6. Shooting zones
      try {
        loadedZones = await nbaDataService.getPlayerShootingZones(playerData.player_id);
        setShootingZones(loadedZones);
      } catch (e) { console.error('Error loading shooting zones:', e); }
      setShootingZonesLoading(false);

      // Save to cache
      dashboardCache.set(playerName, {
        player: playerData,
        gameStats: loadedStats,
        propPlayers: loadedProps,
        teammates: loadedTeammates,
        teamData: loadedTeam,
        shootingZones: loadedZones,
      });
    } catch (error) {
      setPlayerLookupDone(true);
      console.error('Error loading player:', error);
      toast({
        title: 'Error',
        description: 'Failed to load player data',
        variant: 'destructive',
      });
      setStatsLoading(false);
      setPropsLoading(false);
      setTeammatesLoading(false);
      setTeamLoading(false);
      setShootingZonesLoading(false);
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

    const isOverGame = (g: GamePlayerStats) => {
      const statVsLine = (g.stat_vs_line || '').trim().toLowerCase();
      if (statVsLine) {
        if (statVsLine.includes('over')) return true;
        if (statVsLine.includes('under')) return false;
      }

      // Fallback when stat_vs_line is missing/inconsistent
      const line = g.line ?? 0;
      return line > 0 ? (g.stat_value ?? 0) > line : false;
    };

    const gamesForHitRate = filteredGameStats.filter(
      g => (g.line ?? 0) > 0 || !!(g.stat_vs_line && g.stat_vs_line.trim())
    );
    const gamesOver = gamesForHitRate.filter(isOverGame).length;
    const hitRate = gamesForHitRate.length > 0
      ? (gamesOver / gamesForHitRate.length) * 100
      : 0;

    return {
      seasonAvg,
      graphAvg,
      hitRate,
      totalGames: gamesForHitRate.length,
      gamesOver,
    };
  }, [gameStats, filteredGameStats, selectedStatType]);

  // Get current betting line for selected stat type
  const currentLine = useMemo(() => {
    // Get the most recent game's line_most_recent for the selected stat type
    const statsForType = gameStats.filter(g => g.stat_type === selectedStatType);
    if (statsForType.length === 0) return null;
    
    // Sort by date descending and get the first one's line_most_recent
    const sortedStats = [...statsForType].sort((a, b) => 
      new Date(b.game_date).getTime() - new Date(a.game_date).getTime()
    );
    
    return sortedStats[0]?.line_most_recent ?? null;
  }, [gameStats, selectedStatType]);

  if (!player && playerLookupDone) {
    return (
      <div className="w-full min-h-screen bg-terminal-black text-terminal-text flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-terminal-text opacity-80">Jogador não encontrado.</p>
        <Button
          variant="outline"
          className="terminal-button"
          onClick={() => navigate('/home-players')}
        >
          Voltar ao início
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-terminal-black text-terminal-text">
      <AnalyticsNav showBack backTo="/home-players" title={player?.player_name} />
      <main className="container mx-auto px-3 py-4">
        {/* Player Header */}
        <PlayerHeader
          player={player || undefined}
          seasonAverages={seasonAverages}
          isLoading={statsLoading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left Sidebar */}
          <div className="lg:col-span-1 space-y-3">
            {/* Next Game Card */}
            <NextGamesCard
              team={teamData || undefined}
              isLoading={teamLoading}
            />

            {/* Prop Insights */}
            <PropInsightsCard
              propPlayers={propPlayers}
              playerName={player?.player_name || ''}
              isLoading={propsLoading}
            />

            {/* Teammates */}
            <TeammatesCard
              teammates={teammates}
              currentPlayerId={player?.player_id || 0}
              teamName={player?.team_name || ''}
              isLoading={teammatesLoading}
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
            {statsLoading ? (
              <Skeleton className="h-[400px] w-full bg-terminal-gray mb-6" />
            ) : (
              <GameChart
                gameStats={filteredGameStats}
                statType={selectedStatType}
                currentLine={currentLine}
                seasonAvg={seasonStatsData.seasonAvg}
              />
            )}

            {/* Comparison Table */}
            {statsLoading ? (
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
      
      <section className="container mx-auto px-3 pb-6">
        <ShootingZonesCard
          data={shootingZones}
          isLoading={shootingZonesLoading}
          playerName={player?.player_name || ''}
        />
      </section>

      <footer className="terminal-header p-3 mt-6">
        <div className="container mx-auto flex justify-between items-center text-[10px]">
          <div className="opacity-50">
            © 2025 Smartbetting - All rights reserved
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
