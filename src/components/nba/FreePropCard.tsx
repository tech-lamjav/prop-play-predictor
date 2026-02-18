import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, ArrowRight } from 'lucide-react';
import { nbaDataService, Player, PropPlayer } from '@/services/nba-data.service';
import { isFreePlayer } from '@/config/freemium';
import { Button } from '@/components/ui/button';

interface FreePropCardProps {
  /** 'vertical' = sidebar stack (default), 'horizontal' = hero row for Games page */
  layout?: 'vertical' | 'horizontal';
}

export function FreePropCard({ layout = 'vertical' }: FreePropCardProps) {
  const navigate = useNavigate();
  const [freeProps, setFreeProps] = useState<Array<{ player: Player; prop: PropPlayer }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFreeProps = async () => {
      try {
        setIsLoading(true);
        const players = await nbaDataService.getAllPlayers();
        const uniquePlayers = players.filter(
          (player, index, self) =>
            index === self.findIndex((p) => p.player_id === player.player_id)
        );
        const freePlayers = uniquePlayers
          .filter((p) => isFreePlayer(p.player_name))
          .sort((a, b) => (b.rating_stars || 0) - (a.rating_stars || 0));

        if (freePlayers.length === 0) {
          setIsLoading(false);
          return;
        }

        const results: Array<{ player: Player; prop: PropPlayer }> = [];
        for (const freePlayer of freePlayers) {
          const props = await nbaDataService.getPlayerProps(freePlayer.player_id);
          const threeStarProp = props.find((p) => p.rating_stars === 3);
          const topProp =
            threeStarProp ||
            [...props].sort((a, b) => (b.rating_stars || 0) - (a.rating_stars || 0))[0] ||
            props[0];
          if (topProp) {
            results.push({ player: freePlayer, prop: topProp });
          }
        }
        setFreeProps(results);
      } catch (error) {
        console.error('Error loading free props:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFreeProps();
  }, []);

  const isHorizontal = layout === 'horizontal';

  if (isLoading) {
    return (
      <div className={isHorizontal ? 'terminal-container p-6' : 'terminal-container p-4'}>
        <h3 className="section-title mb-3">PROP GRÁTIS DO DIA</h3>
        {isHorizontal && <p className="text-xs text-terminal-text opacity-70 mb-4">Análises gratuitas — sem login necessário</p>}
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-terminal-gray rounded w-3/4"></div>
          <div className="h-4 bg-terminal-gray rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (freeProps.length === 0) {
    return null;
  }

  return (
    <div className={isHorizontal ? 'terminal-container p-6' : 'terminal-container p-4'}>
      <h3 className="section-title mb-3">PROP GRÁTIS DO DIA</h3>
      {isHorizontal && (
        <p className="text-xs text-terminal-text opacity-70 mb-4">Análises gratuitas — sem login necessário</p>
      )}
      <div className={isHorizontal ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : 'space-y-3'}>
        {freeProps.map((freeProp) => {
          const statTypeDisplay = freeProp.prop.stat_type
            .replace('player_', '')
            .replace(/_/g, ' ')
            .toUpperCase();
          const handleClick = () => {
            const slug = freeProp.player.player_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
            const statParam = encodeURIComponent(freeProp.prop.stat_type);
            navigate(`/nba-dashboard/${slug}?stat=${statParam}`);
          };
          const backupName = freeProp.prop.next_available_player_name?.trim();
          const showBackup = Boolean(
            backupName &&
            backupName.toLowerCase() !== freeProp.player.player_name.toLowerCase()
          );
          return (
            <div
              key={freeProp.player.player_id}
              onClick={handleClick}
              className={`rounded border border-terminal-green/30 hover:border-terminal-green transition-colors cursor-pointer h-full flex flex-col ${
                isHorizontal
                  ? 'bg-terminal-dark-gray p-4'
                  : 'bg-terminal-dark-gray p-3'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className={isHorizontal ? 'text-sm font-medium text-terminal-green mb-1' : 'text-xs font-medium text-terminal-green mb-1'}>
                    {freeProp.player.player_name}
                  </div>
                  <div className={isHorizontal ? 'text-sm font-bold text-terminal-text mb-1' : 'text-xs font-bold text-terminal-text mb-1'}>
                    {statTypeDisplay}
                  </div>
                  <div className={`flex items-center gap-2 opacity-60 ${isHorizontal ? 'text-xs' : 'text-[10px]'}`}>
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

              {showBackup && (
                <div className="mt-2 pt-2 border-t border-terminal-border-subtle">
                  <div className={`flex items-center gap-2 ${isHorizontal ? 'text-xs' : 'text-[10px]'}`}>
                    <span className="opacity-60">BACKUP:</span>
                    <span className="text-terminal-text">{backupName}</span>
                  </div>
                </div>
              )}

              <Button
                size={isHorizontal ? 'default' : 'sm'}
                className={`w-full mt-auto terminal-button bg-terminal-green hover:bg-terminal-green/80 text-terminal-black font-bold ${isHorizontal ? 'text-sm' : 'text-xs'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
              >
                Ver Análise Completa
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
