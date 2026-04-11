import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Star, Radar, ChevronRight, Users } from 'lucide-react';
import { getPlayerPhotoUrl, tryNextPlayerPhotoUrl, getTeamLogoUrl, teamAbbrToName } from '@/utils/team-logos';
import { useAnalise360Data } from '@/hooks/use-analise360';
import AnalyticsNav from '@/components/AnalyticsNav';

interface TriggerGroup {
  triggerPlayerId: number;
  triggerName: string;
  triggerStatus: string;
  triggerTeamAbbr: string;
  triggerTeamId: number;
  triggerDaysOut: number | null;
  ratingStars: number;
  backupCount: number;
  gameLabel: string;
}

const STATUS_ORDER: Record<string, number> = { out: 0, doubtful: 1, questionable: 2, probable: 3 };

function normalizeStatusGroup(status: string): string {
  const s = status.toLowerCase();
  if (s === 'out' || s.includes('out')) return 'out';
  if (s.includes('doubtful')) return 'doubtful';
  if (s.includes('questionable')) return 'questionable';
  return 'probable';
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  out: { label: 'OUT', cls: 'bg-terminal-red/20 text-terminal-red border-terminal-red/30' },
  doubtful: { label: 'DOUBTFUL', cls: 'bg-orange-400/20 text-orange-400 border-orange-400/30' },
  questionable: { label: 'QUESTIONABLE', cls: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30' },
  probable: { label: 'PROBABLE', cls: 'bg-lime-400/20 text-lime-400 border-lime-400/30' },
};

function PlayerPhoto({ name, teamAbbr, size = 'md' }: { name: string; teamAbbr: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const sizeClass = size === 'lg' ? 'w-14 h-14' : size === 'md' ? 'w-10 h-10' : 'w-7 h-7';
  const textClass = size === 'lg' ? 'text-sm' : size === 'md' ? 'text-[10px]' : 'text-[9px]';
  return (
    <div className={`${sizeClass} rounded-full overflow-hidden bg-terminal-gray border border-terminal-border-subtle shrink-0 flex items-center justify-center`}>
      <img
        src={getPlayerPhotoUrl(name, teamAbbr)}
        alt={name}
        className="w-full h-full object-cover object-top"
        data-player-photo-index="0"
        onError={(e) => {
          const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, name, teamAbbr);
          if (!didTry) {
            const el = e.target as HTMLImageElement;
            el.style.display = 'none';
            const parent = el.parentElement;
            if (parent) parent.innerHTML = `<span class="${textClass} font-bold text-terminal-text opacity-60">${initials}</span>`;
          }
        }}
      />
    </div>
  );
}

export default function Analise360List() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useAnalise360Data();
  const opportunities = data?.opportunities ?? [];
  const playerStarsMap = data?.playerStarsMap ?? new Map<number, number>();
  const [minStars, setMinStars] = useState<number>(0);

  const triggerGroups = useMemo(() => {
    const byTrigger = new Map<number, typeof opportunities>();
    opportunities.forEach(o => {
      if (!byTrigger.has(o.trigger_player_id)) byTrigger.set(o.trigger_player_id, []);
      byTrigger.get(o.trigger_player_id)!.push(o);
    });

    const groups: TriggerGroup[] = [];
    byTrigger.forEach((opps, triggerId) => {
      const first = opps[0];
      const uniqueBackups = new Set(opps.filter(o => o.backup_player_id).map(o => o.backup_player_id));
      groups.push({
        triggerPlayerId: triggerId,
        triggerName: first.trigger_name,
        triggerStatus: first.trigger_status,
        triggerTeamAbbr: first.trigger_team_abbr,
        triggerTeamId: first.trigger_team_id,
        triggerDaysOut: first.trigger_days_out,
        ratingStars: playerStarsMap.get(triggerId) ?? 0,
        backupCount: uniqueBackups.size,
        gameLabel: `${first.home_team_abbr} vs ${first.visitor_team_abbr}`,
      });
    });

    // Sort by status severity, then by stars desc
    groups.sort((a, b) => {
      const sa = STATUS_ORDER[normalizeStatusGroup(a.triggerStatus)] ?? 99;
      const sb = STATUS_ORDER[normalizeStatusGroup(b.triggerStatus)] ?? 99;
      if (sa !== sb) return sa - sb;
      return b.ratingStars - a.ratingStars;
    });

    return groups;
  }, [opportunities]);

  // Filter by min stars
  const filteredGroups = useMemo(() => {
    if (minStars === 0) return triggerGroups;
    return triggerGroups.filter(g => g.ratingStars >= minStars);
  }, [triggerGroups, minStars]);

  // Group triggers by status
  const groupedByStatus = useMemo(() => {
    const map = new Map<string, TriggerGroup[]>();
    filteredGroups.forEach(g => {
      const key = normalizeStatusGroup(g.triggerStatus);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    });
    return map;
  }, [filteredGroups]);

  const statusSections = useMemo(() => {
    return Array.from(groupedByStatus.entries())
      .sort(([a], [b]) => (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99));
  }, [groupedByStatus]);

  return (
    <div className="min-h-screen bg-terminal-black text-terminal-text font-mono">
      <AnalyticsNav showBack />

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Radar className="w-5 h-5 text-terminal-blue" />
            <h1 className="text-lg font-bold text-terminal-blue">Análise 360</h1>
          </div>
          <p className="text-xs text-terminal-text/50">
            Veja como lesões reorganizam o time — selecione um jogador para ver o impacto nos companheiros
          </p>
        </div>

        {/* Stars filter */}
        {!isLoading && triggerGroups.length > 0 && (
          <div className="flex items-center gap-2 mb-5">
            <span className="text-[10px] text-terminal-text/40 uppercase tracking-wider">Estrelas:</span>
            {[0, 1, 2, 3].map(stars => (
              <button
                key={stars}
                onClick={() => setMinStars(stars)}
                className={`flex items-center gap-1 px-3 py-1 text-[11px] rounded-md border transition-all ${
                  minStars === stars
                    ? 'bg-terminal-blue/15 text-terminal-blue border-terminal-blue/30'
                    : 'text-terminal-text/40 border-terminal-border-subtle/30 hover:text-terminal-text/60 hover:border-terminal-border-subtle/60'
                }`}
              >
                {stars === 0 ? 'Todos' : (
                  <>
                    {stars}+ <Star className="w-3 h-3 text-terminal-yellow fill-terminal-yellow" />
                  </>
                )}
              </button>
            ))}
            {minStars > 0 && (
              <span className="text-[10px] text-terminal-text/30 ml-1">
                {filteredGroups.length} de {triggerGroups.length}
              </span>
            )}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-terminal-green opacity-60" />
            <span className="text-sm text-terminal-text/40">Carregando dados...</span>
          </div>
        ) : error ? (
          <div className="text-center py-20 text-sm text-terminal-red/70">{error?.message ?? 'Falha ao carregar dados'}</div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-20">
            <Radar className="w-8 h-8 text-terminal-text/20 mx-auto mb-3" />
            <p className="text-sm text-terminal-text/40">
              {minStars > 0 ? `Nenhum jogador com ${minStars}+ estrelas lesionado hoje` : 'Nenhum jogador com lesão impactante hoje'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {statusSections.map(([statusKey, triggers]) => {
              const badge = STATUS_BADGE[statusKey] || STATUS_BADGE.probable;
              return (
                <div key={statusKey}>
                  {/* Status section header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="text-[10px] text-terminal-text/30">
                      {triggers.length} {triggers.length === 1 ? 'jogador' : 'jogadores'}
                    </span>
                  </div>

                  {/* Trigger cards grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {triggers.map(trigger => (
                      <button
                        key={trigger.triggerPlayerId}
                        onClick={() => navigate(`/analise-360/${trigger.triggerPlayerId}`)}
                        className="bg-terminal-dark-gray border border-terminal-border-subtle rounded-lg p-4 hover:border-terminal-blue/50 hover:bg-terminal-dark-gray/80 transition-all text-left group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <PlayerPhoto name={trigger.triggerName} teamAbbr={trigger.triggerTeamAbbr} size="lg" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-sm font-bold text-terminal-text truncate">
                                {trigger.triggerName}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-terminal-text/30 group-hover:text-terminal-blue transition-colors shrink-0" />
                            </div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <img
                                src={getTeamLogoUrl(teamAbbrToName(trigger.triggerTeamAbbr))}
                                alt={trigger.triggerTeamAbbr}
                                className="w-4 h-4 object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                              <span className="text-[10px] text-terminal-text/50">{trigger.triggerTeamAbbr}</span>
                              <span className="text-[10px] text-terminal-text/30">·</span>
                              <span className="text-[10px] text-terminal-text/40">{trigger.gameLabel}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: Math.min(trigger.ratingStars, 5) }).map((_, i) => (
                                  <Star key={i} className="w-2.5 h-2.5 text-terminal-yellow fill-terminal-yellow" />
                                ))}
                              </div>
                              <span className="text-[10px] text-terminal-text/30">·</span>
                              <div className="flex items-center gap-1 text-[10px] text-terminal-blue/70">
                                <Users className="w-3 h-3" />
                                <span>{trigger.backupCount} impactados</span>
                              </div>
                              {trigger.triggerDaysOut != null && trigger.triggerDaysOut > 0 && (
                                <>
                                  <span className="text-[10px] text-terminal-text/30">·</span>
                                  <span className="text-[10px] text-terminal-red/50">{trigger.triggerDaysOut}d fora</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
