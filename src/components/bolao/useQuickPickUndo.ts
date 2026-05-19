import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUpsertPredictionsBatch } from '@/hooks/use-bolao';
import { useToast } from '@/hooks/use-toast';
import { bolaoService } from '@/services/bolao.service';
import type { BolaoPrediction } from '@/services/bolao.service';
import type { QuickPickPrediction } from '@/components/bolao/quick-pick';

interface SnapshotEntry {
  home: number;
  away: number;
}

/**
 * Hook que prepara um snapshot dos palpites antes do Quick Pick e expõe um
 * `undo(generated)` capaz de:
 *  - restaurar palpites que existiam antes (via upsertPredictionsBatch)
 *  - apagar palpites criados do zero (via RPC deletePrediction em paralelo)
 *
 * Chamamos o service direto (não o hook useDeletePrediction) pra evitar que
 * cada mutation invalide queries durante a execução das outras — a race
 * resultante deixava a UI dessincronizada. No fim, fazemos uma única
 * atualização sync do cache + refetch como garantia.
 */
export function useQuickPickUndo(bolaoId: string, predictions: BolaoPrediction[] | undefined) {
  const queryClient = useQueryClient();
  const upsertBatch = useUpsertPredictionsBatch();
  const { toast } = useToast();
  const snapshotRef = useRef<Map<number, SnapshotEntry>>(new Map());

  const captureSnapshot = useCallback(() => {
    snapshotRef.current = new Map(
      (predictions || []).map((p) => [
        p.match_id,
        { home: p.predicted_home_score, away: p.predicted_away_score },
      ])
    );
  }, [predictions]);

  const undo = useCallback(
    async (generated: QuickPickPrediction[]) => {
      const before = snapshotRef.current;
      const ids = generated.map((g) => g.match_id);

      const toRestore = ids
        .filter((id) => before.has(id))
        .map((id) => {
          const prev = before.get(id)!;
          return {
            match_id: id,
            predicted_home_score: prev.home,
            predicted_away_score: prev.away,
          };
        });
      const toDelete = ids.filter((id) => !before.has(id));

      try {
        if (toRestore.length > 0) {
          await upsertBatch.mutateAsync({ bolaoId, predictions: toRestore });
        }

        let deletedCount = 0;
        let failedCount = 0;
        const failedErrors: string[] = [];
        if (toDelete.length > 0) {
          // Log detalhado: silenciar com .catch(() => false) escondia bugs
          // tipo prazo encerrado, auth perdida, RLS, etc. Agora cada falha
          // vai pro console.error com contexto + acumula mensagem pra toast.
          const results = await Promise.all(
            toDelete.map((id) =>
              bolaoService
                .deletePrediction(bolaoId, id)
                .then(() => true)
                .catch((err: unknown) => {
                  const msg = err instanceof Error ? err.message : String(err);
                  console.error(`[QuickPickUndo] Falha excluindo match ${id}:`, err);
                  failedErrors.push(`match ${id}: ${msg}`);
                  return false;
                })
            )
          );
          deletedCount = results.filter((r) => r).length;
          failedCount = results.filter((r) => !r).length;
        }

        // 1. Atualiza o cache local IMEDIATAMENTE — UI reflete sem esperar refetch
        const deleteSet = new Set(toDelete);
        const restoreMap = new Map(toRestore.map((r) => [r.match_id, r]));
        queryClient.setQueriesData<BolaoPrediction[]>(
          { queryKey: ['bolao-predictions', bolaoId] },
          (old) => {
            if (!old) return old;
            return old
              .filter((p) => !deleteSet.has(p.match_id))
              .map((p) => {
                const r = restoreMap.get(p.match_id);
                if (!r) return p;
                return {
                  ...p,
                  predicted_home_score: r.predicted_home_score,
                  predicted_away_score: r.predicted_away_score,
                };
              });
          }
        );

        // 2. Refetch sync como garantia — sincroniza com o estado real do servidor
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['bolao-predictions', bolaoId] }),
          queryClient.refetchQueries({ queryKey: ['bolao-ranking', bolaoId] }),
        ]);

        if (failedCount > 0) {
          // Mostra a primeira mensagem real de erro pro user entender o que rolou
          const firstError = failedErrors[0] ?? 'erro desconhecido';
          toast({
            title: 'Não consegui desfazer todos',
            description: `${deletedCount} apagados, ${failedCount} falharam. Causa: ${firstError}`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Quick Pick desfeito',
            description: `${deletedCount} apagado${deletedCount !== 1 ? 's' : ''}, ${toRestore.length} restaurado${toRestore.length !== 1 ? 's' : ''}.`,
          });
        }
      } catch (err: any) {
        toast({
          title: 'Erro ao desfazer',
          description: err?.message ?? 'Tente novamente',
          variant: 'destructive',
        });
      }
    },
    [bolaoId, upsertBatch, toast, queryClient]
  );

  return { captureSnapshot, undo };
}
