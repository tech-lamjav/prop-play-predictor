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
import type { QuickPickApplyOpts } from '@/components/bolao/quick-pick';
import { resolveQuickPickPayload } from '@/components/bolao/quick-pick-resolver';
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

  const { data: bolao } = useBolao(bolaoId);
  const { data: matches, isLoading } = useWcMatches();
  const { data: predictions } = useBolaoPredictions(bolaoId, currentUserId);
  const upsertPrediction = useUpsertPrediction();
  const upsertPredictionsBatch = useUpsertPredictionsBatch();
  const deletePrediction = useDeletePrediction();
  const { toast } = useToast();
  const { unlock } = useAchievement();
  const quickPickUndo = useQuickPickUndo(bolaoId, predictions);

  /**
   * Salva 1 palpite. Sem toast de sucesso (autosave silencioso) — só erro.
   * O card mostra indicator visual ("✓ Salvo") via `MatchPredictionCard`.
   */
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
          if (wasFirstPrediction) unlock('first-prediction', bolaoId);
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

  const handleDeleteRequest = (matchId: number) => {
    setConfirmDeleteMatchId(matchId);
  };

  const applyQuickPick = async (opts: QuickPickApplyOpts) => {
    if (!matches) return;
    let generated;
    try {
      generated = await resolveQuickPickPayload(opts, {
        matches,
        existingPredictions: predictions,
        destBolaoId: bolaoId,
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
      { bolaoId, predictions: generated },
      {
        onSuccess: (res) => {
          const sourceLabel =
            opts.kind === 'copy' ? ` (de "${opts.sourceBolaoName}")` : '';
          toast({
            title: `${res.saved} palpites preenchidos!${sourceLabel}`,
            description:
              res.skipped > 0
                ? `Edite os que quiser. ${res.skipped} jogos foram pulados (prazo encerrado ou sem times).`
                : 'Edite os que quiser na lista abaixo.',
            action: (
              <ToastAction altText="Desfazer Quick Pick" onClick={() => quickPickUndo.undo(generated!)}>
                Desfazer
              </ToastAction>
            ),
          });
          if ((predictions?.length ?? 0) === 0 && res.saved > 0) {
            unlock('first-prediction', bolaoId);
          }
        },
        onError: (err: any) => {
          toast({
            title: 'Erro ao preencher',
            description: err?.message ?? 'Tente novamente',
            variant: 'destructive',
          });
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
          toast({
            title: 'Erro ao apagar',
            description: err?.message ?? 'Tente novamente',
            variant: 'destructive',
          }),
      }
    );
    setConfirmDeleteMatchId(null);
  };

  const totalMatches =
    matches?.filter((m) => !m.is_finished && m.home_team_code !== 'TBD').length || 0;
  const totalPredictions = predictions?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-bolao bg-canvas border border-line w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-5xl max-h-[92vh] overflow-hidden p-0 flex flex-col rounded-rebrand-xl">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0 border-b border-line">
          <div className="flex items-start justify-between gap-3 pr-7 mb-3">
            <div className="min-w-0">
              <DialogTitle className="font-display text-[22px] font-bold text-ink leading-tight">
                Fazer palpites
              </DialogTitle>
              <p className="text-[12px] text-ink-2 mt-1">
                Editou? Salvamos automático. Pode mudar até cada jogo começar.
              </p>
            </div>
          </div>
          {/* Barra de progresso + número alinhado à direita na mesma linha */}
          <div className="flex items-center gap-3">
            <div
              className="flex-1 h-1.5 bg-canvas-2 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={totalPredictions}
              aria-valuemin={0}
              aria-valuemax={totalMatches}
            >
              <div
                className="h-full bg-forest transition-all duration-500"
                style={{
                  width:
                    totalMatches > 0
                      ? `${(totalPredictions / totalMatches) * 100}%`
                      : '0%',
                }}
              />
            </div>
            <div className="shrink-0 tabular-nums text-right">
              <span className="text-[13px] font-bold text-ink">{totalPredictions}</span>
              <span className="text-[12px] text-ink-2">
                /{totalMatches}{' '}
                <span className="text-ink-3">
                  · {totalMatches > 0 ? Math.round((totalPredictions / totalMatches) * 100) : 0}%
                </span>
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Matches — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 minimal-scrollbar">
          {/* Quick Pick — 4 personas + copiar de outro bolão.
              is_closed (inscricoes encerradas) nao afeta palpites — quem
              ja entrou continua palpitando ate o prazo de cada jogo. */}
          {totalMatches > 0 && totalPredictions < totalMatches && (
            <QuickPickInline
              remaining={totalMatches - totalPredictions}
              alreadyFilled={totalPredictions}
              currentBolaoId={bolaoId}
              onApply={applyQuickPick}
              isApplying={upsertPredictionsBatch.isPending}
            />
          )}

          <PredictionsList
            bolaoId={bolaoId}
            matches={matches}
            predictions={predictions}
            isLoadingMatches={isLoading}
            isClosed={bolao?.is_closed}
            deadlineMode={bolao?.prediction_deadline_mode ?? 'per_match'}
            onSave={handleSave}
            onDelete={handleDeleteRequest}
            variant="modal"
            accentColor="green"
            groupFilter={groupFilter}
            onGroupFilterChange={setGroupFilter}
            enableSuggestion
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
