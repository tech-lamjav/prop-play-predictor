import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import AnalyticsNav from '@/components/AnalyticsNav';
import { nbaDataService, Game, TeamPlayer, Team } from '@/services/nba-data.service';
import { getTeamLogoUrl, getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';
import { getInjuryStatusStyle, getInjuryStatusLabel } from '@/utils/injury-status';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

export default function GameDetail() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [game, setGame] = useState<Game | null>(null);
  const [homePlayers, setHomePlayers] = useState<TeamPlayer[]>([]);
  const [visitorPlayers, setVisitorPlayers] = useState<TeamPlayer[]>([]);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [visitorTeam, setVisitorTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      loadGameData();
    }
  }, [gameId, authLoading, user]);

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

    try {
      setIsLoading(true);
      const games = await nbaDataService.getGames();
      const foundGame = games.find(g => g.game_id === parseInt(gameId));

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

      // Load players and team data for both teams
      const [homePlayersData, visitorPlayersData, homeTeamData, visitorTeamData] = await Promise.all([
        nbaDataService.getTeamPlayers(foundGame.home_team_id),
        nbaDataService.getTeamPlayers(foundGame.visitor_team_id),
        nbaDataService.getTeamById(foundGame.home_team_id),
        nbaDataService.getTeamById(foundGame.visitor_team_id),
      ]);

      setHomePlayers(homePlayersData);
      setVisitorPlayers(visitorPlayersData);
      setHomeTeam(homeTeamData);
      setVisitorTeam(visitorTeamData);
    } catch (error) {
      console.error('Error loading game data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load game data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
    
    return (
      <div className="flex items-center gap-1">
        {lastFive.split('').map((result, index) => {
          const isWin = result === 'V' || result === 'W';
          return (
            <span
              key={index}
              className={`text-xs font-medium ${
                isWin ? 'text-terminal-green' : 'text-terminal-red'
              }`}
            >
              {result}
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

  // Group players by position, sorted by rating_stars (desc) within each group
  const groupPlayersByPosition = (players: TeamPlayer[]) => {
    const grouped: { [key: string]: TeamPlayer[] } = {};
    players.forEach(player => {
      const pos = player.position || 'N/A';
      if (!grouped[pos]) grouped[pos] = [];
      grouped[pos].push(player);
    });
    // Sort each position group by rating (highest first)
    Object.keys(grouped).forEach(pos => {
      grouped[pos].sort((a, b) => (b.rating_stars ?? 0) - (a.rating_stars ?? 0));
    });
    return grouped;
  };

  const homePlayersByPos = groupPlayersByPosition(homePlayers);
  const visitorPlayersByPos = groupPlayersByPosition(visitorPlayers);
  
  // Get all unique positions
  const allPositions = Array.from(new Set([
    ...Object.keys(homePlayersByPos),
    ...Object.keys(visitorPlayersByPos)
  ])).sort();

  // Position order for display (starters first)
  const positionOrder = ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'G-F', 'F-C', 'N/A'];
  const sortedPositions = allPositions.sort((a, b) => {
    const aIndex = positionOrder.indexOf(a);
    const bIndex = positionOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  if (isLoading) {
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
        {/* Back Button */}
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/home-games')}
            className="terminal-button"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Games
          </Button>
        </div>

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
                {isGameFinished && (
                  <div className={`text-2xl font-bold mb-1 ${
                    game.winner_team_id === game.home_team_id ? 'text-terminal-green' : 'opacity-60'
                  }`}>
                    {game.home_team_score}
                  </div>
                )}
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
                {formatGameDateSaoPaulo(game.game_date)} (GMT-3)
              </div>
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
                {isGameFinished && (
                  <div className={`text-2xl font-bold mb-1 ${
                    game.winner_team_id === game.visitor_team_id ? 'text-terminal-green' : 'opacity-60'
                  }`}>
                    {game.visitor_team_score}
                  </div>
                )}
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

        {/* Injury Report - below header on the left (only for B2B games) */}
        {isB2B && (homeInjuredPlayers.length > 0 || visitorInjuredPlayers.length > 0) && (
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

          {/* Right column: Lineups - two tables side by side */}
          <div className="lg:col-span-6 xl:col-span-7">
        <div className="terminal-container p-4">
          <h3 className="text-sm font-bold text-terminal-text mb-4">Lineups</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Home team lineup - sorted by position then rating */}
            <div className="border border-terminal-border-subtle rounded-lg overflow-hidden">
              <div className="bg-terminal-gray/20 px-3 py-2 border-b border-terminal-border-subtle">
                <span className="text-xs font-bold text-terminal-text">{game.home_team_abbreviation}</span>
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
                    {sortedPositions.flatMap((pos) => (homePlayersByPos[pos] || []).map((homePlayer) => (
                      <tr
                        key={homePlayer.player_id}
                        className="border-b border-terminal-border-subtle/50 hover:bg-terminal-gray/10 transition-colors"
                      >
                        <td className="py-2 px-2">
                          <Link
                            to={getPlayerHref(homePlayer.player_name)}
                            className="flex items-center gap-2 cursor-pointer hover:text-terminal-green transition-colors"
                          >
                            <div className="w-6 h-6 bg-terminal-gray rounded-full flex items-center justify-center border border-terminal-border-subtle flex-shrink-0 relative overflow-hidden">
                              <img
                                src={getPlayerPhotoUrl(homePlayer.player_name, game.home_team_name)}
                                alt={homePlayer.player_name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                data-player-photo-index="0"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  const hasNext = tryNextPlayerPhotoUrl(target, homePlayer.player_name, game.home_team_name);
                                  if (hasNext) return;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const initials = homePlayer.player_name
                                      .split(' ')
                                      .map(n => n[0])
                                      .join('')
                                      .toUpperCase()
                                      .slice(0, 2);
                                    parent.innerHTML = `<span class="text-[8px] font-bold text-terminal-text">${initials}</span>`;
                                  }
                                }}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-terminal-text truncate">{homePlayer.player_name}</div>
                              {homePlayer.rating_stars > 0 && (
                                <div className="text-[9px] text-terminal-yellow opacity-70">{'★'.repeat(Math.min(homePlayer.rating_stars, 5))}</div>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="py-2 px-1 text-center text-xs text-terminal-text opacity-60">{homePlayer.position || '—'}</td>
                        <td className="py-2 px-1 text-center">
                          {(() => {
                            const injuryStyle = getInjuryStatusStyle(homePlayer.current_status);
                            return (
                              <span className={`text-[9px] px-1 py-0.5 rounded border whitespace-nowrap ${injuryStyle.textClass} ${injuryStyle.borderClass} ${injuryStyle.bgClass}`}>
                                {getInjuryStatusLabel(homePlayer.current_status)}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Visitor team lineup */}
            <div className="border border-terminal-border-subtle rounded-lg overflow-hidden">
              <div className="bg-terminal-gray/20 px-3 py-2 border-b border-terminal-border-subtle">
                <span className="text-xs font-bold text-terminal-text">{game.visitor_team_abbreviation}</span>
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
                    {sortedPositions.flatMap((pos) => (visitorPlayersByPos[pos] || []).map((visitorPlayer) => (
                      <tr
                        key={visitorPlayer.player_id}
                        className="border-b border-terminal-border-subtle/50 hover:bg-terminal-gray/10 transition-colors"
                      >
                        <td className="py-2 px-2">
                          <Link
                            to={getPlayerHref(visitorPlayer.player_name)}
                            className="flex items-center gap-2 cursor-pointer hover:text-terminal-green transition-colors"
                          >
                            <div className="w-6 h-6 bg-terminal-gray rounded-full flex items-center justify-center border border-terminal-border-subtle flex-shrink-0 relative overflow-hidden">
                              <img
                                src={getPlayerPhotoUrl(visitorPlayer.player_name, game.visitor_team_name)}
                                alt={visitorPlayer.player_name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                data-player-photo-index="0"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  const hasNext = tryNextPlayerPhotoUrl(target, visitorPlayer.player_name, game.visitor_team_name);
                                  if (hasNext) return;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const initials = visitorPlayer.player_name
                                      .split(' ')
                                      .map(n => n[0])
                                      .join('')
                                      .toUpperCase()
                                      .slice(0, 2);
                                    parent.innerHTML = `<span class="text-[8px] font-bold text-terminal-text">${initials}</span>`;
                                  }
                                }}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-terminal-text truncate">{visitorPlayer.player_name}</div>
                              {visitorPlayer.rating_stars > 0 && (
                                <div className="text-[9px] text-terminal-yellow opacity-70">{'★'.repeat(Math.min(visitorPlayer.rating_stars, 5))}</div>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="py-2 px-1 text-center text-xs text-terminal-text opacity-60">{visitorPlayer.position || '—'}</td>
                        <td className="py-2 px-1 text-center">
                          {(() => {
                            const injuryStyle = getInjuryStatusStyle(visitorPlayer.current_status);
                            return (
                              <span className={`text-[9px] px-1 py-0.5 rounded border whitespace-nowrap ${injuryStyle.textClass} ${injuryStyle.borderClass} ${injuryStyle.bgClass}`}>
                                {getInjuryStatusLabel(visitorPlayer.current_status)}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
          </div>
        </div>
      </main>
    </div>
  );
}
