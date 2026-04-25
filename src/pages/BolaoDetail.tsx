import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
} from '@/hooks/use-bolao';
import { BolaoRankingTable } from '@/components/bolao/BolaoRankingTable';
import { BolaoShareButton } from '@/components/bolao/BolaoShareButton';
import { ChampionPickModal } from '@/components/bolao/ChampionPickModal';
import { BolaoAdminPanel } from '@/components/bolao/BolaoAdminPanel';
import { SpecialPredictionsSection } from '@/components/bolao/SpecialPredictionsSection';
import { PredictionsModal } from '@/components/bolao/PredictionsModal';

import { BolaoStatsPanel } from '@/components/bolao/BolaoStatsPanel';
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
async function generateRankingImageBlob(
  bolaoName: string,
  ranking: BolaoRankingEntry[]
): Promise<Blob> {
  const top10 = ranking.slice(0, 10);
  const rowH = 46;
  const headerH = 76;
  const footerH = 36;
  const width = 420;
  const height = headerH + top10.length * rowH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0D1117';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#161B22';
  ctx.fillRect(0, 0, width, headerH);

  ctx.fillStyle = '#F0A500';
  ctx.fillRect(20, 20, 36, 36);
  ctx.fillStyle = '#0D1117';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('🏆', 22, 46);

  ctx.fillStyle = '#E6EDF3';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(bolaoName.length > 26 ? bolaoName.slice(0, 26) + '…' : bolaoName, 68, 38);
  ctx.fillStyle = '#8B949E';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('Copa do Mundo 2026', 68, 58);

  const medals = ['🥇', '🥈', '🥉'];
  top10.forEach((entry, i) => {
    const y = headerH + i * rowH;
    if (i % 2 === 0) {
      ctx.fillStyle = '#161B22';
      ctx.fillRect(0, y, width, rowH);
    }

    const rankStr = i < 3 ? medals[i] : `${i + 1}.`;
    const name = (entry.user_name || entry.user_email.split('@')[0]).slice(0, 22);

    ctx.fillStyle = i === 0 ? '#F0A500' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#E6EDF3';
    ctx.font = `bold 13px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(rankStr, 20, y + 28);

    ctx.fillStyle = '#E6EDF3';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(name, 52, y + 28);

    ctx.fillStyle = '#58A6FF';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${entry.total_points} pts`, width - 20, y + 28);
    ctx.textAlign = 'left';
  });

  ctx.fillStyle = '#0D1117';
  ctx.fillRect(0, headerH + top10.length * rowH, width, footerH);
  ctx.fillStyle = '#8B949E';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('smartbetting.app/bolao', 20, headerH + top10.length * rowH + 22);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/png');
  });
}

// ── Component ──────────────────────────────────────────────────────
const BolaoDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('ranking');
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [showAdmin, setShowAdmin] = useState(false);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id);
    });
  }, []);

  const [championModalOpen, setChampionModalOpen] = useState(false);
  const [predictionsModalOpen, setPredictionsModalOpen] = useState(false);
  const [specialPredictionsOpen, setSpecialPredictionsOpen] = useState(false);

  const { data: bolao, isLoading: loadingBolao } = useBolao(id);
  const { data: ranking } = useBolaoRanking(id);
  const { data: matches } = useWcMatches();
  const { data: myPredictions } = useBolaoPredictions(id, currentUserId);
  const { data: championPredictions } = useChampionPredictions(id);
  const upsertChampion = useUpsertChampionPrediction();

  // ── Handle query params: Stripe success + auto-open settings ──────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('success') === 'true') {
      toast({
        title: 'Bolão Premium ativado!',
        description: 'Pagamento confirmado. Aproveite os recursos exclusivos.',
      });
      setShowAdmin(true);
      navigate(`/bolao/${id}`, { replace: true });
    }
    if (params.get('settings') === 'true') {
      setShowAdmin(true);
      navigate(`/bolao/${id}`, { replace: true });
    }
  }, [location.search, id, navigate, toast]);

  const myChampionPick = useMemo(
    () => championPredictions?.find((p) => p.user_id === currentUserId) ?? null,
    [championPredictions, currentUserId]
  );

  const handleChampionConfirm = (teamCode: string) => {
    if (!id) return;
    upsertChampion.mutate(
      { bolaoId: id, teamCode },
      { onSuccess: () => setChampionModalOpen(false) }
    );
  };

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
    const text = buildRankingText(bolao.name, ranking);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(text);
    toast({ title: 'Ranking copiado!', description: 'Cole no WhatsApp ou Telegram.' });
  };

  // ── Ranking share: image (premium) ────────────────────────────────
  const handleShareRankingImage = async () => {
    if (!bolao || !ranking) return;
    try {
      const blob = await generateRankingImageBlob(bolao.name, ranking);
      const file = new File([blob], `ranking-${bolao.invite_code}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${bolao.name} — Ranking` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Imagem baixada!' });
      }
    } catch {
      toast({ title: 'Erro ao gerar imagem', variant: 'destructive' });
    }
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
      <div className="terminal-container p-4 border-terminal-blue/20 bg-terminal-blue/[0.03]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList className="w-4 h-4 text-terminal-blue shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-terminal-blue">
                Palpites dos Jogos
              </p>
              <p className="text-xs opacity-50">
                {myPredictions?.length || 0} feitos · {matches?.filter((m) => !m.is_finished && m.home_team_code !== 'TBD').length || 0} disponíveis
              </p>
            </div>
          </div>
          <button
            onClick={() => setPredictionsModalOpen(true)}
            className="text-[10px] font-bold text-terminal-blue hover:text-terminal-blue/80 shrink-0 border border-terminal-blue/30 rounded px-2 py-1 hover:bg-terminal-blue/10 transition-colors"
          >
            Fazer palpites →
          </button>
        </div>
      </div>

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
    <div className="min-h-screen bg-terminal-bg text-terminal-text">
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
            {currentUserId && currentUserId === bolao.owner_id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdmin(true)}
                className="gap-1.5 text-xs opacity-60 hover:opacity-100 h-8"
              >
                <Settings className="w-3.5 h-3.5" />
                Configurações
              </Button>
            )}
          </div>
        </div>

        {/* ── Info bar ── */}
        <div className="flex items-center gap-4 mb-5 text-xs opacity-50 flex-wrap">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {ranking?.length || 0} participantes
          </span>
          <span className="flex items-center gap-1">
            <Hash className="w-3 h-3" />
            {bolao.invite_code}
          </span>
          <span>
            {bolao.scoring_result} pt resultado / {bolao.scoring_exact} pts placar
            {bolao.scoring_preset === 'weighted_stages' && (
              <span className="ml-1 text-terminal-blue">(×fase)</span>
            )}
          </span>
        </div>

        {/* ── Onboarding (full width, before grid) ── */}
        {showOnboarding && (
          <div className="terminal-container p-4 mb-5 border-terminal-blue/30 bg-terminal-blue/5">
            <p className="text-xs font-bold uppercase tracking-wider text-terminal-blue mb-3">
              Primeiros passos
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-[10px] font-bold text-terminal-blue bg-terminal-blue/20 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">Compartilhe com seus amigos</p>
                  <p className="text-xs opacity-50">
                    Envie o código <span className="font-mono text-terminal-blue">{bolao.invite_code}</span> ou o link de convite
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 flex-1">
                <span className="text-[10px] font-bold text-terminal-blue bg-terminal-blue/20 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">Faça seus palpites</p>
                  <p className="text-xs opacity-50">
                    Palpite nos 104 jogos antes de cada partida começar
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 2-column grid (desktop) / single column (mobile) ── */}
        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-6">

          {/* ── Main content ── */}
          <div className="min-w-0">
            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-terminal-border">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold uppercase transition-colors border-b-2 -mb-px ${
                    activeTab === tab.key
                      ? 'border-terminal-blue text-terminal-blue'
                      : 'border-transparent opacity-50 hover:opacity-80'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab: Ranking */}
            {activeTab === 'ranking' && (
              <>
                {ranking && ranking.length > 1 && (
                  <div className="flex items-center justify-end gap-3 mb-3">
                    <button
                      onClick={handleShareRanking}
                      className="flex items-center gap-1.5 text-xs opacity-50 hover:opacity-80 transition-opacity"
                    >
                      <Share2 className="w-3 h-3" />
                      Texto
                    </button>
                    {bolao.is_premium && (
                      <button
                        onClick={handleShareRankingImage}
                        className="flex items-center gap-1.5 text-xs opacity-50 hover:opacity-80 transition-opacity"
                      >
                        <Image className="w-3 h-3" />
                        Imagem
                      </button>
                    )}
                  </div>
                )}
                <BolaoRankingTable ranking={ranking || []} currentUserId={currentUserId} />
              </>
            )}

            {/* Tab: Meus Palpites */}
            {activeTab === 'meus-palpites' && (
              <div>
                <p className="text-xs opacity-50 mb-4">
                  {myPredictions?.length || 0} palpites registrados
                </p>

                {(!myPredictions || myPredictions.length === 0) ? (
                  <div className="text-center py-10 opacity-40">
                    <ClipboardList className="w-10 h-10 mx-auto mb-3" />
                    <p className="text-sm">Nenhum palpite ainda</p>
                    <p className="text-xs mt-1">Use o botão abaixo para fazer seus palpites</p>
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
              <BolaoStatsPanel
                bolaoId={bolao.id}
                currentUserId={currentUserId}
                isPremium={bolao.is_premium}
              />
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-4 mt-6 lg:mt-0 lg:sticky lg:top-6 lg:self-start">
            {sidebarContent}
          </aside>
        </div>
      </div>

      {/* Fixed bottom CTA removed — fazer palpites is accessible via tab */}

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
    </div>
  );
};

export default BolaoDetail;
