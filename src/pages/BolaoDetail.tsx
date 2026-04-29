import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  Image,
  Settings,
  Target,
  AlertCircle,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  useBolao,
  useBolaoRanking,
  useWcMatches,
  useBolaoPredictions,
  useChampionPredictions,
  useUpsertChampionPrediction,
  useLeaveBolao,
  computeMatchDeadline,
} from '@/hooks/use-bolao';
import { BolaoRankingTable } from '@/components/bolao/BolaoRankingTable';
import { BolaoShareButton } from '@/components/bolao/BolaoShareButton';
import { ChampionPickModal } from '@/components/bolao/ChampionPickModal';
import { BolaoAdminPanel } from '@/components/bolao/BolaoAdminPanel';
import { SpecialPredictionsSection } from '@/components/bolao/SpecialPredictionsSection';
import { PredictionsModal } from '@/components/bolao/PredictionsModal';

import { BolaoStatsPanel } from '@/components/bolao/BolaoStatsPanel';
import { DeadlineBadge } from '@/components/bolao/DeadlineBadge';
import { ShareCallout } from '@/components/bolao/ShareCallout';
import { PremiumWelcomeModal } from '@/components/bolao/PremiumWelcomeModal';
import { BolaoBottomNav } from '@/components/bolao/BolaoBottomNav';
import { ConfirmDialog } from '@/components/bolao/ConfirmDialog';
import { useAchievement } from '@/components/bolao/AchievementProvider';
import { InsightsBanner } from '@/components/bolao/InsightsBanner';
import { RankingShareImage } from '@/components/bolao/RankingShareImage';
import { RankingShareImageStories } from '@/components/bolao/RankingShareImageStories';
import { useRankingShareImage } from '@/components/bolao/useRankingShareImage';
import { shareTextOrLink, SHARE_MESSAGES } from '@/components/bolao/share-utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { WcMatch, BolaoRankingEntry } from '@/services/bolao.service';

type Tab = 'ranking' | 'meus-palpites' | 'estatisticas';

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

// ── Ranking share text ─────────────────────────────────────────────
function buildRankingText(
  bolaoName: string,
  ranking: { user_name: string; user_email: string; total_points: number; rank: number }[]
) {
  const lines = [
    `🏆 ${bolaoName} — Copa do Mundo 2026`,
    '',
    ...ranking.slice(0, 10).map((r) => {
      const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `${r.rank}.`;
      const name = r.user_name || r.user_email.split('@')[0];
      return `${medal} ${name} — ${r.total_points} pts`;
    }),
    '',
    'smartbetting.app/bolao',
  ];
  return lines.join('\n');
}

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

  const [championModalOpen, setChampionModalOpen] = useState(false);
  const [predictionsModalOpen, setPredictionsModalOpen] = useState(false);
  const [specialPredictionsOpen, setSpecialPredictionsOpen] = useState(false);

  const { data: bolao, isLoading: loadingBolao } = useBolao(id);
  const { data: ranking, isLoading: loadingRanking } = useBolaoRanking(id);
  const { data: matches } = useWcMatches();
  const { data: myPredictions } = useBolaoPredictions(id, currentUserId);
  const { data: championPredictions, isLoading: loadingChampions } = useChampionPredictions(id);
  const upsertChampion = useUpsertChampionPrediction();

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

  const handleChampionConfirm = (teamCode: string) => {
    if (!id) return;
    upsertChampion.mutate(
      { bolaoId: id, teamCode },
      {
        onSuccess: () => {
          setChampionModalOpen(false);
          toast({ title: 'Palpite de campeão salvo', description: teamCode });
        },
        onError: (err: any) => {
          toast({ title: 'Erro ao salvar campeão', description: err?.message ?? 'Tente novamente', variant: 'destructive' });
        },
      }
    );
  };

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

  // ── Ranking share: text ────────────────────────────────────────────
  const handleShareRanking = async () => {
    if (!bolao || !ranking) return;
    const inviteUrl = `${window.location.origin}/bolao/entrar/${bolao.invite_code}`;
    const text = buildRankingText(bolao.name, ranking);
    const result = await shareTextOrLink({
      title: `Ranking ${bolao.name}`,
      text,
      url: inviteUrl,
    });
    if (result.method === 'native-share') return;
    // fallback path (clipboard) — copia o texto + url
    await navigator.clipboard.writeText(`${text}\n\nVem disputar: ${inviteUrl}`);
    toast({ title: 'Ranking copiado!', description: 'Cole no WhatsApp ou Telegram.' });
  };

  // ── Ranking share: image — feed (1080×1080) e stories (1080×1920) ────
  const rankingShareFeed = useRankingShareImage({
    bolaoName: bolao?.name ?? 'Bolão',
    filenameSlug: bolao?.invite_code,
    variant: 'feed',
  });
  const rankingShareStories = useRankingShareImage({
    bolaoName: bolao?.name ?? 'Bolão',
    filenameSlug: bolao?.invite_code,
    variant: 'stories',
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

  const handleShareRankingImage = async () => {
    showShareResultToast(await rankingShareFeed.share());
  };

  const handleShareRankingStories = async () => {
    showShareResultToast(await rankingShareStories.share());
  };

  // Theme accent
  const accent = bolao?.custom_color ? THEME_ACCENT[bolao.custom_color] : null;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'ranking',      label: 'Ranking',      icon: <Trophy className="w-4 h-4" /> },
    { key: 'meus-palpites',label: 'Palpites',      icon: <ClipboardList className="w-4 h-4" /> },
    { key: 'estatisticas', label: 'Estatísticas',  icon: <BarChart3 className="w-4 h-4" /> },
  ];

  if (loadingBolao) {
    return (
      <div className="min-h-screen bg-terminal-bg flex items-center justify-center">
        <div className="animate-pulse text-terminal-text opacity-50">Carregando...</div>
      </div>
    );
  }

  if (!bolao) {
    return (
      <div className="min-h-screen bg-terminal-bg flex items-center justify-center text-terminal-text">
        <div className="text-center">
          <p className="text-lg mb-4">Bolão não encontrado</p>
          <Button variant="ghost" onClick={() => navigate('/bolao')}>Voltar</Button>
        </div>
      </div>
    );
  }

  // ── Sidebar content (rendered in both mobile and desktop positions) ──
  const sidebarContent = (
    <>
      {/* 1. Palpites dos Jogos */}
      {(() => {
        const made = myPredictions?.length ?? 0;
        const total = totalAvailableMatches;
        const pct = total > 0 ? Math.round((made / total) * 100) : 0;
        const complete = total > 0 && made >= total;
        return (
          <div className="terminal-container p-4 border-terminal-blue/20 bg-terminal-blue/[0.03]">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <ClipboardList className="w-4 h-4 text-terminal-blue shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-terminal-blue">
                    Palpites dos Jogos
                  </p>
                  <p className="text-xs opacity-60">
                    <span className="font-bold text-terminal-text tabular-nums">{made}</span>
                    <span className="opacity-60"> / </span>
                    <span className="opacity-80 tabular-nums">{total}</span>
                    <span className="opacity-50"> palpites · {pct}%</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPredictionsModalOpen(true)}
                className="text-[10px] font-bold text-terminal-blue hover:text-terminal-blue/80 shrink-0 border border-terminal-blue/30 rounded px-2 py-1 hover:bg-terminal-blue/10 transition-colors"
              >
                {complete ? 'Revisar' : 'Fazer palpites →'}
              </button>
            </div>
            {/* Progress bar — azul a cinza, completa em verde */}
            <div
              className="h-1.5 rounded-full bg-terminal-border-subtle overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${made} de ${total} palpites feitos`}
            >
              <div
                className={`h-full transition-all duration-500 ${
                  complete ? 'bg-terminal-green' : 'bg-terminal-blue'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* 2. Palpite de Campeão */}
      {(bolao.champion_enabled ?? true) && <div className="terminal-container p-4 border-yellow-500/20 bg-yellow-500/[0.03]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                Palpite de Campeão
              </p>
              {myChampionPick ? (
                <p className="text-sm font-semibold truncate">
                  {myChampionPick.predicted_team_code}
                  {matches && (() => {
                    const name =
                      matches.find(m => m.home_team_code === myChampionPick.predicted_team_code)?.home_team ||
                      matches.find(m => m.away_team_code === myChampionPick.predicted_team_code)?.away_team;
                    return name ? ` — ${name}` : '';
                  })()}
                </p>
              ) : (
                <p className="text-xs opacity-50">Quem vai ganhar a Copa 2026?</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setChampionModalOpen(true)}
            className="text-[10px] font-bold text-yellow-400 hover:text-yellow-300 shrink-0 border border-yellow-500/30 rounded px-2 py-1 hover:bg-yellow-500/10 transition-colors"
          >
            {myChampionPick ? 'Alterar' : 'Escolher →'}
          </button>
        </div>

        {loadingChampions && !championPredictions && (
          <div className="mt-3 pt-3 border-t border-yellow-500/10">
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-5 w-12 rounded bg-yellow-500/10 animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {championPredictions && championPredictions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-yellow-500/10">
            <p className="text-[10px] opacity-40 mb-2 uppercase tracking-wider">
              {championPredictions.length} palpite{championPredictions.length !== 1 ? 's' : ''} registrado{championPredictions.length !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(() => {
                const counts = new Map<string, number>();
                for (const p of championPredictions) {
                  counts.set(p.predicted_team_code, (counts.get(p.predicted_team_code) ?? 0) + 1);
                }
                return Array.from(counts.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([code, count]) => (
                    <span
                      key={code}
                      className={`text-[10px] px-2 py-0.5 rounded border font-mono ${
                        code === myChampionPick?.predicted_team_code
                          ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
                          : 'border-terminal-border-subtle bg-terminal-dark-gray/40 opacity-60'
                      }`}
                    >
                      {code} {count > 1 && <span className="opacity-60">×{count}</span>}
                    </span>
                  ));
              })()}
            </div>
          </div>
        )}
      </div>}

      {/* 3. Palpites Especiais — same card style */}
      {(bolao.special_predictions_enabled ?? true) && <div className="terminal-container p-4 border-emerald-500/20 bg-emerald-500/[0.03]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Palpites Especiais
              </p>
              <p className="text-xs opacity-50">
                {(() => {
                  const cfg = bolao.special_predictions_config;
                  if (!cfg) return 'Finalistas, semis, quartas...';
                  const labels: string[] = [];
                  if (cfg.finalist) labels.push('Finalistas');
                  if (cfg.semifinalist) labels.push('Semis');
                  if (cfg.quarterfinalist) labels.push('Quartas');
                  if (cfg.round_of_32) labels.push('Mata-mata');
                  return labels.join(', ') || 'Nenhum habilitado';
                })()}
              </p>
            </div>
          </div>
          {!bolao.is_premium && (
            <span className="text-[9px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 rounded border border-yellow-500/30 font-bold shrink-0">
              PREMIUM
            </span>
          )}
          {bolao.is_premium && (
            <button
              onClick={() => setSpecialPredictionsOpen(true)}
              className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 shrink-0 border border-emerald-500/30 rounded px-2 py-1 hover:bg-emerald-500/10 transition-colors"
            >
              Ver palpites →
            </button>
          )}
        </div>
      </div>}
    </>
  );

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text pb-20 lg:pb-0">
      <AnalyticsNav />

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ── Header ── */}
        <div className={`flex items-center gap-3 mb-4 pb-4 ${accent ? `border-b ${accent.header}` : ''}`}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/bolao')}
            className="h-8 w-8 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          {bolao.custom_banner_url && (
            <img
              src={bolao.custom_banner_url}
              alt="Logo"
              className="w-9 h-9 rounded border border-terminal-border object-cover shrink-0"
            />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">{bolao.name}</h1>
              {bolao.is_premium && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${
                  accent ? accent.badge : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
                } text-yellow-400`}>
                  PREMIUM
                </span>
              )}
            </div>
            {bolao.description && (
              <p className="text-xs opacity-50 truncate">{bolao.description}</p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <BolaoShareButton
              bolaoName={bolao.name}
              inviteCode={bolao.invite_code}
              variant="compact"
            />
            {currentUserId && currentUserId === bolao.owner_id ? (
              <Button
                variant="ghost"
                onClick={() => setShowAdmin(true)}
                aria-label="Abrir configurações do bolão"
                className="gap-1.5 text-xs opacity-70 hover:opacity-100 h-11 px-3"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Configurações</span>
              </Button>
            ) : currentUserId ? (
              <Button
                variant="ghost"
                onClick={() => setConfirmLeaveOpen(true)}
                aria-label="Sair do bolão"
                className="gap-1.5 text-xs opacity-50 hover:opacity-100 hover:text-terminal-red h-11 px-3"
                title="Sair do bolão"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            ) : null}
          </div>
        </div>

        {/* ── Insights pós-jogo ── */}
        {id && currentUserId && <InsightsBanner bolaoId={id} />}

        {/* ── Info bar ── */}
        <div className="flex items-center gap-4 mb-3 text-xs opacity-50 flex-wrap">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {ranking?.length || 0} participantes
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
            className="flex items-center gap-1 hover:opacity-100 hover:text-terminal-blue transition-colors cursor-pointer"
          >
            <Hash className="w-3 h-3" />
            <span className="font-mono">{bolao.invite_code}</span>
          </button>
          <span>
            {bolao.scoring_result} pt resultado / {bolao.scoring_exact} pts placar
            {bolao.scoring_preset === 'weighted_stages' && (
              <span className="ml-1 text-terminal-blue">(×fase)</span>
            )}
          </span>
        </div>

        {/* ── Deadline badge (próximo prazo de palpite) ── */}
        {!bolao.is_closed && (
          <div className="mb-5">
            <DeadlineBadge
              matches={matches}
              mode={bolao.prediction_deadline_mode ?? 'per_match'}
              isClosed={bolao.is_closed}
            />
          </div>
        )}

        {/* ── Banner de urgência: palpites pendentes com deadline próximo ── */}
        {!bolao.is_closed && (() => {
          if (!matches) return null;
          const now = Date.now();
          const sixHours = 6 * 60 * 60 * 1000;
          const mode = bolao.prediction_deadline_mode ?? 'per_match';
          // Conta jogos não palpitados cujo deadline cai em <6h
          const urgentCount = matches.filter(m => {
            if (m.is_finished || m.home_team_code === 'TBD') return false;
            if (predictionsByMatch.has(m.id)) return false;
            const deadline = computeMatchDeadline(m, mode, matches);
            const ms = deadline.getTime() - now;
            return ms > 0 && ms < sixHours;
          }).length;
          if (urgentCount === 0) return null;
          return (
            <div className="mb-5 rounded-lg border border-terminal-yellow/40 bg-terminal-yellow/10 px-4 py-3 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-terminal-yellow shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-terminal-yellow">
                  {urgentCount === 1
                    ? '1 palpite fecha nas próximas 6h'
                    : `${urgentCount} palpites fecham nas próximas 6h`}
                </p>
                <p className="text-xs opacity-70 mt-0.5">
                  Faça antes que perca a chance de pontuar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPredictionsModalOpen(true)}
                className="shrink-0 h-9 px-3 rounded-lg bg-terminal-yellow text-terminal-bg font-bold text-xs hover:bg-terminal-yellow/90 transition-colors"
              >
                Palpitar agora
              </button>
            </div>
          );
        })()}

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
          <div className="terminal-container p-4 mb-5 border-terminal-blue/30 bg-terminal-blue/5">
            <div className="flex items-start gap-3">
              <div className="bg-terminal-blue/15 border border-terminal-blue/30 rounded-full w-9 h-9 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 text-terminal-blue" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Faça seus palpites</p>
                <p className="text-xs opacity-60 mt-0.5">
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
            {/* Tabs */}
            <div role="tablist" aria-label="Seções do bolão" className="flex gap-1 mb-6 border-b border-terminal-border">
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
                    className={`flex items-center gap-1.5 px-4 h-11 text-xs font-bold uppercase transition-colors border-b-2 -mb-px focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-blue/50 ${
                      isActive
                        ? 'border-terminal-blue text-terminal-blue'
                        : 'border-transparent opacity-60 hover:opacity-100'
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
                  <div className="flex items-center justify-end gap-3 mb-3 flex-wrap">
                    <button
                      onClick={handleShareRanking}
                      aria-label="Compartilhar ranking em texto"
                      className="flex items-center gap-1.5 text-xs opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <Share2 className="w-3 h-3" />
                      Texto
                    </button>
                    {bolao.is_premium && (
                      <>
                        <button
                          onClick={handleShareRankingImage}
                          aria-label="Compartilhar ranking como imagem (formato feed)"
                          className="flex items-center gap-1.5 text-xs opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <Image className="w-3 h-3" />
                          Imagem
                        </button>
                        <button
                          onClick={handleShareRankingStories}
                          aria-label="Compartilhar ranking nos Stories (formato vertical)"
                          className="flex items-center gap-1.5 text-xs opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <Image className="w-3 h-3" />
                          Stories
                        </button>
                      </>
                    )}
                  </div>
                )}
                {loadingRanking && !ranking ? (
                  <div className="space-y-1.5">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-14 rounded bg-terminal-dark-gray/30 animate-pulse" />
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
                  />
                )}
              </div>
            )}

            {/* Tab: Meus Palpites */}
            {activeTab === 'meus-palpites' && (
              <div role="tabpanel" id="bolao-tab-panel-meus-palpites" aria-labelledby="bolao-tab-meus-palpites">
                <p className="text-xs opacity-50 mb-4">
                  {myPredictions?.length || 0} palpites registrados
                </p>

                {(!myPredictions || myPredictions.length === 0) ? (
                  <div className="text-center py-10 px-4">
                    <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-terminal-blue/10 border border-terminal-blue/30 flex items-center justify-center">
                      <ClipboardList className="w-7 h-7 text-terminal-blue/70" />
                    </div>
                    <p className="text-sm sm:text-base font-bold">Você ainda não palpitou</p>
                    <p className="text-xs sm:text-sm opacity-60 mt-1 mb-4">
                      Comece pelos jogos da fase de grupos — são 48 partidas
                    </p>
                    <Button
                      onClick={() => setPredictionsModalOpen(true)}
                      className="bg-terminal-blue text-terminal-bg hover:bg-terminal-blue/90 gap-1.5 h-11 px-5 font-bold"
                    >
                      <Target className="w-4 h-4" />
                      Fazer meu primeiro palpite
                    </Button>
                  </div>
                ) : (
                  Object.entries(matchesByStage).map(([stageName, stageMatches]) => {
                    const matchesWithPrediction = stageMatches.filter((m) =>
                      predictionsByMatch.has(m.id)
                    );
                    if (matchesWithPrediction.length === 0) return null;

                    return (
                      <div key={stageName} className="mb-6">
                        <h3 className="text-xs uppercase font-bold opacity-50 mb-3">{stageName}</h3>
                        <div className="space-y-2">
                          {matchesWithPrediction.map((match) => {
                            const pred = predictionsByMatch.get(match.id)!;
                            return (
                              <div
                                key={match.id}
                                className="flex items-center gap-2 p-3 rounded border border-terminal-border-subtle bg-terminal-dark-gray/20"
                              >
                                <div className="flex-1 flex items-center gap-1 text-sm">
                                  <span className="flex-1 text-right font-medium">
                                    {match.home_team_code}
                                  </span>
                                  <span className="px-2 font-bold text-terminal-green">
                                    {pred.predicted_home_score} x {pred.predicted_away_score}
                                  </span>
                                  <span className="flex-1 font-medium">
                                    {match.away_team_code}
                                  </span>
                                </div>
                                {match.is_finished && pred.points_earned != null && (
                                  <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
                                      pred.points_earned > 0
                                        ? 'bg-terminal-green/20 text-terminal-green'
                                        : 'bg-terminal-dark-gray text-terminal-text/50'
                                    }`}
                                  >
                                    {pred.points_earned > 0 ? `+${pred.points_earned}` : '0'}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab: Estatísticas */}
            {activeTab === 'estatisticas' && (
              <div role="tabpanel" id="bolao-tab-panel-estatisticas" aria-labelledby="bolao-tab-estatisticas">
                <BolaoStatsPanel
                  bolaoId={bolao.id}
                  currentUserId={currentUserId}
                  isPremium={bolao.is_premium}
                />
              </div>
            )}
          </div>

          {/* ── Sidebar (desktop only — mobile uses bottom sheet) ── */}
          <aside className="hidden lg:block lg:space-y-4 lg:sticky lg:top-6 lg:self-start">
            {sidebarContent}
          </aside>
        </div>
      </div>

      {/* ── Mobile bottom navigation (always visible on mobile) ── */}
      {!bolao.is_closed && (
        <BolaoBottomNav
          pendingPredictions={Math.max(0, totalAvailableMatches - (myPredictions?.length ?? 0))}
          hasChampionPick={!!myChampionPick}
          championEnabled={bolao.champion_enabled ?? true}
          specialEnabled={bolao.special_predictions_enabled ?? true}
          isPremium={bolao.is_premium}
          onOpenPredictions={() => setPredictionsModalOpen(true)}
          onOpenChampion={() => setChampionModalOpen(true)}
          onOpenSpecial={() => setSpecialPredictionsOpen(true)}
        />
      )}

      {/* Champion pick modal */}
      <ChampionPickModal
        open={championModalOpen}
        onOpenChange={setChampionModalOpen}
        matches={matches || []}
        currentPick={myChampionPick?.predicted_team_code ?? null}
        onConfirm={handleChampionConfirm}
        isLoading={upsertChampion.isPending}
      />

      {/* Special Predictions modal */}
      <Dialog open={specialPredictionsOpen} onOpenChange={setSpecialPredictionsOpen}>
        <DialogContent className="bg-terminal-bg border-terminal-border max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-5 pt-5 pb-0">
            <DialogTitle className="flex items-center gap-2 text-terminal-text">
              <Trophy className="w-5 h-5 text-emerald-400" />
              Palpites Especiais
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-5 pt-4">
            <SpecialPredictionsSection
              bolaoId={bolao.id}
              isPremium={bolao.is_premium}
              matches={matches || []}
              hideChrome
              enabledTypes={bolao.special_predictions_config ?? undefined}
            />
          </div>
        </DialogContent>
      </Dialog>

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
          isClosed={bolao.is_closed}
          isPremium={bolao.is_premium}
          scoringPreset={bolao.scoring_preset ?? null}
          scoringResult={bolao.scoring_result}
          scoringExact={bolao.scoring_exact}
          scoringWeights={bolao.scoring_weights ?? null}
          predictionDeadlineMode={bolao.prediction_deadline_mode ?? 'per_match'}
          customColor={bolao.custom_color ?? null}
          customBannerUrl={bolao.custom_banner_url ?? null}
          championEnabled={bolao.champion_enabled ?? true}
          specialPredictionsEnabled={bolao.special_predictions_enabled ?? true}
          specialPredictionsConfig={bolao.special_predictions_config ?? { finalist: true, semifinalist: true, quarterfinalist: true, round_of_32: true }}
          specialPredictionsPoints={bolao.special_predictions_points ?? { finalist: 10, semifinalist: 5, quarterfinalist: 3, round_of_32: 1 }}
          championPoints={bolao.champion_points ?? 10}
          ranking={ranking || []}
          currentUserId={currentUserId}
          ownerUserId={bolao.owner_id}
        />
      )}

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
          className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
          role="alert"
          aria-live="assertive"
        >
          <div className="bg-terminal-bg border border-yellow-500/40 rounded-lg p-6 max-w-sm text-center">
            {webhookTimedOut ? (
              <>
                <p className="text-base font-bold text-yellow-300 mb-2">
                  Pagamento sendo processado
                </p>
                <p className="text-sm opacity-70 mb-4">
                  A confirmação está demorando mais do que o normal.
                  Você receberá um email assim que for ativado, normalmente em poucos minutos.
                </p>
                <Button
                  onClick={() => {
                    setAwaitingWebhook(false);
                    setWebhookTimedOut(false);
                    navigate(`/bolao/${id}`, { replace: true });
                  }}
                  className="w-full bg-terminal-blue text-terminal-bg hover:bg-terminal-blue/90 h-11"
                >
                  Continuar usando o bolão
                </Button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 mx-auto mb-4 border-3 border-yellow-500/30 border-t-yellow-400 rounded-full animate-spin" />
                <p className="text-base font-bold text-yellow-300 mb-1">
                  Confirmando pagamento...
                </p>
                <p className="text-xs opacity-60">
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
