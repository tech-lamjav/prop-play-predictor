import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import AnalyticsNav from '@/components/AnalyticsNav';
import { nbaDataService, Game, TeamPlayer, Team, BoxScorePlayer, B2BBoxScorePlayer } from '@/services/nba-data.service';
import { gamesCache } from '@/pages/Games';
import { getTeamLogoUrl, getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';
import { getInjuryStatusStyle, getInjuryStatusLabel } from '@/utils/injury-status';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

const formatGameDateSaoPaulo = (dateString: string): string => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateString)
    ? new Date(`${dateString}T12:00:00-03:00`)
    : new Date(dateString);

  return date.toLocaleDateString('pt-BR', {
    timeZone: SAO_PAULO_TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// Cache per gameId
interface GameDetailCache {
  game: Game;
  homePlayers: TeamPlayer[];
  visitorPlayers: TeamPlayer[];
  homeTeam: Team | null;
  visitorTeam: Team | null;
  b2bData?: { home: B2BBoxScorePlayer[]; visitor: B2BBoxScorePlayer[] };
}
const gameDetailCache = new Map<string, GameDetailCache>();

export default function GameDetail() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const initCache = gameId ? gameDetailCache.get(gameId) : undefined;
  const [game, setGame] = useState<Game | null>(initCache?.game ?? null);
  const [homePlayers, setHomePlayers] = useState<TeamPlayer[]>(initCache?.homePlayers ?? []);
  const [visitorPlayers, setVisitorPlayers] = useState<TeamPlayer[]>(initCache?.visitorPlayers ?? []);
  const [homeTeam, setHomeTeam] = useState<Team | null>(initCache?.homeTeam ?? null);
  const [visitorTeam, setVisitorTeam] = useState<Team | null>(initCache?.visitorTeam ?? null);
  const [isLoadingGame, setIsLoadingGame] = useState(!initCache);
  const [isLoadingTeams, setIsLoadingTeams] = useState(!initCache);
  const [boxScore, setBoxScore] = useState<BoxScorePlayer[]>([]);
  const [isLoadingBoxScore, setIsLoadingBoxScore] = useState(false);
  const [activeTab, setActiveTab] = useState<'lineups' | 'boxscore' | 'b2b'>(initCache?.game?.winner_team_id != null ? 'boxscore' : 'lineups');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'desc' | 'asc' }>({ key: 'points', direction: 'desc' });
  const [boxScoreView, setBoxScoreView] = useState<'all' | 'home' | 'visitor'>('all');
  const [detailedView, setDetailedView] = useState(() => window.innerWidth >= 768);
  const [b2bData, setB2bData] = useState<{ home: B2BBoxScorePlayer[]; visitor: B2BBoxScorePlayer[] }>(initCache?.b2bData ?? { home: [], visitor: [] });
  const [isLoadingB2B, setIsLoadingB2B] = useState(false);
  const [b2bLoaded, setB2bLoaded] = useState(!!initCache?.b2bData);
  const hasLoaded = React.useRef(false);

  useEffect(() => {
    if (!authLoading && user && !hasLoaded.current) {
      loadGameData();
    }
  }, [gameId, authLoading, user]);

  // Load box score when tab is activated and game is finished
  useEffect(() => {
    if (activeTab === 'boxscore' && game && game.winner_team_id !== null && boxScore.length === 0 && !isLoadingBoxScore) {
      setIsLoadingBoxScore(true);
      nbaDataService.getGameBoxScore(game.game_id)
        .then(data => setBoxScore(data))
        .catch(err => console.error('Error loading box score:', err))
        .finally(() => setIsLoadingBoxScore(false));
    }
  }, [activeTab, game]);

  // Load B2B data when tab is activated (lazy loading with cache)
  useEffect(() => {
    if (activeTab === 'b2b' && game && !isLoadingB2B) {
      const hasCache = b2bLoaded;
      // Skip if already loaded and not a background refresh
      if (hasCache) {
        // Background refresh: reload silently without showing loading state
        const freshData: { home: B2BBoxScorePlayer[]; visitor: B2BBoxScorePlayer[] } = { home: [], visitor: [] };
        const promises: Promise<void>[] = [];
        if (game.home_team_is_b2b_game) {
          promises.push(
            nbaDataService.getB2BPreviousGameBoxScore(game.game_id, game.home_team_id)
              .then(data => { freshData.home = data; })
              .catch(() => {})
          );
        }
        if (game.visitor_team_is_b2b_game) {
          promises.push(
            nbaDataService.getB2BPreviousGameBoxScore(game.game_id, game.visitor_team_id)
              .then(data => { freshData.visitor = data; })
              .catch(() => {})
          );
        }
        Promise.all(promises).then(() => {
          setB2bData(freshData);
          if (gameId) {
            const cached = gameDetailCache.get(gameId);
            if (cached) gameDetailCache.set(gameId, { ...cached, b2bData: freshData });
          }
        });
        return;
      }

      // First load: show loading state
      setIsLoadingB2B(true);
      const newData: { home: B2BBoxScorePlayer[]; visitor: B2BBoxScorePlayer[] } = { home: [], visitor: [] };
      const promises: Promise<void>[] = [];

      if (game.home_team_is_b2b_game) {
        promises.push(
          nbaDataService.getB2BPreviousGameBoxScore(game.game_id, game.home_team_id)
            .then(data => { newData.home = data; })
            .catch(err => console.error('Error loading home B2B data:', err))
        );
      }
      if (game.visitor_team_is_b2b_game) {
        promises.push(
          nbaDataService.getB2BPreviousGameBoxScore(game.game_id, game.visitor_team_id)
            .then(data => { newData.visitor = data; })
            .catch(err => console.error('Error loading visitor B2B data:', err))
        );
      }

      Promise.all(promises).finally(() => {
        setB2bData(newData);
        setIsLoadingB2B(false);
        setB2bLoaded(true);
        // Save to cache
        if (gameId) {
          const cached = gameDetailCache.get(gameId);
          if (cached) gameDetailCache.set(gameId, { ...cached, b2bData: newData });
        }
      });
    }
  }, [activeTab, game]);

  // PLG freemium: detalhe do jogo exige login (deslogado redireciona para /auth)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-terminal-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-terminal-green" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const loadGameData = async () => {
    if (!gameId) return;

    // Cache hit (full detail)
    const cached = gameDetailCache.get(gameId);
    if (cached) {
      setGame(cached.game);
      setHomePlayers(cached.homePlayers);
      setVisitorPlayers(cached.visitorPlayers);
      setHomeTeam(cached.homeTeam);
      setVisitorTeam(cached.visitorTeam);
      setIsLoadingGame(false);
      setIsLoadingTeams(false);
      hasLoaded.current = true;
      return;
    }

    try {
      setIsLoadingGame(true);
      setIsLoadingTeams(true);

      // 1. Find the game — check gamesCache first, then fetch
      const searchParams = new URLSearchParams(location.search);
      const gameDate = searchParams.get('date') || undefined;

      let foundGame: Game | undefined;
      if (gameDate) {
        const cachedGames = gamesCache.get(gameDate);
        if (cachedGames) {
          foundGame = cachedGames.find(g => g.game_id === parseInt(gameId));
        }
      }

      if (!foundGame) {
        const games = await nbaDataService.getGames({ gameDate });
        foundGame = games.find(g => g.game_id === parseInt(gameId));
      }

      if (!foundGame) {
        toast({
          title: 'Game not found',
          description: 'Could not find the requested game.',
          variant: 'destructive',
        });
        navigate('/home-games');
        return;
      }

      setGame(foundGame);
      if (foundGame.winner_team_id != null) setActiveTab('boxscore');
      setIsLoadingGame(false);

      // 2. Home team data
      let loadedHomePlayers: TeamPlayer[] = [];
      let loadedHomeTeam: Team | null = null;
      try {
        const [hp, ht] = await Promise.allSettled([
          nbaDataService.getTeamPlayers(foundGame.home_team_id),
          nbaDataService.getTeamById(foundGame.home_team_id),
        ]);
        if (hp.status === 'fulfilled') { loadedHomePlayers = hp.value; setHomePlayers(hp.value); }
        if (ht.status === 'fulfilled') { loadedHomeTeam = ht.value; setHomeTeam(ht.value); }
      } catch (e) { console.error('Error loading home team:', e); }

      // 3. Visitor team data
      let loadedVisitorPlayers: TeamPlayer[] = [];
      let loadedVisitorTeam: Team | null = null;
      try {
        const [vp, vt] = await Promise.allSettled([
          nbaDataService.getTeamPlayers(foundGame.visitor_team_id),
          nbaDataService.getTeamById(foundGame.visitor_team_id),
        ]);
        if (vp.status === 'fulfilled') { loadedVisitorPlayers = vp.value; setVisitorPlayers(vp.value); }
        if (vt.status === 'fulfilled') { loadedVisitorTeam = vt.value; setVisitorTeam(vt.value); }
      } catch (e) { console.error('Error loading visitor team:', e); }

      // Save to cache
      gameDetailCache.set(gameId, {
        game: foundGame,
        homePlayers: loadedHomePlayers,
        visitorPlayers: loadedVisitorPlayers,
        homeTeam: loadedHomeTeam,
        visitorTeam: loadedVisitorTeam,
      });
      hasLoaded.current = true;
    } catch (error) {
      console.error('Error loading game data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load game data',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingGame(false);
      setIsLoadingTeams(false);
    }
  };

  const getPlayerHref = (playerName: string) => {
    const slug = playerName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '-');
    return `/nba-dashboard/${slug}`;
  };

  // Use winner_team_id as the source of truth so FT does not appear on scheduled 0-0 games
  const isGameFinished = game?.winner_team_id !== null;
  const isB2B = game?.home_team_is_b2b_game || game?.visitor_team_is_b2b_game;

  // Helper function to render last five games with colors
  const renderLastFiveWithColors = (lastFive: string | null) => {
    if (!lastFive) return <span className="opacity-50">N/A</span>;

    const results = lastFive.replace(/\s/g, '').slice(0, 5).split('').reverse();
    const opacities = ['opacity-20', 'opacity-40', 'opacity-60', 'opacity-80', 'opacity-100'];

    return (
      <div className="flex items-center gap-0.5">
        {results.map((result, idx) => {
          const isWin = result === 'V' || result === 'W';
          return (
            <span
              key={idx}
              title={isWin ? 'Vitória' : 'Derrota'}
              className={`w-5 h-5 flex items-center justify-center text-[10px] font-bold rounded cursor-default ${opacities[idx] ?? 'opacity-100'} ${
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

  // Get last five from team data or game data
  const homeLastFive = homeTeam?.team_last_five_games || game?.home_team_last_five;
  const visitorLastFive = visitorTeam?.team_last_five_games || game?.visitor_team_last_five;
  const injuryReportTime =
    homeTeam?.team_injury_report_time_brasilia ||
    visitorTeam?.team_injury_report_time_brasilia ||
    null;

  // Filter players for injury report (not Active/Available)
  const isActiveStatus = (status: string | null | undefined): boolean => {
    if (!status) return true;
    const statusLower = status.toLowerCase();
    return statusLower === 'active' || statusLower === 'available' || statusLower === 'unk' || statusLower === 'probable';
  };

  const homeInjuredPlayers = homePlayers.filter(p => !isActiveStatus(p.current_status));
  const visitorInjuredPlayers = visitorPlayers.filter(p => !isActiveStatus(p.current_status));

  // Sort: stars desc → position order → name asc
  const positionOrder = ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'G-F', 'F-C', 'N/A'];
  const sortPlayers = (a: TeamPlayer, b: TeamPlayer) => {
    const starsDiff = (b.rating_stars ?? 0) - (a.rating_stars ?? 0);
    if (starsDiff !== 0) return starsDiff;
    const aPosIdx = positionOrder.indexOf(a.position || 'N/A');
    const bPosIdx = positionOrder.indexOf(b.position || 'N/A');
    const posDiff = (aPosIdx === -1 ? 999 : aPosIdx) - (bPosIdx === -1 ? 999 : bPosIdx);
    if (posDiff !== 0) return posDiff;
    return a.player_name.localeCompare(b.player_name);
  };

  const sortedHomePlayers = [...homePlayers].sort(sortPlayers);
  const sortedVisitorPlayers = [...visitorPlayers].sort(sortPlayers);

  const renderLineupTable = (players: TeamPlayer[], teamAbbr: string, teamName: string) => (
    <div className="border border-terminal-border-subtle rounded-lg overflow-hidden">
      <div className="bg-terminal-gray/20 px-3 py-2 border-b border-terminal-border-subtle">
        <span className="text-xs font-bold text-terminal-text">{teamAbbr}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-terminal-border-subtle">
              <th className="text-left py-2 px-2 text-[10px] font-medium text-terminal-text opacity-60">Player</th>
              <th className="text-center py-2 px-1 text-[10px] font-medium text-terminal-text opacity-60">POS</th>
              <th className="text-center py-2 px-1 text-[10px] font-medium text-terminal-text opacity-60">Status</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.player_id} className="border-b border-terminal-border-subtle/50 hover:bg-terminal-gray/10 transition-colors">
                <td className="py-2 px-2">
                  <Link
                    to={getPlayerHref(player.player_name)}
                    className="flex items-center gap-2 cursor-pointer hover:text-terminal-green transition-colors"
                  >
                    <div className="w-6 h-6 bg-terminal-gray rounded-full flex items-center justify-center border border-terminal-border-subtle flex-shrink-0 relative overflow-hidden">
                      <img
                        src={getPlayerPhotoUrl(player.player_name, teamName)}
                        alt={player.player_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        data-player-photo-index="0"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const hasNext = tryNextPlayerPhotoUrl(target, player.player_name, teamName);
                          if (hasNext) return;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const initials = player.player_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                            parent.innerHTML = `<span class="text-[8px] font-bold text-terminal-text">${initials}</span>`;
                          }
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-terminal-text truncate">{player.player_name}</div>
                      {player.rating_stars > 0 && (
                        <div className="text-[9px] text-terminal-yellow opacity-70">{'★'.repeat(Math.min(player.rating_stars, 5))}</div>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="py-2 px-1 text-center text-xs text-terminal-text opacity-60">{player.position || '—'}</td>
                <td className="py-2 px-1 text-center">
                  {(() => {
                    const injuryStyle = getInjuryStatusStyle(player.current_status);
                    return (
                      <span className={`text-[9px] px-1 py-0.5 rounded border whitespace-nowrap ${injuryStyle.textClass} ${injuryStyle.borderClass} ${injuryStyle.bgClass}`}>
                        {getInjuryStatusLabel(player.current_status)}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const handleSort = (key: string) => {
    setSortConfig(prev =>
      prev.key === key
        ? { key, direction: prev.direction === 'desc' ? 'asc' : 'desc' }
        : { key, direction: 'desc' }
    );
  };

  const sortBoxScorePlayers = (players: BoxScorePlayer[]) => {
    const { key, direction } = sortConfig;
    const fieldMap: Record<string, keyof BoxScorePlayer> = {
      points: 'points', rebounds: 'rebounds', assists: 'assists',
      minutes: 'minutes', threes: 'threes', steals: 'steals',
      blocks: 'blocks', turnovers: 'turnovers',
    };
    const field = fieldMap[key];
    if (!field) return players;
    return [...players].sort((a, b) => {
      const va = (a[field] as number) ?? -1;
      const vb = (b[field] as number) ?? -1;
      return direction === 'desc' ? vb - va : va - vb;
    });
  };

  const getPlayerTeamName = (player: BoxScorePlayer) =>
    player.home_away === 'Casa' ? game?.home_team_name ?? '' : game?.visitor_team_name ?? '';

  const compactColumns = [
    { key: 'points', label: 'PTS' },
    { key: 'rebounds', label: 'REB' },
    { key: 'assists', label: 'AST' },
  ];

  const detailedColumns = [
    { key: 'points', label: 'PTS' },
    { key: 'rebounds', label: 'REB' },
    { key: 'assists', label: 'AST' },
    { key: 'minutes', label: 'MIN' },
    { key: 'threes', label: '3PM' },
    { key: 'steals', label: 'STL' },
    { key: 'blocks', label: 'BLK' },
    { key: 'turnovers', label: 'TO' },
  ];

  const activeColumns = detailedView ? detailedColumns : compactColumns;

  const statWeightClass: Record<string, string> = {
    points: 'font-bold',
    rebounds: 'font-semibold',
    assists: 'font-semibold',
    minutes: 'opacity-60',
    threes: 'opacity-80',
    steals: 'opacity-80',
    blocks: 'opacity-80',
    turnovers: 'opacity-60',
  };

  const renderBoxScoreRow = (player: BoxScorePlayer, teamName: string, idx: number) => (
    <tr
      key={player.player_id}
      className={`border-b border-terminal-border-subtle/30 hover:bg-terminal-gray/30 active:bg-terminal-gray/40 transition-colors ${idx % 2 === 1 ? 'bg-terminal-gray/10' : ''}`}
    >
      <td className={`py-2 px-1 text-center w-8 bg-terminal-dark-gray ${detailedView ? '' : 'sticky left-0 z-20'}`}>
        <img
          src={getTeamLogoUrl(teamName)}
          alt=""
          className="w-4 h-4 object-contain inline-block"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </td>
      <td className={`py-2 px-2 bg-terminal-dark-gray ${detailedView ? '' : 'sticky left-8 z-20 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-3 after:-mr-3 after:bg-gradient-to-r after:from-terminal-dark-gray/80 after:to-transparent after:pointer-events-none'}`}>
        <Link
          to={getPlayerHref(player.player_name)}
          className="flex items-center gap-2 cursor-pointer hover:text-terminal-green transition-colors"
        >
          {!detailedView && (
            <div className="w-6 h-6 bg-terminal-gray rounded-full flex items-center justify-center border border-terminal-border-subtle flex-shrink-0 relative overflow-hidden">
              <img
                src={getPlayerPhotoUrl(player.player_name, teamName)}
                alt={player.player_name}
                className="w-full h-full object-cover"
                loading="lazy"
                data-player-photo-index="0"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const hasNext = tryNextPlayerPhotoUrl(target, player.player_name, teamName);
                  if (hasNext) return;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const initials = player.player_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                    parent.innerHTML = `<span class="text-[8px] font-bold text-terminal-text">${initials}</span>`;
                  }
                }}
              />
            </div>
          )}
          <span className={`font-medium text-terminal-text truncate ${detailedView ? 'text-[11px]' : 'text-xs'}`}>{player.player_name}</span>
        </Link>
      </td>
      {activeColumns.map(col => (
        <td key={col.key} className={`py-2 px-1 sm:px-2 text-center text-xs tabular-nums ${sortConfig.key === col.key ? 'text-terminal-green font-bold' : `text-terminal-text ${statWeightClass[col.key] || ''}`}`}>
          {col.key === 'minutes'
            ? (player.minutes != null ? `${Math.round(player.minutes)}'` : '—')
            : ((player as unknown as Record<string, number | null>)[col.key]) ?? '—'}
        </td>
      ))}
      {detailedView && (
        <td className="py-2 px-1 sm:px-2 text-center text-[11px] text-terminal-text opacity-50">
          {player.player_position || '—'}
        </td>
      )}
    </tr>
  );

  const renderBoxScoreTableHeader = () => (
    <thead>
      <tr className="border-b border-terminal-border-subtle bg-terminal-gray">
        <th className={`w-8 bg-terminal-gray ${detailedView ? '' : 'sticky left-0 z-20'}`}></th>
        <th className={`text-left py-3 px-2 text-[11px] font-medium text-terminal-text opacity-70 bg-terminal-gray ${detailedView ? 'min-w-[100px]' : 'sticky left-8 z-20 min-w-[140px] after:absolute after:right-0 after:top-0 after:bottom-0 after:w-3 after:-mr-3 after:bg-gradient-to-r after:from-terminal-gray after:to-transparent after:pointer-events-none'}`}>Player</th>
        {activeColumns.map(col => {
          const isActive = sortConfig.key === col.key;
          return (
            <th
              key={col.key}
              className={`text-center py-3 px-1 sm:px-2 text-[11px] font-medium min-w-[36px] sm:min-w-[40px] cursor-pointer select-none transition-colors active:bg-terminal-light-gray ${isActive ? 'text-terminal-green' : 'text-terminal-text opacity-70 hover:opacity-100'}`}
              onClick={() => handleSort(col.key)}
              aria-sort={isActive ? (sortConfig.direction === 'desc' ? 'descending' : 'ascending') : 'none'}
              aria-label={`Ordenar por ${col.label}`}
              role="columnheader"
            >
              {col.label}
              {isActive && (
                <span className="ml-0.5 text-[8px]">{sortConfig.direction === 'desc' ? '▼' : '▲'}</span>
              )}
            </th>
          );
        })}
        {detailedView && (
          <th className="text-center py-3 px-1 sm:px-2 text-[11px] font-medium text-terminal-text opacity-70 min-w-[36px]">POS</th>
        )}
      </tr>
    </thead>
  );


  const renderTableWrapper = (children: React.ReactNode) => (
    <div className="border border-terminal-border-subtle rounded-lg overflow-hidden relative">
      <div className="overflow-x-auto">
        <table className="w-full">
          {renderBoxScoreTableHeader()}
          <tbody>{children}</tbody>
        </table>
      </div>
      {detailedView && (
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-terminal-dark-gray/90 to-transparent pointer-events-none flex items-center justify-center">
          <span className="text-terminal-text opacity-40 text-xs">▸</span>
        </div>
      )}
    </div>
  );

  const renderBoxScoreTable = (players: BoxScorePlayer[], teamName: string) => {
    const sortedPlayers = sortBoxScorePlayers(players);
    return renderTableWrapper(
      sortedPlayers.map((player, idx) => renderBoxScoreRow(player, teamName, idx))
    );
  };

  const renderCombinedBoxScore = () => {
    const sortedPlayers = sortBoxScorePlayers(boxScore);
    return renderTableWrapper(
      sortedPlayers.map((player, idx) => renderBoxScoreRow(player, getPlayerTeamName(player), idx))
    );
  };

  if (isLoadingGame) {
    return (
      <div className="min-h-screen bg-terminal-black text-terminal-text">
        <AnalyticsNav />
        <main className="container mx-auto px-4 py-4">
          <Skeleton className="h-10 w-32 bg-terminal-gray mb-4" />
          <Skeleton className="h-48 w-full bg-terminal-gray mb-4" />
          <Skeleton className="h-96 w-full bg-terminal-gray" />
        </main>
      </div>
    );
  }

  if (!game) {
    return null;
  }

  return (
    <div className="min-h-screen bg-terminal-black text-terminal-text">
      <AnalyticsNav showBack backTo="/home-games" title="Game Details" />
      
      <main className="container mx-auto px-4 py-4">
        {/* Layout: left = header + injury (compact), right = lineup */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left column: game header + injury report */}
          <div className="lg:col-span-6 xl:col-span-5 space-y-4">
        {/* Game Header - Compact */}
        <div className="terminal-container p-4 md:p-5">
          {/* Main Matchup Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-4">
            {/* Home Team */}
            <div className="flex items-center gap-3 md:gap-4 md:order-1">
              <div className="w-14 h-14 md:w-16 md:h-16 flex-shrink-0">
                <img
                  src={getTeamLogoUrl(game.home_team_name)}
                  alt={game.home_team_abbreviation}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `<span class="text-lg font-bold text-terminal-text">${game.home_team_abbreviation}</span>`;
                    }
                  }}
                />
              </div>
              <div className="flex-1">
                <div className="text-lg font-bold text-terminal-green mb-1">
                  {game.home_team_name}
                </div>
                {homeTeam && (
                  <>
                    <div className="text-xs text-terminal-text opacity-80">
                      {homeTeam.wins}-{homeTeam.losses}
                    </div>
                    <div className="text-xs text-terminal-text opacity-60">
                      #{homeTeam.conference_rank} {homeTeam.conference}
                    </div>
                  </>
                )}
                {game.home_team_is_b2b_game && (
                  <span className="inline-block mt-1 text-[10px] bg-terminal-yellow/20 text-terminal-yellow px-2 py-0.5 rounded">
                    B2B
                  </span>
                )}
              </div>
            </div>

            {/* Center: VS / Score / Date */}
            <div className="text-center md:order-2">
              {isGameFinished ? (
                <>
                  <div className="text-xs opacity-50 mb-2">FT</div>
                  <div className="text-2xl font-black text-terminal-blue">
                    {game.home_team_score} - {game.visitor_team_score}
                  </div>
                </>
              ) : (
                <div className="text-2xl font-black text-terminal-blue italic mb-2">VS</div>
              )}
              <div className="text-xs text-terminal-text opacity-60">
                {formatGameDateSaoPaulo(game.game_date)}
              </div>
              {game.game_datetime_brasilia && !isGameFinished && (
                <div className="text-sm font-bold text-terminal-green mt-0.5">
                  {new Date(game.game_datetime_brasilia).toLocaleTimeString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
              {game.home_team_is_b2b_game && game.visitor_team_is_b2b_game && (
                <div className="mt-2">
                  <span className="text-[10px] bg-terminal-yellow/20 text-terminal-yellow px-2 py-1 rounded">
                    Both B2B
                  </span>
                </div>
              )}
            </div>

            {/* Visitor Team */}
            <div className="flex items-center gap-3 md:gap-4 justify-end md:order-3">
              <div className="flex-1 text-right">
                <div className="text-lg font-bold text-terminal-text mb-1">
                  {game.visitor_team_name}
                </div>
                {visitorTeam && (
                  <>
                    <div className="text-xs text-terminal-text opacity-80">
                      {visitorTeam.wins}-{visitorTeam.losses}
                    </div>
                    <div className="text-xs text-terminal-text opacity-60">
                      #{visitorTeam.conference_rank} {visitorTeam.conference}
                    </div>
                  </>
                )}
                {game.visitor_team_is_b2b_game && (
                  <span className="inline-block mt-1 text-[10px] bg-terminal-yellow/20 text-terminal-yellow px-2 py-0.5 rounded">
                    B2B
                  </span>
                )}
              </div>
              <div className="w-14 h-14 md:w-16 md:h-16 flex-shrink-0">
                <img
                  src={getTeamLogoUrl(game.visitor_team_name)}
                  alt={game.visitor_team_abbreviation}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `<span class="text-lg font-bold text-terminal-text">${game.visitor_team_abbreviation}</span>`;
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Team Stats Comparison */}
          {(homeTeam || visitorTeam) && (
            <div className="border-t border-terminal-border-subtle pt-3 mt-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                {/* Off Rating */}
                {homeTeam?.team_offensive_rating_rank && visitorTeam?.team_offensive_rating_rank && (
                  <>
                    <div className={`text-sm font-bold ${
                      homeTeam.team_offensive_rating_rank <= visitorTeam.team_offensive_rating_rank 
                        ? 'text-terminal-green' : 'text-terminal-text opacity-70'
                    }`}>
                      #{homeTeam.team_offensive_rating_rank}
                    </div>
                    <div className="text-[10px] text-terminal-text opacity-50 self-center">OFF RTG</div>
                    <div className={`text-sm font-bold ${
                      visitorTeam.team_offensive_rating_rank <= homeTeam.team_offensive_rating_rank 
                        ? 'text-terminal-green' : 'text-terminal-text opacity-70'
                    }`}>
                      #{visitorTeam.team_offensive_rating_rank}
                    </div>
                  </>
                )}
                {/* Def Rating */}
                {homeTeam?.team_defensive_rating_rank && visitorTeam?.team_defensive_rating_rank && (
                  <>
                    <div className={`text-sm font-bold ${
                      homeTeam.team_defensive_rating_rank <= visitorTeam.team_defensive_rating_rank 
                        ? 'text-terminal-green' : 'text-terminal-text opacity-70'
                    }`}>
                      #{homeTeam.team_defensive_rating_rank}
                    </div>
                    <div className="text-[10px] text-terminal-text opacity-50 self-center">DEF RTG</div>
                    <div className={`text-sm font-bold ${
                      visitorTeam.team_defensive_rating_rank <= homeTeam.team_defensive_rating_rank 
                        ? 'text-terminal-green' : 'text-terminal-text opacity-70'
                    }`}>
                      #{visitorTeam.team_defensive_rating_rank}
                    </div>
                  </>
                )}
                {/* Last 5 */}
                <div className="flex justify-center">
                  {renderLastFiveWithColors(homeLastFive)}
                </div>
                <div className="text-[10px] text-terminal-text opacity-50 self-center">LAST 5</div>
                <div className="flex justify-center">
                  {renderLastFiveWithColors(visitorLastFive)}
                </div>
              </div>
              {isB2B && injuryReportTime && (
                <div className="mt-2 pt-2 border-t border-terminal-border-subtle/50 text-center">
                  <div className="text-[10px] text-terminal-text opacity-60">INJURY REPORT (GMT-3)</div>
                  <div className="text-xs text-terminal-yellow">{injuryReportTime}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Injury Report - below header on the left (only for upcoming games) */}
        {!isGameFinished && (homeInjuredPlayers.length > 0 || visitorInjuredPlayers.length > 0) && (
          <div className="terminal-container px-3 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-terminal-text">Injury Report</span>
              <span className="text-[10px] bg-terminal-red/20 text-terminal-red px-1.5 py-0.5 rounded">
                {homeInjuredPlayers.length + visitorInjuredPlayers.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
              {/* Home injuries */}
              {homeInjuredPlayers.length > 0 && (
                <div>
                  <div className="text-[10px] text-terminal-green opacity-70 mb-1">{game.home_team_abbreviation}</div>
                  <div className="flex flex-wrap gap-1">
                    {homeInjuredPlayers.map((player) => {
                      const injuryStyle = getInjuryStatusStyle(player.current_status);
                      return (
                        <Link
                          key={player.player_id}
                          to={getPlayerHref(player.player_name)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/20 border border-terminal-border-subtle hover:border-terminal-green/50 transition-colors cursor-pointer"
                        >
                          <span className="text-[11px] text-terminal-text">{player.player_name}</span>
                          <span className="text-[10px] text-terminal-text opacity-50">{player.position}</span>
                          <span className={`text-[9px] px-1 py-0.5 rounded whitespace-nowrap ${injuryStyle.textClass} ${injuryStyle.bgClass}`}>
                            {getInjuryStatusLabel(player.current_status)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Visitor injuries */}
              {visitorInjuredPlayers.length > 0 && (
                <div>
                  <div className="text-[10px] text-terminal-text opacity-70 mb-1">{game.visitor_team_abbreviation}</div>
                  <div className="flex flex-wrap gap-1">
                    {visitorInjuredPlayers.map((player) => {
                      const injuryStyle = getInjuryStatusStyle(player.current_status);
                      return (
                        <Link
                          key={player.player_id}
                          to={getPlayerHref(player.player_name)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/20 border border-terminal-border-subtle hover:border-terminal-green/50 transition-colors cursor-pointer"
                        >
                          <span className="text-[11px] text-terminal-text">{player.player_name}</span>
                          <span className="text-[10px] text-terminal-text opacity-50">{player.position}</span>
                          <span className={`text-[9px] px-1 py-0.5 rounded whitespace-nowrap ${injuryStyle.textClass} ${injuryStyle.bgClass}`}>
                            {getInjuryStatusLabel(player.current_status)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
          </div>

          {/* Right column: Tabs (Lineups / Box Score) */}
          <div className="lg:col-span-6 xl:col-span-7">
            <div className="terminal-container p-4">
              {/* Tabs */}
              <div className="flex items-center gap-1 mb-4 border-b border-terminal-border-subtle pb-2">
                <button
                  onClick={() => setActiveTab('lineups')}
                  className={`px-4 min-h-[44px] text-xs font-bold rounded-t transition-colors active:opacity-70 ${
                    activeTab === 'lineups'
                      ? 'text-terminal-green border-b-2 border-terminal-green'
                      : 'text-terminal-text opacity-50 hover:opacity-80'
                  }`}
                >
                  Lineups
                </button>
                {isGameFinished && (
                  <button
                    onClick={() => setActiveTab('boxscore')}
                    className={`px-4 min-h-[44px] text-xs font-bold rounded-t transition-colors active:opacity-70 ${
                      activeTab === 'boxscore'
                        ? 'text-terminal-green border-b-2 border-terminal-green'
                        : 'text-terminal-text opacity-50 hover:opacity-80'
                    }`}
                  >
                    Box Score
                  </button>
                )}
                {!isGameFinished && isB2B && (
                  <button
                    onClick={() => setActiveTab('b2b')}
                    className={`px-4 min-h-[44px] text-xs font-bold rounded-t transition-colors active:opacity-70 ${
                      activeTab === 'b2b'
                        ? 'text-terminal-green border-b-2 border-terminal-green'
                        : 'text-terminal-text opacity-50 hover:opacity-80'
                    }`}
                  >
                    Performance B2B
                  </button>
                )}
              </div>

              {/* Tab: Lineups */}
              {activeTab === 'lineups' && (
                <>
                  {isLoadingTeams ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[0, 1].map((i) => (
                        <div key={i} className="border border-terminal-border-subtle rounded-lg overflow-hidden">
                          <div className="bg-terminal-gray/20 px-3 py-2 border-b border-terminal-border-subtle">
                            <Skeleton className="h-4 w-10 bg-terminal-gray" />
                          </div>
                          <div className="p-2 space-y-2">
                            {Array.from({ length: 8 }).map((_, j) => (
                              <Skeleton key={j} className="h-8 w-full bg-terminal-gray/60" />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Home team lineup */}
                      {renderLineupTable(sortedHomePlayers, game.home_team_abbreviation, game.home_team_name)}
                      {/* Visitor team lineup */}
                      {renderLineupTable(sortedVisitorPlayers, game.visitor_team_abbreviation, game.visitor_team_name)}
                    </div>
                  )}
                </>
              )}

              {/* Tab: Box Score */}
              {activeTab === 'boxscore' && (
                <>
                  {isLoadingBoxScore ? (
                    <div className="space-y-4">
                      {[0, 1].map((i) => (
                        <div key={i} className="border border-terminal-border-subtle rounded-lg overflow-hidden">
                          <div className="bg-terminal-gray/20 px-3 py-2 border-b border-terminal-border-subtle">
                            <Skeleton className="h-4 w-20 bg-terminal-gray" />
                          </div>
                          <div className="p-2 space-y-2">
                            {Array.from({ length: 6 }).map((_, j) => (
                              <Skeleton key={j} className="h-8 w-full bg-terminal-gray/60" />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : boxScore.length === 0 ? (
                    <div className="text-center py-8 text-terminal-text opacity-50 text-sm">
                      Box score indisponivel para este jogo
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Controls: Team selector + Detailed view toggle */}
                      <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg p-1 w-fit">
                        <button
                          onClick={() => setBoxScoreView('all')}
                          aria-label={`Ver todos os jogadores (${game.home_team_abbreviation} + ${game.visitor_team_abbreviation})`}
                          aria-pressed={boxScoreView === 'all'}
                          className={`flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3 rounded-md text-xs font-medium transition-colors active:scale-95 motion-reduce:transform-none ${boxScoreView === 'all' ? 'bg-terminal-green/20 text-terminal-green border border-terminal-green/30' : 'bg-terminal-gray/40 border border-terminal-border-subtle text-terminal-text opacity-70 hover:opacity-100 hover:bg-terminal-gray/60 active:bg-terminal-gray/80'}`}
                        >
                          <img src={getTeamLogoUrl(game.home_team_name)} alt="" className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <span>+</span>
                          <img src={getTeamLogoUrl(game.visitor_team_name)} alt="" className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </button>
                        <button
                          onClick={() => setBoxScoreView('home')}
                          aria-label={`Ver jogadores do ${game.home_team_abbreviation}`}
                          aria-pressed={boxScoreView === 'home'}
                          className={`flex items-center justify-center min-h-[44px] min-w-[44px] px-3 rounded-md text-xs font-medium transition-colors active:scale-95 motion-reduce:transform-none ${boxScoreView === 'home' ? 'bg-terminal-green/20 text-terminal-green border border-terminal-green/30' : 'bg-terminal-gray/40 border border-terminal-border-subtle text-terminal-text opacity-70 hover:opacity-100 hover:bg-terminal-gray/60 active:bg-terminal-gray/80'}`}
                        >
                          <img src={getTeamLogoUrl(game.home_team_name)} alt="" className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </button>
                        <button
                          onClick={() => setBoxScoreView('visitor')}
                          aria-label={`Ver jogadores do ${game.visitor_team_abbreviation}`}
                          aria-pressed={boxScoreView === 'visitor'}
                          className={`flex items-center justify-center min-h-[44px] min-w-[44px] px-3 rounded-md text-xs font-medium transition-colors active:scale-95 motion-reduce:transform-none ${boxScoreView === 'visitor' ? 'bg-terminal-green/20 text-terminal-green border border-terminal-green/30' : 'bg-terminal-gray/40 border border-terminal-border-subtle text-terminal-text opacity-70 hover:opacity-100 hover:bg-terminal-gray/60 active:bg-terminal-gray/80'}`}
                        >
                          <img src={getTeamLogoUrl(game.visitor_team_name)} alt="" className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </button>
                      </div>

                      {/* Detailed view toggle — mobile only */}
                      <button
                        onClick={() => setDetailedView(!detailedView)}
                        className={`md:hidden flex items-center gap-2 min-h-[44px] px-2 rounded-lg border transition-colors ${detailedView ? 'bg-terminal-green/15 border-terminal-green/30' : 'bg-terminal-dark-gray border-terminal-border-subtle hover:bg-terminal-gray/30'}`}
                        aria-label={detailedView ? 'Mudar para visão compacta' : 'Mudar para visão detalhada'}
                      >
                        <span className={`text-[11px] ${detailedView ? 'text-terminal-green' : 'text-terminal-text opacity-60'}`}>Detalhado</span>
                        <div className={`relative w-10 h-[22px] rounded-full transition-colors border ${detailedView ? 'bg-terminal-green border-terminal-green' : 'bg-terminal-gray border-terminal-border-subtle'}`}>
                          <div className={`absolute top-[2px] w-4 h-4 rounded-full shadow-sm transition-transform ${detailedView ? 'translate-x-[22px]' : 'translate-x-[3px]'} bg-white`} />
                        </div>
                      </button>
                      </div>

                      {boxScoreView === 'all' ? (
                        renderCombinedBoxScore()
                      ) : boxScoreView === 'home' ? (
                        renderBoxScoreTable(
                          boxScore.filter(p => p.home_away === 'Casa'),
                          game.home_team_name
                        )
                      ) : (
                        renderBoxScoreTable(
                          boxScore.filter(p => p.home_away === 'Fora'),
                          game.visitor_team_name
                        )
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Tab: Performance B2B */}
              {activeTab === 'b2b' && (
                <>
                  {isLoadingB2B ? (
                    <div className="space-y-4">
                      {[0, 1].map((i) => (
                        <div key={i} className="border border-terminal-border-subtle rounded-lg overflow-hidden">
                          <div className="bg-terminal-gray/20 px-3 py-2 border-b border-terminal-border-subtle">
                            <Skeleton className="h-4 w-24 bg-terminal-gray" />
                          </div>
                          <div className="p-2 space-y-2">
                            {Array.from({ length: 5 }).map((_, j) => (
                              <Skeleton key={j} className="h-10 w-full bg-terminal-gray/60" />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Context banner */}
                      <div className="bg-terminal-yellow/10 border border-terminal-yellow/20 rounded-lg px-3 py-2">
                        <p className="text-[11px] text-terminal-yellow">
                          Jogadores com rating ★★ ou superior que atuaram no jogo anterior. Fique atento a minutagens altas — fadiga impacta diretamente a performance em back-to-back.
                        </p>
                      </div>

                      <div className={`grid gap-4 ${game.home_team_is_b2b_game && game.visitor_team_is_b2b_game ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                        {/* Home team B2B */}
                        {game.home_team_is_b2b_game && (
                          <div className="border border-terminal-border-subtle rounded-lg overflow-hidden">
                            <div className="bg-terminal-gray px-3 py-2 border-b border-terminal-border-subtle flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img src={getTeamLogoUrl(game.home_team_name)} alt="" className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                <span className="text-xs font-bold text-terminal-text">{game.home_team_abbreviation}</span>
                                <span className="text-[9px] bg-terminal-yellow/20 text-terminal-yellow px-1.5 py-0.5 rounded font-medium">B2B</span>
                              </div>
                              {b2bData.home.length > 0 && (
                                <span className="text-[10px] text-terminal-text opacity-50">
                                  vs {b2bData.home[0].previous_opponent} • {new Date(b2bData.home[0].previous_game_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                </span>
                              )}
                            </div>
                            {b2bData.home.length === 0 ? (
                              <div className="text-center py-6 text-terminal-text opacity-50 text-xs">
                                Dados do jogo anterior indisponíveis
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="border-b border-terminal-border-subtle bg-terminal-gray/50">
                                      <th className="text-left py-2 px-2 text-[11px] font-medium text-terminal-text opacity-70 min-w-[130px]">Jogador</th>
                                      <th className="text-center py-2 px-2 text-[11px] font-medium text-terminal-text opacity-70 min-w-[40px]">MIN</th>
                                      <th className="text-center py-2 px-2 text-[11px] font-medium text-terminal-text opacity-70 min-w-[36px]">PTS</th>
                                      <th className="text-center py-2 px-2 text-[11px] font-medium text-terminal-text opacity-70 min-w-[36px]">REB</th>
                                      <th className="text-center py-2 px-2 text-[11px] font-medium text-terminal-text opacity-70 min-w-[36px]">AST</th>
                                      <th className="text-center py-2 px-2 text-[11px] font-medium text-terminal-text opacity-70 min-w-[36px]">+/-</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {b2bData.home.map((player, idx) => {
                                      const highMinutes = (player.minutes ?? 0) > 35;
                                      return (
                                        <tr key={player.player_id} className={`border-b border-terminal-border-subtle/30 ${idx % 2 === 1 ? 'bg-terminal-gray/10' : ''}`}>
                                          <td className="py-2 px-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] text-terminal-yellow">{'★'.repeat(player.rating_stars)}</span>
                                              <Link to={getPlayerHref(player.player_name)} className="text-xs font-medium text-terminal-text hover:text-terminal-green transition-colors truncate">
                                                {player.player_name}
                                              </Link>
                                            </div>
                                          </td>
                                          <td className={`py-2 px-2 text-center text-xs tabular-nums font-bold ${highMinutes ? 'text-terminal-red' : 'text-terminal-text'}`}>
                                            {player.minutes != null ? Math.round(player.minutes) : '—'}
                                            {highMinutes && <span className="ml-0.5 text-[8px]">⚠</span>}
                                          </td>
                                          <td className="py-2 px-2 text-center text-xs tabular-nums text-terminal-text font-semibold">{player.points ?? '—'}</td>
                                          <td className="py-2 px-2 text-center text-xs tabular-nums text-terminal-text">{player.rebounds ?? '—'}</td>
                                          <td className="py-2 px-2 text-center text-xs tabular-nums text-terminal-text">{player.assists ?? '—'}</td>
                                          <td className={`py-2 px-2 text-center text-xs tabular-nums ${(player.plus_minus ?? 0) > 0 ? 'text-green-400' : (player.plus_minus ?? 0) < 0 ? 'text-terminal-red' : 'text-terminal-text opacity-50'}`}>
                                            {player.plus_minus != null ? (player.plus_minus > 0 ? `+${player.plus_minus}` : player.plus_minus) : '—'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Visitor team B2B */}
                        {game.visitor_team_is_b2b_game && (
                          <div className="border border-terminal-border-subtle rounded-lg overflow-hidden">
                            <div className="bg-terminal-gray px-3 py-2 border-b border-terminal-border-subtle flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img src={getTeamLogoUrl(game.visitor_team_name)} alt="" className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                <span className="text-xs font-bold text-terminal-text">{game.visitor_team_abbreviation}</span>
                                <span className="text-[9px] bg-terminal-yellow/20 text-terminal-yellow px-1.5 py-0.5 rounded font-medium">B2B</span>
                              </div>
                              {b2bData.visitor.length > 0 && (
                                <span className="text-[10px] text-terminal-text opacity-50">
                                  vs {b2bData.visitor[0].previous_opponent} • {new Date(b2bData.visitor[0].previous_game_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                </span>
                              )}
                            </div>
                            {b2bData.visitor.length === 0 ? (
                              <div className="text-center py-6 text-terminal-text opacity-50 text-xs">
                                Dados do jogo anterior indisponíveis
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="border-b border-terminal-border-subtle bg-terminal-gray/50">
                                      <th className="text-left py-2 px-2 text-[11px] font-medium text-terminal-text opacity-70 min-w-[130px]">Jogador</th>
                                      <th className="text-center py-2 px-2 text-[11px] font-medium text-terminal-text opacity-70 min-w-[40px]">MIN</th>
                                      <th className="text-center py-2 px-2 text-[11px] font-medium text-terminal-text opacity-70 min-w-[36px]">PTS</th>
                                      <th className="text-center py-2 px-2 text-[11px] font-medium text-terminal-text opacity-70 min-w-[36px]">REB</th>
                                      <th className="text-center py-2 px-2 text-[11px] font-medium text-terminal-text opacity-70 min-w-[36px]">AST</th>
                                      <th className="text-center py-2 px-2 text-[11px] font-medium text-terminal-text opacity-70 min-w-[36px]">+/-</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {b2bData.visitor.map((player, idx) => {
                                      const highMinutes = (player.minutes ?? 0) > 35;
                                      return (
                                        <tr key={player.player_id} className={`border-b border-terminal-border-subtle/30 ${idx % 2 === 1 ? 'bg-terminal-gray/10' : ''}`}>
                                          <td className="py-2 px-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] text-terminal-yellow">{'★'.repeat(player.rating_stars)}</span>
                                              <Link to={getPlayerHref(player.player_name)} className="text-xs font-medium text-terminal-text hover:text-terminal-green transition-colors truncate">
                                                {player.player_name}
                                              </Link>
                                            </div>
                                          </td>
                                          <td className={`py-2 px-2 text-center text-xs tabular-nums font-bold ${highMinutes ? 'text-terminal-red' : 'text-terminal-text'}`}>
                                            {player.minutes != null ? Math.round(player.minutes) : '—'}
                                            {highMinutes && <span className="ml-0.5 text-[8px]">⚠</span>}
                                          </td>
                                          <td className="py-2 px-2 text-center text-xs tabular-nums text-terminal-text font-semibold">{player.points ?? '—'}</td>
                                          <td className="py-2 px-2 text-center text-xs tabular-nums text-terminal-text">{player.rebounds ?? '—'}</td>
                                          <td className="py-2 px-2 text-center text-xs tabular-nums text-terminal-text">{player.assists ?? '—'}</td>
                                          <td className={`py-2 px-2 text-center text-xs tabular-nums ${(player.plus_minus ?? 0) > 0 ? 'text-green-400' : (player.plus_minus ?? 0) < 0 ? 'text-terminal-red' : 'text-terminal-text opacity-50'}`}>
                                            {player.plus_minus != null ? (player.plus_minus > 0 ? `+${player.plus_minus}` : player.plus_minus) : '—'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
