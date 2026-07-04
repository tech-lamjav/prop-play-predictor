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
import { PredictionsList, type FilterMode } from '@/components/bolao/PredictionsList';
import { PendingPredictionsSticky } from '@/components/bolao/PendingPredictionsSticky';
import { ConfirmDialog } from '@/components/bolao/ConfirmDialog';
import { useAchievement } from '@/components/bolao/AchievementProvider';
import { QuickPickInline } from '@/components/bolao/QuickPickInline';
import { PalpitesProgress } from '@/components/bolao/PalpitesProgress';
import type { QuickPickApplyOpts } from '@/components/bolao/quick-pick';
import { resolveQuickPickPayload } from '@/components/bolao/quick-pick-resolver';
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
  const [filterMode, setFilterMode] = useState<FilterMode>('date');

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
  const quickPickUndo = useQuickPickUndo(id ?? '', predictions);

  const predictionsByMatch = useMemo(
    () => new Map((predictions || []).map((p) => [p.match_id, p])),
    [predictions]
  );

  const handleDeleteRequest = (matchId: number) => {
    setConfirmDeleteMatchId(matchId);
  };

  const applyQuickPick = async (opts: QuickPickApplyOpts) => {
    if (!id || !matches) return;
    let generated;
    try {
      generated = await resolveQuickPickPayload(opts, {
        matches,
        existingPredictions: predictions,
        destBolaoId: id,
        userId: currentUserId,
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao buscar palpites',
        description: err?.message ?? 'Tente novamente',
        variant: 'destructive',
      });
      return;
    }
    if (generated.length === 0) {
      toast({
        title: 'Nada pra preencher',
        description:
          opts.kind === 'copy'
            ? 'O bolão escolhido não tem palpites pra copiar nesses jogos.'
            : opts.mode === 'pendentes'
              ? 'Todos os jogos já têm palpite. Use "Substituir todos" se quiser refazer.'
              : 'Todos os jogos já foram finalizados ou estão sem times definidos.',
      });
      return;
    }
    quickPickUndo.captureSnapshot();
    upsertPredictionsBatch.mutate(
      { bolaoId: id, predictions: generated },
      {
        onSuccess: (res) => {
          const sourceLabel =
            opts.kind === 'copy' ? ` (de "${opts.sourceBolaoName}")` : '';
          toast({
            title: `${res.saved} palpites preenchidos!${sourceLabel}`,
            description: res.skipped > 0
              ? `Edite os que quiser. ${res.skipped} jogos foram pulados (prazo encerrado ou sem times).`
              : 'Edite os que quiser na lista abaixo.',
            action: (
              <ToastAction altText="Desfazer Quick Pick" onClick={() => quickPickUndo.undo(generated!)}>
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

  /**
   * Salva 1 palpite. Sem toast de sucesso (autosave silencioso) — só erro.
   */
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
          if (wasFirstPrediction) unlock('first-prediction', id);
        },
        onError: (err: any) => {
          toast({
            title: 'Erro ao salvar palpite',
            description: err?.message ?? 'Tente novamente',
            variant: 'destructive',
          });
        },
      }
    );
  };

  // Stats — progresso conta só os jogos ABERTOS e os palpites DESSES jogos
  // (palpites de jogos encerrados não entram no numerador; ver PredictionsModal).
  const openMatchIds = useMemo(
    () => new Set((matches ?? []).filter((m) => !m.is_finished && m.home_team_code !== 'TBD').map((m) => m.id)),
    [matches]
  );
  const totalMatches = openMatchIds.size;
  const totalPredictions = useMemo(
    () => (predictions ?? []).filter((p) => openMatchIds.has(p.match_id)).length,
    [predictions, openMatchIds]
  );

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
    <div className="bg-canvas min-h-screen flex flex-col">
      <AnalyticsNav />
      {/* is_closed (inscricoes encerradas) nao afeta palpites — sticky
          continua util pra quem ja entrou */}
      <PendingPredictionsSticky
        totalAvailable={totalMatches}
        totalDone={totalPredictions}
        nextMatchId={nextPendingMatchId}
      />
      <div className="max-w-2xl mx-auto px-4 py-6 w-full flex-1">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => navigate(`/bolao/${id}`)}
            aria-label="Voltar para o bolão"
            className="w-11 h-11 rounded-rebrand-md hover:bg-canvas-2 text-ink-2 hover:text-ink flex items-center justify-center transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-[20px] font-bold text-ink leading-tight">Palpites</h1>
            <p className="text-[12px] text-ink-2 truncate">{bolao?.name}</p>
          </div>
          <PalpitesProgress
            done={totalPredictions}
            total={totalMatches}
            variant="page"
            onClick={() => setFilterMode('pending')}
          />
        </div>

        {/* Quick Pick — 4 personas + copiar de outro bolão.
            is_closed nao afeta palpites de quem ja entrou. */}
        {totalMatches > 0 && totalPredictions < totalMatches && id && (
          <QuickPickInline
            remaining={totalMatches - totalPredictions}
            alreadyFilled={totalPredictions}
            currentBolaoId={id}
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
            isClosed={bolao?.is_closed}
            deadlineMode={bolao?.prediction_deadline_mode ?? 'per_match'}
            onSave={handleSave}
            onDelete={handleDeleteRequest}
            variant="page"
            accentColor="green"
            groupFilter={groupFilter}
            onGroupFilterChange={setGroupFilter}
            filterMode={filterMode}
            onFilterModeChange={setFilterMode}
            enableSuggestion
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
