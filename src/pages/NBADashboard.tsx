import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation, Navigate } from 'react-router-dom';
import { nbaDataService, Player, GamePlayerStats, PropPlayer, TeamPlayer, Team, PlayerShootingZones, DailyOpportunity, OpponentRankings, TeamPlaytypes, TeamOppShootingZones, PlayerPassingSeason } from '@/services/nba-data.service';
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
import { MatchupZonesCard } from '@/components/nba/MatchupZonesCard';
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
  const [gamePeriod, setGamePeriod] = useState<'full' | 'q1' | 'h1'>('full');
  const [periodStats, setPeriodStats] = useState<GamePlayerStats[]>([]);
  const [periodStatsLoaded, setPeriodStatsLoaded] = useState(false);
  const [oppRankings, setOppRankings] = useState<OpponentRankings | null>(null);
  const [oppPlaytypes, setOppPlaytypes] = useState<TeamPlaytypes | null>(null);
  const [oppShootingZones, setOppShootingZones] = useState<TeamOppShootingZones | null>(null);
  const [passingSeason, setPassingSeason] = useState<PlayerPassingSeason | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | 'current'>('current');
  const [seasonType, setSeasonType] = useState<'all' | 'regular' | 'playoffs' | 'playin'>('all');
  const [historicalStats, setHistoricalStats] = useState<Map<number, GamePlayerStats[]>>(new Map());
  const [historicalLoading, setHistoricalLoading] = useState(false);

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

  // Lazy-load period stats when user switches to Q1/H1
  useEffect(() => {
    if (gamePeriod === 'full' || periodStatsLoaded || !player) return;
    let cancelled = false;
    nbaDataService.getPlayerPeriodStats(player.player_id, 100).then(data => {
      if (!cancelled) {
        setPeriodStats(data);
        setPeriodStatsLoaded(true);
      }
    }).catch(e => console.error('Error loading period stats:', e));
    return () => { cancelled = true; };
  }, [gamePeriod, periodStatsLoaded, player]);

  // Lazy-load historical stats for past seasons
  useEffect(() => {
    if (selectedSeason === 'current' || !player) return;
    if (historicalStats.has(selectedSeason)) return;
    let cancelled = false;
    setHistoricalLoading(true);
    nbaDataService.getPlayerHistoricalStats(player.player_id, selectedSeason).then(data => {
      if (!cancelled) {
        setHistoricalStats(prev => {
          const next = new Map(prev);
          next.set(selectedSeason, data);
          return next;
        });
        setHistoricalLoading(false);
      }
    }).catch(e => {
      console.error('Error loading historical stats:', e);
      if (!cancelled) setHistoricalLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedSeason, player, historicalStats]);

  // Reset period to 'full' when switching to past season
  useEffect(() => {
    if (selectedSeason !== 'current' && gamePeriod !== 'full') {
      setGamePeriod('full');
    }
  }, [selectedSeason]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync selectedStatType with gamePeriod (Q1/H1 tabs also change period)
  useEffect(() => {
    if (selectedStatType.startsWith('player_q1_')) {
      if (gamePeriod !== 'q1') setGamePeriod('q1');
    } else if (selectedStatType.startsWith('player_h1_')) {
      if (gamePeriod !== 'h1') setGamePeriod('h1');
    } else {
      if (gamePeriod !== 'full') setGamePeriod('full');
    }
  }, [selectedStatType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter game stats based on selected filters
  const filteredGameStats = useMemo(() => {
    let sourceStats: GamePlayerStats[];
    if (selectedSeason !== 'current') {
      sourceStats = historicalStats.get(selectedSeason) || [];
    } else if (gamePeriod !== 'full') {
      sourceStats = periodStats;
    } else {
      sourceStats = gameStats;
    }

    let filtered = sourceStats.filter(g => g.stat_type === selectedStatType);

    // Apply season_type filter (historical only)
    if (selectedSeason !== 'current' && seasonType !== 'all') {
      filtered = filtered.filter(g => g.season_type === seasonType);
    }

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
  }, [gameStats, periodStats, historicalStats, selectedSeason, seasonType, gamePeriod, selectedStatType, homeAway, lastNGames, teammateFilter, teammateGameIds, b2bOnly, h2hOnly, teamData]);

  // Get current betting line for selected stat type
  // For periods/historical without market lines: fallback to player average rounded to .5
  const currentLine = useMemo(() => {
    let sourceStats: GamePlayerStats[];
    if (selectedSeason !== 'current') {
      sourceStats = historicalStats.get(selectedSeason) || [];
    } else if (gamePeriod !== 'full') {
      sourceStats = periodStats;
    } else {
      sourceStats = gameStats;
    }
    const statsForType = sourceStats.filter(g => g.stat_type === selectedStatType);
    if (statsForType.length === 0) return null;

    // Try market line first
    const sortedStats = [...statsForType].sort((a, b) =>
      new Date(b.game_date).getTime() - new Date(a.game_date).getTime()
    );
    const marketLine = sortedStats[0]?.line_most_recent ?? null;
    if (marketLine !== null) return marketLine;

    // Fallback: player average rounded down to nearest .5
    const avg = statsForType.reduce((sum, g) => sum + (g.stat_value ?? 0), 0) / statsForType.length;
    return Math.floor(avg) + 0.5;
  }, [gameStats, periodStats, historicalStats, selectedSeason, gamePeriod, selectedStatType]);

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

      // Cache doesn't include opponent rankings/playtypes/zones — fetch in background
      if (cached.teamData?.next_opponent_id) {
        nbaDataService.getOpponentRankings(cached.teamData.next_opponent_id)
          .then(data => setOppRankings(data))
          .catch(e => console.error('Error loading opponent rankings:', e));
        nbaDataService.getTeamPlaytypes(cached.teamData.next_opponent_id)
          .then(data => setOppPlaytypes(data))
          .catch(e => console.error('Error loading opponent playtypes:', e));
        nbaDataService.getTeamOppShootingZones(cached.teamData.next_opponent_id)
          .then(data => setOppShootingZones(data))
          .catch(e => console.error('Error loading opponent shooting zones:', e));
      }

      // Passing season profile — tambem nao vem do cache
      if (cached.player?.player_id) {
        nbaDataService.getPlayerPassingSeason(cached.player.player_id)
          .then(data => setPassingSeason(data))
          .catch(e => console.error('Error loading passing season:', e));
      }

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
        navigate('/home-nba');
        return;
      }

      setPlayer(playerData);
      setPlayerLookupDone(true);

      // Passing season (perfil de playmaking) — non-blocking, paralelo
      nbaDataService.getPlayerPassingSeason(playerData.player_id)
        .then(data => setPassingSeason(data))
        .catch(e => console.error('Error loading passing season:', e));

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

        // Load opponent rankings + playtypes + zones in parallel (non-blocking)
        if (loadedTeam?.next_opponent_id) {
          nbaDataService.getOpponentRankings(loadedTeam.next_opponent_id)
            .then(data => setOppRankings(data))
            .catch(e => console.error('Error loading opponent rankings:', e));
          nbaDataService.getTeamPlaytypes(loadedTeam.next_opponent_id)
            .then(data => setOppPlaytypes(data))
            .catch(e => console.error('Error loading opponent playtypes:', e));
          nbaDataService.getTeamOppShootingZones(loadedTeam.next_opponent_id)
            .then(data => setOppShootingZones(data))
            .catch(e => console.error('Error loading opponent shooting zones:', e));
        }

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
      <div className="w-full min-h-screen bg-canvas text-ink flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-ink opacity-80">Jogador não encontrado.</p>
        <Button
          variant="outline"
          className="bg-white border border-line text-ink hover:border-forest/30"
          onClick={() => navigate(-1)}
        >
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-canvas text-ink">
      <AnalyticsNav variant="rebrand" showBack />
      <main className="container mx-auto px-3 py-4">
        {(() => {
          const playerHeaderEl = (
            <PlayerHeader
              player={player || undefined}
              seasonAverages={seasonAverages}
              isLoading={statsLoading}
            />
          );

          const nextGameEl = (
            <NextGamesCard
              team={teamData || undefined}
              isLoading={teamLoading}
              isTeamB2B={isTeamB2B}
              isOpponentB2B={isOpponentB2B}
              nextGameTime={nextGameTime}
              opponentRankings={oppRankings}
              opponentPlaytypes={oppPlaytypes}
              selectedStatType={selectedStatType}
            />
          );

          const opportunitiesEl = dailyOpps.length > 0 ? (
              <div className="rounded-lg bg-white border border-line overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-line">
                  <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2">
                    Oportunidades do dia
                  </span>
                  <span className="text-[10px] text-ink-dim">mesma análise da tela de Picks</span>
                </div>
                {dailyOpps.map((opp, i) => {
                  const triggerLastName = opp.trigger_name.split(' ').pop() ?? opp.trigger_name;
                  const status = opp.trigger_status.toLowerCase();
                  const statusBadge = status.includes('out')
                    ? 'OUT'
                    : status.includes('doubtful')
                      ? 'DTD'
                      : 'Q';
                  const statLabel: Record<string, string> = {
                    player_points: 'Pontos',
                    player_assists: 'Assistências',
                    player_rebounds: 'Rebotes',
                    player_points_rebounds_assists: 'PRA',
                    player_threes: '3 Pontos',
                    player_steals: 'Roubos',
                    player_blocks: 'Bloqueios',
                  };
                  const label = statLabel[opp.stat_type] || opp.stat_type;
                  const isClickable = !!handleInsightClick;
                  const score = opp.score ?? 0;
                  const scoreColor = score >= 80 ? 'text-forest' : score >= 70 ? 'text-forest' : 'text-amber-700';

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleInsightClick?.(opp.stat_type, opp.trigger_name)}
                      className={`w-full text-left px-4 py-3.5 ${i > 0 ? 'border-t border-line' : ''} ${
                        isClickable ? 'hover:bg-canvas-2/40 cursor-pointer transition-colors' : 'cursor-default'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[12px] font-semibold tracking-tight text-ink">{label}</span>
                            <span className="px-1.5 h-5 inline-flex items-center rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              Sem {triggerLastName} ({statusBadge})
                            </span>
                          </div>
                          <div className="text-[12px] tabular mt-1.5 text-ink-2 flex items-center gap-1.5 flex-wrap">
                            <span>{opp.avg_com?.toFixed(1) ?? '—'}</span>
                            <span className="text-ink-dim">→</span>
                            <span className="font-semibold text-[14px] text-ink">{opp.avg_sem?.toFixed(1) ?? '—'}</span>
                            {opp.gap_pct != null && (
                              <span className="ml-1 font-semibold text-forest">+{opp.gap_pct.toFixed(1)}%</span>
                            )}
                          </div>
                          <div className="text-[10px] mt-1.5 text-ink-dim">
                            {opp.line_value != null ? `Linha: ${opp.line_value.toFixed(1)} · ` : ''}
                            clique para filtrar o gráfico
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-dim">Score</div>
                          <div className={`text-[24px] font-semibold tabular tracking-tight ${scoreColor}`}>{opp.score ?? '—'}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <PropInsightsCard
                propPlayers={propPlayers}
                playerName={player?.player_name || ''}
                isLoading={propsLoading}
                onInsightClick={handleInsightClick}
              />
            );

          const teammatesEl = (
            <TeammatesCard
              teammates={teammates}
              currentPlayerId={player?.player_id || 0}
              teamName={player?.team_name || ''}
              isLoading={teammatesLoading}
            />
          );

          const gameChartEl = statsLoading ? (
              <Skeleton className="h-[400px] w-full bg-canvas-2 mb-6" />
            ) : (
              <GameChart
                chartLoading={
                  (gamePeriod !== 'full' && selectedSeason === 'current' && !periodStatsLoaded)
                  || (selectedSeason !== 'current' && historicalLoading && !historicalStats.has(selectedSeason))
                }
                gameStats={filteredGameStats}
                currentLine={currentLine}
                seasonAvg={(() => {
                  const src = selectedSeason !== 'current'
                    ? (historicalStats.get(selectedSeason) || [])
                    : (gamePeriod === 'full' ? gameStats : periodStats);
                  const s = src.filter(g => g.stat_type === selectedStatType && (selectedSeason === 'current' || seasonType === 'all' || g.season_type === seasonType));
                  return s.length > 0 ? s.reduce((sum, g) => sum + (g.stat_value ?? 0), 0) / s.length : 0;
                })()}
                lastNGames={lastNGames}
                homeAway={homeAway}
                onLastNGamesChange={setLastNGames}
                onHomeAwayChange={setHomeAway}
                totalGamesAvailable={(() => {
                  const src = selectedSeason !== 'current'
                    ? (historicalStats.get(selectedSeason) || [])
                    : (gamePeriod === 'full' ? gameStats : periodStats);
                  return src.filter(g => g.stat_type === selectedStatType && (selectedSeason === 'current' || seasonType === 'all' || g.season_type === seasonType)).length;
                })()}
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
                selectedSeason={selectedSeason}
                onSeasonChange={setSelectedSeason}
                seasonType={seasonType}
                onSeasonTypeChange={setSeasonType}
                potentialAstSeason={passingSeason?.potential_ast ?? null}
                potentialAstSeasonRank={passingSeason?.potential_ast_rank ?? null}
              />
            );

          const recentGamesEl = statsLoading ? (
            <Skeleton className="h-[300px] w-full bg-canvas-2" />
          ) : (
            <ComparisonTable
              gameStats={filteredGameStats}
              playerName={player?.player_name || ''}
            />
          );

          const zonesEl = (
            <ShootingZonesCard
              data={shootingZones}
              isLoading={shootingZonesLoading}
              playerName={player?.player_name || ''}
              oppShootingZones={oppShootingZones}
              opponentAbbreviation={teamData?.next_opponent_abbreviation || null}
            />
          );

          const matchupEl = (
            <MatchupZonesCard
              data={shootingZones}
              oppShootingZones={oppShootingZones}
              opponentAbbreviation={teamData?.next_opponent_abbreviation || null}
              playerName={player?.player_name}
            />
          );

          return (
            <>
              {/* Mobile layout — single column reordered */}
              <div className="lg:hidden flex flex-col gap-3" ref={chartRef}>
                {playerHeaderEl}
                {nextGameEl}
                {opportunitiesEl}
                {gameChartEl}
                {zonesEl}
                {matchupEl}
                {recentGamesEl}
                {teammatesEl}
              </div>

              {/* Desktop layout — 3-col grid */}
              <div className="hidden lg:grid lg:grid-cols-3 gap-3">
                <div className="lg:col-span-1 space-y-3">
                  {playerHeaderEl}
                  {nextGameEl}
                  {opportunitiesEl}
                  {teammatesEl}
                </div>
                <div className="lg:col-span-2 space-y-3">
                  {gameChartEl}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-stretch">
                    {recentGamesEl}
                    {zonesEl}
                  </div>
                  {matchupEl}
                </div>
              </div>
            </>
          );
        })()}
      </main>

    </div>
  );
}
