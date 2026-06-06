import React, { useMemo, useState } from 'react';
import { Sparkles, Clock, BarChart3 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TeamFlag } from '@/components/bolao/TeamFlag';
import { ChampionHeroCard } from '@/components/bolao/ChampionHeroCard';
import { ChampionPickModal } from '@/components/bolao/ChampionPickModal';
import { SpecialPredictionsSection } from '@/components/bolao/SpecialPredictionsSection';
import { PlayerAwardsSection } from '@/components/bolao/PlayerAwardsSection';
import {
  useChampionPredictions,
  useUpsertChampionPrediction,
  useMySpecialPredictions,
  useToggleSpecialPrediction,
} from '@/hooks/use-bolao';
import { useToast } from '@/hooks/use-toast';
import type { WcMatch, ChampionPrediction, SpecialDeadlinesConfig } from '@/services/bolao.service';

interface SpecialPredictionsConfig {
  finalist?: boolean;
  semifinalist?: boolean;
  quarterfinalist?: boolean;
  round_of_16?: boolean;
  round_of_32?: boolean;
}

interface PointsConfig {
  finalist: number;
  semifinalist: number;
  quarterfinalist: number;
  round_of_16: number;
  round_of_32: number;
}

interface SpecialPredictionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bolaoId: string;
  bolaoName: string;
  matches: WcMatch[];
  isPremium: boolean;
  currentUserId: string | undefined;
  championEnabled: boolean;
  specialPredictionsEnabled: boolean;
  enabledTypes?: SpecialPredictionsConfig;
  championPoints: number;
  pointsConfig: PointsConfig;
  specialDeadlines?: SpecialDeadlinesConfig | null;
}

export const SpecialPredictionsModal: React.FC<SpecialPredictionsModalProps> = ({
  open,
  onOpenChange,
  bolaoId,
  bolaoName,
  matches,
  isPremium,
  currentUserId,
  championEnabled,
  specialPredictionsEnabled,
  enabledTypes,
  championPoints,
  pointsConfig,
  specialDeadlines,
}) => {
  const [championPickerOpen, setChampionPickerOpen] = useState(false);

  const { data: championPicks } = useChampionPredictions(bolaoId);
  const upsertChampion = useUpsertChampionPrediction();
  const { data: mySpecialPreds } = useMySpecialPredictions(bolaoId);
  const toggleSpecial = useToggleSpecialPrediction();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /**
   * Atualiza optimisticamente o cache de championPicks pro time escolhido,
   * garantindo que o Hero atualize na hora — sem precisar esperar o refetch.
   * Útil porque há janelas curtas em que invalidate→refetch toma alguns ms e
   * o user fica vendo "Escolher campeão" depois de salvar.
   */
  const optimisticChampion = (teamCode: string) => {
    if (!currentUserId) return;
    queryClient.setQueryData<ChampionPrediction[] | undefined>(
      ['champion-predictions', bolaoId],
      (old) => {
        const now = new Date().toISOString();
        const userName = old?.find((p) => p.user_id === currentUserId)?.user_name ?? '';
        const newPick: ChampionPrediction = {
          user_id: currentUserId,
          user_name: userName,
          predicted_team_code: teamCode,
          points_earned: null,
          created_at: now,
        };
        if (!old) return [newPick];
        return [...old.filter((p) => p.user_id !== currentUserId), newPick];
      }
    );
  };

  const myChampionPick = useMemo(
    () => championPicks?.find((p) => p.user_id === currentUserId)?.predicted_team_code ?? null,
    [championPicks, currentUserId]
  );

  const myPicksByType = useMemo(() => {
    const map: Record<'finalist' | 'semifinalist' | 'quarterfinalist' | 'round_of_16' | 'round_of_32', string[]> = {
      finalist: [],
      semifinalist: [],
      quarterfinalist: [],
      round_of_16: [],
      round_of_32: [],
    };
    for (const p of mySpecialPreds || []) {
      if (p.prediction_type in map && p.predicted_team_code) map[p.prediction_type as keyof typeof map].push(p.predicted_team_code);
    }
    return map;
  }, [mySpecialPreds]);

  const STAGE_MAX: Record<'finalist' | 'semifinalist' | 'quarterfinalist' | 'round_of_16' | 'round_of_32', number> = {
    finalist: 2,
    semifinalist: 4,
    quarterfinalist: 8,
    round_of_16: 16,
    round_of_32: 32,
  };

  /**
   * Quando user faz primeiro pick em qualquer fase e ainda não tem campeão,
   * assume esse time como palpite de campeão. User pode trocar pelo botão do
   * hero a qualquer momento.
   */
  const handleSuggestChampion = (teamCode: string) => {
    if (myChampionPick) return;
    optimisticChampion(teamCode);
    upsertChampion.mutate(
      { bolaoId, teamCode },
      {
        onSuccess: () => {
          toast({
            title: `${teamCode} virou seu palpite de campeão`,
            description: 'Foi seu primeiro pick. Pode trocar pelo botão "Trocar campeão" no card amber.',
          });
        },
        onError: () => {
          // Rollback optimistic update
          queryClient.invalidateQueries({ queryKey: ['champion-predictions', bolaoId] });
        },
      }
    );
  };

  /**
   * Salva campeão e cascateia: campeão passa por TODAS as fases (final, semi,
   * quarta, mata-mata 32). Auto-adiciona em cada fase se ainda não estiver e
   * houver vaga. Stages desabilitados na config são pulados. Picker fecha
   * imediatamente + optimistic update no cache pra Hero atualizar na hora.
   */
  const handleChampionConfirm = (teamCode: string) => {
    setChampionPickerOpen(false);
    optimisticChampion(teamCode);

    const cascadeOrder: ('finalist' | 'semifinalist' | 'quarterfinalist' | 'round_of_16' | 'round_of_32')[] = [
      'finalist',
      'semifinalist',
      'quarterfinalist',
      'round_of_16',
      'round_of_32',
    ];
    const cascadedStages: string[] = [];
    for (const stage of cascadeOrder) {
      if (enabledTypes?.[stage] === false) continue;
      const currentPicks = myPicksByType[stage] || [];
      if (!currentPicks.includes(teamCode) && currentPicks.length < STAGE_MAX[stage]) {
        toggleSpecial.mutate({ bolaoId, predictionType: stage, teamCode });
        cascadedStages.push(stage);
      }
    }

    upsertChampion.mutate(
      { bolaoId, teamCode },
      {
        onSuccess: () => {
          toast({
            title: 'Palpite de campeão salvo',
            description: cascadedStages.length > 0
              ? `${teamCode} passa por todas as fases até a final — adicionei automaticamente.`
              : teamCode,
          });
        },
        onError: (err: any) => {
          // Rollback optimistic update
          queryClient.invalidateQueries({ queryKey: ['champion-predictions', bolaoId] });
          toast({
            title: 'Erro ao salvar campeão',
            description: err?.message ?? 'Tente novamente',
            variant: 'destructive',
          });
        },
      }
    );
  };

  // Cálculo do bônus máximo possível (soma de todas as bonifications)
  const bonusBreakdown = useMemo(() => {
    const enabled = enabledTypes ?? {
      finalist: true,
      semifinalist: true,
      quarterfinalist: true,
      round_of_16: true,
      round_of_32: true,
    };
    const items: { label: string; pts: number }[] = [];
    if (championEnabled) items.push({ label: 'Campeão', pts: championPoints });
    if (specialPredictionsEnabled) {
      if (enabled.finalist !== false) items.push({ label: 'Finalistas (2)', pts: pointsConfig.finalist * 2 });
      if (enabled.semifinalist !== false) items.push({ label: 'Semis (4)', pts: pointsConfig.semifinalist * 4 });
      if (enabled.quarterfinalist !== false) items.push({ label: 'Quartas (8)', pts: pointsConfig.quarterfinalist * 8 });
      if (enabled.round_of_16 !== false) items.push({ label: 'Oitavas (16)', pts: (pointsConfig.round_of_16 ?? 2) * 16 });
      if (enabled.round_of_32 !== false) items.push({ label: '16 avos (32)', pts: (pointsConfig.round_of_32 ?? 1) * 32 });
    }
    const total = items.reduce((acc, i) => acc + i.pts, 0);
    return { items, total };
  }, [championEnabled, specialPredictionsEnabled, enabledTypes, championPoints, pointsConfig]);

  // Popularidade do campeão (top 6 times)
  const popularity = useMemo(() => {
    if (!championPicks || championPicks.length === 0) return null;
    const counts = new Map<string, number>();
    for (const p of championPicks) {
      counts.set(p.predicted_team_code, (counts.get(p.predicted_team_code) ?? 0) + 1);
    }
    const sorted = Array.from(counts.entries())
      .map(([code, count]) => ({ code, count, pct: Math.round((count / championPicks.length) * 100) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
    return { total: championPicks.length, top: sorted };
  }, [championPicks]);

  // Time names para popularidade
  const teamMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const match of matches) {
      if (match.home_team_code && match.home_team_code !== 'TBD') m.set(match.home_team_code, match.home_team);
      if (match.away_team_code && match.away_team_code !== 'TBD') m.set(match.away_team_code, match.away_team);
    }
    return m;
  }, [matches]);

  // Prazo até abertura da Copa (primeiro jogo)
  const deadline = useMemo(() => {
    if (!matches || matches.length === 0) return null;
    const firstMatch = matches
      .filter((m) => m.match_date && m.match_time_brasilia)
      .sort((a, b) =>
        a.match_date === b.match_date
          ? a.match_time_brasilia.localeCompare(b.match_time_brasilia)
          : a.match_date.localeCompare(b.match_date)
      )[0];
    if (!firstMatch) return null;
    const kickoff = new Date(`${firstMatch.match_date}T${firstMatch.match_time_brasilia}-03:00`);
    const diffMs = kickoff.getTime() - Date.now();
    if (diffMs < 0) return { passed: true, label: 'Copa iniciada', dateStr: formatBrDate(firstMatch.match_date) };
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const label = days > 0 ? `${days} dia${days !== 1 ? 's' : ''} ${hours}h` : `${hours} horas`;
    return { passed: false, label, dateStr: formatBrDate(firstMatch.match_date) };
  }, [matches]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="theme-bolao bg-canvas border border-line w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-5xl max-h-[92vh] overflow-hidden p-0 flex flex-col rounded-rebrand-xl">
          <DialogHeader className="px-5 sm:px-6 pt-5 pb-4 shrink-0 border-b border-line bg-white">
            <div className="flex items-start justify-between gap-3 pr-7">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3 mb-0.5">
                  {bolaoName}
                </p>
                <DialogTitle className="font-display text-[20px] sm:text-[22px] font-bold text-ink leading-tight">
                  Palpites especiais
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>

          {/* Conteúdo scrollable */}
          <div className="flex-1 overflow-y-auto minimal-scrollbar">
            <div className="px-5 sm:px-6 py-5 grid lg:grid-cols-[1fr_300px] gap-5">
              {/* Main column */}
              <div className="space-y-4 min-w-0">
                {championEnabled && (
                  <ChampionHeroCard
                    bolaoId={bolaoId}
                    matches={matches}
                    currentPick={myChampionPick}
                    championPoints={championPoints}
                    onOpenPicker={() => setChampionPickerOpen(true)}
                  />
                )}

                {specialPredictionsEnabled && (
                  <SpecialPredictionsSection
                    bolaoId={bolaoId}
                    isPremium={isPremium}
                    matches={matches}
                    currentUserId={currentUserId}
                    enabledTypes={enabledTypes}
                    pointsConfig={pointsConfig}
                    championPick={myChampionPick}
                    onSuggestChampion={championEnabled ? handleSuggestChampion : undefined}
                    specialDeadlines={specialDeadlines}
                  />
                )}

                {/* Palpites de jogador (artilheiro/goleiro/craque/revelação) */}
                <div>
                  <div className="flex items-center gap-2 mt-1 mb-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
                      Palpites de jogador
                    </h3>
                    <div className="flex-1 h-px bg-line" />
                  </div>
                  <PlayerAwardsSection
                    bolaoId={bolaoId}
                    enabled={playerAwardsEnabled}
                    pointsConfig={playerAwardPoints}
                  />
                </div>
              </div>

              {/* Sidebar — bônus, popularidade, prazo (sempre visível) */}
              <aside className="space-y-3 lg:order-last">
                  {/* Bônus máximo */}
                  <div className="rounded-rebrand-md border border-forest/30 bg-forest/[0.06] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest mb-2">
                      Bônus máximo possível
                    </p>
                    <p className="text-[28px] font-bold tracking-tight text-forest leading-none tabular-nums">
                      +{bonusBreakdown.total} pts
                    </p>
                    <p className="text-[11px] text-ink-2 mt-1.5 leading-snug">
                      Se acertar todos os palpites especiais.
                    </p>
                    <div className="mt-3 pt-3 border-t border-forest/20 grid grid-cols-2 gap-y-1.5 text-[11px]">
                      {bonusBreakdown.items.map((item) => (
                        <React.Fragment key={item.label}>
                          <span className="text-ink-2">{item.label}</span>
                          <span className="text-right font-semibold tabular-nums text-ink">
                            {item.pts} pts
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                    <p className="text-[10px] text-ink-3 mt-3 leading-snug border-t border-forest/20 pt-2">
                      Esses valores podem ser alterados pelo dono do bolão nas configurações.
                    </p>
                  </div>

                  {/* Popularidade */}
                  {popularity && popularity.total > 0 && (
                    <div className="rounded-rebrand-md border border-line bg-white p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <BarChart3 className="w-3.5 h-3.5 text-ink-2" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-2">
                          Quem o bolão tá apostando
                        </p>
                      </div>
                      <p className="text-[11px] text-ink-2 mb-3">
                        Para campeão · {popularity.total} voto{popularity.total !== 1 ? 's' : ''}
                      </p>
                      <ul className="space-y-2">
                        {popularity.top.map((t, i) => (
                          <li key={t.code} className="flex items-center gap-2.5">
                            <TeamFlag code={t.code} size="sm" />
                            <span className="font-mono font-bold text-[11px] text-ink w-9 shrink-0">
                              {t.code}
                            </span>
                            <div className="flex-1 h-1.5 rounded-full bg-canvas-2 overflow-hidden">
                              <div
                                className={`h-full ${i === 0 ? 'bg-amber' : 'bg-ink-3'}`}
                                style={{ width: `${Math.max(t.pct, 4)}%` }}
                              />
                            </div>
                            <span className="text-[11px] tabular-nums text-ink-2 font-medium w-9 text-right">
                              {t.pct}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Prazo */}
                  {deadline && (
                    <div className="rounded-rebrand-md border border-line bg-white p-4">
                      <div className="flex items-center gap-1.5 text-ink-2 mb-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-[12px] font-semibold">Primeiro prazo</span>
                      </div>
                      <p className="text-[14px] font-bold text-ink leading-tight">{deadline.label}</p>
                      <p className="text-[11px] text-ink-2 mt-0.5">
                        {deadline.passed ? 'Copa iniciada · ' : 'até a abertura da Copa · '}
                        {deadline.dateStr}
                      </p>
                      <p className="text-[10px] text-ink-3 mt-2 leading-snug border-t border-line pt-2">
                        Prêmios de jogador fecham na abertura. Cada fase do mata-mata fecha
                        no início da rodada que a decide — o prazo aparece em cada card.
                      </p>
                    </div>
                  )}
                </aside>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ChampionPickModal
        open={championPickerOpen}
        onOpenChange={setChampionPickerOpen}
        matches={matches}
        currentPick={myChampionPick}
        onConfirm={handleChampionConfirm}
        isLoading={upsertChampion.isPending}
        championPoints={championPoints}
      />
    </>
  );
};

function formatBrDate(iso: string): string {
  const [, mo, da] = iso.split('-');
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${parseInt(da, 10)}/${months[parseInt(mo, 10) - 1]}`;
}
