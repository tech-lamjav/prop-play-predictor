import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { nbaDataService, Game, Player, DailyOpportunity } from '@/services/nba-data.service';
import { getTeamLogoUrl } from '@/utils/team-logos';
import { Loader2, Star, ArrowRight, Check } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';

const STATUSES = ['probable', 'questionable', 'doubtful', 'out'] as const;
type Status = typeof STATUSES[number];

const STATUS_META: Record<Status, { label: string; bg: string; fg: string; dot: string }> = {
  probable:     { label: 'Provável',     bg: 'bg-emerald-100', fg: 'text-forest',       dot: 'bg-forest' },
  questionable: { label: 'Questionável', bg: 'bg-amber-100',   fg: 'text-amber-700',    dot: 'bg-amber-400' },
  doubtful:     { label: 'Duvidoso',     bg: 'bg-orange-100',  fg: 'text-orange-700',   dot: 'bg-orange-500' },
  out:          { label: 'Out',          bg: 'bg-rose-100',    fg: 'text-rose-700',     dot: 'bg-rose-600' },
};

interface InjuredPlayer {
  playerId: number;
  name: string;
  ratingStars: number;
  status: Status;
  teamAbbr: string;
  teamName: string;
  isHome: boolean;
}

function normalizeStatus(status: string): Status | null {
  const s = (status ?? '').toLowerCase().trim();
  if (!s || s === 'active' || s === 'available' || s.includes('unk')) return null;
  if (s.includes('probable')) return 'probable';
  if (s.includes('questionable')) return 'questionable';
  if (s.includes('doubtful')) return 'doubtful';
  if (s === 'out' || s.includes('out') || s.includes('inactive') || s.includes('injured')) return 'out';
  return null;
}

function formatPtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00-03:00`);
  return d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).replace(/^./, c => c.toUpperCase());
}

let playersCache: Player[] | null = null;

interface Props {
  open: boolean;
  onClose: () => void;
  games: Game[];
  /** Quando fornecido, ★ vira "é gatilho de pelo menos 1 oportunidade do dia". Sem prop, fallback no rating_stars ≥ 3. */
  opportunities?: DailyOpportunity[];
}

export function InjuryReportModal({ open, onClose, games, opportunities }: Props) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>(playersCache ?? []);
  const [isLoading, setIsLoading] = useState(!playersCache);
  const [activeGameId, setActiveGameId] = useState<number | 'all'>('all');
  const [impactOnly, setImpactOnly] = useState(false);
  const [activeStatusMobile, setActiveStatusMobile] = useState<Status | 'all'>('all');

  useEffect(() => {
    if (!open || playersCache) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await nbaDataService.getAllPlayers();
        playersCache = data;
        setPlayers(data);
      } catch (e) {
        console.error('Error loading injury report', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [open]);

  // Set de trigger_player_id que aparecem em oportunidades do dia (impact)
  const triggerIds = useMemo(() => {
    const s = new Set<number>();
    opportunities?.forEach(o => s.add(o.trigger_player_id));
    return s;
  }, [opportunities]);

  const isImpact = (p: InjuredPlayer) =>
    opportunities ? triggerIds.has(p.playerId) : p.ratingStars >= 3;

  // Mapa teamAbbr → status → InjuredPlayer[]
  const teamInjuryMap = useMemo(() => {
    const teamSet = new Set<string>();
    games.forEach(g => {
      teamSet.add(g.home_team_abbreviation);
      teamSet.add(g.visitor_team_abbreviation);
    });
    const map = new Map<string, Map<Status, InjuredPlayer[]>>();
    players.forEach(p => {
      if (!teamSet.has(p.team_abbreviation)) return;
      const status = normalizeStatus(p.current_status || '');
      if (!status) return;
      if (!map.has(p.team_abbreviation)) map.set(p.team_abbreviation, new Map());
      const m = map.get(p.team_abbreviation)!;
      if (!m.has(status)) m.set(status, []);
      m.get(status)!.push({
        playerId: p.player_id,
        name: p.player_name,
        ratingStars: p.rating_stars ?? 0,
        status,
        teamAbbr: p.team_abbreviation,
        teamName: p.team_name,
        isHome: false, // assigned later per matchup
      });
    });
    return map;
  }, [players, games]);

  // Matchups com lesões (todos os jogos)
  const matchups = useMemo(() => {
    return games.map(g => {
      const homeMap = teamInjuryMap.get(g.home_team_abbreviation);
      const visitorMap = teamInjuryMap.get(g.visitor_team_abbreviation);
      return {
        gameId: g.game_id,
        label: `${g.visitor_team_abbreviation} vs ${g.home_team_abbreviation}`,
        time: g.game_datetime_brasilia
          ? new Date(g.game_datetime_brasilia).toLocaleTimeString('pt-BR', {
              timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
            })
          : '',
        home: {
          abbr: g.home_team_abbreviation,
          name: g.home_team_name,
          hasInjuries: !!homeMap,
          byStatus: homeMap,
        },
        visitor: {
          abbr: g.visitor_team_abbreviation,
          name: g.visitor_team_name,
          hasInjuries: !!visitorMap,
          byStatus: visitorMap,
        },
      };
    }).filter(m => m.home.hasInjuries || m.visitor.hasInjuries);
  }, [games, teamInjuryMap]);

  // Filtro por jogo
  const visibleMatchups = useMemo(
    () => activeGameId === 'all' ? matchups : matchups.filter(m => m.gameId === activeGameId),
    [matchups, activeGameId],
  );

  // Players visíveis após filtro impactOnly (pra cell rendering)
  const filterPlayers = (list: InjuredPlayer[] | undefined): InjuredPlayer[] => {
    if (!list) return [];
    if (!impactOnly) return list;
    return list.filter(isImpact);
  };

  // Totais globais por status (após filtro de jogo + impactOnly)
  const totals = useMemo(() => {
    const t: Record<Status, number> = { probable: 0, questionable: 0, doubtful: 0, out: 0 };
    visibleMatchups.forEach(m => {
      [m.home.byStatus, m.visitor.byStatus].forEach(byStatus => {
        if (!byStatus) return;
        STATUSES.forEach(st => {
          const list = filterPlayers(byStatus.get(st));
          t[st] += list.length;
        });
      });
    });
    return t;
  }, [visibleMatchups, impactOnly, opportunities]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalInjuries = totals.probable + totals.questionable + totals.doubtful + totals.out;
  const totalImpact = useMemo(() => {
    let c = 0;
    visibleMatchups.forEach(m => {
      [m.home.byStatus, m.visitor.byStatus].forEach(byStatus => {
        if (!byStatus) return;
        byStatus.forEach(list => {
          list.forEach(p => { if (isImpact(p)) c++; });
        });
      });
    });
    return c;
  }, [visibleMatchups, opportunities]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lista chata pro mobile (filtrada por status ativo + impactOnly)
  const mobileFlatList = useMemo(() => {
    const out: InjuredPlayer[] = [];
    const statusesToInclude: Status[] = activeStatusMobile === 'all'
      ? [...STATUSES]
      : [activeStatusMobile];
    visibleMatchups.forEach(m => {
      const collect = (byStatus: Map<Status, InjuredPlayer[]> | undefined, isHome: boolean) => {
        statusesToInclude.forEach(st => {
          const list = byStatus?.get(st) ?? [];
          list.forEach(p => {
            if (impactOnly && !isImpact(p)) return;
            out.push({ ...p, isHome });
          });
        });
      };
      collect(m.home.byStatus, true);
      collect(m.visitor.byStatus, false);
    });
    // Order: out → doubtful → questionable → probable; depois impacto; depois rating_stars
    const statusPriority: Record<Status, number> = { out: 0, doubtful: 1, questionable: 2, probable: 3 };
    return out.sort((a, b) => {
      const sa = statusPriority[a.status];
      const sb = statusPriority[b.status];
      if (sa !== sb) return sa - sb;
      const ia = isImpact(a) ? 1 : 0;
      const ib = isImpact(b) ? 1 : 0;
      if (ia !== ib) return ib - ia;
      return b.ratingStars - a.ratingStars;
    });
  }, [visibleMatchups, activeStatusMobile, impactOnly, opportunities]); // eslint-disable-line react-hooks/exhaustive-deps

  const headerDate = games[0]?.game_date ? formatPtDate(games[0].game_date) : '';

  const handleAnalise360 = () => {
    onClose();
    navigate('/analise-360');
  };

  // ── Mobile bottom sheet ──
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="bottom"
          className="theme-rebrand h-[88vh] p-0 rounded-t-2xl bg-white text-ink border-t border-line flex flex-col"
        >
          <div className="grid place-items-center pt-2 pb-1 shrink-0">
            <div className="w-9 h-1 rounded-full bg-line" />
          </div>
          <header className="px-4 py-3 shrink-0 border-b border-line pr-12">
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-ink-2">Injury Report</div>
            <div className="text-[14px] font-semibold tracking-tight text-ink mt-0.5 truncate">
              {headerDate || 'Jogos de hoje'}
            </div>
            <div className="text-[10px] text-ink-2 mt-0.5">
              {totalInjuries} lesões{opportunities ? ` · ${totalImpact} com impacto` : ''}
            </div>
          </header>

          {/* Matchup tabs */}
          <div className="px-4 pt-3 flex gap-1.5 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
            <button
              type="button"
              onClick={() => setActiveGameId('all')}
              className={`shrink-0 h-7 px-2.5 text-[11px] font-semibold rounded-md inline-flex items-center transition-colors ${
                activeGameId === 'all' ? 'bg-forest text-white' : 'bg-white text-ink border border-line'
              }`}
            >
              Todos os jogos
            </button>
            {matchups.map(m => {
              const active = activeGameId === m.gameId;
              return (
                <button
                  key={m.gameId}
                  type="button"
                  onClick={() => setActiveGameId(m.gameId)}
                  className={`shrink-0 h-7 px-2.5 text-[11px] font-semibold rounded-md inline-flex items-center gap-1.5 transition-colors ${
                    active ? 'bg-forest text-white' : 'bg-white text-ink border border-line'
                  }`}
                >
                  <span>{m.label}</span>
                  {m.time && <span className={active ? 'text-white/60 tabular' : 'text-ink-2 tabular'}>{m.time}</span>}
                </button>
              );
            })}
          </div>

          {/* Status tabs */}
          <div className="px-4 pt-2 flex gap-1.5 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
            <button
              type="button"
              onClick={() => setActiveStatusMobile('all')}
              className={`shrink-0 h-7 px-2.5 text-[11px] font-semibold rounded-md inline-flex items-center gap-1.5 transition-colors ${
                activeStatusMobile === 'all'
                  ? 'bg-ink text-white border border-transparent'
                  : 'bg-white text-ink border border-line'
              }`}
            >
              <span>Todos</span>
              <span className="tabular opacity-70">{totalInjuries}</span>
            </button>
            {STATUSES.map(s => {
              const meta = STATUS_META[s];
              const active = activeStatusMobile === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setActiveStatusMobile(s)}
                  className={`shrink-0 h-7 px-2.5 text-[11px] font-semibold rounded-md inline-flex items-center gap-1.5 transition-colors ${
                    active
                      ? `${meta.bg} ${meta.fg} border border-transparent`
                      : 'bg-white text-ink border border-line'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                  <span>{meta.label}</span>
                  <span className="tabular opacity-70">{totals[s]}</span>
                </button>
              );
            })}
          </div>

          {/* Impact filter */}
          {opportunities && (
            <div className="px-4 pt-2 pb-1 shrink-0">
              <button
                type="button"
                onClick={() => setImpactOnly(v => !v)}
                className="inline-flex items-center gap-1.5 text-[11px] text-ink-2"
              >
                <span className={`w-3.5 h-3.5 rounded border grid place-items-center transition-colors ${impactOnly ? 'border-forest bg-forest' : 'border-line bg-white'}`}>
                  {impactOnly && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                Só lesões com impacto <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              </button>
            </div>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto px-4 pt-3 pb-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-ink-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Carregando…</span>
              </div>
            ) : mobileFlatList.length === 0 ? (
              <div className="text-center py-10 text-[12px] text-ink-2">
                Nenhuma lesão {activeStatusMobile === 'all' ? 'encontrada' : STATUS_META[activeStatusMobile].label.toLowerCase()}
              </div>
            ) : (
              <div className="flex flex-col">
                {mobileFlatList.map((p, i) => (
                  <div key={`${p.teamAbbr}-${p.name}`} className={`flex items-start gap-3 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}>
                    <div className="w-8 h-8 rounded-md grid place-items-center shrink-0 bg-canvas-2 border border-line overflow-hidden">
                      <img
                        src={getTeamLogoUrl(p.teamName)}
                        alt={p.teamAbbr}
                        className="w-[80%] h-[80%] object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isImpact(p) && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                        <div className="text-[13px] font-semibold tracking-tight truncate text-ink">{p.name}</div>
                      </div>
                      <div className="text-[11px] text-ink-2 mt-0.5">{p.teamAbbr}</div>
                    </div>
                    <span className={`px-1.5 h-5 inline-flex items-center rounded text-[10px] font-bold tabular ${STATUS_META[p.status].bg} ${STATUS_META[p.status].fg}`}>
                      {STATUS_META[p.status].label.toUpperCase().slice(0, 3)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-line bg-canvas-2 shrink-0">
            <button
              type="button"
              onClick={handleAnalise360}
              className="w-full h-10 rounded-md text-[12px] font-semibold inline-flex items-center justify-center gap-2 bg-amber-400 text-ink hover:bg-amber-300 transition-colors"
            >
              <span>Abrir Análise 360° das lesões</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // ── Desktop dialog ──
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="theme-rebrand max-w-5xl w-full bg-white text-ink border border-line p-0 overflow-hidden max-h-[88vh] flex flex-col">
        {/* Header */}
        <header className="px-7 py-5 border-b border-line shrink-0 pr-14">
          <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-ink-2">Injury Report</div>
          <h2 className="text-[22px] font-semibold tracking-tight text-ink mt-1">
            Jogos de hoje{headerDate ? ` · ${headerDate}` : ''}
          </h2>
          <p className="text-[12px] mt-1 text-ink-2">
            {totalInjuries} lesões nos {matchups.length} {matchups.length === 1 ? 'jogo' : 'jogos'}
            {opportunities && (
              <> · <span className="font-semibold text-ink">{totalImpact} com impacto direto</span> em alguma análise de pick <Star className="w-3 h-3 text-amber-400 fill-amber-400 inline-block align-text-bottom" /></>
            )}
          </p>
        </header>

        {/* Filter row */}
        <div className="px-7 py-3 flex items-center gap-2 flex-wrap border-b border-line bg-canvas-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveGameId('all')}
            className={`h-7 px-3 text-[11px] font-semibold rounded-md inline-flex items-center transition-colors ${
              activeGameId === 'all' ? 'bg-forest text-white' : 'bg-white text-ink border border-line'
            }`}
          >
            Todos os jogos
          </button>
          {matchups.map(m => {
            const active = activeGameId === m.gameId;
            return (
              <button
                key={m.gameId}
                type="button"
                onClick={() => setActiveGameId(m.gameId)}
                className={`h-7 px-3 text-[11px] font-semibold rounded-md inline-flex items-center gap-1.5 transition-colors ${
                  active ? 'bg-forest text-white' : 'bg-white text-ink border border-line'
                }`}
              >
                <span>{m.label}</span>
                {m.time && <span className={active ? 'text-white/60 tabular' : 'text-ink-2 tabular'}>{m.time}</span>}
              </button>
            );
          })}
          <div className="flex-1" />
          {opportunities && (
            <button
              type="button"
              onClick={() => setImpactOnly(v => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] text-ink-2 hover:text-ink transition-colors"
            >
              <span className={`w-3.5 h-3.5 rounded border-[1.5px] grid place-items-center transition-colors ${
                impactOnly ? 'border-forest bg-forest' : 'border-line bg-white'
              }`}>
                {impactOnly && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
              Só lesões com impacto <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            </button>
          )}
        </div>

        {/* Status column headers */}
        <div className="grid grid-cols-[260px_1fr_1fr_1fr_1fr] px-7 py-2.5 bg-canvas-2 border-b border-line shrink-0">
          <div />
          {STATUSES.map(s => {
            const meta = STATUS_META[s];
            return (
              <div key={s} className="px-3 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                <span className={`text-[11px] font-semibold tracking-tight ${meta.fg}`}>{meta.label}</span>
                <span className={`text-[10px] tabular px-1.5 h-4 rounded inline-flex items-center font-semibold ${meta.bg} ${meta.fg}`}>
                  {totals[s]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-ink-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Carregando…</span>
          </div>
        ) : visibleMatchups.length === 0 ? (
          <div className="text-center py-16 text-[13px] text-ink-2">
            Nenhuma lesão reportada
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            {visibleMatchups.map((m, gi) => {
              const teamRows: Array<{
                abbr: string; name: string; isHome: boolean; byStatus?: Map<Status, InjuredPlayer[]>;
              }> = [];
              if (m.home.hasInjuries) teamRows.push({ abbr: m.home.abbr, name: m.home.name, isHome: true, byStatus: m.home.byStatus });
              if (m.visitor.hasInjuries) teamRows.push({ abbr: m.visitor.abbr, name: m.visitor.name, isHome: false, byStatus: m.visitor.byStatus });

              return (
                <div key={m.gameId}>
                  <div
                    className={`px-7 py-2.5 flex items-center gap-3 bg-canvas-2 ${gi > 0 ? 'border-t border-line' : ''}`}
                  >
                    <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-2/70">Jogo</span>
                    <span className="text-[12px] font-semibold tracking-tight text-ink">{m.label}</span>
                    {m.time && <span className="text-[11px] tabular text-ink-2">{m.time}</span>}
                  </div>
                  {teamRows.map((tr) => (
                    <TeamRow
                      key={`${m.gameId}-${tr.abbr}`}
                      team={tr}
                      filterPlayers={filterPlayers}
                      isImpact={isImpact}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="px-7 py-3 flex items-center justify-between text-[11px] border-t border-line bg-canvas-2 shrink-0">
          <div className="text-ink-2">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400 inline-block align-text-bottom mr-1" />
            Lesões com impacto = jogadores que afetam pelo menos uma análise de pick do dia
          </div>
          <button
            type="button"
            onClick={handleAnalise360}
            className="font-semibold inline-flex items-center gap-1 text-forest hover:text-forest-soft"
          >
            <span>Abrir Análise 360° das lesões</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface TeamRowProps {
  team: { abbr: string; name: string; isHome: boolean; byStatus?: Map<Status, InjuredPlayer[]> };
  filterPlayers: (list: InjuredPlayer[] | undefined) => InjuredPlayer[];
  isImpact: (p: InjuredPlayer) => boolean;
}

const TeamRow: React.FC<TeamRowProps> = ({ team, filterPlayers, isImpact }) => {
  return (
    <div className="grid grid-cols-[260px_1fr_1fr_1fr_1fr] px-7 py-3 items-start border-t border-line">
      <div className="flex items-center gap-3 pr-4 min-w-0">
        <div className="w-9 h-9 rounded-md grid place-items-center shrink-0 bg-canvas-2 border border-line overflow-hidden">
          <img
            src={getTeamLogoUrl(team.name)}
            alt={team.abbr}
            className="w-[80%] h-[80%] object-contain"
            onError={(e) => {
              const el = e.target as HTMLImageElement;
              el.style.display = 'none';
              const parent = el.parentElement;
              if (parent) parent.insertAdjacentHTML('beforeend', `<span class="text-[10px] font-bold text-ink-2">${team.abbr}</span>`);
            }}
          />
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold tracking-tight text-ink truncate">{team.name}</div>
          <div className="text-[10px] text-ink-2">{team.isHome ? 'casa' : 'fora'}</div>
        </div>
      </div>
      {STATUSES.map(st => {
        const list = filterPlayers(team.byStatus?.get(st)).sort((a, b) => {
          const ia = isImpact(a) ? 1 : 0;
          const ib = isImpact(b) ? 1 : 0;
          if (ia !== ib) return ib - ia;
          return b.ratingStars - a.ratingStars;
        });
        return (
          <div key={st} className="px-3">
            {list.length === 0 ? (
              <div className="text-[11px] tabular text-ink-3">—</div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {list.map(p => (
                  <div key={`${p.teamAbbr}-${p.name}`} className="flex items-start gap-1.5 py-1">
                    {isImpact(p) && <Star className="w-3 h-3 text-amber-400 fill-amber-400 mt-0.5 shrink-0" />}
                    <div className="text-[12px] font-semibold tracking-tight text-ink leading-tight">{p.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
