import React from 'react';
import { PropPlayer } from '@/services/nba-data.service';
import { Lightbulb, Star, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const STAT_LABELS: Record<string, string> = {
  player_points: 'Pontos',
  player_assists: 'Assistências',
  player_rebounds: 'Rebotes',
  player_threes: '3 Pontos',
  player_steals: 'Roubos',
  player_blocks: 'Bloqueios',
  player_turnovers: 'Turnovers',
  player_points_assists: 'Pts + Ast',
  player_points_rebounds: 'Pts + Reb',
  player_rebounds_assists: 'Reb + Ast',
  player_points_rebounds_assists: 'PRA',
  player_double_double: 'Double-Double',
};

const STAT_LABELS_SHORT: Record<string, string> = {
  player_points: 'pontos',
  player_assists: 'assistências',
  player_rebounds: 'rebotes',
  player_threes: '3 pontos',
  player_steals: 'roubos',
  player_blocks: 'bloqueios',
  player_turnovers: 'turnovers',
  player_points_assists: 'pts + ast',
  player_points_rebounds: 'pts + reb',
  player_rebounds_assists: 'reb + ast',
  player_points_rebounds_assists: 'PRA',
  player_double_double: 'double-doubles',
};

interface PropInsightsCardProps {
  propPlayers: PropPlayer[];
  playerName: string;
  isLoading?: boolean;
  onInsightClick?: (statType: string, triggerPlayerName: string) => void;
}

export const PropInsightsCard: React.FC<PropInsightsCardProps> = ({ propPlayers, playerName, isLoading, onInsightClick }) => {
  if (isLoading) {
    return (
      <div className="terminal-container p-4">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-32 bg-terminal-gray" />
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full bg-terminal-gray" />
          ))}
        </div>
      </div>
    );
  }

  // Apenas props com gatilho ativo
  const backupProps = propPlayers.filter(
    p => p.is_available_backup &&
      p.next_available_player_name?.trim() &&
      p.next_player_stats_when_leader_out > 0 &&
      p.next_player_stats_when_leader_out > p.next_player_stats_normal
  );

  // Sem gatilho → sem card
  if (backupProps.length === 0) return null;

  // Trigger name: pega do primeiro (todos compartilham o mesmo gatilho no contexto do time)
  const triggerName = backupProps[0].next_available_player_name;
  const triggerLastName = triggerName.split(' ').pop();
  const playerLastName = playerName.split(' ').pop() || playerName;

  return (
    <div className="terminal-container p-4">
      {/* Header — INSIGHT label */}
      <div className="flex items-center gap-2 mb-1">
        <Lightbulb className="w-3.5 h-3.5 text-terminal-yellow shrink-0" />
        <span className="text-[10px] font-bold text-terminal-yellow uppercase tracking-widest">
          Insight
        </span>
      </div>

      {/* Storytelling — narrative sentence */}
      <p className="text-xs text-terminal-text opacity-80 mb-3 leading-relaxed">
        Com <span className="font-bold text-terminal-red">{triggerLastName}</span> fora,{' '}
        {backupProps.length === 1 ? (
          <>
            os <span className="font-bold text-terminal-green">
              {STAT_LABELS_SHORT[backupProps[0].stat_type] ?? backupProps[0].stat_type.replace('player_', '').replace(/_/g, ' ')}
            </span> de {playerLastName} sobem{' '}
            <span className="font-bold text-terminal-green">
              +{backupProps[0].next_player_stats_normal > 0
                ? Math.round(((backupProps[0].next_player_stats_when_leader_out - backupProps[0].next_player_stats_normal) / backupProps[0].next_player_stats_normal) * 100)
                : 0}%
            </span>
          </>
        ) : (
          <>
            as médias de {playerLastName} sobem em{' '}
            <span className="font-bold text-terminal-green">
              {backupProps.length} categorias
            </span>
          </>
        )}
      </p>

      {/* Oportunidades — clickable */}
      <div className="space-y-2">
        {backupProps.map((prop, i) => {
          const normal = prop.next_player_stats_normal;
          const semEle = prop.next_player_stats_when_leader_out;
          const gap = semEle - normal;
          const gapPct = normal > 0 ? Math.round((gap / normal) * 100) : 0;
          const statLabel = STAT_LABELS[prop.stat_type] ?? prop.stat_type.replace('player_', '').replace(/_/g, ' ');
          const isClickable = !!onInsightClick;

          return (
            <button
              key={i}
              className={`w-full text-left bg-terminal-dark-gray rounded border border-terminal-yellow/20 p-3 transition-all ${
                isClickable ? 'hover:border-terminal-yellow/50 hover:bg-terminal-yellow/5 cursor-pointer' : 'cursor-default'
              }`}
              onClick={() => onInsightClick?.(prop.stat_type, triggerName)}
            >
              {/* Stat + estrelas */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-terminal-text uppercase">{statLabel}</span>
                <div className="flex items-center gap-1.5">
                  {prop.rating_stars > 0 && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: prop.rating_stars }).map((_, j) => (
                        <Star key={j} className="w-3 h-3 fill-terminal-yellow text-terminal-yellow" />
                      ))}
                    </div>
                  )}
                  {isClickable && (
                    <ChevronRight className="w-4 h-4 text-terminal-yellow" />
                  )}
                </div>
              </div>

              {/* Números */}
              <div className="flex items-center gap-2">
                {normal > 0 && (
                  <span className="text-sm opacity-50">{normal.toFixed(1)}</span>
                )}
                {normal > 0 && (
                  <span className="text-xs opacity-30">→</span>
                )}
                <span className="text-lg font-bold text-terminal-green leading-none">
                  {semEle.toFixed(1)}
                </span>
                {gapPct > 0 && (
                  <span className="text-[11px] font-semibold text-terminal-green bg-terminal-green/10 px-1.5 py-0.5 rounded">
                    +{gapPct}%
                  </span>
                )}
              </div>

              {normal > 0 && (
                <div className="text-[9px] opacity-40 mt-1">
                  média normal → sem {triggerLastName}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* CTA hint */}
      {onInsightClick && (
        <div className="text-[9px] text-terminal-yellow/40 mt-2 text-center">
          Clique para filtrar o gráfico
        </div>
      )}
    </div>
  );
};
