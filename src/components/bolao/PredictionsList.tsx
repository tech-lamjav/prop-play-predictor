import React, { useMemo } from 'react';
import { Filter } from 'lucide-react';
import { MatchPredictionCard } from '@/components/bolao/MatchPredictionCard';
import { FilterScroller } from '@/components/bolao/FilterScroller';
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
  /** "page" = vertical layout pra rota dedicada; "modal" = compactado */
  variant?: 'page' | 'modal';
  /** Cor do filtro ativo — green pra page, blue pra modal */
  accentColor?: 'green' | 'blue';
  /** Group filter state controlled by caller (pra eles persistir/reusar) */
  groupFilter: string;
  onGroupFilterChange: (filter: string) => void;
}

/**
 * Lista compartilhada de palpites — usada pela página BolaoPalpites e pelo
 * modal PredictionsModal. Centraliza filtro de grupo, agrupamento por
 * fase, render dos cards. Diff entre os dois é só o variant visual e cor.
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
  variant = 'page',
  accentColor = 'green',
  groupFilter,
  onGroupFilterChange,
}) => {
  const predictionsByMatch = useMemo(
    () => new Map((predictions || []).map((p) => [p.match_id, p])),
    [predictions]
  );

  const groups = useMemo(() => {
    if (!matches) return [];
    const unique = new Set(matches.filter((m) => m.group_name).map((m) => m.group_name!));
    return Array.from(unique).sort();
  }, [matches]);

  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    if (groupFilter === 'all') return matches;
    return matches.filter((m) => m.group_name === groupFilter);
  }, [matches, groupFilter]);

  const groupedMatches = useMemo(() => {
    const grouped: Record<string, WcMatch[]> = {};
    filteredMatches.forEach((m) => {
      const key = m.group_name ? `Grupo ${m.group_name}` : m.stage;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    });
    return grouped;
  }, [filteredMatches]);

  const activeBorder = accentColor === 'green'
    ? 'border-terminal-green text-terminal-green bg-terminal-green/10'
    : 'border-terminal-blue text-terminal-blue bg-terminal-blue/10';

  const filterPadding = variant === 'modal' ? 'px-5 pt-3' : '';

  return (
    <>
      {/* Group filter */}
      <div className={filterPadding}>
        <FilterScroller filterIcon={<Filter className="w-3 h-3 opacity-40 shrink-0" />}>
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
        <div className="space-y-6">
          {Object.entries(groupedMatches).map(([groupName, groupMatches]) => (
            <div key={groupName}>
              <h3 className="text-xs uppercase font-bold opacity-50 mb-3">{groupName}</h3>
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
                      isSaving={isSavingPrediction}
                      bolaoId={bolaoId}
                      deadlineMode={deadlineMode}
                      allMatches={matches}
                      isClosed={isClosed}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
