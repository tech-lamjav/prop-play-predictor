import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, ArrowRight } from 'lucide-react';
import { nbaDataService, Player, PropPlayer } from '@/services/nba-data.service';
import { isFreePlayer } from '@/config/freemium';
import { Button } from '@/components/ui/button';

export function FreePropCard() {
  const navigate = useNavigate();
  const [freeProp, setFreeProp] = useState<{ player: Player; prop: PropPlayer } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFreeProp = async () => {
      try {
        setIsLoading(true);
        const players = await nbaDataService.getAllPlayers();
        const freePlayers = players.filter(p => isFreePlayer(p.player_name));
        
        if (freePlayers.length === 0) {
          setIsLoading(false);
          return;
        }

        // Get props for the first free player (or highest rated)
        const topFreePlayer = freePlayers.sort((a, b) => (b.rating_stars || 0) - (a.rating_stars || 0))[0];
        const props = await nbaDataService.getPlayerProps(topFreePlayer.player_id);
        
        // Get the top-rated prop (3 stars)
        const topProp = props.filter(p => p.rating_stars === 3)[0];
        
        if (topProp) {
          setFreeProp({ player: topFreePlayer, prop: topProp });
        }
      } catch (error) {
        console.error('Error loading free prop:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFreeProp();
  }, []);

  if (isLoading) {
    return (
      <div className="terminal-container p-4">
        <h3 className="section-title mb-3">PROP GRÁTIS DO DIA</h3>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-terminal-gray rounded w-3/4"></div>
          <div className="h-4 bg-terminal-gray rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!freeProp) {
    return null;
  }

  const statTypeDisplay = freeProp.prop.stat_type
    .replace('player_', '')
    .replace(/_/g, ' ')
    .toUpperCase();

  const handleClick = () => {
    const slug = freeProp.player.player_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
    const statParam = encodeURIComponent(freeProp.prop.stat_type);
    navigate(`/nba-dashboard/${slug}?stat=${statParam}`);
  };

  return (
    <div className="terminal-container p-4">
      <h3 className="section-title mb-3">PROP GRÁTIS DO DIA</h3>
      
      <div 
        onClick={handleClick}
        className="bg-terminal-dark-gray p-3 rounded border border-terminal-green/30 hover:border-terminal-green transition-colors cursor-pointer"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="text-xs font-medium text-terminal-green mb-1">
              {freeProp.player.player_name}
            </div>
            <div className="text-xs font-bold text-terminal-text mb-1">
              {statTypeDisplay}
            </div>
            <div className="flex items-center gap-2 text-[10px] opacity-60">
              <span>{freeProp.player.team_abbreviation}</span>
              <span>•</span>
              <span>RANK #{freeProp.prop.stat_rank}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-terminal-gray px-2 py-1 rounded">
            <Star className="w-3 h-3 text-terminal-green fill-current" />
            <span className="text-xs font-bold text-terminal-green">{freeProp.prop.rating_stars}</span>
          </div>
        </div>

        {freeProp.prop.next_available_player_name && (
          <div className="mt-2 pt-2 border-t border-terminal-border-subtle">
            <div className="flex items-center gap-2 text-[10px]">
              <span className="opacity-60">BACKUP:</span>
              <span className="text-terminal-text">{freeProp.prop.next_available_player_name}</span>
            </div>
          </div>
        )}

        <Button
          size="sm"
          className="w-full mt-3 terminal-button bg-terminal-green hover:bg-terminal-green/80 text-terminal-black font-bold text-xs"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
        >
          Ver Análise Completa
          <ArrowRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
