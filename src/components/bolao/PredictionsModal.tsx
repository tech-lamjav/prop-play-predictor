import React, { useState } from 'react';
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
  useUpsertPredictionsBatch,
  useDeletePrediction,
} from '@/hooks/use-bolao';
import { PredictionsList } from '@/components/bolao/PredictionsList';
import { ConfirmDialog } from '@/components/bolao/ConfirmDialog';
import { QuickPickInline } from '@/components/bolao/QuickPickInline';
import { PalpitesProgress } from '@/components/bolao/PalpitesProgress';
import { generateQuickPickPredictions, type QuickPickPersona } from '@/components/bolao/quick-pick';
import { useQuickPickUndo } from '@/components/bolao/useQuickPickUndo';
import { ToastAction } from '@/components/ui/toast';
import { useAchievement } from '@/components/bolao/AchievementProvider';
import { useToast } from '@/hooks/use-toast';

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
  const [confirmDeleteMatchId, setConfirmDeleteMatchId] = useState<number | null>(null);
  const [justSavedCount, setJustSavedCount] = useState(0);

  const { data: bolao } = useBolao(bolaoId);
  const { data: matches, isLoading } = useWcMatches();
  const { data: predictions } = useBolaoPredictions(bolaoId, currentUserId);
  const upsertPrediction = useUpsertPrediction();
  const upsertPredictionsBatch = useUpsertPredictionsBatch();
  const deletePrediction = useDeletePrediction();
  const { toast } = useToast();
  const { unlock } = useAchievement();
  const quickPickUndo = useQuickPickUndo(bolaoId, predictions);

  const handleSave = (matchId: number, homeScore: number, awayScore: number) => {
    const wasFirstPrediction = (predictions?.length ?? 0) === 0;
    upsertPrediction.mutate(
      {
        bolao_id: bolaoId,
        match_id: matchId,
        predicted_home_score: homeScore,
        predicted_away_score: awayScore,
      },
      {
        onSuccess: () => {
          toast({ title: 'Palpite salvo', description: `${homeScore} x ${awayScore}` });
          if (wasFirstPrediction) unlock('first-prediction', bolaoId);
        },
        onError: (err: any) => {
          toast({ title: 'Erro ao salvar palpite', description: err?.message ?? 'Tente novamente', variant: 'destructive' });
        },
      }
    );
  };

  const handleDeleteRequest = (matchId: number) => {
    setConfirmDeleteMatchId(matchId);
  };

  const applyQuickPick = (persona: QuickPickPersona) => {
    if (!matches) return;
    const seed = bolaoId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    const generated = generateQuickPickPredictions(matches, persona, { seed });
    if (generated.length === 0) {
      toast({ title: 'Nada pra preencher', description: 'Todos os jogos já foram finalizados ou estão sem times definidos.' });
      return;
    }
    quickPickUndo.captureSnapshot();
    upsertPredictionsBatch.mutate(
      { bolaoId, predictions: generated },
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
            unlock('first-prediction', bolaoId);
          }
        },
        onError: (err: any) => {
          toast({ title: 'Erro ao preencher', description: err?.message ?? 'Tente novamente', variant: 'destructive' });
        },
      }
    );
  };

  const handleSaveBatch = (
    payload: { match_id: number; predicted_home_score: number; predicted_away_score: number }[]
  ) => {
    upsertPredictionsBatch.mutate(
      { bolaoId, predictions: payload },
      {
        onSuccess: (res) => {
          // Feedback "✓ X salvos" na sticky bar por 1.2s
          setJustSavedCount(res.saved);
          setTimeout(() => setJustSavedCount(0), 1200);
          if (res.skipped > 0) {
            toast({
              title: `${res.saved} salvo${res.saved !== 1 ? 's' : ''}, ${res.skipped} pulado${res.skipped !== 1 ? 's' : ''}`,
              description: 'Os pulados estavam com prazo encerrado.',
            });
          }
          if ((predictions?.length ?? 0) === 0 && res.saved > 0) {
            unlock('first-prediction', bolaoId);
          }
        },
        onError: (err: any) => {
          toast({ title: 'Erro ao salvar', description: err?.message ?? 'Tente novamente', variant: 'destructive' });
        },
      }
    );
  };

  const performDelete = () => {
    if (confirmDeleteMatchId == null) return;
    const matchId = confirmDeleteMatchId;
    deletePrediction.mutate(
      { bolao_id: bolaoId, match_id: matchId },
      {
        onSuccess: () => toast({ title: 'Palpite apagado' }),
        onError: (err: any) =>
          toast({ title: 'Erro ao apagar', description: err?.message ?? 'Tente novamente', variant: 'destructive' }),
      }
    );
    setConfirmDeleteMatchId(null);
  };

  const totalMatches = matches?.filter((m) => !m.is_finished && m.home_team_code !== 'TBD').length || 0;
  const totalPredictions = predictions?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-terminal-bg border-terminal-border max-w-2xl max-h-[85vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-start justify-between gap-3 pr-7">
            <DialogTitle className="flex items-center gap-2 text-terminal-text">
              Fazer Palpites
            </DialogTitle>
            <PalpitesProgress done={totalPredictions} total={totalMatches} variant="modal" />
          </div>
        </DialogHeader>

        {/* Matches — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 minimal-scrollbar">
          {/* Quick Pick — 3 botões inline (clica = aplica direto) */}
          {!bolao?.is_closed && totalMatches > 0 && totalPredictions < totalMatches * 0.5 && (
            <QuickPickInline
              remaining={totalMatches - totalPredictions}
              alreadyFilled={totalPredictions}
              onApply={applyQuickPick}
              isApplying={upsertPredictionsBatch.isPending}
            />
          )}

          <PredictionsList
            bolaoId={bolaoId}
            matches={matches}
            predictions={predictions}
            isLoadingMatches={isLoading}
            isSavingPrediction={upsertPrediction.isPending}
            isClosed={bolao?.is_closed}
            deadlineMode={bolao?.prediction_deadline_mode ?? 'per_match'}
            onSave={handleSave}
            onDelete={handleDeleteRequest}
            variant="modal"
            accentColor="blue"
            groupFilter={groupFilter}
            onGroupFilterChange={setGroupFilter}
            enableSuggestion
            onSaveBatch={handleSaveBatch}
            isSavingBatch={upsertPredictionsBatch.isPending}
            justSavedCount={justSavedCount}
          />
        </div>

        {/* Confirmação ao apagar palpite */}
        <ConfirmDialog
          open={confirmDeleteMatchId !== null}
          onOpenChange={(o) => !o && setConfirmDeleteMatchId(null)}
          title="Apagar este palpite?"
          description="O palpite vai voltar ao estado vazio (- x -). Você pode palpitar de novo enquanto o prazo estiver aberto."
          confirmLabel="Apagar"
          variant="destructive"
          onConfirm={performDelete}
          isLoading={deletePrediction.isPending}
        />
      </DialogContent>
    </Dialog>
  );
};
