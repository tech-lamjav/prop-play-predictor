import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AnalyticsNav from '@/components/AnalyticsNav';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useBolao,
  useWcMatches,
  useBolaoPredictions,
  useUpsertPrediction,
} from '@/hooks/use-bolao';
import { PredictionsList } from '@/components/bolao/PredictionsList';
import { PendingPredictionsSticky } from '@/components/bolao/PendingPredictionsSticky';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type GroupFilter = 'all' | string;

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
  const { toast } = useToast();

  const predictionsByMatch = useMemo(
    () => new Map((predictions || []).map((p) => [p.match_id, p])),
    [predictions]
  );

  const handleSave = (matchId: number, homeScore: number, awayScore: number) => {
    if (!id) return;
    upsertPrediction.mutate(
      {
        bolao_id: id,
        match_id: matchId,
        predicted_home_score: homeScore,
        predicted_away_score: awayScore,
      },
      {
        onSuccess: () => {
          toast({ title: 'Palpite salvo', description: `${homeScore} x ${awayScore}` });
        },
        onError: (err: any) => {
          toast({ title: 'Erro ao salvar palpite', description: err?.message ?? 'Tente novamente', variant: 'destructive' });
        },
      }
    );
  };

  // Stats
  const totalMatches = matches?.filter((m) => !m.is_finished && m.home_team_code !== 'TBD').length || 0;
  const totalPredictions = predictions?.length || 0;

  // Filter matches by group for the "next pending" lookup
  const filteredMatchesForNext = useMemo(() => {
    if (!matches) return [];
    if (groupFilter === 'all') return matches;
    return matches.filter((m) => m.group_name === groupFilter);
  }, [matches, groupFilter]);

  // First pending match (display order) for the sticky "Próximo" button.
  const nextPendingMatchId = useMemo(() => {
    const next = filteredMatchesForNext.find(m =>
      !m.is_finished
      && m.home_team_code !== 'TBD'
      && !predictionsByMatch.has(m.id)
    );
    return next?.id ?? null;
  }, [filteredMatchesForNext, predictionsByMatch]);

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text">
      <AnalyticsNav />
      {!bolao?.is_closed && (
        <PendingPredictionsSticky
          totalAvailable={totalMatches}
          totalDone={totalPredictions}
          nextMatchId={nextPendingMatchId}
        />
      )}
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
          <div className="text-right" aria-label={`${totalPredictions} de ${totalMatches} palpites feitos`}>
            <span className="text-sm font-bold text-terminal-green">{totalPredictions}</span>
            <span className="text-xs opacity-40">/{totalMatches}</span>
          </div>
        </div>

        {/* Shared list (filter + grouped match cards) */}
        {id && (
          <PredictionsList
            bolaoId={id}
            matches={matches}
            predictions={predictions}
            isLoadingMatches={loadingMatches}
            isSavingPrediction={upsertPrediction.isPending}
            isClosed={bolao?.is_closed}
            deadlineMode={bolao?.prediction_deadline_mode ?? 'per_match'}
            onSave={handleSave}
            variant="page"
            accentColor="green"
            groupFilter={groupFilter}
            onGroupFilterChange={setGroupFilter}
          />
        )}
      </div>
    </div>
  );
};

export default BolaoPalpites;
