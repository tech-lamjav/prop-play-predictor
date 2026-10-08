import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { PropPlayer } from '@/services/nba-data.service';
import { Lightbulb, AlertTriangle, Star, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_CONFIG: Record<string, { estado: string; badgeClass: string; color: string }> = {
  out: { estado: 'out', badgeClass: 'bg-rose-100 text-rose-700', color: 'text-rose-700' },
  'out for season': { estado: 'out_for_season', badgeClass: 'bg-rose-100 text-rose-700', color: 'text-rose-700' },
  doubtful: { estado: 'doubtful', badgeClass: 'bg-orange-400/20 text-orange-400', color: 'text-orange-400' },
  questionable: { estado: 'questionable', badgeClass: 'bg-yellow-400/20 text-yellow-400', color: 'text-yellow-400' },
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
  const { t } = useTranslation('nba');

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white border border-line p-4">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-32 bg-canvas-2" />
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full bg-canvas-2" />
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
    <div className="rounded-lg bg-white border border-line p-4">
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
                  <Lightbulb className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                )}
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">
                  {confirmed ? t('jogador.insightDica') : t('jogador.insightAlerta')}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${config.badgeClass}`}>
                  {t(`estado.selo.${config.estado}`)}
                </span>
              </div>

              {/* Storytelling */}
              <p className="text-xs text-ink opacity-80 mb-3 leading-relaxed">
                {group.props.length === 1 ? (() => {
                  const tipo = group.props[0].stat_type;
                  const bruto = tipo.replace('player_', '').replace(/_/g, ' ');
                  const pct = group.props[0].next_player_stats_normal > 0
                    ? Math.round(((group.props[0].next_player_stats_when_leader_out - group.props[0].next_player_stats_normal) / group.props[0].next_player_stats_normal) * 100)
                    : 0;
                  return (
                    <Trans
                      t={t}
                      i18nKey={confirmed ? 'jogador.insightConfirmadaUma' : 'jogador.insightDuvidaUma'}
                      values={{
                        gatilho: triggerLastName,
                        artigo: t(`estatisticas.artigo.${tipo}`, { defaultValue: '' }),
                        estatistica: t(`estatisticas.minusculo.${tipo}`, { defaultValue: bruto }),
                        jogador: playerLastName,
                        pct,
                      }}
                      components={[
                        <span className={`font-bold ${config.color}`} key="gatilho" />,
                        <span className="font-bold text-forest" key="estatistica" />,
                        <span className="font-bold text-forest" key="pct" />,
                      ]}
                    />
                  );
                })() : (
                  <Trans
                    t={t}
                    i18nKey={confirmed ? 'jogador.insightConfirmadaVarias' : 'jogador.insightDuvidaVarias'}
                    values={{ gatilho: triggerLastName, jogador: playerLastName, n: group.props.length }}
                    components={[
                      <span className={`font-bold ${config.color}`} key="gatilho" />,
                      <span className="font-bold text-forest" key="n" />,
                    ]}
                  />
                )}
              </p>

              {/* Oportunidades */}
              <div className="space-y-2">
                {group.props.map((prop, i) => {
                  const normal = prop.next_player_stats_normal;
                  const semEle = prop.next_player_stats_when_leader_out;
                  const gap = semEle - normal;
                  const gapPct = normal > 0 ? Math.round((gap / normal) * 100) : 0;
                  const statLabel = t(`estatisticas.nome.${prop.stat_type}`, { defaultValue: prop.stat_type.replace('player_', '').replace(/_/g, ' ') });
                  const isClickable = !!onInsightClick;

                  return (
                    <button
                      key={i}
                      className={`w-full text-left bg-canvas-2 rounded border p-3 transition-all ${
                        confirmed ? 'border-amber-200/20' : 'border-yellow-400/15'
                      } ${isClickable ? 'hover:border-amber-200/50 hover:bg-amber-50 cursor-pointer' : 'cursor-default'}`}
                      onClick={() => onInsightClick?.(prop.stat_type, group.name)}
                    >
                      {/* Stat + estrelas */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-ink uppercase">{statLabel}</span>
                        <div className="flex items-center gap-1.5">
                          {prop.rating_stars > 0 && (
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: prop.rating_stars }).map((_, j) => (
                                <Star key={j} className="w-3 h-3 fill-amber-400 text-amber-700" />
                              ))}
                            </div>
                          )}
                          {isClickable && (
                            <ChevronRight className="w-4 h-4 text-amber-700" />
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
                        <span className="text-lg font-bold text-forest leading-none">
                          {semEle.toFixed(1)}
                        </span>
                        {gapPct > 0 && (
                          <span className="text-[11px] font-semibold text-forest bg-emerald-50 px-1.5 py-0.5 rounded">
                            +{gapPct}%
                          </span>
                        )}
                      </div>

                      {normal > 0 && (
                        <div className="text-[9px] opacity-40 mt-1">
                          {t('jogador.insightMediaNormal', { gatilho: triggerLastName })}
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
        <div className="text-[9px] text-amber-700/40 mt-2 text-center">
          {t('jogador.insightCliqueFiltrar')}
        </div>
      )}
    </div>
  );
};
