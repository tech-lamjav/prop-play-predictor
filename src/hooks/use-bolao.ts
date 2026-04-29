import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bolaoService } from '@/services/bolao.service';
import type { WcMatch } from '@/services/bolao.service';

// =============================================
// Matches
// =============================================

export function useWcMatches(params?: { stage?: string; groupName?: string }) {
  return useQuery({
    queryKey: ['wc-matches', params?.stage, params?.groupName],
    queryFn: () => bolaoService.getMatches(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useWcMatch(matchId: number | undefined) {
  return useQuery({
    queryKey: ['wc-match', matchId],
    queryFn: () => bolaoService.getMatchById(matchId!),
    enabled: !!matchId,
    staleTime: 5 * 60 * 1000,
  });
}

// =============================================
// Bolões
// =============================================

export function useUserBoloes() {
  return useQuery({
    queryKey: ['user-boloes'],
    queryFn: () => bolaoService.getUserBoloes(),
    staleTime: 3 * 60 * 1000,  // 3 min — repeat visits são instantâneos
    gcTime: 10 * 60 * 1000,    // 10 min — cache sobrevive navegação
  });
}

export function useBolao(bolaoId: string | undefined) {
  return useQuery({
    queryKey: ['bolao', bolaoId],
    queryFn: () => bolaoService.getBolaoById(bolaoId!),
    enabled: !!bolaoId,
  });
}

export function useCreateBolao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      name: string;
      description?: string;
      predictionDeadlineMode?: 'per_match' | 'per_round' | 'tournament_start';
    }) => bolaoService.createBolao(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-boloes'] });
    },
  });
}

export function useJoinBolao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteCode: string) => bolaoService.joinByCode(inviteCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-boloes'] });
    },
  });
}

export function useLeaveBolao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bolaoId: string) => bolaoService.leaveBolao(bolaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-boloes'] });
    },
  });
}

// =============================================
// Ranking
// =============================================

export function useBolaoRanking(bolaoId: string | undefined) {
  return useQuery({
    queryKey: ['bolao-ranking', bolaoId],
    queryFn: () => bolaoService.getRanking(bolaoId!),
    enabled: !!bolaoId,
    refetchInterval: 60 * 1000, // refresh every minute during games
  });
}

// =============================================
// Predictions
// =============================================

export function useBolaoPredictions(bolaoId: string | undefined, userId?: string) {
  return useQuery({
    queryKey: ['bolao-predictions', bolaoId, userId],
    queryFn: () => bolaoService.getPredictions(bolaoId!, userId),
    enabled: !!bolaoId,
  });
}

export function useUpsertPrediction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      bolao_id: string;
      match_id: number;
      predicted_home_score: number;
      predicted_away_score: number;
    }) => bolaoService.upsertPrediction(params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bolao-predictions', variables.bolao_id] });
    },
  });
}

export function useDeletePrediction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { bolao_id: string; match_id: number }) =>
      bolaoService.deletePrediction(params.bolao_id, params.match_id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bolao-predictions', variables.bolao_id] });
      queryClient.invalidateQueries({ queryKey: ['bolao-ranking', variables.bolao_id] });
    },
  });
}

export function useUpsertPredictionsBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      bolaoId: string;
      predictions: { match_id: number; predicted_home_score: number; predicted_away_score: number }[];
    }) => bolaoService.upsertPredictionsBatch(params.bolaoId, params.predictions),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bolao-predictions', variables.bolaoId] });
      queryClient.invalidateQueries({ queryKey: ['bolao-ranking', variables.bolaoId] });
    },
  });
}

// =============================================
// Champion Prediction
// =============================================

export function useChampionPredictions(bolaoId: string | undefined) {
  return useQuery({
    queryKey: ['champion-predictions', bolaoId],
    queryFn: () => bolaoService.getChampionPredictions(bolaoId!),
    enabled: !!bolaoId,
    staleTime: 30 * 1000,
  });
}

export function useUpsertChampionPrediction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { bolaoId: string; teamCode: string }) =>
      bolaoService.upsertChampionPrediction(params.bolaoId, params.teamCode),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['champion-predictions', variables.bolaoId] });
      queryClient.invalidateQueries({ queryKey: ['user-boloes'] });
    },
  });
}

// =============================================
// Admin
// =============================================

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { bolaoId: string; userId: string }) =>
      bolaoService.removeMember(params.bolaoId, params.userId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bolao-ranking', variables.bolaoId] });
      queryClient.invalidateQueries({ queryKey: ['user-boloes'] });
    },
  });
}

export function useToggleBolaoClose() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bolaoId: string) => bolaoService.toggleBolaoClose(bolaoId),
    onSuccess: (_data, bolaoId) => {
      queryClient.invalidateQueries({ queryKey: ['user-boloes'] });
      queryClient.invalidateQueries({ queryKey: ['bolao', bolaoId] });
    },
  });
}

// =============================================
// Special Predictions (Wave 2)
// =============================================

export function useMySpecialPredictions(bolaoId: string | undefined) {
  return useQuery({
    queryKey: ['special-predictions-mine', bolaoId],
    queryFn: () => bolaoService.getMySpecialPredictions(bolaoId!),
    enabled: !!bolaoId,
    staleTime: 30 * 1000,
  });
}

export function useSpecialSummary(bolaoId: string | undefined) {
  return useQuery({
    queryKey: ['special-summary', bolaoId],
    queryFn: () => bolaoService.getSpecialSummary(bolaoId!),
    enabled: !!bolaoId,
    staleTime: 30 * 1000,
  });
}

export function useToggleSpecialPrediction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      bolaoId: string;
      predictionType: 'finalist' | 'semifinalist' | 'quarterfinalist' | 'round_of_32';
      teamCode: string;
    }) => bolaoService.toggleSpecialPrediction(params.bolaoId, params.predictionType, params.teamCode),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['special-predictions-mine', variables.bolaoId] });
      queryClient.invalidateQueries({ queryKey: ['special-summary', variables.bolaoId] });
      queryClient.invalidateQueries({ queryKey: ['user-boloes'] });
    },
  });
}

export function useUpdateBolaoScoring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      bolaoId: string;
      preset: 'standard' | 'classic' | 'weighted_stages' | 'custom';
      scoringResult?: number;
      scoringExact?: number;
      scoringWeights?: Record<string, number> | null;
    }) => bolaoService.updateBolaoScoring(
      params.bolaoId,
      params.preset,
      params.scoringResult,
      params.scoringExact,
      params.scoringWeights
    ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bolao', variables.bolaoId] });
      queryClient.invalidateQueries({ queryKey: ['user-boloes'] });
    },
  });
}

export function useUpdateBolaoDeadlineMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      bolaoId: string;
      mode: 'per_match' | 'per_round' | 'tournament_start';
    }) => bolaoService.updateBolaoDeadlineMode(params.bolaoId, params.mode),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bolao', variables.bolaoId] });
      queryClient.invalidateQueries({ queryKey: ['user-boloes'] });
    },
  });
}

export function useUpdateBolaoSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      bolaoId: string;
      settings: {
        champion_enabled?: boolean;
        special_predictions_enabled?: boolean;
        special_predictions_config?: Record<string, boolean>;
        special_predictions_points?: Record<string, number>;
        champion_points?: number;
      };
    }) => bolaoService.updateBolaoSettings(params.bolaoId, params.settings),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bolao', variables.bolaoId] });
      queryClient.invalidateQueries({ queryKey: ['user-boloes'] });
    },
  });
}

// =============================================
// Stats + Round Rankings (Wave 3)
// =============================================

export function useBolaoInsights(bolaoId: string | undefined) {
  return useQuery({
    queryKey: ['bolao-insights', bolaoId],
    queryFn: () => bolaoService.getBolaoInsights(bolaoId!),
    enabled: !!bolaoId,
    staleTime: 60_000, // 1 min — insights são reativos a jogos novos
  });
}

export function useMarkInsightsSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bolaoService.markInsightsSeen(ids),
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['bolao-insights'] });
    },
  });
}

export function useBolaoStats(bolaoId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['bolao-stats', bolaoId],
    queryFn: () => bolaoService.getBolaoStats(bolaoId!),
    enabled: !!bolaoId && enabled,
    staleTime: 60 * 1000,
  });
}

export function useBolaoRoundRanking(bolaoId: string | undefined, stage?: string) {
  return useQuery({
    queryKey: ['bolao-round-ranking', bolaoId, stage ?? 'all'],
    queryFn: () => bolaoService.getRoundRanking(bolaoId!, stage),
    enabled: !!bolaoId,
    staleTime: 60 * 1000,
  });
}

// =============================================
// Personal stats (Onda 5 — "Você")
// =============================================

export function useMyBolaoPersonalStats(bolaoId: string | undefined) {
  return useQuery({
    queryKey: ['bolao-personal-stats', bolaoId],
    queryFn: () => bolaoService.getMyBolaoPersonalStats(bolaoId!),
    enabled: !!bolaoId,
    staleTime: 60 * 1000,
  });
}

export function useMyTeamHeatmap(bolaoId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['bolao-team-heatmap', bolaoId],
    queryFn: () => bolaoService.getMyTeamHeatmap(bolaoId!),
    enabled: !!bolaoId && enabled,
    staleTime: 60 * 1000,
  });
}

export function useVersusStats(
  bolaoId: string | undefined,
  opponentUserId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: ['bolao-versus', bolaoId, opponentUserId],
    queryFn: () => bolaoService.getVersusStats(bolaoId!, opponentUserId!),
    enabled: !!bolaoId && !!opponentUserId && enabled,
    staleTime: 60 * 1000,
  });
}

export function useUpdateBolaoTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { bolaoId: string; color?: string; logoUrl?: string }) =>
      bolaoService.updateBolaoTheme(params.bolaoId, params.color, params.logoUrl),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bolao', variables.bolaoId] });
      queryClient.invalidateQueries({ queryKey: ['user-boloes'] });
    },
  });
}

export function useUploadBolaoLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { bolaoId: string; file: File }) =>
      bolaoService.uploadBolaoLogo(params.bolaoId, params.file),
    onSuccess: (_logoUrl, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bolao', variables.bolaoId] });
    },
  });
}

// =============================================
// Helpers
// =============================================

export function getStageLabel(stage: WcMatch['stage']): string {
  switch (stage) {
    case 'group': return 'Fase de Grupos';
    case 'round_of_32': return 'Oitavas de Final';
    case 'round_of_16': return '16 Avos de Final';
    case 'quarter': return 'Quartas de Final';
    case 'semi': return 'Semifinal';
    case 'third_place': return 'Disputa de 3º Lugar';
    case 'final': return 'Final';
    default: return stage;
  }
}

export function isMatchLocked(match: WcMatch): boolean {
  const now = new Date();
  const matchDateTime = new Date(`${match.match_date}T${match.match_time_brasilia}-03:00`);
  return now >= matchDateTime || match.is_finished;
}

function matchKickoff(m: WcMatch): Date {
  return new Date(`${m.match_date}T${m.match_time_brasilia}-03:00`);
}

/**
 * Computes the prediction deadline for a match given the bolão's mode.
 * Mirrors the server-side get_prediction_deadline function.
 */
export function computeMatchDeadline(
  match: WcMatch,
  mode: 'per_match' | 'per_round' | 'tournament_start',
  allMatches: WcMatch[] | undefined
): Date {
  if (mode === 'per_match' || !allMatches || allMatches.length === 0) {
    return matchKickoff(match);
  }
  if (mode === 'per_round') {
    const stageMatches = allMatches.filter(m => m.stage === match.stage);
    if (stageMatches.length === 0) return matchKickoff(match);
    return stageMatches.reduce((min, m) => {
      const t = matchKickoff(m);
      return t < min ? t : min;
    }, matchKickoff(stageMatches[0]));
  }
  // tournament_start
  return allMatches.reduce((min, m) => {
    const t = matchKickoff(m);
    return t < min ? t : min;
  }, matchKickoff(allMatches[0]));
}

export function isMatchPredictionLocked(
  match: WcMatch,
  mode: 'per_match' | 'per_round' | 'tournament_start',
  allMatches: WcMatch[] | undefined,
  isClosed: boolean
): boolean {
  if (match.is_finished || isClosed) return true;
  const deadline = computeMatchDeadline(match, mode, allMatches);
  return new Date() >= deadline;
}

/**
 * Returns the next prediction deadline that hasn't passed yet, given the
 * bolão mode + the user's already-made predictions. Used to show the user
 * "Próximo palpite fecha em XYZ" outside of an individual match card.
 *
 * Returns null if everything is already locked or finished.
 */
export function getNextDeadline(
  mode: 'per_match' | 'per_round' | 'tournament_start',
  allMatches: WcMatch[] | undefined,
  isClosed: boolean
): { match: WcMatch; deadline: Date } | null {
  if (isClosed || !allMatches || allMatches.length === 0) return null;
  const now = new Date();
  // Find every match that's still open and pick the earliest deadline.
  const candidates = allMatches
    .filter(m => !m.is_finished)
    .map(m => ({ match: m, deadline: computeMatchDeadline(m, mode, allMatches) }))
    .filter(c => c.deadline.getTime() > now.getTime())
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  return candidates[0] ?? null;
}

/**
 * Human-friendly relative time formatter. Returns "47min", "2h 15min",
 * "Hoje 22:00", "23/04 22:00", etc. Suitable for deadline countdown badges.
 */
export function formatDeadlineRelative(deadline: Date, now: Date = new Date()): string {
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return 'Encerrado';

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 12) {
    const remainingMin = diffMin % 60;
    return remainingMin > 0 ? `${diffHours}h ${remainingMin}min` : `${diffHours}h`;
  }

  // Same calendar day → "Hoje 22:00"
  const sameDay = deadline.toDateString() === now.toDateString();
  const hh = String(deadline.getHours()).padStart(2, '0');
  const mm = String(deadline.getMinutes()).padStart(2, '0');
  if (sameDay) return `Hoje ${hh}:${mm}`;

  // Tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (deadline.toDateString() === tomorrow.toDateString()) return `Amanhã ${hh}:${mm}`;

  // Otherwise → "23/04 22:00"
  const dd = String(deadline.getDate()).padStart(2, '0');
  const mo = String(deadline.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mo} ${hh}:${mm}`;
}

/** Returns true if the deadline is < 1 hour away → urgent (red pulse) */
export function isDeadlineUrgent(deadline: Date, now: Date = new Date()): boolean {
  const diffMs = deadline.getTime() - now.getTime();
  return diffMs > 0 && diffMs < 60 * 60_000;
}
