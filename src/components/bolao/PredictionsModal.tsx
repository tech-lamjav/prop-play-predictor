import React, { useState, useMemo } from 'react';
import { Filter } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useBolao,
  useWcMatches,
  useBolaoPredictions,
  useUpsertPrediction,
} from '@/hooks/use-bolao';
import { MatchPredictionCard } from '@/components/bolao/MatchPredictionCard';
import type { WcMatch } from '@/services/bolao.service';

interface PredictionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bolaoId: string;
  currentUserId: string | undefined;
}

export const PredictionsModal: React.FC<PredictionsModalProps> = ({
  open,
  onOpenChange,
  bolaoId,
  currentUserId,
}) => {
  const [groupFilter, setGroupFilter] = useState<string>('all');

  const { data: bolao } = useBolao(bolaoId);
  const { data: matches, isLoading } = useWcMatches();
  const { data: predictions } = useBolaoPredictions(bolaoId, currentUserId);
  const upsertPrediction = useUpsertPrediction();

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

  const handleSave = (matchId: number, homeScore: number, awayScore: number) => {
    upsertPrediction.mutate({
      bolao_id: bolaoId,
      match_id: matchId,
      predicted_home_score: homeScore,
      predicted_away_score: awayScore,
    });
  };

  const totalMatches = matches?.filter((m) => !m.is_finished && m.home_team_code !== 'TBD').length || 0;
  const totalPredictions = predictions?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-terminal-bg border-terminal-border max-w-2xl max-h-[85vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-terminal-text">
              Fazer Palpites
            </DialogTitle>
            <div>
              <span className="text-sm font-bold text-terminal-blue">{totalPredictions}</span>
              <span className="text-xs opacity-40">/{totalMatches}</span>
            </div>
          </div>
        </DialogHeader>

        {/* Group filter */}
        <div className="flex items-center gap-2 px-5 py-3 overflow-x-auto shrink-0 border-b border-terminal-border-subtle">
          <Filter className="w-3 h-3 opacity-40 shrink-0" />
          <button
            onClick={() => setGroupFilter('all')}
            className={`px-3 py-1 text-xs rounded border shrink-0 transition-colors ${
              groupFilter === 'all'
                ? 'border-terminal-blue text-terminal-blue bg-terminal-blue/10'
                : 'border-terminal-border opacity-50 hover:opacity-80'
            }`}
          >
            Todos
          </button>
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              className={`px-3 py-1 text-xs rounded border shrink-0 transition-colors ${
                groupFilter === g
                  ? 'border-terminal-blue text-terminal-blue bg-terminal-blue/10'
                  : 'border-terminal-border opacity-50 hover:opacity-80'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Matches — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 minimal-scrollbar">
          {isLoading ? (
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
                      <MatchPredictionCard
                        key={match.id}
                        match={match}
                        prediction={predictionsByMatch.get(match.id)}
                        onSave={handleSave}
                        isSaving={upsertPrediction.isPending}
                        deadlineMode={bolao?.prediction_deadline_mode ?? 'per_match'}
                        allMatches={matches}
                        isClosed={bolao?.is_closed}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
