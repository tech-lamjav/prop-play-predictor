import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Search } from 'lucide-react';
import { bigQueryService } from '@/services/bigquery.service';

interface Player {
  playerId: string;
  playerName: string;
  team: string;
}

interface PlayerSelectorProps {
  selectedPlayerId?: string;
  onPlayerSelect: (playerId: string) => void;
  className?: string;
}

export const PlayerSelector: React.FC<PlayerSelectorProps> = ({
  selectedPlayerId,
  onPlayerSelect,
  className = ''
}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlayers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await bigQueryService.getAvailablePlayers();
      
      if (fetchError) {
        setError(fetchError);
        return;
      }

      setPlayers(data);
    } catch (err) {
      setError('Failed to fetch players');
      console.error('Error fetching players:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const handlePlayerChange = (playerId: string) => {
    onPlayerSelect(playerId);
  };

  if (error) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="text-red-400 text-sm">Erro ao carregar jogadores</div>
        <Button size="sm" variant="outline" onClick={fetchPlayers}>
          <Search className="w-4 h-4 mr-1" />
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Select
        value={selectedPlayerId}
        onValueChange={handlePlayerChange}
        disabled={isLoading}
      >
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Selecionar jogador..." />
        </SelectTrigger>
        <SelectContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm">Carregando jogadores...</span>
            </div>
          ) : (
            players.map((player) => (
              <SelectItem key={player.playerId} value={player.playerId}>
                <div className="flex items-center justify-between w-full">
                  <span>{player.playerName}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {player.team}
                  </span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      
      {isLoading && (
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      )}
    </div>
  );
};
