import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nbaDataService, Player } from '@/services/nba-data.service';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function NBADashboard() {
  const { playerName } = useParams<{ playerName: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [player, setPlayer] = useState<Player | null>(null);
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
        navigate('/players');
        return;
      }
      
      setPlayer(playerData);
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
      <AuthenticatedLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="text-xl">Loading player data...</div>
          </div>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!player) {
    return null;
  }

  return (
    <AuthenticatedLayout>
      <div className="min-h-screen bg-background p-6">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate('/players')}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Players
            </Button>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2">{player.player_name}</h1>
                <p className="text-muted-foreground text-lg">
                  {player.position} • {player.team_name} ({player.team_abbreviation})
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Age</div>
                <div className="text-2xl font-bold">{player.age}</div>
              </div>
            </div>
          </div>

          {/* Player Info Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {player.current_status || 'Active'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Team</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{player.team_abbreviation}</div>
                <div className="text-sm text-muted-foreground">{player.team_name}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Last Game</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm">{player.last_game_text || 'N/A'}</div>
              </CardContent>
            </Card>
          </div>

          {/* Placeholder for future dashboard components */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <p>Player statistics and analytics will be displayed here.</p>
                <p className="mt-2 text-sm">
                  This section will include game stats, prop betting insights, and performance trends.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
