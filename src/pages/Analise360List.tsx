import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Loader2, Star, ChevronRight, Calendar, Filter as FilterIcon,
} from 'lucide-react';
import { getPlayerPhotoUrl, tryNextPlayerPhotoUrl } from '@/utils/team-logos';
import { useAnalise360Data } from '@/hooks/use-analise360';
import AnalyticsNav from '@/components/AnalyticsNav';
import type { DailyOpportunity } from '@/services/nba-data.service';
import {
  Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';

// ─── Types ───────────────────────────────────────────────────────────────

interface TriggerGroup {
  triggerPlayerId: number;
  triggerName: string;
  triggerStatus: string;
  triggerTeamAbbr: string;
  triggerDaysOut: number | null;
  ratingStars: number;
  homeTeamAbbr: string;
  visitorTeamAbbr: string;
  backupCount: number;
  topBackupName: string | null;
  topBackupGapPct: number;
  topBackupStat: string;
}

// ─── Constants ───────────────────────────────────────────────────────────

const STATUS_ORDER: Record<string, number> = { out: 0, doubtful: 1, questionable: 2, probable: 3 };

const STAT_LABEL_PT: Record<string, string> = {
  player_points: 'Pontos',
  player_assists: 'Assistências',
  player_rebounds: 'Rebotes',
  player_points_rebounds_assists: 'PRA',
  player_points_assists: 'P+A',
  player_points_rebounds: 'P+R',
  player_rebounds_assists: 'R+A',
  player_blocks_steals: 'B+R',
  player_threes: '3PT',
  player_steals: 'Roubos',
  player_blocks: 'Tocos',
};

const STATUS_META: Record<string, { short: 'OUT' | 'Q' | 'DTD'; filterLabel: string; sectionLabel: string; badgeCls: string; chipCls: string }> = {
  out: {
    short: 'OUT',
    filterLabel: 'OUT',
    sectionLabel: 'Fora hoje',
    badgeCls: 'bg-status-danger text-white',
    chipCls: 'bg-status-danger/10 text-status-danger border border-status-danger/20',
  },
  doubtful: {
    short: 'DTD',
    filterLabel: 'Duvidoso',
    sectionLabel: 'Duvidosos',
    badgeCls: 'bg-status-warning text-white',
    chipCls: 'bg-status-warning/10 text-status-warning border border-status-warning/20',
  },
  questionable: {
    short: 'Q',
    filterLabel: 'Questionável',
    sectionLabel: 'Questionáveis',
    badgeCls: 'bg-amber-500 text-white',
    chipCls: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  probable: {
    short: 'Q',
    filterLabel: 'Provável',
    sectionLabel: 'Prováveis',
    badgeCls: 'bg-lime-500 text-white',
    chipCls: 'bg-lime-50 text-lime-700 border border-lime-200',
  },
};

function normalizeStatusGroup(status: string): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'out' || s.includes('out')) return 'out';
  if (s.includes('doubtful')) return 'doubtful';
  if (s.includes('questionable')) return 'questionable';
  return 'probable';
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function getSaoPauloTodayLabel(): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
  }).formatToParts(new Date());
  const d = parts.find(p => p.type === 'day')?.value ?? '00';
  const m = parts.find(p => p.type === 'month')?.value ?? '00';
  return `${d}/${m}`;
}

// ─── Player Photo ────────────────────────────────────────────────────────

function PlayerPhoto({ name, teamAbbr, size = 'md' }: { name: string; teamAbbr: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const sizeClass = size === 'lg' ? 'w-12 h-12' : size === 'md' ? 'w-10 h-10' : 'w-8 h-8';
  const textClass = size === 'lg' ? 'text-sm' : size === 'md' ? 'text-[11px]' : 'text-[9px]';
  return (
    <div className={`${sizeClass} rounded-full overflow-hidden bg-ink-3 border border-line shrink-0 flex items-center justify-center`}>
      <img
        src={getPlayerPhotoUrl(name, teamAbbr)}
        alt={name}
        className="w-full h-full object-cover object-top"
        loading="lazy"
        data-player-photo-index="0"
        onError={(e) => {
          const didTry = tryNextPlayerPhotoUrl(e.target as HTMLImageElement, name, teamAbbr);
          if (!didTry) {
            const el = e.target as HTMLImageElement;
            el.style.display = 'none';
            const parent = el.parentElement;
            if (parent) parent.innerHTML = `<span class="${textClass} font-semibold text-ink-2">${initials}</span>`;
          }
        }}
      />
    </div>
  );
}

// ─── Pill / Chip components ──────────────────────────────────────────────

type PillTone = 'default' | 'out' | 'questionable' | 'doubtful';

const PILL_ACTIVE_CLS: Record<PillTone, string> = {
  default: 'bg-forest-tint text-forest border-forest/30 font-semibold',
  out: 'bg-status-danger/10 text-status-danger border-status-danger/30 font-semibold',
  questionable: 'bg-amber-50 text-amber-700 border-amber-300 font-semibold',
  doubtful: 'bg-status-warning/10 text-status-warning border-status-warning/30 font-semibold',
};

function FilterPill({
  active, onClick, children, tone = 'default',
}: { active: boolean; onClick: () => void; children: React.ReactNode; tone?: PillTone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
        active
          ? PILL_ACTIVE_CLS[tone]
          : 'text-ink-2 border-transparent hover:text-ink hover:bg-ink-3/60'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Trigger Card ────────────────────────────────────────────────────────

function TriggerCard({ trigger, onClick }: { trigger: TriggerGroup; onClick: () => void }) {
  const statusMeta = STATUS_META[normalizeStatusGroup(trigger.triggerStatus)] ?? STATUS_META.out;
  const lastName = trigger.topBackupName?.split(' ').slice(-1)[0] ?? null;
  const topStatLabel = STAT_LABEL_PT[trigger.topBackupStat] ?? trigger.topBackupStat;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-white border border-line rounded-xl p-4 text-left hover:border-forest/30 hover:shadow-[0_2px_8px_-3px_rgba(10,61,46,0.08)] transition-all group"
    >
      {/* Header: avatar + name + meta */}
      <div className="flex items-start gap-3 mb-3">
        <PlayerPhoto name={trigger.triggerName} teamAbbr={trigger.triggerTeamAbbr} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-sm font-semibold text-ink truncate">{trigger.triggerName}</span>
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${statusMeta.badgeCls}`}>
              {statusMeta.short}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mb-1 text-[11px] text-ink-2">
            <span className="font-medium">{trigger.triggerTeamAbbr}</span>
            <span className="text-line">·</span>
            <span>{trigger.homeTeamAbbr} vs {trigger.visitorTeamAbbr}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: Math.max(0, Math.min(trigger.ratingStars, 5)) }).map((_, i) => (
                <Star key={i} className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
              ))}
            </div>
            {trigger.triggerDaysOut != null && trigger.triggerDaysOut > 0 && (
              <>
                <span className="text-line">·</span>
                <span className="text-[10px] text-ink-2">fora há {trigger.triggerDaysOut}d</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats box */}
      <div className="bg-canvas-2/60 rounded-lg px-3 py-2.5 flex items-center justify-between mb-3">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-ink-2 font-semibold mb-0.5">
            Companheiros valorizados
          </div>
          <div className="text-2xl font-bold text-ink tabular-nums leading-none">
            {trigger.backupCount}
          </div>
        </div>
        <div className="text-right min-w-0">
          <div className="text-[9px] uppercase tracking-wider text-ink-2 font-semibold mb-0.5">
            Top impacto
          </div>
          {lastName ? (
            <>
              <div className="text-sm font-semibold text-ink truncate">{lastName}</div>
              <div className="text-[11px] text-forest font-medium">
                {trigger.topBackupGapPct > 0 ? '+' : ''}{trigger.topBackupGapPct.toFixed(0)}% em {topStatLabel}
              </div>
            </>
          ) : (
            <div className="text-[11px] text-ink-2">—</div>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-forest font-medium group-hover:underline">Ver análise</span>
        <ChevronRight className="w-3.5 h-3.5 text-ink-2 group-hover:text-forest transition-colors" />
      </div>
    </button>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'out' | 'doubtful' | 'questionable';

export default function Analise360List() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useAnalise360Data();
  const opportunities = data?.opportunities ?? [];
  const playerStarsMap = data?.playerStarsMap ?? new Map<number, number>();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // exactStars: 0 = todos; 1/2/3 = exatamente N estrelas
  const [exactStars, setExactStars] = useState<number>(0);
  const [onlyMultiImpact, setOnlyMultiImpact] = useState<boolean>(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (exactStars > 0 ? 1 : 0) +
    (onlyMultiImpact ? 1 : 0);

  const clearAllFilters = () => {
    setStatusFilter('all');
    setExactStars(0);
    setOnlyMultiImpact(false);
  };

  // Aggregate opportunities into triggers
  const triggerGroups = useMemo((): TriggerGroup[] => {
    const byTrigger = new Map<number, DailyOpportunity[]>();
    opportunities.forEach((o) => {
      if (!byTrigger.has(o.trigger_player_id)) byTrigger.set(o.trigger_player_id, []);
      byTrigger.get(o.trigger_player_id)!.push(o);
    });

    const groups: TriggerGroup[] = [];
    byTrigger.forEach((opps, triggerId) => {
      const first = opps[0];
      const uniqueBackups = new Set(opps.filter(o => o.backup_player_id != null).map(o => o.backup_player_id));
      // Top backup = entry com maior gap_pct positivo
      const top = opps.reduce<DailyOpportunity | null>((best, o) => {
        if (o.gap_pct == null) return best;
        if (best == null) return o;
        return o.gap_pct > (best.gap_pct ?? -Infinity) ? o : best;
      }, null);

      // Apenas backups com ganho positivo significativo contam como "valorizados"
      const valuedBackups = new Set(
        opps.filter(o => o.backup_player_id != null && (o.gap_pct ?? 0) > 0).map(o => o.backup_player_id)
      );

      groups.push({
        triggerPlayerId: triggerId,
        triggerName: first.trigger_name,
        triggerStatus: first.trigger_status,
        triggerTeamAbbr: first.trigger_team_abbr,
        triggerDaysOut: first.trigger_days_out,
        ratingStars: playerStarsMap.get(triggerId) ?? first.rating_stars ?? 0,
        homeTeamAbbr: first.home_team_abbr,
        visitorTeamAbbr: first.visitor_team_abbr,
        backupCount: valuedBackups.size,
        topBackupName: top?.backup_player_name ?? null,
        topBackupGapPct: top?.gap_pct ?? 0,
        topBackupStat: top?.stat_type ?? '',
      });
    });

    return groups;
  }, [opportunities, playerStarsMap]);

  // Apply filters
  const filteredGroups = useMemo(() => {
    let g = triggerGroups;
    if (statusFilter !== 'all') g = g.filter(t => normalizeStatusGroup(t.triggerStatus) === statusFilter);
    if (exactStars > 0) g = g.filter(t => t.ratingStars === exactStars);
    if (onlyMultiImpact) g = g.filter(t => t.backupCount >= 2);
    return g;
  }, [triggerGroups, statusFilter, exactStars, onlyMultiImpact]);

  // Ordem fixa dentro do grupo: mais valorizados primeiro, depois maior gap
  const sortedGroups = useMemo(() => {
    return [...filteredGroups].sort((a, b) =>
      b.backupCount - a.backupCount || b.topBackupGapPct - a.topBackupGapPct
    );
  }, [filteredGroups]);

  // Group by status section
  const groupedSections = useMemo(() => {
    const map = new Map<string, TriggerGroup[]>();
    sortedGroups.forEach((g) => {
      const key = normalizeStatusGroup(g.triggerStatus);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99));
  }, [sortedGroups]);

  const todayLabel = getSaoPauloTodayLabel();

  return (
    <>
      <Helmet>
        <title>Análise 360° — Smart Betting</title>
      </Helmet>

      <div className="theme-rebrand min-h-screen bg-canvas text-ink">
        <AnalyticsNav variant="rebrand" showBack backTo="/home-nba" />

        {/* Page header (bg-white) */}
        <div className="bg-white border-b border-line">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-7">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h1 className="text-[26px] md:text-[32px] font-semibold tracking-tight text-ink leading-none">
                    Análise 360°
                  </h1>
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 bg-amber-100 text-amber-700 rounded-md whitespace-nowrap">
                    impacto de cada lesão
                  </span>
                </div>
                <p className="text-[13px] md:text-[14px] mt-1.5 text-ink-2 max-w-2xl leading-snug">
                  Quem se beneficia quando um titular não joga. Cada card é uma lesão; clique para
                  ver a análise e os companheiros valorizados.
                </p>

              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 border border-line bg-white rounded-md text-xs text-ink-2 shrink-0">
                <Calendar className="w-3.5 h-3.5" />
                <span>Hoje · {todayLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <main id="main-content" className="max-w-6xl mx-auto px-4 py-6">
          {/* Filters bar */}
          {!isLoading && triggerGroups.length > 0 && (
            <>
              {/* Desktop: inline filter bar */}
              <div className="hidden sm:flex bg-white border border-line rounded-lg px-3 py-2.5 mb-6 items-center gap-x-5 gap-y-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <FilterIcon className="w-3.5 h-3.5 text-ink-2" />
                    <span className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">Status</span>
                  </div>
                  <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>Todos</FilterPill>
                  <FilterPill tone="out" active={statusFilter === 'out'} onClick={() => setStatusFilter('out')}>Fora</FilterPill>
                  <FilterPill tone="doubtful" active={statusFilter === 'doubtful'} onClick={() => setStatusFilter('doubtful')}>Duvidoso</FilterPill>
                  <FilterPill tone="questionable" active={statusFilter === 'questionable'} onClick={() => setStatusFilter('questionable')}>Questionável</FilterPill>
                </div>

                <div className="w-px h-5 bg-line" />

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">Estrelas</span>
                  <FilterPill active={exactStars === 0} onClick={() => setExactStars(0)}>Todos</FilterPill>
                  {[1, 2, 3].map((s) => (
                    <FilterPill key={s} active={exactStars === s} onClick={() => setExactStars(s)}>
                      <span className="inline-flex items-center gap-0.5">
                        {s} <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                      </span>
                    </FilterPill>
                  ))}
                </div>

                <div className="w-px h-5 bg-line" />

                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">Valorizados</span>
                  <FilterPill active={onlyMultiImpact} onClick={() => setOnlyMultiImpact(!onlyMultiImpact)}>
                    ≥ 2
                  </FilterPill>
                </div>
              </div>

              {/* Mobile: filter trigger button + sheet */}
              <div className="sm:hidden mb-4">
                <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center justify-between w-full bg-white border border-line rounded-lg px-3 py-2.5 hover:border-forest/30 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-ink">
                        <FilterIcon className="w-4 h-4 text-ink-2" />
                        Filtros
                        {activeFilterCount > 0 && (
                          <span className="bg-forest text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums">
                            {activeFilterCount}
                          </span>
                        )}
                      </span>
                      <ChevronRight className="w-4 h-4 text-ink-2" />
                    </button>
                  </SheetTrigger>
                  <SheetContent
                    side="bottom"
                    className="theme-rebrand bg-canvas rounded-t-2xl border-t border-line max-h-[85vh] overflow-y-auto"
                  >
                    <SheetHeader>
                      <SheetTitle className="text-ink text-left">Filtros</SheetTitle>
                    </SheetHeader>

                    <div className="flex flex-col gap-6 mt-5">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5">
                          <FilterIcon className="w-3.5 h-3.5 text-ink-2" />
                          <span className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">Status</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>Todos</FilterPill>
                          <FilterPill tone="out" active={statusFilter === 'out'} onClick={() => setStatusFilter('out')}>Fora</FilterPill>
                          <FilterPill tone="doubtful" active={statusFilter === 'doubtful'} onClick={() => setStatusFilter('doubtful')}>Duvidoso</FilterPill>
                          <FilterPill tone="questionable" active={statusFilter === 'questionable'} onClick={() => setStatusFilter('questionable')}>Questionável</FilterPill>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">Estrelas</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <FilterPill active={exactStars === 0} onClick={() => setExactStars(0)}>Todos</FilterPill>
                          {[1, 2, 3].map((s) => (
                            <FilterPill key={s} active={exactStars === s} onClick={() => setExactStars(s)}>
                              <span className="inline-flex items-center gap-0.5">
                                {s} <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                              </span>
                            </FilterPill>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-ink-2 font-semibold">Valorizados</span>
                        <div className="flex items-center gap-2">
                          <FilterPill active={onlyMultiImpact} onClick={() => setOnlyMultiImpact(!onlyMultiImpact)}>
                            ≥ 2
                          </FilterPill>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        disabled={activeFilterCount === 0}
                        className="flex-1 px-3 py-2.5 text-sm font-medium rounded-md border border-line text-ink-2 hover:text-ink hover:border-ink-2 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Limpar
                      </button>
                      <SheetClose asChild>
                        <button
                          type="button"
                          className="flex-1 px-3 py-2.5 text-sm font-semibold rounded-md bg-forest text-white hover:bg-forest/90 transition-colors"
                        >
                          Ver resultados ({sortedGroups.length})
                        </button>
                      </SheetClose>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-forest opacity-70" />
              <span className="text-sm text-ink-2">Carregando dados...</span>
            </div>
          ) : error ? (
            <div className="text-center py-20 text-sm text-status-danger">
              {error?.message ?? 'Falha ao carregar dados'}
            </div>
          ) : sortedGroups.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm text-ink-2">Nenhum jogador com lesão impactante hoje.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedSections.map(([statusKey, triggers]) => {
                const meta = STATUS_META[statusKey] ?? STATUS_META.out;
                return (
                  <section key={statusKey}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${meta.chipCls}`}>
                        {meta.short}
                      </span>
                      <span className="text-sm text-ink-2">
                        {meta.sectionLabel} · {triggers.length} {triggers.length === 1 ? 'jogador' : 'jogadores'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {triggers.map((trigger) => (
                        <TriggerCard
                          key={trigger.triggerPlayerId}
                          trigger={trigger}
                          onClick={() => navigate(`/analise-360/${trigger.triggerPlayerId}`)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
