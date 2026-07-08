import React, { useState, useMemo, useEffect } from 'react';
import { usePostHog } from '@posthog/react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import AnalyticsNav from '@/components/AnalyticsNav';
import {
  Trophy,
  ArrowLeft,
  Users,
  Hash,
  ClipboardList,
  Share2,
  BarChart3,
  Download,
  Settings,
  Target,
  AlertCircle,
  LogOut,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useBolao,
  useBolaoRanking,
  useWcMatches,
  useBolaoPredictions,
  useChampionPredictions,
  useLeaveBolao,
  computeMatchDeadline,
} from '@/hooks/use-bolao';
import { BolaoRankingTable } from '@/components/bolao/BolaoRankingTable';
import { UserPredictionsModal } from '@/components/bolao/UserPredictionsModal';
import { BolaoShareButton } from '@/components/bolao/BolaoShareButton';
import { BolaoAdminPanel } from '@/components/bolao/BolaoAdminPanel';
import { SpecialPredictionsModal } from '@/components/bolao/SpecialPredictionsModal';
import { normalizeSpecialConfig } from '@/components/bolao/special-config';
import { PlayerAwardsModal } from '@/components/bolao/PlayerAwardsModal';
import { PredictionsModal } from '@/components/bolao/PredictionsModal';

import { BolaoStatsPanel } from '@/components/bolao/BolaoStatsPanel';
import { ShareCallout } from '@/components/bolao/ShareCallout';
import { PremiumWelcomeModal } from '@/components/bolao/PremiumWelcomeModal';
import { ConfirmDialog } from '@/components/bolao/ConfirmDialog';
import { useAchievement } from '@/components/bolao/AchievementProvider';
import { InsightsBanner } from '@/components/bolao/InsightsBanner';
import { BolaoEmptyState } from '@/components/bolao/BolaoEmptyState';
import { BolaoStatsTopCards } from '@/components/bolao/BolaoStatsTopCards';
import { BrandIcon } from '@/components/bolao/BrandIcon';
import { RankingShareImage } from '@/components/bolao/RankingShareImage';
import { RankingShareImageStories } from '@/components/bolao/RankingShareImageStories';
import { useRankingShareImage } from '@/components/bolao/useRankingShareImage';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { WcMatch, BolaoRankingEntry } from '@/services/bolao.service';

type Tab = 'ranking' | 'estatisticas';

// ── Theme accent colors ────────────────────────────────────────────
const THEME_ACCENT: Record<string, { badge: string; header: string }> = {
  blue:    { badge: 'bg-blue-900/20 border-blue-500/30',    header: 'border-blue-500/20'    },
  green:   { badge: 'bg-emerald-900/20 border-emerald-500/30', header: 'border-emerald-500/20' },
  gold:    { badge: 'bg-yellow-900/20 border-yellow-500/30', header: 'border-yellow-500/20'  },
  purple:  { badge: 'bg-purple-900/20 border-purple-500/30', header: 'border-purple-500/20'  },
  red:     { badge: 'bg-red-900/20 border-red-700/30',       header: 'border-red-700/20'     },
  cyan:    { badge: 'bg-cyan-900/20 border-cyan-500/30',     header: 'border-cyan-500/20'    },
  orange:  { badge: 'bg-orange-900/20 border-orange-500/30', header: 'border-orange-500/20'  },
};

// ── Ranking share image ────────────────────────────────────────────
// Ranking image generation moved to RankingShareImage component +
// useRankingShareImage hook (uses html2canvas, supports Web Share API
// + Clipboard API com fallback gracioso pra download).

// ── Component ──────────────────────────────────────────────────────
const BolaoDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const leaveBolao = useLeaveBolao();
  const { unlock } = useAchievement();

  const handleLeaveBolao = () => {
    if (!id) return;
    leaveBolao.mutate(id, {
      onSuccess: () => {
        toast({ title: 'Você saiu do bolão' });
        navigate('/bolao');
      },
      onError: (err: any) => {
        toast({ title: 'Erro ao sair', description: err?.message ?? 'Tente novamente', variant: 'destructive' });
      },
    });
  };
  const [activeTab, setActiveTab] = useState<Tab>('ranking');
  const posthog = usePostHog();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPremiumWelcome, setShowPremiumWelcome] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  // Webhook polling state: true = ?success=true detectado mas is_premium ainda false
  const [awaitingWebhook, setAwaitingWebhook] = useState(false);
  const [webhookTimedOut, setWebhookTimedOut] = useState(false);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id);
    });
  }, []);

  // Analytics: visualização do ranking do bolão. Marca "usuário ativo no bolão" — base da
  // coorte de migração para Betinho/Futebol no handoff de 19/jul (métrica E4 do plano).
  useEffect(() => {
    if (id && activeTab === 'ranking') {
      posthog?.capture('bolao_ranking_viewed', { bolao_id: id });
    }
  }, [id, activeTab, posthog]);

  const [predictionsModalOpen, setPredictionsModalOpen] = useState(false);
  const [specialPredictionsOpen, setSpecialPredictionsOpen] = useState(false);
  const [playerAwardsOpen, setPlayerAwardsOpen] = useState(false);
  const [selectedRankUser, setSelectedRankUser] = useState<BolaoRankingEntry | null>(null);

  // Auto-abre o modal de palpites quando vem com ?openPalpites=1
  // (usado pelo welcome screen do BolaoJoin pra continuar o fluxo
  // sem ir pra rota fixa /bolao/:id/palpites). Limpa o query param
  // logo apos abrir pra nao reabrir em refresh.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('openPalpites') === '1') {
      setPredictionsModalOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('openPalpites');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: bolao, isLoading: loadingBolao } = useBolao(id);
  const { data: ranking, isLoading: loadingRanking } = useBolaoRanking(id);
  const { data: matches } = useWcMatches();
  const { data: myPredictions } = useBolaoPredictions(id, currentUserId);
  const { data: championPredictions } = useChampionPredictions(id);

  // ── Handle query params: Stripe success + auto-open settings ──────
  // Two cases for ?success=true:
  //   1. Bolão already premium → open welcome modal once
  //   2. Webhook still pending → enter awaitingWebhook state, poll until premium
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('success') === 'true') {
      if (bolao && bolao.is_premium) {
        setShowPremiumWelcome(true);
        navigate(`/bolao/${id}`, { replace: true });
      } else if (bolao && !bolao.is_premium) {
        setAwaitingWebhook(true);
        // Don't strip ?success=true yet — keep polling until webhook fires
      }
    }
    if (params.get('settings') === 'true') {
      setShowAdmin(true);
      navigate(`/bolao/${id}`, { replace: true });
    }
  }, [location.search, id, navigate, bolao?.is_premium]); // eslint-disable-line react-hooks/exhaustive-deps

  // Webhook polling: while awaitingWebhook, refetch bolão every 4s up to 30s.
  useEffect(() => {
    if (!awaitingWebhook || !id) return;
    let attempts = 0;
    const MAX_ATTEMPTS = 8; // 8 × 4s = 32s window

    const tick = setInterval(() => {
      attempts++;
      // Force a refetch via React Query — the bolao prop will reflect new state
      queryClient.invalidateQueries({ queryKey: ['bolao', id] });
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(tick);
        setWebhookTimedOut(true);
      }
    }, 4000);
    return () => clearInterval(tick);
  }, [awaitingWebhook, id, queryClient]);

  // When premium flips to true while awaiting → open welcome modal, clean URL.
  useEffect(() => {
    if (awaitingWebhook && bolao?.is_premium) {
      setAwaitingWebhook(false);
      setWebhookTimedOut(false);
      setShowPremiumWelcome(true);
      navigate(`/bolao/${id}`, { replace: true });
    }
  }, [awaitingWebhook, bolao?.is_premium, id, navigate]);

  const myChampionPick = useMemo(
    () => championPredictions?.find((p) => p.user_id === currentUserId) ?? null,
    [championPredictions, currentUserId]
  );

  // Achievement: usuário escolheu campeão (uma vez)
  useEffect(() => {
    if (id && myChampionPick) unlock('champion-picked', id);
  }, [id, myChampionPick, unlock]);

  // Achievement: usuário entrou no top 3 (uma vez)
  useEffect(() => {
    if (!id || !ranking || !currentUserId) return;
    const me = ranking.find(r => r.user_id === currentUserId);
    if (!me) return;
    // Só conta pódio quando há concorrência (>=3 membros) e o user está em rank 1-3
    if (ranking.length >= 3 && me.rank <= 3 && me.total_points > 0) {
      unlock('reached-podium', id);
    }
  }, [id, ranking, currentUserId, unlock]);

  // Achievement: usuário cravou primeiro placar exato (uma vez)
  // points_earned == scoring_exact significa placar exato (resto é 0 ou scoring_result)
  useEffect(() => {
    if (!id || !myPredictions || !bolao) return;
    const exactScoreHit = myPredictions.some(
      p => p.points_earned != null && p.points_earned >= bolao.scoring_exact
    );
    if (exactScoreHit) unlock('first-exact-score', id);
  }, [id, myPredictions, bolao, unlock]);

  // Achievement: completou todos os palpites da fase de grupos
  useEffect(() => {
    if (!id || !matches || !myPredictions) return;
    const groupMatches = matches.filter(m => m.stage === 'group' && m.home_team_code !== 'TBD');
    if (groupMatches.length === 0) return;
    const palpitatedGroupIds = new Set(
      myPredictions
        .filter(p => groupMatches.some(g => g.id === p.match_id))
        .map(p => p.match_id)
    );
    if (palpitatedGroupIds.size >= groupMatches.length) {
      unlock('all-group-stage-done', id);
    }
  }, [id, matches, myPredictions, unlock]);

  const totalAvailableMatches = useMemo(
    () => matches?.filter(m => !m.is_finished && m.home_team_code !== 'TBD').length ?? 0,
    [matches]
  );

  const predictionsByMatch = useMemo(
    () => new Map((myPredictions || []).map((p) => [p.match_id, p])),
    [myPredictions]
  );



  const matchesByStage = useMemo(
    () =>
      (matches || []).reduce<Record<string, WcMatch[]>>((acc, m) => {
        const key = m.group_name ? `Grupo ${m.group_name}` : m.stage;
        if (!acc[key]) acc[key] = [];
        acc[key].push(m);
        return acc;
      }, {}),
    [matches]
  );

  const showOnboarding = useMemo(
    () =>
      bolao != null &&
      (ranking?.length ?? 0) <= 1 &&
      (myPredictions?.length ?? 0) === 0,
    [bolao, ranking, myPredictions]
  );

  // ── Ranking share: imagens — feed (1080×1080) e stories (1080×1920) ────
  // O hook expõe `share` (sheet native com imagem + texto + link) e
  // `download` (salva o PNG direto, sem share sheet).
  // URL do bolão = link direto, não o convite/entrar — bolão já está rolando,
  // a galera vai "acompanhar" o andamento (não "disputar" do zero).
  const bolaoShareUrl = bolao
    ? `${window.location.origin}/bolao/${bolao.id}`
    : undefined;

  // Modo da imagem de ranking compartilhada: Top 5 (pódio) ou Todos (geral).
  const [shareMode, setShareMode] = useState<'top5' | 'all'>('top5');

  const rankingShareFeed = useRankingShareImage({
    bolaoName: bolao?.name ?? 'Bolão',
    filenameSlug: bolao?.invite_code,
    variant: 'feed',
    bolaoUrl: bolaoShareUrl,
  });
  const rankingShareStories = useRankingShareImage({
    bolaoName: bolao?.name ?? 'Bolão',
    filenameSlug: bolao?.invite_code,
    variant: 'stories',
    bolaoUrl: bolaoShareUrl,
  });

  const showShareResultToast = (result: Awaited<ReturnType<typeof rankingShareFeed.share>>) => {
    if (result.method === 'native-share') {
      // Sheet abriu — user escolheu app
    } else if (result.method === 'download') {
      toast({
        title: 'Imagem salva!',
        description: 'Arraste no chat do WhatsApp ou anexe na conversa',
      });
    } else if (result.error && result.error !== 'Cancelado') {
      toast({ title: 'Erro ao gerar imagem', description: result.error, variant: 'destructive' });
    }
  };

  // WhatsApp: mobile usa Web Share API (sheet nativo com WhatsApp);
  // desktop baixa imagem + abre WhatsApp Web. Ver shareImageToWhatsApp().
  const handleShareRanking = async () => {
    showShareResultToast(await rankingShareFeed.shareToWhatsApp());
  };

  // Stories: compartilha imagem 1080×1920 via share sheet
  const handleShareRankingStories = async () => {
    showShareResultToast(await rankingShareStories.share());
  };

  // Baixar: download direto da imagem feed (sem share sheet)
  const handleDownloadRankingImage = async () => {
    showShareResultToast(await rankingShareFeed.download());
  };

  // Theme accent
  const accent = bolao?.custom_color ? THEME_ACCENT[bolao.custom_color] : null;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'ranking',      label: 'Ranking',      icon: <Trophy className="w-4 h-4" /> },
    { key: 'estatisticas', label: 'Estatísticas',  icon: <BarChart3 className="w-4 h-4" /> },
  ];

  if (loadingBolao) {
    return (
      <div className="theme-bolao min-h-screen bg-canvas flex items-center justify-center">
        <div className="animate-pulse text-ink-2 text-[14px]">Carregando...</div>
      </div>
    );
  }

  if (!bolao) {
    return (
      <div className="theme-bolao min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center">
          <p className="text-[16px] text-ink mb-4">Bolão não encontrado</p>
          <Button variant="ghost" onClick={() => navigate('/bolao')} className="text-ink-2 hover:text-ink hover:bg-canvas-2">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  // ── Tela A: estado vazio (poucos jogadores) — rebrand "Direção A" ──
  // Threshold pra teste = 1 (só user). Em produção depois ajustamos pra < 4.
  // Renderiza a Tela A em vez do hub completo quando o bolão ainda não tem
  // massa crítica de gente — foca em CONVIDAR + COMEÇAR A PALPITAR.
  // Prêmios de jogador habilitados? (null = todos ligados por padrão).
  // Definido aqui (antes do early-return da Tela A) pra ambos os branches usarem.
  const playerAwardsAnyEnabled =
    !bolao.player_awards_enabled || Object.values(bolao.player_awards_enabled).some(Boolean);

  const memberCountForGate = ranking?.length ?? 1;
  if (memberCountForGate < 2 && !bolao.is_closed) {
    return (
      <>
        <AnalyticsNav variant="rebrand" />
        <BolaoEmptyState
          bolao={bolao}
          matches={matches}
          predictions={myPredictions}
          ranking={ranking}
          memberCount={memberCountForGate}
          currentUserId={currentUserId}
          onBack={() => navigate('/bolao')}
          onPalpitar={() => setPredictionsModalOpen(true)}
          onQuickPick={() => setPredictionsModalOpen(true)}
          onConfigurar={() => setShowAdmin(true)}
          /* onChampionPick removido — Campeão entrou no SpecialPredictionsModal.
             Aba "Especiais" no header do EmptyState aciona o mesmo modal. */
          onSpecialPicks={() => setSpecialPredictionsOpen(true)}
          onPlayerPicks={playerAwardsAnyEnabled ? () => setPlayerAwardsOpen(true) : undefined}
        />

        {/* Modais — mesmas instâncias do hub completo, evitando dupla
            renderização. Usam a interface real de cada componente. */}
        {currentUserId && (
          <PredictionsModal
            open={predictionsModalOpen}
            onOpenChange={setPredictionsModalOpen}
            bolaoId={bolao.id}
            currentUserId={currentUserId}
          />
        )}

        <SpecialPredictionsModal
          open={specialPredictionsOpen}
          onOpenChange={setSpecialPredictionsOpen}
          bolaoId={bolao.id}
          bolaoName={bolao.name}
          matches={matches || []}
          isPremium={bolao.is_premium}
          currentUserId={currentUserId}
          championEnabled={bolao.champion_enabled ?? true}
          specialPredictionsEnabled={bolao.special_predictions_enabled ?? true}
          enabledTypes={normalizeSpecialConfig(bolao.special_predictions_config)}
          championPoints={bolao.champion_points ?? 25}
          pointsConfig={bolao.special_predictions_points ?? { finalist: 10, semifinalist: 5, quarterfinalist: 3, round_of_16: 2, round_of_32: 1 }}
          specialDeadlines={bolao.special_deadlines ?? null}
          knockoutRealMode={bolao.knockout_real_predictions_enabled ?? false}
        />

        {playerAwardsAnyEnabled && (
          <PlayerAwardsModal
            open={playerAwardsOpen}
            onOpenChange={setPlayerAwardsOpen}
            bolaoId={bolao.id}
            bolaoName={bolao.name}
            matches={matches || []}
            playerAwardsEnabled={bolao.player_awards_enabled ?? undefined}
            playerAwardPoints={bolao.player_award_points ?? undefined}
            specialDeadlines={bolao.special_deadlines ?? null}
          />
        )}

        {currentUserId && (
          <BolaoAdminPanel
            open={showAdmin}
            onOpenChange={setShowAdmin}
            bolaoId={bolao.id}
            bolaoName={bolao.name}
            bolaoDescription={bolao.description}
            isClosed={bolao.is_closed}
            isPremium={bolao.is_premium}
            scoringPreset={bolao.scoring_preset ?? null}
            scoringResult={bolao.scoring_result}
            scoringExact={bolao.scoring_exact}
            scoringWeights={bolao.scoring_weights ?? null}
            predictionDeadlineMode={bolao.prediction_deadline_mode ?? 'per_match'}
            matches={matches}
            specialDeadlines={bolao.special_deadlines ?? null}
            customBannerUrl={bolao.custom_banner_url ?? null}
            championEnabled={bolao.champion_enabled ?? true}
            knockoutRealEnabled={bolao.knockout_real_predictions_enabled ?? false}
            kickoffNotifyTelegram={bolao.kickoff_notify_telegram ?? false}
            specialPredictionsEnabled={bolao.special_predictions_enabled ?? true}
            specialPredictionsConfig={normalizeSpecialConfig(bolao.special_predictions_config)}
            specialPredictionsPoints={bolao.special_predictions_points ?? { finalist: 10, semifinalist: 5, quarterfinalist: 3, round_of_16: 2, round_of_32: 1 }}
            championPoints={bolao.champion_points ?? 10}
            playerAwardsEnabled={bolao.player_awards_enabled ?? undefined}
            playerAwardPoints={bolao.player_award_points ?? undefined}
            ranking={ranking || []}
            currentUserId={currentUserId}
            ownerUserId={bolao.owner_id}
          />
        )}
      </>
    );
  }

  // ── Sidebar content (rebrand "Direção A" — light theme) ──
  // Card unificado: Campeão entrou pra dentro do modal de Especiais, então a
  // sidebar mostra só o resumo "Campeão, Finalistas, Semis..." e abre o modal.
  const championOrSpecialEnabled =
    (bolao.champion_enabled ?? true) || (bolao.special_predictions_enabled ?? true);

  const sidebarContent = (
    <>
      {championOrSpecialEnabled && (
        <div className="bg-white border border-line rounded-rebrand-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-rebrand-md bg-amber/10 border border-amber/30 flex items-center justify-center text-amber-2 shrink-0">
                <Trophy className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-2">
                  Palpites Especiais
                </p>
                <p className="text-[12px] text-ink mt-0.5 truncate">
                  {(() => {
                    const labels: string[] = [];
                    if (bolao.champion_enabled ?? true) labels.push('Campeão');
                    if (bolao.knockout_real_predictions_enabled) {
                      labels.push('Mata-mata (jogo real)');
                    } else {
                      const cfg = normalizeSpecialConfig(bolao.special_predictions_config);
                      if (bolao.special_predictions_enabled ?? true) {
                        if (cfg.finalist) labels.push('Finalistas');
                        if (cfg.semifinalist) labels.push('Semis');
                        if (cfg.quarterfinalist) labels.push('Quartas');
                        if (cfg.round_of_16) labels.push('Oitavas');
                        if (cfg.round_of_32) labels.push('16 avos');
                      }
                    }
                    return labels.join(', ') || 'Nenhum habilitado';
                  })()}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSpecialPredictionsOpen(true)}
              className="text-[11px] font-semibold text-amber-2 hover:bg-amber/10 shrink-0 border border-amber/40 rounded-rebrand-sm px-2.5 py-1 transition-colors"
            >
              {myChampionPick ? 'Ver palpites →' : 'Palpitar →'}
            </button>
          </div>
        </div>
      )}

      {playerAwardsAnyEnabled && (
        <div className="bg-white border border-line rounded-rebrand-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-9 h-9 rounded-rebrand-md bg-amber/10 border border-amber/30 flex items-center justify-center text-amber-2 shrink-0">
                <Star className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-2">
                  Palpites de Jogador
                </p>
                <p className="text-[12px] text-ink mt-0.5 truncate">
                  Artilheiro, Craque, Goleiro, Revelação
                </p>
              </div>
            </div>
            <button
              onClick={() => setPlayerAwardsOpen(true)}
              className="text-[11px] font-semibold text-amber-2 hover:bg-amber/10 shrink-0 border border-amber/40 rounded-rebrand-sm px-2.5 py-1 transition-colors"
            >
              Palpitar →
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="bg-canvas flex-1">
      <AnalyticsNav variant="rebrand" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header (rebrand "Direção A") ── */}
        <div className="flex items-start gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate('/bolao')}
            aria-label="Voltar"
            className="w-9 h-9 rounded-rebrand-md hover:bg-canvas-2 text-ink-2 flex items-center justify-center transition-colors shrink-0 mt-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {bolao.custom_banner_url && (
            <div className="w-16 h-16 rounded-rebrand-md border border-line bg-canvas-2 p-1.5 shrink-0 mt-0.5 flex items-center justify-center overflow-hidden">
              <img
                src={bolao.custom_banner_url}
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-ink-2">
                Bolão Copa 2026
              </span>
              {bolao.is_premium && (
                <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber/15 text-amber-2 border border-amber/30">
                  PREMIUM
                </span>
              )}
            </div>
            <h1 className="font-display text-[32px] sm:text-[40px] font-extrabold leading-tight text-ink truncate">
              {bolao.name}
            </h1>
            {bolao.description && (
              <p className="text-[13px] text-ink-2 mt-1 truncate">{bolao.description}</p>
            )}

            {/* Info bar combinada */}
            <div className="flex items-center gap-3 mt-2 text-[12px] text-ink-2 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Users className="w-3 h-3" />
                {ranking?.length || 0} jogador{(ranking?.length ?? 0) !== 1 ? 'es' : ''}
              </span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(bolao.invite_code);
                    toast({ title: 'Código copiado', description: bolao.invite_code });
                  } catch {
                    toast({ title: 'Erro ao copiar', variant: 'destructive' });
                  }
                }}
                aria-label={`Copiar código de convite ${bolao.invite_code}`}
                title="Clique para copiar"
                className="inline-flex items-center gap-1 hover:text-forest transition-colors cursor-pointer"
              >
                <Hash className="w-3 h-3 text-ink-3" />
                <span className="font-mono">{bolao.invite_code}</span>
              </button>
              <span>
                Pontuação:{' '}
                <span className="text-ink">
                  {bolao.scoring_result}pt resultado · {bolao.scoring_exact}pt placar exato
                </span>
                {bolao.scoring_preset === 'weighted_stages' && (
                  <span className="ml-1 text-forest font-medium">· ×fase</span>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <BolaoShareButton
              bolaoName={bolao.name}
              inviteCode={bolao.invite_code}
              variant="compact"
            />
            {currentUserId && (
              <>
                {/* Configuracoes: owner edita, membro ve em read-only */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdmin(true)}
                  aria-label="Abrir configurações do bolão"
                  className="rounded-rebrand-md gap-1.5 bg-white border border-line text-ink-2 hover:bg-canvas-2 hover:text-ink"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Configurações</span>
                </Button>
                {/* Sair so aparece pra membro (nao-dono) */}
                {currentUserId !== bolao.owner_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmLeaveOpen(true)}
                    aria-label="Sair do bolão"
                    className="rounded-rebrand-md gap-1.5 text-ink-2 hover:text-status-danger hover:bg-status-danger/10"
                    title="Sair do bolão"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Sair</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── 9.2 Cards de stats topo (rebrand): SEUS PALPITES + PRÓXIMO PRAZO ──
            Substitui DeadlineBadge + banner urgência.
            Encerrar inscricoes nao para os palpites — quem ja entrou continua
            palpitando ate o prazo de cada jogo. Por isso o card aparece
            independente de is_closed. */}
        <BolaoStatsTopCards
          bolao={bolao}
          matches={matches}
          predictions={myPredictions}
          onContinuarPalpites={() => setPredictionsModalOpen(true)}
          onSpecialPicks={() => setSpecialPredictionsOpen(true)}
          onPlayerPicks={playerAwardsAnyEnabled ? () => setPlayerAwardsOpen(true) : undefined}
        />

        {/* ── Sidebar mobile (logo após stats topo, lg:hidden pra desktop) ── */}
        <div className="lg:hidden space-y-4 mb-5">
          {sidebarContent}
        </div>

        {/* ── Insights pós-jogo ── */}
        {id && currentUserId && <InsightsBanner bolaoId={id} />}

        {/* ── Share callout: aparece quando bolão tem ≤ 1 membro ── */}
        {ranking && ranking.length <= 1 && !bolao.is_closed && (
          <ShareCallout
            bolaoId={bolao.id}
            bolaoName={bolao.name}
            inviteCode={bolao.invite_code}
          />
        )}

        {/* ── Onboarding "Faça palpites" (só pra quem ainda não palpitou) ── */}
        {showOnboarding && (myPredictions?.length ?? 0) === 0 && (
          <div className="bg-white border border-line rounded-rebrand-md p-4 mb-5">
            <div className="flex items-start gap-3">
              <div className="bg-forest/10 border border-forest/30 rounded-full w-9 h-9 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 text-forest" />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-ink">Faça seus palpites</p>
                <p className="text-[12px] text-ink-2 mt-0.5">
                  Palpite nos 104 jogos antes de cada partida começar
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── 2-column grid (desktop) / single column (mobile) ── */}
        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-6">

          {/* ── Main content ── */}
          <div className="min-w-0">
            {/* Tabs (rebrand: forest underline + Inter) */}
            <div role="tablist" aria-label="Seções do bolão" className="flex gap-1 mb-6 border-b border-line">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`bolao-tab-panel-${tab.key}`}
                    id={`bolao-tab-${tab.key}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 h-11 text-[12px] font-semibold transition-colors border-b-2 -mb-px focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 ${
                      isActive
                        ? 'border-forest text-forest'
                        : 'border-transparent text-ink-2 hover:text-ink'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab: Ranking */}
            {activeTab === 'ranking' && (
              <div role="tabpanel" id="bolao-tab-panel-ranking" aria-labelledby="bolao-tab-ranking">
                {ranking && ranking.length > 1 && (
                  <div className="flex items-center justify-end gap-3 mb-3 flex-wrap text-[12px] text-ink-2">
                    <div className="inline-flex items-center rounded-rebrand-sm border border-line overflow-hidden mr-1" role="group" aria-label="Conteúdo da imagem">
                      <button
                        onClick={() => setShareMode('top5')}
                        className={`px-2.5 py-1 font-semibold transition-colors ${shareMode === 'top5' ? 'bg-forest text-white' : 'text-ink-2 hover:bg-canvas-2'}`}
                      >
                        Top 5
                      </button>
                      <button
                        onClick={() => setShareMode('all')}
                        className={`px-2.5 py-1 font-semibold transition-colors ${shareMode === 'all' ? 'bg-forest text-white' : 'text-ink-2 hover:bg-canvas-2'}`}
                      >
                        Todos
                      </button>
                    </div>
                    <span className="text-ink-3">Compartilhar:</span>
                    <button
                      onClick={handleShareRanking}
                      aria-label="Compartilhar ranking via WhatsApp (imagem + link)"
                      className="inline-flex items-center gap-1.5 hover:text-forest transition-colors"
                    >
                      <BrandIcon brand="whatsapp" className="w-3.5 h-3.5" />
                      WhatsApp
                    </button>
                    <button
                      onClick={handleShareRankingStories}
                      aria-label="Compartilhar ranking nos Stories (formato vertical)"
                      className="inline-flex items-center gap-1.5 hover:text-forest transition-colors"
                    >
                      <BrandIcon brand="instagram" className="w-3.5 h-3.5" />
                      Stories
                    </button>
                    <button
                      onClick={handleDownloadRankingImage}
                      aria-label="Baixar imagem do ranking"
                      className="inline-flex items-center gap-1.5 hover:text-forest transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar
                    </button>
                  </div>
                )}
                {loadingRanking && !ranking ? (
                  <div className="space-y-1.5">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-14 rounded-rebrand-md bg-canvas-2 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <BolaoRankingTable
                    ranking={ranking || []}
                    currentUserId={currentUserId}
                    onInviteFriends={() => {
                      // Scroll to top so user sees the ShareCallout (rendered at the top
                      // when ranking.length <= 1).
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onSelectUser={(entry) => setSelectedRankUser(entry)}
                  />
                )}
              </div>
            )}

            {/* Tab: Meus Palpites */}
            {/* Tab: Estatísticas */}
            {activeTab === 'estatisticas' && (
              <div role="tabpanel" id="bolao-tab-panel-estatisticas" aria-labelledby="bolao-tab-estatisticas">
                <BolaoStatsPanel
                  bolaoId={bolao.id}
                  currentUserId={currentUserId}
                />
              </div>
            )}
          </div>

          {/* ── Sidebar desktop (mobile renderiza essa mesma `sidebarContent`
              acima dos insights) ── */}
          <aside className="hidden lg:block lg:space-y-4 lg:sticky lg:top-6 lg:self-start">
            {sidebarContent}
          </aside>
        </div>
      </div>

      {/* Special Predictions modal (engloba Hero do Campeão + brackets) */}
      <SpecialPredictionsModal
        open={specialPredictionsOpen}
        onOpenChange={setSpecialPredictionsOpen}
        bolaoId={bolao.id}
        bolaoName={bolao.name}
        matches={matches || []}
        isPremium={bolao.is_premium}
        currentUserId={currentUserId}
        championEnabled={bolao.champion_enabled ?? true}
        specialPredictionsEnabled={bolao.special_predictions_enabled ?? true}
        enabledTypes={normalizeSpecialConfig(bolao.special_predictions_config)}
        championPoints={bolao.champion_points ?? 25}
        pointsConfig={bolao.special_predictions_points ?? { finalist: 10, semifinalist: 5, quarterfinalist: 3, round_of_16: 2, round_of_32: 1 }}
        specialDeadlines={bolao.special_deadlines ?? null}
        knockoutRealMode={bolao.knockout_real_predictions_enabled ?? false}
      />

      {playerAwardsAnyEnabled && (
        <PlayerAwardsModal
          open={playerAwardsOpen}
          onOpenChange={setPlayerAwardsOpen}
          bolaoId={bolao.id}
          bolaoName={bolao.name}
          matches={matches || []}
          playerAwardsEnabled={bolao.player_awards_enabled ?? undefined}
          playerAwardPoints={bolao.player_award_points ?? undefined}
          specialDeadlines={bolao.special_deadlines ?? null}
        />
      )}

      {/* Predictions modal */}
      <PredictionsModal
        open={predictionsModalOpen}
        onOpenChange={setPredictionsModalOpen}
        bolaoId={bolao.id}
        currentUserId={currentUserId}
      />

      {/* Settings modal */}
      {currentUserId && (
        <BolaoAdminPanel
          open={showAdmin}
          onOpenChange={setShowAdmin}
          bolaoId={bolao.id}
          bolaoName={bolao.name}
          bolaoDescription={bolao.description}
          isClosed={bolao.is_closed}
          isPremium={bolao.is_premium}
          scoringPreset={bolao.scoring_preset ?? null}
          scoringResult={bolao.scoring_result}
          scoringExact={bolao.scoring_exact}
          scoringWeights={bolao.scoring_weights ?? null}
          predictionDeadlineMode={bolao.prediction_deadline_mode ?? 'per_match'}
          matches={matches}
          specialDeadlines={bolao.special_deadlines ?? null}
          customBannerUrl={bolao.custom_banner_url ?? null}
          championEnabled={bolao.champion_enabled ?? true}
          knockoutRealEnabled={bolao.knockout_real_predictions_enabled ?? false}
          specialPredictionsEnabled={bolao.special_predictions_enabled ?? true}
          specialPredictionsConfig={normalizeSpecialConfig(bolao.special_predictions_config)}
          specialPredictionsPoints={bolao.special_predictions_points ?? { finalist: 10, semifinalist: 5, quarterfinalist: 3, round_of_16: 2, round_of_32: 1 }}
          championPoints={bolao.champion_points ?? 10}
          playerAwardsEnabled={bolao.player_awards_enabled ?? undefined}
          playerAwardPoints={bolao.player_award_points ?? undefined}
          ranking={ranking || []}
          currentUserId={currentUserId}
          ownerUserId={bolao.owner_id}
        />
      )}

      {/* User predictions modal — abre quando user clica numa linha do ranking */}
      <UserPredictionsModal
        open={selectedRankUser !== null}
        onOpenChange={(o) => !o && setSelectedRankUser(null)}
        bolaoId={bolao.id}
        user={selectedRankUser}
        isCurrentUser={selectedRankUser?.user_id === currentUserId}
        playerAwardsEnabled={bolao.player_awards_enabled ?? null}
      />

      {/* Premium welcome modal — shown once after successful payment */}
      <PremiumWelcomeModal
        open={showPremiumWelcome}
        onOpenChange={setShowPremiumWelcome}
        onShare={() => {
          setShowPremiumWelcome(false);
          // Scroll to ShareCallout (sticky atop). If no callout (already 2+ members),
          // scroll to top so user can use the header share button.
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onConfigure={() => {
          setShowPremiumWelcome(false);
          setShowAdmin(true);
        }}
      />

      {/* Webhook awaiting overlay — paid but is_premium not yet flipped */}
      {awaitingWebhook && !bolao.is_premium && (
        <div
          className="theme-bolao fixed inset-0 z-[200] bg-ink/70 backdrop-blur-sm flex items-center justify-center p-6"
          role="alert"
          aria-live="assertive"
        >
          <div className="bg-canvas border border-amber/50 shadow-lg rounded-rebrand-xl p-6 max-w-sm text-center">
            {webhookTimedOut ? (
              <>
                <p className="text-[16px] font-bold text-amber-2 mb-2">
                  Pagamento sendo processado
                </p>
                <p className="text-[13px] text-ink-2 mb-4 leading-relaxed">
                  A confirmação está demorando mais do que o normal.
                  Você receberá um email assim que for ativado, normalmente em poucos minutos.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAwaitingWebhook(false);
                    setWebhookTimedOut(false);
                    navigate(`/bolao/${id}`, { replace: true });
                  }}
                  className="w-full h-11 rounded-rebrand-md bg-forest hover:bg-forest-2 text-white text-[13px] font-bold transition-colors"
                >
                  Continuar usando o bolão
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 mx-auto mb-4 border-[3px] border-amber/30 border-t-amber rounded-full animate-spin" />
                <p className="text-[16px] font-bold text-amber-2 mb-1">
                  Confirmando pagamento...
                </p>
                <p className="text-[12px] text-ink-2">
                  Aguarde até 30 segundos para a Stripe confirmar.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Sair do bolão (apenas não-owner) ── */}
      <ConfirmDialog
        open={confirmLeaveOpen}
        onOpenChange={setConfirmLeaveOpen}
        title="Sair do bolão?"
        description={
          <>
            <p className="mb-2">
              Você não vai mais aparecer no ranking de <strong>{bolao.name}</strong>.
            </p>
            <p className="text-xs opacity-70">
              Seus palpites já feitos serão removidos. Pra voltar, precisa do código de convite novamente.
            </p>
          </>
        }
        confirmLabel="Sair do bolão"
        variant="destructive"
        onConfirm={() => {
          handleLeaveBolao();
          setConfirmLeaveOpen(false);
        }}
        isLoading={leaveBolao.isPending}
      />

      {/* ── Off-screen render dos cards de ranking pra captura via html2canvas ── */}
      {ranking && bolao && (
        <>
          <RankingShareImage
            ref={rankingShareFeed.captureRef}
            bolaoName={bolao.name}
            inviteCode={bolao.invite_code}
            ranking={ranking}
            currentUserId={currentUserId}
            myChampionPick={myChampionPick}
            mode={shareMode}
          />
          <RankingShareImageStories
            ref={rankingShareStories.captureRef}
            bolaoName={bolao.name}
            inviteCode={bolao.invite_code}
            ranking={ranking}
            currentUserId={currentUserId}
            myChampionPick={myChampionPick}
          />
        </>
      )}
    </div>
  );
};

export default BolaoDetail;
