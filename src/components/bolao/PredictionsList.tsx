import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Filter, CheckCircle } from 'lucide-react';
import { MatchPredictionCard } from '@/components/bolao/MatchPredictionCard';
import { FilterScroller } from '@/components/bolao/FilterScroller';
import { DraftSavebar } from '@/components/bolao/DraftSavebar';
import type { WcMatch, BolaoPrediction } from '@/services/bolao.service';

interface PredictionsListProps {
  bolaoId: string;
  matches: WcMatch[] | undefined;
  predictions: BolaoPrediction[] | undefined;
  isLoadingMatches?: boolean;
  isSavingPrediction?: boolean;
  isClosed?: boolean;
  deadlineMode?: 'per_match' | 'per_round' | 'tournament_start';
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
  /** Save batch of drafts (sticky bar). When omitted, the bar is not rendered. */
  onSaveBatch?: (
    predictions: { match_id: number; predicted_home_score: number; predicted_away_score: number }[]
  ) => void;
  isSavingBatch?: boolean;
  /** Quando > 0, mostra feedback "✓ X salvos" na sticky bar por 1s. Caller controla via timeout. */
  justSavedCount?: number;
}

type FilterMode = 'group' | 'date';

function formatDateLabel(iso: string): string {
  // iso = 'YYYY-MM-DD' → '11/06'
  const [, mo, da] = iso.split('-');
  return `${da}/${mo}`;
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
  onSaveBatch,
  isSavingBatch,
  justSavedCount,
}) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('date');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [autoSelected, setAutoSelected] = useState(false);
  const [drafts, setDrafts] = useState<Map<number, { home: string; away: string }>>(new Map());

  const handleDraftChange = useCallback(
    (matchId: number, draft: { home: string; away: string } | null) => {
      setDrafts((prev) => {
        const next = new Map(prev);
        if (draft === null) {
          if (!next.has(matchId)) return prev; // no-op, evita re-render
          next.delete(matchId);
        } else {
          const existing = next.get(matchId);
          if (existing && existing.home === draft.home && existing.away === draft.away) {
            return prev;
          }
          next.set(matchId, draft);
        }
        return next;
      });
    },
    []
  );

  // Particiona drafts em "completos" (ambos preenchidos com número válido) e "incompletos"
  const draftCounts = useMemo(() => {
    let complete = 0;
    let incomplete = 0;
    const incompleteIds: number[] = [];
    drafts.forEach((d, matchId) => {
      const isFilled = (s: string) => s !== '' && !Number.isNaN(Number(s));
      if (isFilled(d.home) && isFilled(d.away)) complete++;
      else {
        incomplete++;
        incompleteIds.push(matchId);
      }
    });
    return { complete, incomplete, incompleteIds };
  }, [drafts]);

  const handleSaveBatch = useCallback(() => {
    if (!onSaveBatch) return;
    const payload: { match_id: number; predicted_home_score: number; predicted_away_score: number }[] = [];
    drafts.forEach((d, matchId) => {
      const h = Number(d.home);
      const a = Number(d.away);
      if (d.home === '' || d.away === '' || Number.isNaN(h) || Number.isNaN(a)) return;
      payload.push({ match_id: matchId, predicted_home_score: h, predicted_away_score: a });
    });
    if (payload.length > 0) onSaveBatch(payload);
  }, [drafts, onSaveBatch]);

  const handleJumpToIncomplete = useCallback(() => {
    const firstId = draftCounts.incompleteIds[0];
    if (firstId == null) return;
    const el = document.getElementById(`match-${firstId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [draftCounts.incompleteIds]);

  const predictionsByMatch = useMemo(
    () => new Map((predictions || []).map((p) => [p.match_id, p])),
    [predictions]
  );

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
    if (filterMode === 'group') {
      if (groupFilter === 'all') return matches;
      return matches.filter((m) => m.group_name === groupFilter);
    }
    if (dateFilter === 'all') return matches;
    return matches.filter((m) => m.match_date === dateFilter);
  }, [matches, filterMode, groupFilter, dateFilter]);

  const groupedMatches = useMemo(() => {
    const grouped: Record<string, WcMatch[]> = {};
    if (filterMode === 'date' && dateFilter !== 'all') {
      // Quando filtra por uma data específica, agrupa numa única seção com label do dia
      grouped[formatLongDateLabel(dateFilter)] = filteredMatches;
      return grouped;
    }
    if (filterMode === 'date') {
      // Sem filtro específico → agrupa por dia
      filteredMatches.forEach((m) => {
        const key = formatLongDateLabel(m.match_date);
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
    ? 'border-terminal-green text-terminal-green bg-terminal-green/10'
    : 'border-terminal-blue text-terminal-blue bg-terminal-blue/10';
  const activeText = accentColor === 'green' ? 'text-terminal-green' : 'text-terminal-blue';

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

  // Auto-avançar pro próximo dia com pendências quando o dia atual ficar completo.
  // 800ms de delay pra dar tempo do user perceber "✓ Tudo palpitado".
  // Cancela se user trocar de dia manualmente antes do timer disparar.
  useEffect(() => {
    if (filterMode !== 'date' || dateFilter === 'all') return;
    if (!selectedDayStats) return;
    if (selectedDayStats.total === 0) return;
    if (selectedDayStats.palpitated < selectedDayStats.total) return;

    const timer = setTimeout(() => {
      // Procura próximo dia (após o atual) com ao menos um jogo pendente
      const currentIndex = dates.indexOf(dateFilter);
      const nextDate = dates
        .slice(currentIndex + 1)
        .find((d) => (pendingByDate.get(d) ?? 0) > 0);
      if (nextDate) {
        setDateFilter(nextDate);
      }
      // Se não há próximo, fica no dia atual com a mensagem "Tudo palpitado"
    }, 800);
    return () => clearTimeout(timer);
  }, [filterMode, dateFilter, selectedDayStats, dates, pendingByDate]);

  return (
    <>
      {/* Mode toggle: Dias | Grupos (default = dia, então vem primeiro) */}
      <div
        className={`${filterPadding} flex items-center gap-1 mb-2`}
        role="tablist"
        aria-label="Modo de filtro dos palpites"
      >
        <button
          type="button"
          role="tab"
          aria-selected={filterMode === 'date'}
          onClick={() => setFilterMode('date')}
          className={`px-3 h-8 text-xs font-medium rounded transition-colors ${
            filterMode === 'date'
              ? `${activeText} bg-terminal-dark-gray/40`
              : 'opacity-50 hover:opacity-90'
          }`}
        >
          Por dia
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filterMode === 'group'}
          onClick={() => setFilterMode('group')}
          className={`px-3 h-8 text-xs font-medium rounded transition-colors ${
            filterMode === 'group'
              ? `${activeText} bg-terminal-dark-gray/40`
              : 'opacity-50 hover:opacity-90'
          }`}
        >
          Por grupo
        </button>
      </div>

      {/* Filter scroller */}
      <div className={variant === 'modal' ? 'px-5' : ''}>
        <FilterScroller filterIcon={<Filter className="w-3 h-3 opacity-40 shrink-0" />}>
          {filterMode === 'group' ? (
            <>
              <button
                onClick={() => onGroupFilterChange('all')}
                className={`px-3 h-9 text-xs rounded border shrink-0 transition-colors ${
                  groupFilter === 'all' ? activeBorder : 'border-terminal-border opacity-60 hover:opacity-100'
                }`}
              >
                Todos
              </button>
              {groups.map((g) => (
                <button
                  key={g}
                  onClick={() => onGroupFilterChange(g)}
                  className={`px-3 h-9 text-xs rounded border shrink-0 transition-colors ${
                    groupFilter === g ? activeBorder : 'border-terminal-border opacity-60 hover:opacity-100'
                  }`}
                >
                  Grupo {g}
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => setDateFilter('all')}
                className={`px-3 h-9 text-xs rounded border shrink-0 transition-colors ${
                  dateFilter === 'all' ? activeBorder : 'border-terminal-border opacity-60 hover:opacity-100'
                }`}
              >
                Todos
              </button>
              {dates.map((d) => {
                const pending = pendingByDate.get(d) ?? 0;
                const isActive = dateFilter === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDateFilter(d)}
                    className={`px-3 h-9 text-xs rounded border shrink-0 transition-colors inline-flex items-center gap-1.5 ${
                      isActive ? activeBorder : 'border-terminal-border opacity-60 hover:opacity-100'
                    }`}
                  >
                    {formatDateLabel(d)}
                    {pending > 0 && (
                      <span
                        className={`text-[9px] px-1.5 h-4 rounded-full inline-flex items-center justify-center font-bold ${
                          isActive ? 'bg-current/20' : 'bg-terminal-yellow/20 text-terminal-yellow'
                        }`}
                      >
                        {pending}
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
              className="h-32 rounded border border-terminal-border animate-pulse bg-terminal-dark-gray/30"
            />
          ))}
        </div>
      ) : (
        <div className={`space-y-6 ${onSaveBatch ? 'pb-20' : ''}`}>
          {/* Cabeçalho rico quando filtra por dia específico — 1 linha (responsivo) */}
          {filterMode === 'date' && dateFilter !== 'all' && selectedDayStats && (
            <div className="rounded-lg border border-terminal-border-subtle bg-terminal-dark-gray/30 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-bold">{formatRichDateLabel(dateFilter)}</p>
                <span className="text-xs opacity-50">·</span>
                <p className="text-xs opacity-60">
                  {selectedDayStats.total} jogo{selectedDayStats.total !== 1 ? 's' : ''}
                  {' · '}
                  {selectedDayStats.palpitated} palpitado{selectedDayStats.palpitated !== 1 ? 's' : ''}
                </p>
                {selectedDayStats.palpitated === selectedDayStats.total && selectedDayStats.total > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-terminal-green ml-auto">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Tudo palpitado
                  </span>
                )}
              </div>
            </div>
          )}
          {Object.entries(groupedMatches).map(([groupName, groupMatches]) => (
            <div key={groupName}>
              {/* Esconde o h3 quando o cabeçalho rico já está mostrando o dia */}
              {!(filterMode === 'date' && dateFilter !== 'all') && (
                <h3 className="text-xs uppercase font-bold opacity-50 mb-3">{groupName}</h3>
              )}
              <div className="space-y-3">
                {groupMatches.map((match) => (
                  <div
                    key={match.id}
                    id={`match-${match.id}`}
                    className="rounded transition-shadow"
                  >
                    <MatchPredictionCard
                      match={match}
                      prediction={predictionsByMatch.get(match.id)}
                      onSave={onSave}
                      onDelete={onDelete}
                      isSaving={isSavingPrediction}
                      bolaoId={bolaoId}
                      deadlineMode={deadlineMode}
                      allMatches={matches}
                      isClosed={isClosed}
                      enableSuggestion={enableSuggestion}
                      hideMatchDate={filterMode === 'date'}
                      onDraftChange={onSaveBatch ? handleDraftChange : undefined}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {onSaveBatch && (
        <DraftSavebar
          completeCount={draftCounts.complete}
          incompleteCount={draftCounts.incomplete}
          isSaving={!!isSavingBatch}
          onSave={handleSaveBatch}
          onJumpToIncomplete={handleJumpToIncomplete}
          variant={variant === 'modal' ? 'modal' : 'page'}
          justSavedCount={justSavedCount}
        />
      )}
    </>
  );
};
