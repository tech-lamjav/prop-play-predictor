import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AnalyticsNav from '@/components/AnalyticsNav';
import { nbaDataService, Game, TeamPlayer, Team } from '@/services/nba-data.service';
import { getTeamLogoUrl } from '@/utils/team-logos';
import { getInjuryStatusStyle, getInjuryStatusLabel } from '@/utils/injury-status';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GameDetail() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [game, setGame] = useState<Game | null>(null);
  const [homePlayers, setHomePlayers] = useState<TeamPlayer[]>([]);
  const [visitorPlayers, setVisitorPlayers] = useState<TeamPlayer[]>([]);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [visitorTeam, setVisitorTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadGameData();
  }, [gameId]);

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
        navigate('/games');
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

  const handlePlayerClick = (playerId: number) => {
    const allPlayers = [...homePlayers, ...visitorPlayers];
    const player = allPlayers.find(p => p.player_id === playerId);
    if (player) {
      const slug = player.player_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
      navigate(`/nba-dashboard/${slug}`);
    }
  };

  const isGameFinished = game?.home_team_score !== null && game?.visitor_team_score !== null;
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
      <AnalyticsNav showBack backTo="/games" title="Game Details" />
      
      <main className="container mx-auto px-4 py-4">
        {/* Back Button */}
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/games')}
            className="terminal-button"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Games
          </Button>
        </div>

        {/* Expanded Game Header */}
        <div className="terminal-container p-4 md:p-6 mb-4">
          {/* Main Matchup Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-4">
            {/* Home Team */}
            <div className="flex items-center gap-3 md:gap-4 md:order-1">
              <div className="w-16 h-16 md:w-20 md:h-20 flex-shrink-0">
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
                <div className="text-xl font-bold text-terminal-green mb-1">
                  {game.home_team_name}
                </div>
                {isGameFinished && (
                  <div className={`text-3xl font-bold mb-1 ${
                    game.winner_team_id === game.home_team_id ? 'text-terminal-green' : 'opacity-60'
                  }`}>
                    {game.home_team_score}
                  </div>
                )}
                {homeTeam && (
                  <>
                    <div className="text-sm text-terminal-text opacity-80">
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
                {new Date(game.game_date).toLocaleDateString('pt-BR', { 
                  weekday: 'short', 
                  day: 'numeric', 
                  month: 'short',
                  year: 'numeric'
                })}
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
                <div className="text-xl font-bold text-terminal-text mb-1">
                  {game.visitor_team_name}
                </div>
                {isGameFinished && (
                  <div className={`text-3xl font-bold mb-1 ${
                    game.winner_team_id === game.visitor_team_id ? 'text-terminal-green' : 'opacity-60'
                  }`}>
                    {game.visitor_team_score}
                  </div>
                )}
                {visitorTeam && (
                  <>
                    <div className="text-sm text-terminal-text opacity-80">
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
              <div className="w-16 h-16 md:w-20 md:h-20 flex-shrink-0">
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
            </div>
          )}
        </div>

        {/* Injury Report Section - Compact */}
        {(homeInjuredPlayers.length > 0 || visitorInjuredPlayers.length > 0) && (
          <div className="terminal-container px-4 py-3 mb-4">
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
                        <div
                          key={player.player_id}
                          onClick={() => handlePlayerClick(player.player_id)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/20 border border-terminal-border-subtle hover:border-terminal-green/50 transition-colors cursor-pointer"
                        >
                          <span className="text-[11px] text-terminal-text">{player.player_name}</span>
                          <span className="text-[10px] text-terminal-text opacity-50">{player.position}</span>
                          <span className={`text-[9px] px-1 py-0.5 rounded ${injuryStyle.textClass} ${injuryStyle.bgClass}`}>
                            {getInjuryStatusLabel(player.current_status)}
                          </span>
                        </div>
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
                        <div
                          key={player.player_id}
                          onClick={() => handlePlayerClick(player.player_id)}
                          className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/20 border border-terminal-border-subtle hover:border-terminal-green/50 transition-colors cursor-pointer"
                        >
                          <span className="text-[11px] text-terminal-text">{player.player_name}</span>
                          <span className="text-[10px] text-terminal-text opacity-50">{player.position}</span>
                          <span className={`text-[9px] px-1 py-0.5 rounded ${injuryStyle.textClass} ${injuryStyle.bgClass}`}>
                            {getInjuryStatusLabel(player.current_status)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lineups Table */}
        <div className="terminal-container p-4">
          <h3 className="text-sm font-bold text-terminal-text mb-4">Lineups</h3>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: '35%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '35%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-terminal-border-subtle">
                    <th className="text-left py-2 px-3 text-xs font-medium text-terminal-text opacity-60">
                      {game.home_team_abbreviation}
                    </th>
                    <th className="text-center py-2 px-1 text-xs font-medium text-terminal-text opacity-60">
                    </th>
                    <th className="text-center py-2 px-1 text-xs font-medium text-terminal-text opacity-60">
                      POS
                    </th>
                    <th className="text-center py-2 px-1 text-xs font-medium text-terminal-text opacity-60">
                    </th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-terminal-text opacity-60">
                      {game.visitor_team_abbreviation}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPositions.map((pos) => {
                    const homePlayersAtPos = homePlayersByPos[pos] || [];
                    const visitorPlayersAtPos = visitorPlayersByPos[pos] || [];
                    const maxCount = Math.max(homePlayersAtPos.length, visitorPlayersAtPos.length);
                    
                    return Array.from({ length: maxCount }).map((_, idx) => {
                      const homePlayer = homePlayersAtPos[idx];
                      const visitorPlayer = visitorPlayersAtPos[idx];
                      
                      return (
                        <tr
                          key={`${pos}-${idx}`}
                          className="border-b border-terminal-border-subtle/50 hover:bg-terminal-gray/10 transition-colors"
                        >
                          {/* Home Player */}
                          <td className="py-2 px-3">
                            {homePlayer ? (
                              <div
                                onClick={() => handlePlayerClick(homePlayer.player_id)}
                                className="flex items-center gap-2 cursor-pointer hover:text-terminal-green transition-colors"
                              >
                                <div className="w-7 h-7 bg-terminal-gray rounded-full flex items-center justify-center border border-terminal-border-subtle flex-shrink-0">
                                  <span className="text-[9px] font-bold text-terminal-text">
                                    {homePlayer.player_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-medium text-terminal-text truncate">
                                    {homePlayer.player_name}
                                  </div>
                                  {homePlayer.rating_stars > 0 && (
                                    <div className="text-[9px] text-terminal-yellow opacity-70">
                                      {'★'.repeat(Math.min(homePlayer.rating_stars, 5))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs opacity-30">—</span>
                            )}
                          </td>
                          
                          {/* Home Status */}
                          <td className="py-2 px-2 text-center">
                            {homePlayer ? (() => {
                              const injuryStyle = getInjuryStatusStyle(homePlayer.current_status);
                              return (
                                <div className={`text-[10px] px-1.5 py-0.5 rounded border inline-block ${
                                  injuryStyle.textClass} ${injuryStyle.borderClass} ${injuryStyle.bgClass}`}>
                                  {getInjuryStatusLabel(homePlayer.current_status)}
                                </div>
                              );
                            })() : (
                              <span className="text-xs opacity-30">—</span>
                            )}
                          </td>
                          
                          {/* Position */}
                          <td className="py-2 px-2 text-center">
                            <span className="text-xs font-medium text-terminal-text opacity-60">
                              {pos}
                            </span>
                          </td>
                          
                          {/* Away Status */}
                          <td className="py-2 px-2 text-center">
                            {visitorPlayer ? (() => {
                              const injuryStyle = getInjuryStatusStyle(visitorPlayer.current_status);
                              return (
                                <div className={`text-[10px] px-1.5 py-0.5 rounded border inline-block ${
                                  injuryStyle.textClass} ${injuryStyle.borderClass} ${injuryStyle.bgClass}`}>
                                  {getInjuryStatusLabel(visitorPlayer.current_status)}
                                </div>
                              );
                            })() : (
                              <span className="text-xs opacity-30">—</span>
                            )}
                          </td>
                          
                          {/* Away Player */}
                          <td className="py-2 px-3 text-right">
                            {visitorPlayer ? (
                              <div
                                onClick={() => handlePlayerClick(visitorPlayer.player_id)}
                                className="flex items-center gap-2 justify-end cursor-pointer hover:text-terminal-green transition-colors"
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-medium text-terminal-text truncate">
                                    {visitorPlayer.player_name}
                                  </div>
                                  {visitorPlayer.rating_stars > 0 && (
                                    <div className="text-[9px] text-terminal-yellow opacity-70 text-right">
                                      {'★'.repeat(Math.min(visitorPlayer.rating_stars, 5))}
                                    </div>
                                  )}
                                </div>
                                <div className="w-7 h-7 bg-terminal-gray rounded-full flex items-center justify-center border border-terminal-border-subtle flex-shrink-0">
                                  <span className="text-[9px] font-bold text-terminal-text">
                                    {visitorPlayer.player_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs opacity-30">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </div>
      </main>
    </div>
  );
}
