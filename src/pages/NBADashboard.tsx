import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nbaDataService, Player, GamePlayerStats } from '@/services/nba-data.service';
import { NBAHeader } from '@/components/nba/NBAHeader';
import { GameChart } from '@/components/nba/GameChart';
import { ComparisonTable } from '@/components/nba/ComparisonTable';
import { useToast } from '@/hooks/use-toast';

export default function NBADashboard() {
  const { playerName } = useParams<{ playerName: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [player, setPlayer] = useState<Player | null>(null);
  const [gameStats, setGameStats] = useState<GamePlayerStats[]>([]);
  const [loading, setLoading] = useState(true);

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
      
      // Load game stats
      try {
        const stats = await nbaDataService.getPlayerGameStats(playerData.player_id, 30);
        setGameStats(stats);
      } catch (error) {
        console.error('Error loading game stats:', error);
        // Don't show error toast for stats, just log it
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

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-terminal-black text-terminal-text">
        <NBAHeader playerName={playerName} />
        <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
          <div className="text-center">
            <div className="text-xl font-mono">Loading player data...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!player) {
    return null;
  }

  return (
    <div className="w-full min-h-screen bg-terminal-black text-terminal-text">
      <NBAHeader playerName={playerName} />
      <main className="container mx-auto px-3 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left Sidebar - Quick Info */}
          <div className="lg:col-span-1">
            <div className="terminal-container p-4 mb-3">
              <h3 className="section-title mb-3">PLAYER INFO</h3>
              <div className="space-y-3">
                <div>
                  <div className="data-label mb-1">NAME</div>
                  <div className="text-lg font-semibold text-terminal-green">
                    {player.player_name}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="data-label mb-1">POSITION</div>
                    <div className="text-sm font-medium">{player.position}</div>
                  </div>
                  <div>
                    <div className="data-label mb-1">AGE</div>
                    <div className="text-sm font-medium">{player.age}</div>
                  </div>
                </div>
                <div>
                  <div className="data-label mb-1">TEAM</div>
                  <div className="text-sm font-medium">
                    {player.team_name} ({player.team_abbreviation})
                  </div>
                </div>
                <div>
                  <div className="data-label mb-1">STATUS</div>
                  <div className={`text-sm font-medium ${
                    player.current_status?.toLowerCase() === 'active' 
                      ? 'text-terminal-green' 
                      : 'text-terminal-red'
                  }`}>
                    {player.current_status || 'Active'}
                  </div>
                </div>
                {player.last_game_text && (
                  <div>
                    <div className="data-label mb-1">LAST GAME</div>
                    <div className="text-xs opacity-70">{player.last_game_text}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Summary */}
            {gameStats.length > 0 && (
              <div className="terminal-container p-4 mb-3">
                <h3 className="section-title mb-3">QUICK STATS</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="data-label">GAMES PLAYED</span>
                    <span className="text-sm font-medium">{gameStats.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="data-label">AVG VALUE</span>
                    <span className="text-sm font-medium stat-positive">
                      {(gameStats.reduce((sum, g) => sum + (g.stat_value ?? 0), 0) / gameStats.length).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="data-label">HIT RATE</span>
                    <span className="text-sm font-medium stat-positive">
                      {((gameStats.filter(g => g.stat_vs_line === 'Over').length / gameStats.length) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {/* Game Chart */}
            <GameChart gameStats={gameStats} statType={gameStats[0]?.stat_type || 'Points'} />
            
            {/* Comparison Table */}
            <ComparisonTable gameStats={gameStats} playerName={player.player_name} />
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
