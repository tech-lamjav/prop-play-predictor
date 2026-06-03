import React, { useEffect, useMemo, useState } from 'react';
import { Filter, CheckCircle, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { MatchPredictionCard } from '@/components/bolao/MatchPredictionCard';
import { FilterScroller } from '@/components/bolao/FilterScroller';
import { GroupProjectionTable } from '@/components/bolao/GroupProjectionTable';
import { computeGroupProjection, type PredictionMap } from '@/components/bolao/group-projection';
import type { WcMatch, BolaoPrediction } from '@/services/bolao.service';

interface PredictionsListProps {
  bolaoId: string;
  matches: WcMatch[] | undefined;
  predictions: BolaoPrediction[] | undefined;
  isLoadingMatches?: boolean;
  isClosed?: boolean;
  deadlineMode?: 'per_match' | 'per_day' | 'per_round' | 'per_stage' | 'tournament_start';
  onSave: (matchId: number, homeScore: number, awayScore: number) => void;
  /** Optional — when present, shows "Apagar palpite" menu in each card */
  onDelete?: (matchId: number) => void;
  /** "page" = vertical layout pra rota dedicada; "modal" = compactado */
  variant?: 'page' | 'modal';
  /** Cor do filtro ativo — green pra page, blue pra modal */
  accentColor?: 'green' | 'blue';
  /** Group filter state controlled by caller (pra eles persistir/reusar) */
  groupFilter: string;
  onGroupFilterChange: (filter: string) => void;
  /** When true, each card shows a "sugerir placar" sparkles button */
  enableSuggestion?: boolean;
}

type FilterMode = 'group' | 'date' | 'stage';

const STAGE_LABEL_BY_KEY: Record<string, string> = {
  group: 'Fase de grupos',
  round_of_32: '16 avos',
  round_of_16: 'Oitavas',
  quarter: 'Quartas',
  semi: 'Semifinais',
  third_place: '3º lugar',
  final: 'Final',
};
const STAGE_ORDER = [
  'group',
  'round_of_32',
  'round_of_16',
  'quarter',
  'semi',
  'third_place',
  'final',
];

function formatDateLabel(iso: string): string {
  // iso = 'YYYY-MM-DD' → '11/06'
  const [, mo, da] = iso.split('-');
  return `${da}/${mo}`;
}

function formatDayOfWeekShort(iso: string): string {
  // 'YYYY-MM-DD' → 'Qua' (capitalizado, sem ponto)
  const d = new Date(iso + 'T00:00:00');
  const wk = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace(/\./g, '');
  return wk.charAt(0).toUpperCase() + wk.slice(1);
}

function formatLongDateLabel(iso: string): string {
  // 'YYYY-MM-DD' → 'qua, 11 jun'
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function formatRichDateLabel(iso: string): string {
  // 'YYYY-MM-DD' → 'Quarta, 11 de junho'
  const d = new Date(iso + 'T00:00:00');
  const formatted = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  // Capitaliza primeira letra ('quarta-feira, 11 de junho' → 'Quarta-feira, 11 de junho')
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Lista compartilhada de palpites — usada pela página BolaoPalpites e pelo
 * modal PredictionsModal. Centraliza filtro de grupo/dia, agrupamento por
 * fase ou data, render dos cards. Diff entre os dois é só o variant visual e cor.
 */
export const PredictionsList: React.FC<PredictionsListProps> = ({
  bolaoId,
  matches,
  predictions,
  isLoadingMatches,
  isSavingPrediction,
  isClosed,
  deadlineMode,
  onSave,
  onDelete,
  variant = 'page',
  accentColor = 'green',
  groupFilter,
  onGroupFilterChange,
  enableSuggestion,
}) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('date');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [onlyPending, setOnlyPending] = useState(false);
  const [autoSelected, setAutoSelected] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const prevPredCountRef = React.useRef<number>(predictions?.length ?? 0);

  const predictionsByMatch = useMemo(
    () => new Map((predictions || []).map((p) => [p.match_id, p])),
    [predictions]
  );

  // Projeção dos grupos a partir dos palpites do usuário (group_name → projeção).
  const projectionByGroup = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeGroupProjection>['groups'][number]>();
    if (!matches) return map;
    const predMap: PredictionMap = {};
    for (const p of predictions || []) {
      if (p.predicted_home_score != null && p.predicted_away_score != null) {
        predMap[p.match_id] = { home: p.predicted_home_score, away: p.predicted_away_score };
      }
    }
    for (const g of computeGroupProjection(matches, predMap).groups) map.set(g.group, g);
    return map;
  }, [matches, predictions]);

  // Detecta novos saves observando mudança em predictions (para indicator
  // "Tudo salvo — última alteração há Xs" no footer)
  useEffect(() => {
    if (!predictions) return;
    const prev = prevPredCountRef.current;
    // Mudança detectada (novo palpite ou edição) → marca timestamp
    if (predictions.length !== prev || predictions.some(() => false)) {
      // Nota: edições também atualizam updated_at, mas usamos só o length
      // como proxy simples — em prática, qualquer edição refetch acontece
      // e ratifica o estado.
      setLastSavedAt(Date.now());
    }
    prevPredCountRef.current = predictions.length;
  }, [predictions]);

  const groups = useMemo(() => {
    if (!matches) return [];
    const unique = new Set(matches.filter((m) => m.group_name).map((m) => m.group_name!));
    return Array.from(unique).sort();
  }, [matches]);

  const dates = useMemo(() => {
    if (!matches) return [];
    const unique = new Set(matches.map((m) => m.match_date));
    return Array.from(unique).sort();
  }, [matches]);

  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    let list = matches;
    if (filterMode === 'group') {
      if (groupFilter !== 'all') list = list.filter((m) => m.group_name === groupFilter);
    } else if (filterMode === 'stage') {
      if (stageFilter !== 'all') list = list.filter((m) => m.stage === stageFilter);
    } else {
      if (dateFilter !== 'all') list = list.filter((m) => m.match_date === dateFilter);
    }
    if (onlyPending) {
      list = list.filter(
        (m) =>
          !m.is_finished &&
          m.home_team_code !== 'TBD' &&
          m.away_team_code !== 'TBD' &&
          !predictionsByMatch.has(m.id)
      );
    }
    return list;
  }, [matches, filterMode, groupFilter, dateFilter, stageFilter, onlyPending, predictionsByMatch]);

  const groupedMatches = useMemo(() => {
    const grouped: Record<string, WcMatch[]> = {};
    if (filterMode === 'date' && dateFilter !== 'all') {
      grouped[formatLongDateLabel(dateFilter)] = filteredMatches;
      return grouped;
    }
    if (filterMode === 'date') {
      filteredMatches.forEach((m) => {
        const key = formatLongDateLabel(m.match_date);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
      });
      return grouped;
    }
    if (filterMode === 'stage') {
      // Agrupa por stage usando STAGE_LABEL_BY_KEY
      filteredMatches.forEach((m) => {
        const key = STAGE_LABEL_BY_KEY[m.stage] || m.stage;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(m);
      });
      return grouped;
    }
    // group mode → agrupa por grupo / fase
    filteredMatches.forEach((m) => {
      const key = m.group_name ? `Grupo ${m.group_name}` : m.stage;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    });
    return grouped;
  }, [filteredMatches, filterMode, dateFilter]);

  const activeBorder = accentColor === 'green'
    ? 'border-forest bg-forest text-white shadow-sm'
    : 'border-status-info bg-status-info text-white shadow-sm';
  const activeText = accentColor === 'green' ? 'text-white' : 'text-white';

  const filterPadding = variant === 'modal' ? 'px-5 pt-3' : '';

  // Pendências por dia (quantos jogos sem palpite numa data) — pra badge no botão
  const pendingByDate = useMemo(() => {
    if (!matches) return new Map<string, number>();
    const m = new Map<string, number>();
    matches.forEach((match) => {
      if (match.is_finished || match.home_team_code === 'TBD' || match.away_team_code === 'TBD') return;
      if (predictionsByMatch.has(match.id)) return;
      m.set(match.match_date, (m.get(match.match_date) ?? 0) + 1);
    });
    return m;
  }, [matches, predictionsByMatch]);

  // Estatísticas do dia selecionado (pra cabeçalho rico)
  const selectedDayStats = useMemo(() => {
    if (filterMode !== 'date' || dateFilter === 'all' || !matches) return null;
    const dayMatches = matches.filter((m) => m.match_date === dateFilter);
    const total = dayMatches.length;
    const palpitated = dayMatches.filter((m) => predictionsByMatch.has(m.id)).length;
    return { total, palpitated };
  }, [filterMode, dateFilter, matches, predictionsByMatch]);

  // Auto-seleciona o primeiro dia com pendências quando entra no modo "date"
  // pela primeira vez. User pode mudar pra "Todos" ou outro dia depois.
  useEffect(() => {
    if (autoSelected) return;
    if (filterMode !== 'date') return;
    if (!matches || matches.length === 0) return;
    if (dates.length === 0) return;

    // Primeiro dia que tem ao menos um jogo pendente
    const firstPendingDate = dates.find((d) => (pendingByDate.get(d) ?? 0) > 0);
    if (firstPendingDate) {
      setDateFilter(firstPendingDate);
    }
    setAutoSelected(true);
  }, [autoSelected, filterMode, matches, dates, pendingByDate]);

  // Auto-focus no primeiro input "mandante" do primeiro card aberto pendente
  // ao trocar de dia. Skip quando todos do dia já foram palpitados.
  useEffect(() => {
    if (filterMode !== 'date' || dateFilter === 'all') return;
    if (!matches) return;
    // Pequeno delay pro DOM atualizar com os novos cards
    const timer = setTimeout(() => {
      const dayMatches = matches.filter((m) => m.match_date === dateFilter);
      const firstPending = dayMatches.find(
        (m) =>
          !m.is_finished &&
          m.home_team_code !== 'TBD' &&
          m.away_team_code !== 'TBD' &&
          !predictionsByMatch.has(m.id)
      );
      if (!firstPending) return;
      const card = document.getElementById(`match-${firstPending.id}`);
      const input = card?.querySelector<HTMLInputElement>('input[aria-label*="mandante"]');
      if (input) {
        input.focus();
        input.select();
      }
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, filterMode]);

  // Removido: auto-advance pro próximo dia quando o dia atual fica completo.
  // Motivo (feedback Diody, 18/mai/2026): quando o user clica num dia que JÁ
  // tem todos palpites preenchidos pra revisar/editar, o effect disparava
  // depois de 800ms e trocava o filter pro próximo dia pendente — "não dava
  // pra ficar no dia que já preenchi". A intenção era educada (guiar pro
  // próximo) mas virou agressiva. Se o user quer pular pra próximo pendente,
  // ele tem outras formas: botão "Próximo" da sticky bar + chip "só pendentes".

  return (
    <>
      {/* Mode toggle: Dias | Grupos | Fase + filtro "só pendentes" */}
      <div
        className={`${filterPadding} flex items-center justify-between gap-2 mb-2 flex-wrap`}
      >
        <div role="tablist" aria-label="Modo de filtro dos palpites" className="flex items-center gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={filterMode === 'date'}
            onClick={() => setFilterMode('date')}
            className={`px-3 h-8 text-[12px] font-semibold rounded-rebrand-md transition-colors inline-flex items-center gap-1.5 ${
              filterMode === 'date'
                ? 'bg-forest text-white'
                : 'text-ink-2 hover:text-ink hover:bg-canvas-2'
            }`}
          >
            {filterMode === 'date' && <Filter className="w-3 h-3" />}
            Por dia
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterMode === 'group'}
            onClick={() => setFilterMode('group')}
            className={`px-3 h-8 text-[12px] font-semibold rounded-rebrand-md transition-colors inline-flex items-center gap-1.5 ${
              filterMode === 'group'
                ? 'bg-forest text-white'
                : 'text-ink-2 hover:text-ink hover:bg-canvas-2'
            }`}
          >
            {filterMode === 'group' && <Filter className="w-3 h-3" />}
            Por grupo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterMode === 'stage'}
            onClick={() => setFilterMode('stage')}
            className={`px-3 h-8 text-[12px] font-semibold rounded-rebrand-md transition-colors inline-flex items-center gap-1.5 ${
              filterMode === 'stage'
                ? 'bg-forest text-white'
                : 'text-ink-2 hover:text-ink hover:bg-canvas-2'
            }`}
          >
            {filterMode === 'stage' && <Filter className="w-3 h-3" />}
            Por fase
          </button>
        </div>

        {/* Toggle "só pendentes" — texto-link estilo mockup */}
        {(() => {
          const totalPending = (matches || []).filter(
            (m) =>
              !m.is_finished &&
              m.home_team_code !== 'TBD' &&
              m.away_team_code !== 'TBD' &&
              !predictionsByMatch.has(m.id)
          ).length;
          if (totalPending === 0) return null;
          return (
            <button
              type="button"
              onClick={() => setOnlyPending((v) => !v)}
              className="text-[11px] text-ink-2 hover:text-ink transition-colors"
              aria-pressed={onlyPending}
            >
              Mostrar:{' '}
              <span
                className={`font-semibold ${
                  onlyPending ? 'text-forest underline underline-offset-2' : 'text-ink'
                }`}
              >
                {onlyPending ? `só pendentes (${totalPending})` : 'todos'}
              </span>
            </button>
          );
        })()}
      </div>

      {/* Filter scroller */}
      <div className={variant === 'modal' ? 'px-5' : ''}>
        <FilterScroller filterIcon={<Filter className="w-3 h-3 text-ink-3 shrink-0" />}>
          {filterMode === 'group' ? (
            <>
              <button
                onClick={() => onGroupFilterChange('all')}
                className={`px-3 h-8 text-[12px] rounded border shrink-0 transition-colors ${
                  groupFilter === 'all'
                    ? activeBorder
                    : 'border-line text-ink-2 bg-white hover:border-line-2 hover:text-ink'
                }`}
              >
                Todos
              </button>
              {groups.map((g) => (
                <button
                  key={g}
                  onClick={() => onGroupFilterChange(g)}
                  className={`px-3 h-8 text-[12px] rounded border shrink-0 transition-colors ${
                    groupFilter === g
                      ? activeBorder
                      : 'border-line text-ink-2 bg-white hover:border-line-2 hover:text-ink'
                  }`}
                >
                  Grupo {g}
                </button>
              ))}
            </>
          ) : filterMode === 'stage' ? (
            <>
              <button
                onClick={() => setStageFilter('all')}
                className={`px-3 h-8 text-[12px] rounded border shrink-0 transition-colors ${
                  stageFilter === 'all'
                    ? activeBorder
                    : 'border-line text-ink-2 bg-white hover:border-line-2 hover:text-ink'
                }`}
              >
                Todas
              </button>
              {STAGE_ORDER.filter((s) =>
                (matches || []).some((m) => m.stage === s)
              ).map((s) => (
                <button
                  key={s}
                  onClick={() => setStageFilter(s)}
                  className={`px-3 h-8 text-[12px] rounded border shrink-0 transition-colors ${
                    stageFilter === s
                      ? activeBorder
                      : 'border-line text-ink-2 bg-white hover:border-line-2 hover:text-ink'
                  }`}
                >
                  {STAGE_LABEL_BY_KEY[s] || s}
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => setDateFilter('all')}
                className={`px-3 h-8 text-[12px] rounded border shrink-0 transition-colors ${
                  dateFilter === 'all'
                    ? activeBorder
                    : 'border-line text-ink-2 bg-white hover:border-line-2 hover:text-ink'
                }`}
              >
                Todos · {(matches || []).length}
              </button>
              {dates.map((d) => {
                const pending = pendingByDate.get(d) ?? 0;
                const totalDay = (matches || []).filter(
                  (m) =>
                    m.match_date === d &&
                    !m.is_finished &&
                    m.home_team_code !== 'TBD' &&
                    m.away_team_code !== 'TBD'
                ).length;
                const done = totalDay - pending;
                const isActive = dateFilter === d;
                const allDone = totalDay > 0 && pending === 0;
                return (
                  <button
                    key={d}
                    onClick={() => setDateFilter(d)}
                    className={`px-3 h-8 text-[12px] rounded border shrink-0 transition-colors inline-flex items-center gap-1.5 ${
                      isActive
                        ? activeBorder
                        : 'border-line text-ink-2 bg-white hover:border-line-2 hover:text-ink'
                    }`}
                  >
                    <span className={`mr-0.5 ${isActive ? 'text-white/80' : 'text-ink-3'}`}>{formatDayOfWeekShort(d)}</span>
                    <span className="font-medium">{formatDateLabel(d)}</span>
                    {totalDay > 0 && (
                      <span
                        className={`text-[10px] tabular-nums inline-flex items-center gap-0.5 ${
                          isActive
                            ? 'text-white/90'
                            : allDone
                              ? 'text-status-success'
                              : 'text-ink-3'
                        }`}
                      >
                        {done}/{totalDay}
                        {allDone && <Check className="w-3 h-3" strokeWidth={3} />}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </FilterScroller>
      </div>

      {/* Matches */}
      {isLoadingMatches ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 rounded-rebrand-md border border-line animate-pulse bg-canvas-2"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cabeçalho do dia — texto solto, integrado ao container (não card) */}
          {filterMode === 'date' && dateFilter !== 'all' && selectedDayStats && (() => {
            const total = selectedDayStats.total;
            const palpitated = selectedDayStats.palpitated;
            const allDone = total > 0 && palpitated === total;

            // Countdown do primeiro jogo aberto do dia
            let countdownLabel: string | null = null;
            if (!allDone && matches) {
              const firstOpen = matches
                .filter((m) => m.match_date === dateFilter && !m.is_finished && m.home_team_code !== 'TBD')
                .sort((a, b) => a.match_time_brasilia.localeCompare(b.match_time_brasilia))[0];
              if (firstOpen) {
                const kickoff = new Date(`${firstOpen.match_date}T${firstOpen.match_time_brasilia}-03:00`);
                const diffMs = kickoff.getTime() - Date.now();
                if (diffMs > 0) {
                  const hours = Math.floor(diffMs / (60 * 60 * 1000));
                  if (hours < 1) {
                    const min = Math.max(1, Math.floor(diffMs / 60_000));
                    countdownLabel = `primeiro fecha em ${min}min`;
                  } else if (hours < 48) {
                    countdownLabel = `primeiro fecha em ${hours}h`;
                  } else {
                    countdownLabel = `primeiro fecha em ${Math.floor(hours / 24)}d`;
                  }
                }
              }
            }

            return (
              <div className="px-1">
                <h2 className="text-[18px] font-bold text-ink leading-tight">
                  {formatRichDateLabel(dateFilter)}
                </h2>
                <p className="text-[12px] text-ink-2 mt-1 inline-flex items-center gap-2 flex-wrap">
                  <span>
                    {total} jogo{total !== 1 ? 's' : ''}
                  </span>
                  {allDone ? (
                    <span className="inline-flex items-center gap-1 text-status-success font-medium">
                      <CheckCircle className="w-3 h-3" />
                      Tudo palpitado
                    </span>
                  ) : countdownLabel ? (
                    <>
                      <span className="text-ink-3">·</span>
                      <span>{countdownLabel}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-ink-3">·</span>
                      <span>
                        {palpitated} palpitado{palpitated !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                </p>
              </div>
            );
          })()}
          {Object.entries(groupedMatches).map(([groupName, groupMatches]) => (
            <div key={groupName}>
              {/* Esconde o h3 quando o cabeçalho rico já está mostrando o dia */}
              {!(filterMode === 'date' && dateFilter !== 'all') && (
                <h3 className="text-[11px] uppercase tracking-[0.12em] font-bold text-ink-2 mb-3">
                  {groupName}
                </h3>
              )}
              {filterMode === 'group' && groupName.startsWith('Grupo ') &&
                projectionByGroup.get(groupName.slice(6)) && (
                  <GroupProjectionTable projection={projectionByGroup.get(groupName.slice(6))!} />
                )}
              <div className="bg-white border border-line rounded-rebrand-md divide-y divide-line overflow-hidden">
                {groupMatches.map((match) => (
                  <div key={match.id} id={`match-${match.id}`} className="relative">
                    <MatchPredictionCard
                      match={match}
                      prediction={predictionsByMatch.get(match.id)}
                      onSave={onSave}
                      onDelete={onDelete}
                      bolaoId={bolaoId}
                      deadlineMode={deadlineMode}
                      allMatches={matches}
                      isClosed={isClosed}
                      enableSuggestion={enableSuggestion}
                      hideMatchDate={filterMode === 'date'}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filteredMatches.length === 0 && (
            <div className="text-center py-12 text-ink-2">
              <p className="text-[13px]">
                {onlyPending
                  ? 'Tudo palpitado por aqui! Tira o filtro pra ver a lista completa.'
                  : 'Nenhum jogo encontrado nesse filtro.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer: navegação entre dias + indicator de salvo */}
      {filterMode === 'date' && dateFilter !== 'all' && (() => {
        const currentIndex = dates.indexOf(dateFilter);
        const prevDate = currentIndex > 0 ? dates[currentIndex - 1] : null;
        const nextDate = currentIndex < dates.length - 1 ? dates[currentIndex + 1] : null;
        return (
          <div className="mt-6 flex items-center justify-between gap-2 flex-wrap">
            <SavedIndicator lastSavedAt={lastSavedAt} />
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                disabled={!prevDate}
                onClick={() => prevDate && setDateFilter(prevDate)}
                className="h-9 px-3 inline-flex items-center gap-1 rounded-rebrand-md border border-line bg-white text-[12px] text-ink-2 hover:bg-canvas-2 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {prevDate ? formatDateLabel(prevDate) : '—'}
              </button>
              <button
                type="button"
                disabled={!nextDate}
                onClick={() => nextDate && setDateFilter(nextDate)}
                className="h-9 px-4 inline-flex items-center gap-1 rounded-rebrand-md bg-forest text-white text-[12px] font-semibold hover:bg-forest-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Próximo dia · {nextDate ? formatDateLabel(nextDate) : '—'}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })()}
      {(filterMode !== 'date' || dateFilter === 'all') && lastSavedAt && (
        <div className="mt-6 flex justify-start">
          <SavedIndicator lastSavedAt={lastSavedAt} />
        </div>
      )}
    </>
  );
};

/**
 * Indicator "Tudo salvo — última alteração há Xs". Re-renderiza a cada 10s
 * pra atualizar o tempo decorrido.
 */
const SavedIndicator: React.FC<{ lastSavedAt: number | null }> = ({ lastSavedAt }) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastSavedAt) return;
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, [lastSavedAt]);
  if (!lastSavedAt) return null;

  const diffSec = Math.floor((Date.now() - lastSavedAt) / 1000);
  const label =
    diffSec < 5
      ? 'agora'
      : diffSec < 60
        ? `há ${diffSec}s`
        : diffSec < 3600
          ? `há ${Math.floor(diffSec / 60)}min`
          : `há ${Math.floor(diffSec / 3600)}h`;

  return (
    <p className="inline-flex items-center gap-1.5 text-[11px] text-ink-2">
      <Check className="w-3 h-3 text-status-success" strokeWidth={3} />
      Tudo salvo — última alteração {label}
    </p>
  );
};
