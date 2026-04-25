import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AnalyticsNav from '@/components/AnalyticsNav';
import { ArrowLeft, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useBolao,
  useWcMatches,
  useBolaoPredictions,
  useUpsertPrediction,
} from '@/hooks/use-bolao';
import { MatchPredictionCard } from '@/components/bolao/MatchPredictionCard';
import { supabase } from '@/integrations/supabase/client';
import type { WcMatch } from '@/services/bolao.service';

type GroupFilter = 'all' | string; // 'all' or group letter

const BolaoPalpites: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id);
    });
  }, []);

  const { data: bolao } = useBolao(id);
  const { data: matches, isLoading: loadingMatches } = useWcMatches();
  const { data: predictions } = useBolaoPredictions(id, currentUserId);
  const upsertPrediction = useUpsertPrediction();

  const predictionsByMatch = useMemo(
    () => new Map((predictions || []).map((p) => [p.match_id, p])),
    [predictions]
  );

  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    let filtered = matches;

    if (groupFilter !== 'all') {
      filtered = filtered.filter((m) => m.group_name === groupFilter);
    }

    return filtered;
  }, [matches, groupFilter]);

  // Available groups for filter
  const groups = useMemo(() => {
    if (!matches) return [];
    const unique = new Set(matches.filter((m) => m.group_name).map((m) => m.group_name!));
    return Array.from(unique).sort();
  }, [matches]);

  // Group filtered matches by stage/group
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
    if (!id) return;
    upsertPrediction.mutate({
      bolao_id: id,
      match_id: matchId,
      predicted_home_score: homeScore,
      predicted_away_score: awayScore,
    });
  };

  // Stats
  const totalMatches = matches?.filter((m) => !m.is_finished && m.home_team_code !== 'TBD').length || 0;
  const totalPredictions = predictions?.length || 0;

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text">
      <AnalyticsNav />
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/bolao/${id}`)}
            aria-label="Voltar para o bolão"
            className="h-11 w-11 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Palpites</h1>
            <p className="text-xs opacity-50">{bolao?.name}</p>
          </div>
          <div className="text-right">
            <span className="text-sm font-bold text-terminal-green">{totalPredictions}</span>
            <span className="text-xs opacity-40">/{totalMatches}</span>
          </div>
        </div>

        {/* Group filter */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <Filter className="w-3 h-3 opacity-40 shrink-0" />
          <button
            onClick={() => setGroupFilter('all')}
            className={`px-3 py-1 text-xs rounded border shrink-0 transition-colors ${
              groupFilter === 'all'
                ? 'border-terminal-green text-terminal-green bg-terminal-green/10'
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
                  ? 'border-terminal-green text-terminal-green bg-terminal-green/10'
                  : 'border-terminal-border opacity-50 hover:opacity-80'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Matches */}
        {loadingMatches ? (
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
    </div>
  );
};

export default BolaoPalpites;
