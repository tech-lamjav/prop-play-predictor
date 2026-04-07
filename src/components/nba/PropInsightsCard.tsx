import React from 'react';
import { PropPlayer } from '@/services/nba-data.service';
import { Lightbulb, AlertTriangle, Star, ChevronRight } from 'lucide-react';
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

const STAT_LABELS_SHORT: Record<string, { article: string; name: string }> = {
  player_points: { article: 'os', name: 'pontos' },
  player_assists: { article: 'as', name: 'assistências' },
  player_rebounds: { article: 'os', name: 'rebotes' },
  player_threes: { article: 'os', name: '3 pontos' },
  player_steals: { article: 'os', name: 'roubos' },
  player_blocks: { article: 'os', name: 'bloqueios' },
  player_turnovers: { article: 'os', name: 'turnovers' },
  player_points_assists: { article: 'os', name: 'pts + ast' },
  player_points_rebounds: { article: 'os', name: 'pts + reb' },
  player_rebounds_assists: { article: 'os', name: 'reb + ast' },
  player_points_rebounds_assists: { article: 'o', name: 'PRA' },
  player_double_double: { article: 'os', name: 'double-doubles' },
};

const STATUS_CONFIG: Record<string, { badge: string; badgeClass: string; color: string }> = {
  out: { badge: 'OUT', badgeClass: 'bg-terminal-red/20 text-terminal-red', color: 'text-terminal-red' },
  'out for season': { badge: 'OFS', badgeClass: 'bg-terminal-red/20 text-terminal-red', color: 'text-terminal-red' },
  doubtful: { badge: 'DTD', badgeClass: 'bg-orange-400/20 text-orange-400', color: 'text-orange-400' },
  questionable: { badge: 'Q', badgeClass: 'bg-yellow-400/20 text-yellow-400', color: 'text-yellow-400' },
};

function isConfirmedOut(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'out' || s === 'out for season';
}

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

  // Apenas props com gatilho ativo e impacto positivo
  const backupProps = propPlayers.filter(
    p => p.is_available_backup &&
      p.next_available_player_name?.trim() &&
      p.next_player_stats_when_leader_out > 0 &&
      p.next_player_stats_when_leader_out > p.next_player_stats_normal
  );

  if (backupProps.length === 0) return null;

  const playerLastName = playerName.split(' ').pop() || playerName;

  // Agrupar por gatilho (pode ter mais de um líder lesionado)
  const byTrigger = new Map<string, PropPlayer[]>();
  backupProps.forEach(p => {
    const key = p.next_available_player_name;
    if (!byTrigger.has(key)) byTrigger.set(key, []);
    byTrigger.get(key)!.push(p);
  });

  // Ordenar: Out primeiro, depois Doubtful, depois Questionable
  const statusOrder = (s: string | null) => {
    if (!s) return 99;
    const l = s.toLowerCase();
    if (l === 'out' || l === 'out for season') return 0;
    if (l === 'doubtful') return 1;
    return 2;
  };

  const triggerGroups = Array.from(byTrigger.entries())
    .map(([name, props]) => ({ name, props, status: props[0].leader_injury_status }))
    .sort((a, b) => statusOrder(a.status) - statusOrder(b.status));

  return (
    <div className="terminal-container p-4">
      <div className="space-y-4">
        {triggerGroups.map((group) => {
          const triggerLastName = group.name.split(' ').pop();
          const status = group.status?.toLowerCase() || 'out';
          const config = STATUS_CONFIG[status] || STATUS_CONFIG['out'];
          const confirmed = isConfirmedOut(group.status);

          return (
            <div key={group.name}>
              {/* Header */}
              <div className="flex items-center gap-2 mb-1">
                {confirmed ? (
                  <Lightbulb className="w-3.5 h-3.5 text-terminal-yellow shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                )}
                <span className="text-[10px] font-bold text-terminal-yellow uppercase tracking-widest">
                  {confirmed ? 'Insight' : 'Alerta'}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${config.badgeClass}`}>
                  {config.badge}
                </span>
              </div>

              {/* Storytelling */}
              <p className="text-xs text-terminal-text opacity-80 mb-3 leading-relaxed">
                {confirmed ? (
                  <>
                    Com <span className={`font-bold ${config.color}`}>{triggerLastName}</span> fora,{' '}
                  </>
                ) : (
                  <>
                    Se <span className={`font-bold ${config.color}`}>{triggerLastName}</span> for confirmado fora,{' '}
                  </>
                )}
                {group.props.length === 1 ? (() => {
                  const stat = STAT_LABELS_SHORT[group.props[0].stat_type];
                  const article = stat?.article ?? 'os';
                  const name = stat?.name ?? group.props[0].stat_type.replace('player_', '').replace(/_/g, ' ');
                  const pct = group.props[0].next_player_stats_normal > 0
                    ? Math.round(((group.props[0].next_player_stats_when_leader_out - group.props[0].next_player_stats_normal) / group.props[0].next_player_stats_normal) * 100)
                    : 0;
                  return (
                    <>
                      {article}{' '}
                      <span className="font-bold text-terminal-green">{name}</span>
                      {' '}de {playerLastName} {confirmed ? 'sobem' : 'podem subir'}{' '}
                      <span className="font-bold text-terminal-green">+{pct}%</span>
                    </>
                  );
                })() : (
                  <>
                    as médias de {playerLastName} {confirmed ? 'sobem' : 'podem subir'} em{' '}
                    <span className="font-bold text-terminal-green">
                      {group.props.length} categorias
                    </span>
                  </>
                )}
              </p>

              {/* Oportunidades */}
              <div className="space-y-2">
                {group.props.map((prop, i) => {
                  const normal = prop.next_player_stats_normal;
                  const semEle = prop.next_player_stats_when_leader_out;
                  const gap = semEle - normal;
                  const gapPct = normal > 0 ? Math.round((gap / normal) * 100) : 0;
                  const statLabel = STAT_LABELS[prop.stat_type] ?? prop.stat_type.replace('player_', '').replace(/_/g, ' ');
                  const isClickable = !!onInsightClick;

                  return (
                    <button
                      key={i}
                      className={`w-full text-left bg-terminal-dark-gray rounded border p-3 transition-all ${
                        confirmed ? 'border-terminal-yellow/20' : 'border-yellow-400/15'
                      } ${isClickable ? 'hover:border-terminal-yellow/50 hover:bg-terminal-yellow/5 cursor-pointer' : 'cursor-default'}`}
                      onClick={() => onInsightClick?.(prop.stat_type, group.name)}
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
            </div>
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
