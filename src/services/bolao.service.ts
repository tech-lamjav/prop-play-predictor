import { supabase } from '@/integrations/supabase/client';

// =============================================
// Types
// =============================================

export interface WcMatch {
  id: number;
  match_number: number;
  stage: 'group' | 'round_of_32' | 'round_of_16' | 'quarter' | 'semi' | 'third_place' | 'final';
  group_name: string | null;
  home_team: string;
  away_team: string;
  home_team_code: string;
  away_team_code: string;
  match_date: string;
  match_time_brasilia: string;
  venue: string | null;
  city: string | null;
  home_score: number | null;
  away_score: number | null;
  is_finished: boolean;
}

export interface Bolao {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  invite_code: string;
  is_public: boolean;
  max_participants: number;
  is_premium: boolean;
  is_closed: boolean;
  scoring_exact: number;
  scoring_result: number;
  scoring_preset: string | null;
  scoring_weights: Record<string, number> | null;
  prediction_deadline_mode: 'per_match' | 'per_day' | 'per_round' | 'per_stage' | 'tournament_start';
  custom_color: string | null;
  custom_banner_url: string | null;
  champion_enabled: boolean;
  knockout_real_predictions_enabled: boolean;
  /** Opt-in do dono: avisar no Telegram dele quando cada jogo começa. */
  kickoff_notify_telegram: boolean;
  special_predictions_enabled: boolean;
  special_predictions_config: {
    finalist: boolean;
    semifinalist: boolean;
    quarterfinalist: boolean;
    round_of_16: boolean;
    round_of_32: boolean;
  };
  special_predictions_points: {
    finalist: number;
    semifinalist: number;
    quarterfinalist: number;
    round_of_16: number;
    round_of_32: number;
  };
  champion_points: number;
  player_awards_enabled: Record<PlayerAwardType, boolean> | null;
  player_award_points: Record<PlayerAwardType, number> | null;
  /** Config de prazo dos palpites especiais (presets + override por tipo). null = rolling. */
  special_deadlines: SpecialDeadlinesConfig | null;
  created_at: string;
}

/** Preset de prazo dos palpites especiais. */
export type SpecialDeadlineMode = 'rolling' | 'opening';

/**
 * Config de prazo dos palpites especiais. `mode` é o preset; `overrides`
 * sobrescreve a data/hora (ISO timestamptz) de tipos específicos.
 */
export interface SpecialDeadlinesConfig {
  mode: SpecialDeadlineMode;
  overrides?: Record<string, string | null>;
}

export interface BolaoMember {
  id: string;
  bolao_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export interface BolaoPrediction {
  id: string;
  bolao_id: string;
  user_id: string;
  match_id: number;
  predicted_home_score: number;
  predicted_away_score: number;
  points_earned: number | null;
  created_at: string;
  updated_at: string;
}

export interface BolaoRankingEntry {
  user_id: string;
  user_name: string;
  user_email: string;
  total_points: number;
  exact_scores: number;
  correct_results: number;
  total_predictions: number;
  rank: number;
}

export interface UserBolao {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  is_premium: boolean;
  is_closed: boolean;
  max_participants: number;
  owner_id: string;
  owner_name: string;
  member_count: number;
  user_points: number;
  user_rank: number;
  user_predictions: number;
  pending_predictions: number;
  has_champion_prediction: boolean;
  created_at: string;
  prediction_deadline_mode: 'per_match' | 'per_day' | 'per_round' | 'per_stage' | 'tournament_start';
  custom_banner_url: string | null;
}

export interface ChampionPrediction {
  user_id: string;
  user_name: string;
  predicted_team_code: string;
  points_earned: number | null;
  created_at: string;
}

export type SpecialPredictionType =
  | 'finalist' | 'semifinalist' | 'quarterfinalist' | 'round_of_16' | 'round_of_32'
  | 'top_scorer' | 'best_goalkeeper' | 'best_young_player' | 'best_player';

export type PlayerAwardType = 'top_scorer' | 'best_goalkeeper' | 'best_young_player' | 'best_player';

export interface SpecialPrediction {
  prediction_type: SpecialPredictionType;
  predicted_team_code: string | null;
  predicted_player_id: number | null;
  points_earned: number | null;
}

export interface WcPlayer {
  player_id: number;
  player_name: string;
  team_code: string;
  position: string | null;
  shirt_number: number | null;
  birth_date: string | null;
  photo_url: string | null;
}

export interface SpecialSummaryEntry {
  prediction_type: string;
  predicted_team_code: string;
  pick_count: number;
}

export interface BolaoInsight {
  id: string;
  match_id: number | null;
  type: 'rare_correct' | 'exact_score_lonely' | 'majority_wrong' | 'streak_3' | 'streak_5' | string;
  payload: Record<string, any>;
  seen: boolean;
  created_at: string;
  match_home_team: string | null;
  match_away_team: string | null;
  match_home_score: number | null;
  match_away_score: number | null;
}

export interface BolaoStats {
  total_members: number;
  total_predictions: number;
  distinct_games: number;
  exact_scores: number;
  correct_results: number;
  total_points_awarded: number;
  finished_games: number;
  top_team_champion: string | null;
  champion_pick_count: number;
}

export interface PersonalEvolutionPoint {
  match_id: number;
  match_date: string;
  home: string;
  away: string;
  home_score: number | null;
  away_score: number | null;
  points: number;
  cumulative: number;
}

export interface PersonalPersonalityData {
  total: number;
  draws: number;
  high_scoring: number;
  low_scoring: number;
  blowouts: number;
  tight: number;
}

export interface PersonalStats {
  total_points: number;
  exact_scores: number;
  correct_results: number;
  total_predictions: number;
  finished_with_pred: number;
  accuracy_pct: number;
  evolution: PersonalEvolutionPoint[];
  personality_data: PersonalPersonalityData;
}

export interface TeamHeatmapEntry {
  team_code: string;
  team_name: string;
  matches_predicted: number;
  matches_finished: number;
  exact_scores: number;
  correct_results: number;
  total_points: number;
}

export interface VersusUserStats {
  user_id: string;
  total_points: number;
  exact_scores: number;
  correct_results: number;
  total_predictions: number;
}

export interface VersusStats {
  me: VersusUserStats | Record<string, never>;
  opponent: VersusUserStats | Record<string, never>;
}

export const SPECIAL_PREDICTION_MAX: Record<string, number> = {
  finalist: 2,
  semifinalist: 4,
  quarterfinalist: 8,
  round_of_32: 32,
};

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// =============================================
// Service
// =============================================

export const bolaoService = {
  // --- Matches ---

  async getMatches(params?: { stage?: string; groupName?: string }): Promise<WcMatch[]> {
    let query = supabase
      .from('wc_matches')
      .select('id, match_number, stage, group_name, home_team, away_team, home_team_code, away_team_code, match_date, match_time_brasilia, venue, city, home_score, away_score, is_finished')
      .order('match_date', { ascending: true })
      .order('match_time_brasilia', { ascending: true });

    if (params?.stage) {
      query = query.eq('stage', params.stage);
    }
    if (params?.groupName) {
      query = query.eq('group_name', params.groupName);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as WcMatch[];
  },

  async getMatchById(matchId: number): Promise<WcMatch | null> {
    const { data, error } = await supabase
      .from('wc_matches')
      .select('id, match_number, stage, group_name, home_team, away_team, home_team_code, away_team_code, match_date, match_time_brasilia, venue, city, home_score, away_score, is_finished')
      .eq('id', matchId)
      .single();

    if (error) throw error;
    return data as WcMatch | null;
  },

  // --- Bolões ---

  async getUserBoloes(): Promise<UserBolao[]> {
    const { data, error } = await supabase.rpc('get_user_boloes');
    if (error) throw error;
    return (data || []) as UserBolao[];
  },

  async getBolaoById(bolaoId: string): Promise<Bolao | null> {
    const { data, error } = await supabase
      .from('boloes')
      .select('*')
      .eq('id', bolaoId)
      .single();

    if (error) throw error;
    return data as Bolao | null;
  },

  async createBolao(params: {
    name: string;
    description?: string;
    predictionDeadlineMode?: 'per_match' | 'per_round' | 'tournament_start';
  }): Promise<Bolao> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Usuário não autenticado');

    const invite_code = generateInviteCode();

    const { data, error } = await supabase
      .from('boloes')
      .insert({
        owner_id: userId,
        name: params.name,
        description: params.description || null,
        invite_code,
        prediction_deadline_mode: params.predictionDeadlineMode ?? 'per_match',
      })
      .select()
      .single();

    if (error) throw error;

    // Add owner as member
    await supabase
      .from('bolao_members')
      .insert({
        bolao_id: (data as any).id,
        user_id: userId,
        role: 'owner',
      });

    return data as Bolao;
  },

  async joinByCode(inviteCode: string): Promise<{ success: boolean; bolao_id?: string; already_member?: boolean; error?: string }> {
    const { data, error } = await supabase.rpc('join_bolao_by_code', {
      p_invite_code: inviteCode.toUpperCase(),
    });

    if (error) throw error;
    return data as { success: boolean; bolao_id?: string; already_member?: boolean; error?: string };
  },

  async leaveBolao(bolaoId: string): Promise<void> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Usuário não autenticado');

    const { error } = await supabase
      .from('bolao_members')
      .delete()
      .eq('bolao_id', bolaoId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async deleteBolao(bolaoId: string): Promise<void> {
    const { data, error } = await supabase.rpc('delete_bolao', {
      p_bolao_id: bolaoId,
    });
    if (error) throw error;
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error || 'Erro ao excluir bolão');
  },

  // --- Members ---

  async getMembers(bolaoId: string): Promise<BolaoMember[]> {
    const { data, error } = await supabase
      .from('bolao_members')
      .select('*')
      .eq('bolao_id', bolaoId)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return (data || []) as BolaoMember[];
  },

  // --- Ranking ---

  async getRanking(bolaoId: string): Promise<BolaoRankingEntry[]> {
    const { data, error } = await supabase.rpc('get_bolao_ranking', {
      p_bolao_id: bolaoId,
    });

    if (error) throw error;
    return (data || []) as BolaoRankingEntry[];
  },

  // --- Champion Prediction ---

  async upsertChampionPrediction(bolaoId: string, teamCode: string): Promise<void> {
    const { data, error } = await supabase.rpc('upsert_champion_prediction', {
      p_bolao_id: bolaoId,
      p_team_code: teamCode,
    });

    if (error) throw error;
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error || 'Erro ao salvar palpite de campeão');
  },

  async getChampionPredictions(bolaoId: string): Promise<ChampionPrediction[]> {
    const { data, error } = await supabase.rpc('get_champion_predictions', {
      p_bolao_id: bolaoId,
    });

    if (error) throw error;
    return (data || []) as ChampionPrediction[];
  },

  // --- Admin ---

  async removeMember(bolaoId: string, userId: string): Promise<void> {
    const { data, error } = await supabase.rpc('remove_bolao_member', {
      p_bolao_id: bolaoId,
      p_user_id: userId,
    });

    if (error) throw error;
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error || 'Erro ao remover participante');
  },

  async toggleBolaoClose(bolaoId: string): Promise<{ is_closed: boolean }> {
    const { data, error } = await supabase.rpc('toggle_bolao_closed', {
      p_bolao_id: bolaoId,
    });

    if (error) throw error;
    const result = data as { success: boolean; is_closed: boolean; error?: string };
    if (!result.success) throw new Error(result.error || 'Erro ao alterar inscrições');
    return { is_closed: result.is_closed };
  },

  // --- Predictions ---

  async getPredictions(bolaoId: string, userId?: string): Promise<BolaoPrediction[]> {
    let query = supabase
      .from('bolao_predictions')
      .select('*')
      .eq('bolao_id', bolaoId);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.order('match_id', { ascending: true });
    if (error) throw error;
    return (data || []) as BolaoPrediction[];
  },

  async upsertPrediction(params: {
    bolao_id: string;
    match_id: number;
    predicted_home_score: number;
    predicted_away_score: number;
  }): Promise<void> {
    const { data, error } = await supabase.rpc('submit_bolao_prediction', {
      p_bolao_id: params.bolao_id,
      p_match_id: params.match_id,
      p_predicted_home_score: params.predicted_home_score,
      p_predicted_away_score: params.predicted_away_score,
    });
    if (error) throw error;
    const result = data as { success: boolean; error?: string; deadline?: string };
    if (!result.success) throw new Error(result.error || 'Erro ao salvar palpite');
  },

  async upsertPredictionsBatch(
    bolaoId: string,
    predictions: { match_id: number; predicted_home_score: number; predicted_away_score: number }[]
  ): Promise<{ saved: number; skipped: number }> {
    const payload = predictions.map((p) => ({
      match_id: p.match_id,
      home: p.predicted_home_score,
      away: p.predicted_away_score,
    }));
    const { data, error } = await supabase.rpc('batch_submit_bolao_predictions', {
      p_bolao_id: bolaoId,
      p_predictions: payload,
    });
    if (error) throw error;
    const result = data as { success: boolean; saved: number; skipped: number; error?: string };
    if (!result.success) throw new Error(result.error || 'Erro ao salvar palpites');
    return { saved: result.saved, skipped: result.skipped };
  },

  async updateBolaoDeadlineMode(
    bolaoId: string,
    mode: 'per_match' | 'per_round' | 'tournament_start'
  ): Promise<{ prediction_deadline_mode: string }> {
    const { data, error } = await supabase.rpc('update_bolao_deadline_mode', {
      p_bolao_id: bolaoId,
      p_mode: mode,
    });
    if (error) throw error;
    const result = data as { success: boolean; prediction_deadline_mode: string; error?: string };
    if (!result.success) throw new Error(result.error || 'Erro ao atualizar prazo');
    return { prediction_deadline_mode: result.prediction_deadline_mode };
  },

  async getBolaoInsights(bolaoId: string, limit = 10): Promise<BolaoInsight[]> {
    const { data, error } = await supabase.rpc('get_my_bolao_insights', {
      p_bolao_id: bolaoId,
      p_limit: limit,
    });
    if (error) throw error;
    return (data || []) as BolaoInsight[];
  },

  async markInsightsSeen(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await supabase.rpc('mark_insights_seen', { p_ids: ids });
    if (error) throw error;
  },

  async deletePrediction(bolaoId: string, matchId: number): Promise<void> {
    const { data, error } = await supabase.rpc('delete_bolao_prediction', {
      p_bolao_id: bolaoId,
      p_match_id: matchId,
    });
    if (error) throw error;
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error || 'Erro ao apagar palpite');
  },

  async getPredictionDeadline(bolaoId: string, matchId: number): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_prediction_deadline', {
      p_bolao_id: bolaoId,
      p_match_id: matchId,
    });
    if (error) throw error;
    return data as string | null;
  },

  // --- Special Predictions (Wave 2) ---

  async getMySpecialPredictions(bolaoId: string): Promise<SpecialPrediction[]> {
    const { data, error } = await supabase.rpc('get_my_special_predictions', {
      p_bolao_id: bolaoId,
    });
    if (error) throw error;
    return (data || []) as SpecialPrediction[];
  },

  async getUserSpecialPredictions(
    bolaoId: string,
    userId: string
  ): Promise<SpecialPrediction[]> {
    // Query direta na tabela em vez de RPC (RPC com SECURITY DEFINER exigiria
    // migration manual). Funciona se a RLS permite membros lerem palpites
    // uns dos outros — que é o caso, já que `get_bolao_special_summary`
    // agrega tudo da mesma tabela.
    const { data, error } = await supabase
      .from('bolao_special_predictions')
      .select('prediction_type, predicted_team_code, predicted_player_id, points_earned')
      .eq('bolao_id', bolaoId)
      .eq('user_id', userId)
      .order('prediction_type');
    if (error) throw error;
    return (data || []) as SpecialPrediction[];
  },

  async getSpecialSummary(bolaoId: string): Promise<SpecialSummaryEntry[]> {
    const { data, error } = await supabase.rpc('get_bolao_special_summary', {
      p_bolao_id: bolaoId,
    });
    if (error) throw error;
    return (data || []) as SpecialSummaryEntry[];
  },

  async toggleSpecialPrediction(
    bolaoId: string,
    predictionType: 'finalist' | 'semifinalist' | 'quarterfinalist' | 'round_of_16' | 'round_of_32',
    teamCode: string
  ): Promise<{ action: 'added' | 'removed'; count?: number }> {
    const { data, error } = await supabase.rpc('toggle_special_prediction', {
      p_bolao_id: bolaoId,
      p_prediction_type: predictionType,
      p_team_code: teamCode,
    });
    if (error) throw error;
    const result = data as { success: boolean; action?: string; count?: number; error?: string; max?: number };
    if (!result.success) throw new Error(result.error || 'Erro ao salvar palpite');
    return { action: result.action as 'added' | 'removed', count: result.count };
  },

  // --- Player Awards (palpites de jogador) ---

  /** Lista todos os jogadores da Copa (ref global wc_players). Filtro/busca é client-side.
   *  Pagina em lotes de 1000 porque o PostgREST corta em 1000 linhas por padrão — sem isso,
   *  jogadores no fim da ordem alfabética (ex.: Vini Jr) não apareciam no seletor. */
  async getWcPlayers(): Promise<WcPlayer[]> {
    const PAGE = 1000;
    const all: WcPlayer[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('wc_players')
        .select('player_id, player_name, team_code, position, shirt_number, birth_date, photo_url')
        .order('player_name')
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data || []) as WcPlayer[];
      all.push(...rows);
      if (rows.length < PAGE) break;
    }
    return all;
  },

  /** Define (pick único) o palpite de jogador. playerId null limpa o palpite. */
  async setPlayerPrediction(
    bolaoId: string,
    predictionType: PlayerAwardType,
    playerId: number | null
  ): Promise<{ action: 'set' | 'removed' }> {
    const { data, error } = await supabase.rpc('set_player_prediction', {
      p_bolao_id: bolaoId,
      p_prediction_type: predictionType,
      p_player_id: playerId,
    });
    if (error) throw error;
    const result = data as { success: boolean; action?: string; error?: string };
    if (!result.success) throw new Error(result.error || 'Erro ao salvar palpite');
    return { action: result.action as 'set' | 'removed' };
  },

  /** Avança o vencedor de um confronto do mata-mata (e remove o perdedor das fases adiante). */
  async bracketAdvance(bolaoId: string, winner: string, loser: string, nextStage: string): Promise<void> {
    const { data, error } = await supabase.rpc('bracket_advance', {
      p_bolao_id: bolaoId,
      p_winner: winner,
      p_loser: loser,
      p_next_stage: nextStage,
    });
    if (error) throw error;
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error || 'Erro ao avançar no chaveamento');
  },

  /** Auto-preenche os 16 avos (round_of_32) com os 32 códigos projetados. Substitui os atuais. */
  async setRoundOf32FromProjection(bolaoId: string, codes: string[]): Promise<{ count: number }> {
    const { data, error } = await supabase.rpc('set_round_of_32_from_projection', {
      p_bolao_id: bolaoId,
      p_codes: codes,
    });
    if (error) throw error;
    const result = data as { success: boolean; count?: number; error?: string };
    if (!result.success) throw new Error(result.error || 'Erro ao aplicar a projeção');
    return { count: result.count ?? 0 };
  },

  async updateBolaoScoring(
    bolaoId: string,
    preset: 'standard' | 'classic' | 'weighted_stages' | 'custom',
    scoringResult?: number,
    scoringExact?: number,
    scoringWeights?: Record<string, number> | null
  ): Promise<{ scoring_result: number; scoring_exact: number; scoring_weights: Record<string, number> | null }> {
    const { data, error } = await supabase.rpc('update_bolao_scoring', {
      p_bolao_id: bolaoId,
      p_preset: preset,
      p_scoring_result: scoringResult,
      p_scoring_exact: scoringExact,
      p_scoring_weights: scoringWeights ?? null,
    });
    if (error) throw error;
    const result = data as {
      success: boolean;
      scoring_result: number;
      scoring_exact: number;
      scoring_weights: Record<string, number> | null;
      error?: string;
    };
    if (!result.success) throw new Error(result.error || 'Erro ao atualizar pontuação');
    return {
      scoring_result: result.scoring_result,
      scoring_exact: result.scoring_exact,
      scoring_weights: result.scoring_weights,
    };
  },

  // --- Stats + Round Rankings (Wave 3) ---

  async getBolaoStats(bolaoId: string): Promise<BolaoStats | null> {
    const { data, error } = await supabase.rpc('get_bolao_stats', {
      p_bolao_id: bolaoId,
    });
    if (error) throw error;
    return data as unknown as BolaoStats | null;
  },

  async getRoundRanking(bolaoId: string, stage?: string): Promise<BolaoRankingEntry[]> {
    const { data, error } = await supabase.rpc('get_bolao_round_ranking', {
      p_bolao_id: bolaoId,
      p_stage: stage,
    });
    if (error) throw error;
    return (data || []) as BolaoRankingEntry[];
  },

  // --- Personal stats (Onda 5 — "Você") ---

  async getMyBolaoPersonalStats(bolaoId: string): Promise<PersonalStats | null> {
    const { data, error } = await supabase.rpc('get_my_bolao_personal_stats', {
      p_bolao_id: bolaoId,
    });
    if (error) throw error;
    if (!data || (data as any).error) return null;
    return data as unknown as PersonalStats;
  },

  async getMyTeamHeatmap(bolaoId: string): Promise<TeamHeatmapEntry[]> {
    const { data, error } = await supabase.rpc('get_my_team_heatmap', {
      p_bolao_id: bolaoId,
    });
    if (error) throw error;
    return (data || []) as TeamHeatmapEntry[];
  },

  async getVersusStats(bolaoId: string, opponentUserId: string): Promise<VersusStats | null> {
    const { data, error } = await supabase.rpc('get_versus_stats', {
      p_bolao_id: bolaoId,
      p_opponent_user_id: opponentUserId,
    });
    if (error) throw error;
    if (!data || (data as any).error) return null;
    return data as unknown as VersusStats;
  },

  async uploadBolaoLogo(bolaoId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${bolaoId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('bolao-logos')
      .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('bolao-logos').getPublicUrl(path);
    return data.publicUrl;
  },

  async updateBolaoTheme(
    bolaoId: string,
    color?: string,
    logoUrl?: string
  ): Promise<void> {
    const { data, error } = await supabase.rpc('update_bolao_theme', {
      p_bolao_id: bolaoId,
      p_color: color,
      p_logo_url: logoUrl,
    });
    if (error) throw error;
    const result = data as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error || 'Erro ao atualizar tema');
  },

  async updateBolaoSettings(
    bolaoId: string,
    settings: {
      name?: string;
      description?: string | null;
      champion_enabled?: boolean;
      knockout_real_predictions_enabled?: boolean;
      kickoff_notify_telegram?: boolean;
      special_predictions_enabled?: boolean;
      special_predictions_config?: Record<string, boolean>;
      special_predictions_points?: Record<string, number>;
      champion_points?: number;
      player_awards_enabled?: Record<string, boolean>;
      player_award_points?: Record<string, number>;
      special_deadlines?: SpecialDeadlinesConfig | null;
    }
  ): Promise<void> {
    const { error } = await supabase
      .from('boloes')
      .update(settings as any)
      .eq('id', bolaoId);
    if (error) throw error;
  },
};
