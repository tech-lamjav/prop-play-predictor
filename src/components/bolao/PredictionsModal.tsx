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
  useDeletePrediction,
} from '@/hooks/use-bolao';
import { PredictionsList } from '@/components/bolao/PredictionsList';
import { ConfirmDialog } from '@/components/bolao/ConfirmDialog';
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
  const deletePrediction = useDeletePrediction();
  const { toast } = useToast();
  const { unlock } = useAchievement();

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
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-terminal-text">
              Fazer Palpites
            </DialogTitle>
            <div aria-label={`${totalPredictions} de ${totalMatches} palpites feitos`}>
              <span className="text-sm font-bold text-terminal-blue">{totalPredictions}</span>
              <span className="text-xs opacity-40">/{totalMatches}</span>
            </div>
          </div>
        </DialogHeader>

        {/* Matches — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 minimal-scrollbar">
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
