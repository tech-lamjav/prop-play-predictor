/**
 * Resolve um QuickPickApplyOpts num array de predictions pronto pra
 * `upsertPredictionsBatch`. Centraliza a lógica de:
 *  - filtrar matches por mode (pendentes vs substituir)
 *  - rotear pra `generateQuickPickPredictions` (persona) ou
 *    `bolaoService.getPredictions` (copy)
 *
 * Compartilhado por PredictionsModal e BolaoPalpites — ambos chamam o
 * mesmo `applyQuickPick` no callback do QuickPickInline.
 */
import { bolaoService } from '@/services/bolao.service';
import type { BolaoPrediction, WcMatch } from '@/services/bolao.service';
import {
  generateQuickPickPredictions,
  type QuickPickApplyOpts,
  type QuickPickPrediction,
} from './quick-pick';

interface ResolveCtx {
  matches: WcMatch[];
  existingPredictions: BolaoPrediction[] | undefined;
  destBolaoId: string;
  userId: string | undefined;
}

export async function resolveQuickPickPayload(
  opts: QuickPickApplyOpts,
  ctx: ResolveCtx
): Promise<QuickPickPrediction[]> {
  const { matches, existingPredictions, destBolaoId, userId } = ctx;

  // Filtro de modo: "pendentes" remove matches que já têm palpite no bolão atual
  const candidateMatches =
    opts.mode === 'pendentes'
      ? matches.filter((m) => !existingPredictions?.some((p) => p.match_id === m.id))
      : matches;

  if (opts.kind === 'persona') {
    const seed = destBolaoId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
    return generateQuickPickPredictions(candidateMatches, opts.persona, {
      seed,
      fixedScore: opts.fixedScore,
    });
  }

  // kind === 'copy': busca palpites do bolão fonte e mapeia pros matches válidos
  if (!userId) return [];
  const sourcePreds = await bolaoService.getPredictions(opts.sourceBolaoId, userId);
  const byMatchId = new Map(sourcePreds.map((p) => [p.match_id, p]));

  return candidateMatches
    .filter(
      (m) =>
        !m.is_finished &&
        m.home_team_code !== 'TBD' &&
        m.away_team_code !== 'TBD' &&
        byMatchId.has(m.id)
    )
    .map((m) => {
      const sp = byMatchId.get(m.id)!;
      return {
        match_id: m.id,
        predicted_home_score: sp.predicted_home_score,
        predicted_away_score: sp.predicted_away_score,
      };
    });
}
