import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation, Navigate } from 'react-router-dom';
import { nbaDataService, Player, GamePlayerStats, PropPlayer, TeamPlayer, Team, PlayerShootingZones, DailyOpportunity } from '@/services/nba-data.service';
import AnalyticsNav from '@/components/AnalyticsNav';
import { GameChart } from '@/components/nba/GameChart';
import { ComparisonTable } from '@/components/nba/ComparisonTable';
import { PlayerHeader } from '@/components/nba/PlayerHeader';
import { PropInsightsCard } from '@/components/nba/PropInsightsCard';
import { TeammatesCard } from '@/components/nba/TeammatesCard';
import { NextGamesCard } from '@/components/nba/NextGamesCard';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShootingZonesCard } from '@/components/nba/ShootingZonesCard';
import { TeammateFilter } from '@/components/nba/TeammateFilterBar';
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
  isTeamB2B: boolean;
  isOpponentB2B: boolean;
  nextGameTime: string | null;
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
  const [isTeamB2B, setIsTeamB2B] = useState<boolean>(initCache?.isTeamB2B ?? false);
  const [isOpponentB2B, setIsOpponentB2B] = useState<boolean>(initCache?.isOpponentB2B ?? false);
  const [nextGameTime, setNextGameTime] = useState<string | null>(initCache?.nextGameTime ?? null);
  const [statsLoading, setStatsLoading] = useState(!initCache);
  const [propsLoading, setPropsLoading] = useState(!initCache);
  const [dailyOpps, setDailyOpps] = useState<DailyOpportunity[]>([]);
  const [teammatesLoading, setTeammatesLoading] = useState(!initCache);
  const [teamLoading, setTeamLoading] = useState(!initCache);
  const [shootingZonesLoading, setShootingZonesLoading] = useState(!initCache);
  const [playerLookupDone, setPlayerLookupDone] = useState(!!initCache);
  const initialStat = searchParams.get('stat');
  const initialTrigger = searchParams.get('trigger');
  const statFromUrl = initialStat && VALID_STAT_TYPES.includes(initialStat) ? initialStat : 'player_points';
  const [selectedStatType, setSelectedStatType] = useState<string>(statFromUrl);
  const [lastNGames, setLastNGames] = useState<number | 'all'>(15);
  const [homeAway, setHomeAway] = useState<'all' | 'home' | 'away'>('all');
  const [teammateFilter, setTeammateFilter] = useState<TeammateFilter>(null);
  const [teammateGameIds, setTeammateGameIds] = useState<Map<number, Set<number>> | null>(null);
  const [teammateFilterLoading, setTeammateFilterLoading] = useState(!!initialTrigger);
  const [b2bOnly, setB2bOnly] = useState(false);

  // React to URL param changes (stat type only — trigger handled below)
  useEffect(() => {
    const urlStat = searchParams.get('stat');
    if (urlStat && VALID_STAT_TYPES.includes(urlStat)) {
      setSelectedStatType(urlStat);
    }
  }, [searchParams.get('stat')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply trigger filter when teammates are ready + URL has trigger param
  useEffect(() => {
    const urlTrigger = searchParams.get('trigger');
    if (!urlTrigger || teammates.length === 0) return;

    const triggerTeammate = teammates.find(
      t => t.player_name.toLowerCase() === urlTrigger.toLowerCase()
    );
    if (triggerTeammate) {
      // Only apply if not already filtering for this trigger
      const alreadyFiltered = teammateFilter?.some(f => f.playerId === triggerTeammate.player_id && f.mode === 'without');
      if (!alreadyFiltered) {
        handleTeammateFilterChange([{
          playerId: triggerTeammate.player_id,
          playerName: triggerTeammate.player_name,
          mode: 'without',
        }]);
      }
    }
  }, [teammates.length, searchParams.get('trigger')]); // eslint-disable-line react-hooks/exhaustive-deps
  const [h2hOnly, setH2hOnly] = useState(false);

  useEffect(() => {
    loadPlayer();
  }, [playerName]);

  // Load daily opportunities whenever player is identified
  useEffect(() => {
    if (!player) return;
    nbaDataService.getDailyOpportunities()
      .then(allOpps => {
        const playerOpps = allOpps.filter(o => o.backup_player_name === player.player_name);
        setDailyOpps(playerOpps);
      })
      .catch(e => console.error('Error loading daily opportunities:', e));
  }, [player?.player_name]); // eslint-disable-line react-hooks/exhaustive-deps

  // PLG freemium: deslogado só acessa jogadores FREE_PLAYERS ou via Picks trial; outros → login
  const isFree = player ? isFreePlayer(player.player_name) : false;
  const isPicksTrial = !!initialTrigger; // came from Oportunidades do Dia top 2

  // Logado mas não premium: jogador não grátis e não via Picks trial → paywall
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!subscriptionLoading && user && player && !isPremium && !isFree && !isPicksTrial) {
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

  // Calculate season averages from all game stats
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

  // Ref to scroll chart into view when insight is clicked
  const chartRef = React.useRef<HTMLDivElement>(null);

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

    // Apply teammate filter (multi-select)
    if (teammateFilter && teammateFilter.length > 0 && teammateGameIds) {
      for (const tf of teammateFilter) {
        const ids = teammateGameIds.get(tf.playerId);
        if (!ids) continue;
        filtered = filtered.filter(g =>
          tf.mode === 'with'
            ? ids.has(Number(g.game_id))
            : !ids.has(Number(g.game_id))
        );
      }
    }

    // Apply B2B filter
    if (b2bOnly) {
      filtered = filtered.filter(g => g.is_b2b_game);
    }

    // Apply H2H filter (games against next opponent)
    if (h2hOnly && teamData?.next_opponent_abbreviation) {
      const opp = teamData.next_opponent_abbreviation.toUpperCase();
      filtered = filtered.filter(g =>
        g.played_against?.toUpperCase().replace('@', '').includes(opp)
      );
    }

    // Apply last N games filter
    if (lastNGames !== 'all') {
      filtered = filtered.slice(0, lastNGames);
    }

    return filtered;
  }, [gameStats, selectedStatType, homeAway, lastNGames, teammateFilter, teammateGameIds, b2bOnly, h2hOnly, teamData]);

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

  // Early returns (after all hooks)
  if (!authLoading && !user && player && !isFree && !isPicksTrial) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const loadPlayer = async () => {
    if (!playerName) return;

    const cached = dashboardCache.get(playerName);

    // Cache hit → set states and skip fetch
    // Invalidate stale cache entries that don't have B2B fields (added later)
    if (cached && cached.isTeamB2B !== undefined) {
      console.log(`[dashboard] cache hit: ${playerName}`);
      setPlayer(cached.player);
      setGameStats(cached.gameStats);
      setPropPlayers(cached.propPlayers);
      setTeammates(cached.teammates);
      setTeamData(cached.teamData);
      setShootingZones(cached.shootingZones);
      setIsTeamB2B(cached.isTeamB2B);
      setIsOpponentB2B(cached.isOpponentB2B);
      setNextGameTime(cached.nextGameTime);
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

      // 3. Prop insights — busca nas linhas dos LÍDERES que apontam este jogador como backup
      try {
        loadedProps = await nbaDataService.getPlayerTriggerInsights(playerData.player_name);
        setPropPlayers(loadedProps);
      } catch (e) { console.error('Error loading props:', e); }
      setPropsLoading(false);

      // 3.5. Daily opportunities loaded via separate effect below

      // 4. Teammates
      try {
        loadedTeammates = await nbaDataService.getTeamPlayers(playerData.team_id);
        setTeammates(loadedTeammates);

        // Trigger filter applied via separate useEffect when teammates are ready
      } catch (e) { console.error('Error loading teammates:', e); }
      setTeammatesLoading(false);

      // 5. Team / next game + B2B flags
      let loadedIsTeamB2B = false;
      let loadedIsOpponentB2B = false;
      let loadedNextGameTime: string | null = null;
      try {
        loadedTeam = await nbaDataService.getTeamById(playerData.team_id);
        setTeamData(loadedTeam);

        if (loadedTeam) {
          const teamId = Number(playerData.team_id);
          const nextOpponentId = Number(loadedTeam.next_opponent_id);
          // Filter by team abbreviation at DB level — avoids fetching all games
          const teamGames = await nbaDataService.getGames({ teamAbbreviation: loadedTeam.team_abbreviation });
          const now = new Date();
          const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const nextGame = teamGames
            .filter(g =>
              g.game_date >= today &&
              ((Number(g.home_team_id) === teamId && Number(g.visitor_team_id) === nextOpponentId) ||
               (Number(g.visitor_team_id) === teamId && Number(g.home_team_id) === nextOpponentId))
            )
            .sort((a, b) => a.game_date.localeCompare(b.game_date))[0];
          if (nextGame) {
            const isHome = Number(nextGame.home_team_id) === teamId;
            loadedIsTeamB2B = isHome ? nextGame.home_team_is_b2b_game : nextGame.visitor_team_is_b2b_game;
            loadedIsOpponentB2B = isHome ? nextGame.visitor_team_is_b2b_game : nextGame.home_team_is_b2b_game;
            if (nextGame.game_datetime_brasilia) {
              const date = new Date(nextGame.game_datetime_brasilia);
              const day = String(date.getDate()).padStart(2, '0');
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const hours = String(date.getHours()).padStart(2, '0');
              const minutes = String(date.getMinutes()).padStart(2, '0');
              loadedNextGameTime = `${day}/${month} · ${hours}:${minutes}`;
            }
          }
        }
        setIsTeamB2B(loadedIsTeamB2B);
        setIsOpponentB2B(loadedIsOpponentB2B);
        setNextGameTime(loadedNextGameTime);
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
        isTeamB2B: loadedIsTeamB2B,
        isOpponentB2B: loadedIsOpponentB2B,
        nextGameTime: loadedNextGameTime,
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

  const handleInsightClick = (statType: string, triggerPlayerName: string) => {
    // 1. Switch stat type to the insight's stat
    setSelectedStatType(statType);

    // 2. Find the trigger player in teammates and set "SEM" filter
    const triggerTeammate = teammates.find(
      t => t.player_name.toLowerCase() === triggerPlayerName.toLowerCase()
    );
    if (triggerTeammate) {
      handleTeammateFilterChange([{
        playerId: triggerTeammate.player_id,
        playerName: triggerTeammate.player_name,
        mode: 'without',
      }]);
    }

    // 3. Reset other filters to show clean view (all games for full season comparison)
    setLastNGames('all');
    setHomeAway('all');
    setB2bOnly(false);
    setH2hOnly(false);

    // No scroll — keep user's current position
  };

  const handleTeammateFilterChange = async (filter: TeammateFilter) => {
    setTeammateFilter(filter);
    if (!filter || filter.length === 0) {
      setTeammateGameIds(null);
      return;
    }
    setTeammateFilterLoading(true);
    try {
      // Load game_ids for each teammate in parallel
      const map = new Map<number, Set<number>>();
      const existing = teammateGameIds ?? new Map<number, Set<number>>();

      // Only load data for new teammates (reuse cached)
      const toLoad = filter.filter(f => !existing.has(f.playerId));
      const results = await Promise.all(
        toLoad.map(async f => {
          const stats = await nbaDataService.getPlayerGameStats(f.playerId, 250);
          return { playerId: f.playerId, gameIds: new Set(stats.map(g => Number(g.game_id))) };
        })
      );

      // Build map: keep existing + add new
      for (const f of filter) {
        const cached = existing.get(f.playerId);
        if (cached) {
          map.set(f.playerId, cached);
        }
      }
      for (const r of results) {
        map.set(r.playerId, r.gameIds);
      }

      setTeammateGameIds(map);
    } catch (e) {
      console.error('Error loading teammate stats:', e);
      setTeammateGameIds(null);
    } finally {
      setTeammateFilterLoading(false);
    }
  };

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left Sidebar */}
          <div className="lg:col-span-1 space-y-3">
            {/* Player Header */}
            <PlayerHeader
              player={player || undefined}
              seasonAverages={seasonAverages}
              isLoading={statsLoading}
            />

            {/* Next Game Card */}
            <NextGamesCard
              team={teamData || undefined}
              isLoading={teamLoading}
              isTeamB2B={isTeamB2B}
              isOpponentB2B={isOpponentB2B}
              nextGameTime={nextGameTime}
            />

            {/* Oportunidades do Dia (mesma fonte dos Picks) ou fallback para Insights */}
            {dailyOpps.length > 0 ? (
              <div className="terminal-container p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold text-terminal-green uppercase tracking-widest">
                    Oportunidades do Dia
                  </span>
                  <span className="text-[9px] opacity-40">mesma análise da tela de Picks</span>
                </div>
                <div className="space-y-2">
                  {dailyOpps.map((opp, i) => {
                    const triggerLastName = opp.trigger_name.split(' ').pop();
                    const statusBadge = opp.trigger_status.toLowerCase().includes('out') ? { text: 'OUT', cls: 'bg-terminal-red/20 text-terminal-red border-terminal-red/30' }
                      : opp.trigger_status.toLowerCase().includes('doubtful') ? { text: 'DTD', cls: 'bg-orange-400/20 text-orange-400 border-orange-400/30' }
                      : { text: 'Q', cls: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30' };
                    const statLabel = { player_points: 'Pontos', player_assists: 'Assistências', player_rebounds: 'Rebotes', player_points_rebounds_assists: 'PRA', player_threes: '3 Pontos', player_steals: 'Roubos', player_blocks: 'Bloqueios' }[opp.stat_type] || opp.stat_type;
                    const isClickable = !!handleInsightClick;

                    return (
                      <button
                        key={i}
                        className={`w-full text-left bg-terminal-dark-gray rounded border border-terminal-green/20 p-3 transition-all ${
                          isClickable ? 'hover:border-terminal-green/50 hover:bg-terminal-green/5 cursor-pointer' : 'cursor-default'
                        }`}
                        onClick={() => handleInsightClick?.(opp.stat_type, opp.trigger_name)}
                      >
                        {/* Header: stat + trigger + score */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-terminal-text uppercase">{statLabel}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${statusBadge.cls}`}>
                              SEM {triggerLastName} ({statusBadge.text})
                            </span>
                          </div>
                          <span className={`text-sm font-black tabular-nums ${
                            (opp.score ?? 0) >= 80 ? 'text-terminal-green' : (opp.score ?? 0) >= 70 ? 'text-terminal-yellow' : 'text-orange-400'
                          }`}>
                            {opp.score}
                          </span>
                        </div>

                        {/* Numbers */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm opacity-50">{opp.avg_com?.toFixed(1)}</span>
                          <span className="text-xs opacity-30">→</span>
                          <span className="text-lg font-bold text-terminal-green leading-none">{opp.avg_sem?.toFixed(1)}</span>
                          {opp.gap_pct > 0 && (
                            <span className="text-[11px] font-semibold text-terminal-green bg-terminal-green/10 px-1.5 py-0.5 rounded">
                              +{opp.gap_pct?.toFixed(1)}%
                            </span>
                          )}
                          {opp.line_value && (
                            <span className="text-[11px] opacity-40 ml-auto">Linha: {opp.line_value?.toFixed(1)}</span>
                          )}
                        </div>

                        <div className="text-[9px] opacity-40 mt-1">
                          com {triggerLastName} → sem {triggerLastName} • Clique para filtrar o gráfico
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <PropInsightsCard
                propPlayers={propPlayers}
                playerName={player?.player_name || ''}
                isLoading={propsLoading}
                onInsightClick={handleInsightClick}
              />
            )}

            {/* Teammates */}
            <TeammatesCard
              teammates={teammates}
              currentPlayerId={player?.player_id || 0}
              teamName={player?.team_name || ''}
              isLoading={teammatesLoading}
            />
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2" ref={chartRef}>
            {/* Game Chart (stat tabs integrated inside) */}
            {statsLoading ? (
              <Skeleton className="h-[400px] w-full bg-terminal-gray mb-6" />
            ) : (
              <GameChart
                gameStats={filteredGameStats}
                currentLine={currentLine}
                seasonAvg={(() => { const s = gameStats.filter(g => g.stat_type === selectedStatType); return s.length > 0 ? s.reduce((sum, g) => sum + (g.stat_value ?? 0), 0) / s.length : 0; })()}
                lastNGames={lastNGames}
                homeAway={homeAway}
                onLastNGamesChange={setLastNGames}
                onHomeAwayChange={setHomeAway}
                totalGamesAvailable={gameStats.filter(g => g.stat_type === selectedStatType).length}
                teammates={teammates}
                currentPlayerId={player?.player_id || 0}
                teamName={player?.team_name || ''}
                teammateFilter={teammateFilter}
                onTeammateFilterChange={handleTeammateFilterChange}
                teammateFilterLoading={teammateFilterLoading}
                selectedStatType={selectedStatType}
                onStatTypeChange={setSelectedStatType}
                b2bOnly={b2bOnly}
                onB2BChange={setB2bOnly}
                h2hOnly={h2hOnly}
                onH2HChange={setH2hOnly}
                nextOpponent={teamData?.next_opponent_abbreviation || undefined}
              />
            )}

            {/* Recent Games + Shooting Zones side by side */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-stretch">
              {statsLoading ? (
                <Skeleton className="h-[300px] w-full bg-terminal-gray" />
              ) : (
                <ComparisonTable
                  gameStats={filteredGameStats}
                  playerName={player?.player_name || ''}
                />
              )}
              <ShootingZonesCard
                data={shootingZones}
                isLoading={shootingZonesLoading}
                playerName={player?.player_name || ''}
              />
            </div>
          </div>
        </div>
      </main>

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
