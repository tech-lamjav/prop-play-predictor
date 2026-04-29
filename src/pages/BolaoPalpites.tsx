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
  useUpsertPredictionsBatch,
  useDeletePrediction,
} from '@/hooks/use-bolao';
import { PredictionsList } from '@/components/bolao/PredictionsList';
import { PendingPredictionsSticky } from '@/components/bolao/PendingPredictionsSticky';
import { ConfirmDialog } from '@/components/bolao/ConfirmDialog';
import { useAchievement } from '@/components/bolao/AchievementProvider';
import { QuickPickInline } from '@/components/bolao/QuickPickInline';
import { PalpitesProgress } from '@/components/bolao/PalpitesProgress';
import { generateQuickPickPredictions, type QuickPickPersona } from '@/components/bolao/quick-pick';
import { useQuickPickUndo } from '@/components/bolao/useQuickPickUndo';
import { ToastAction } from '@/components/ui/toast';
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
  const upsertPredictionsBatch = useUpsertPredictionsBatch();
  const deletePrediction = useDeletePrediction();
  const { toast } = useToast();
  const { unlock } = useAchievement();
  const [confirmDeleteMatchId, setConfirmDeleteMatchId] = useState<number | null>(null);
  const [justSavedCount, setJustSavedCount] = useState(0);
  const quickPickUndo = useQuickPickUndo(id ?? '', predictions);

  const predictionsByMatch = useMemo(
    () => new Map((predictions || []).map((p) => [p.match_id, p])),
    [predictions]
  );

  const handleDeleteRequest = (matchId: number) => {
    setConfirmDeleteMatchId(matchId);
  };

  const handleSaveBatch = (
    payload: { match_id: number; predicted_home_score: number; predicted_away_score: number }[]
  ) => {
    if (!id) return;
    upsertPredictionsBatch.mutate(
      { bolaoId: id, predictions: payload },
      {
        onSuccess: (res) => {
          setJustSavedCount(res.saved);
          setTimeout(() => setJustSavedCount(0), 1200);
          if (res.skipped > 0) {
            toast({
              title: `${res.saved} salvo${res.saved !== 1 ? 's' : ''}, ${res.skipped} pulado${res.skipped !== 1 ? 's' : ''}`,
              description: 'Os pulados estavam com prazo encerrado.',
            });
          }
          if ((predictions?.length ?? 0) === 0 && res.saved > 0) {
            unlock('first-prediction', id);
          }
        },
        onError: (err: any) => {
          toast({ title: 'Erro ao salvar', description: err?.message ?? 'Tente novamente', variant: 'destructive' });
        },
      }
    );
  };

  const applyQuickPick = (persona: QuickPickPersona) => {
    if (!id || !matches) return;
    // Seed determinístico baseado no bolaoId pra rng reproduzível
    const seed = id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const generated = generateQuickPickPredictions(matches, persona, { seed });
    if (generated.length === 0) {
      toast({ title: 'Nada pra preencher', description: 'Todos os jogos já foram finalizados ou estão sem times definidos.' });
      return;
    }
    quickPickUndo.captureSnapshot();
    upsertPredictionsBatch.mutate(
      { bolaoId: id, predictions: generated },
      {
        onSuccess: (res) => {
          toast({
            title: `${res.saved} palpites preenchidos!`,
            description: res.skipped > 0
              ? `Edite os que quiser. ${res.skipped} jogos foram pulados (prazo encerrado ou sem times).`
              : 'Edite os que quiser na lista abaixo.',
            action: (
              <ToastAction altText="Desfazer Quick Pick" onClick={() => quickPickUndo.undo(generated)}>
                Desfazer
              </ToastAction>
            ),
          });
          if ((predictions?.length ?? 0) === 0 && res.saved > 0) {
            unlock('first-prediction', id);
          }
        },
        onError: (err: any) => {
          toast({ title: 'Erro ao preencher', description: err?.message ?? 'Tente novamente', variant: 'destructive' });
        },
      }
    );
  };

  const performDelete = () => {
    if (!id || confirmDeleteMatchId == null) return;
    const matchId = confirmDeleteMatchId;
    deletePrediction.mutate(
      { bolao_id: id, match_id: matchId },
      {
        onSuccess: () => {
          toast({ title: 'Palpite apagado' });
        },
        onError: (err: any) => {
          toast({ title: 'Erro ao apagar', description: err?.message ?? 'Tente novamente', variant: 'destructive' });
        },
      }
    );
    setConfirmDeleteMatchId(null);
  };

  const handleSave = (matchId: number, homeScore: number, awayScore: number) => {
    if (!id) return;
    const wasFirstPrediction = (predictions?.length ?? 0) === 0;
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
          if (wasFirstPrediction) unlock('first-prediction', id);
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
          <PalpitesProgress done={totalPredictions} total={totalMatches} variant="page" />
        </div>

        {/* Quick Pick — 3 botões inline (clica = aplica direto) */}
        {!bolao?.is_closed && totalMatches > 0 && totalPredictions < totalMatches * 0.5 && (
          <QuickPickInline
            remaining={totalMatches - totalPredictions}
            alreadyFilled={totalPredictions}
            onApply={applyQuickPick}
            isApplying={upsertPredictionsBatch.isPending}
          />
        )}

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
            onDelete={handleDeleteRequest}
            variant="page"
            accentColor="green"
            groupFilter={groupFilter}
            onGroupFilterChange={setGroupFilter}
            enableSuggestion
            onSaveBatch={handleSaveBatch}
            isSavingBatch={upsertPredictionsBatch.isPending}
            justSavedCount={justSavedCount}
          />
        )}
      </div>

      {/* Confirmação ao apagar palpite */}
      <ConfirmDialog
        open={confirmDeleteMatchId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteMatchId(null)}
        title="Apagar este palpite?"
        description="O palpite vai voltar ao estado vazio (- x -). Você pode palpitar de novo enquanto o prazo estiver aberto."
        confirmLabel="Apagar"
        variant="destructive"
        onConfirm={performDelete}
        isLoading={deletePrediction.isPending}
      />

    </div>
  );
};

export default BolaoPalpites;
