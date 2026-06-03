import React, { useState } from 'react';
import {
  ArrowLeft,
  Settings,
  Sparkles,
  Wand2,
  Target,
  Copy,
  Check,
  Users,
  Hash,
  Trophy,
  LayoutGrid,
  Share2,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TeamFlag } from '@/components/bolao/TeamFlag';
import { BrandIcon } from '@/components/bolao/BrandIcon';
import { CopaGruposView } from '@/components/bolao/CopaGruposView';
import { BolaoRankingTable } from '@/components/bolao/BolaoRankingTable';
import { RankingShareImage } from '@/components/bolao/RankingShareImage';
import { RankingShareImageStories } from '@/components/bolao/RankingShareImageStories';
import { useRankingShareImage } from '@/components/bolao/useRankingShareImage';
import { shareTextOrLink, SHARE_MESSAGES } from '@/components/bolao/share-utils';
import type { Bolao, BolaoPrediction, BolaoRankingEntry, WcMatch } from '@/services/bolao.service';

interface BolaoEmptyStateProps {
  bolao: Bolao;
  matches: WcMatch[] | undefined;
  predictions: BolaoPrediction[] | undefined;
  /** Ranking do bolão até o momento — usado pela tab "Ranking". */
  ranking: BolaoRankingEntry[] | undefined;
  memberCount: number;
  currentUserId: string | undefined;
  onBack: () => void;
  onPalpitar: () => void;
  onQuickPick: () => void;
  onConfigurar: () => void;
  /**
   * Abre o modal de Especiais (Campeão + Finalistas + Semis + Quartas + Mata-mata 32).
   * Substituiu o antigo par `onChampionPick` + `onSpecialPicks` — ambos abriam o mesmo modal.
   */
  onSpecialPicks: () => void;
}

type EmptyStateTab = 'palpites' | 'tabela' | 'ranking';

/**
 * Tela A do BolaoDetail — estado vazio (poucos membros).
 *
 * Hierarquia de prioridade pré-Copa:
 *   1. PALPITAR (hero forest grande, full-width) — ação principal
 *   2. CONVIDAR amigos (card compacto, sempre visível) — secundário
 *   3. Sub-nav "Especiais" no topo abre modal com Campeão + Especiais — terciário
 *
 * Decisões anteriores que justificam essa estrutura:
 *   - O /welcome já guiou o criador a convidar logo após criar — aqui o convite
 *     vira "lembrete passivo", não destaque competindo com palpitar.
 *   - "Palpite de Campeão" e "Palpites Especiais" eram cards separados nessa
 *     tela; ambos abriam o mesmo SpecialPredictionsModal. Foram movidos pra
 *     uma sub-nav "Especiais" no topo (single source of truth pra modalidades
 *     que não são placar de jogo).
 */
export const BolaoEmptyState: React.FC<BolaoEmptyStateProps> = ({
  bolao,
  matches,
  predictions,
  ranking,
  memberCount,
  currentUserId,
  onBack,
  onPalpitar,
  onQuickPick,
  onConfigurar,
  onSpecialPicks,
}) => {
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<EmptyStateTab>('palpites');

  // Hooks pra gerar imagem do ranking (1080×1080 feed e 1080×1920 stories).
  // Em pré-Copa com 0-1 jogador, os botões ficam ocultos (ver condição abaixo);
  // os hooks são criados sempre pra manter ordem estável dos hooks no React.
  const bolaoShareUrl = `${window.location.origin}/bolao/${bolao.id}`;
  const rankingShareFeed = useRankingShareImage({
    bolaoName: bolao.name,
    filenameSlug: bolao.invite_code,
    variant: 'feed',
    bolaoUrl: bolaoShareUrl,
  });
  const rankingShareStories = useRankingShareImage({
    bolaoName: bolao.name,
    filenameSlug: bolao.invite_code,
    variant: 'stories',
    bolaoUrl: bolaoShareUrl,
  });

  // Total de jogos jogáveis (não TBD, não finalizados)
  const totalMatches =
    matches?.filter((m) => !m.is_finished && m.home_team_code !== 'TBD').length || 0;
  const userPredictionsCount = predictions?.length || 0;
  const pendingCount = Math.max(0, totalMatches - userPredictionsCount);

  // Próximo jogo (pra mostrar prazo + primeira partida)
  const nextMatch = matches
    ?.filter((m) => !m.is_finished && m.home_team_code !== 'TBD')
    .sort(
      (a, b) =>
        a.match_date.localeCompare(b.match_date) ||
        a.match_time_brasilia.localeCompare(b.match_time_brasilia)
    )[0];

  const nextDeadlineLabel = nextMatch
    ? (() => {
        const d = new Date(nextMatch.match_date + 'T00:00:00');
        const dayShort = d.toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
        });
        return `${dayShort.charAt(0).toUpperCase() + dayShort.slice(1)} ${nextMatch.match_time_brasilia.slice(0, 5)}`;
      })()
    : null;

  const inviteUrl = `${window.location.origin}/bolao/entrar/${bolao.invite_code}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Web Share API com fallback wa.me (em desktop sem share API).
  // O sheet nativo deixa o user escolher entre WhatsApp / Telegram / Instagram / Copiar etc.
  const handleShareInvite = () => {
    void shareTextOrLink({
      title: `Bolão "${bolao.name}" — Copa 2026`,
      text: SHARE_MESSAGES.invite(bolao.name, bolao.invite_code, inviteUrl),
    });
  };

  // Telegram continua como link direto secundário — Web Share API não tem
  // como filtrar app específico, então mantemos o atalho pra quem prefere.
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent('Pra entrar no bolão da Copa 2026')}`;

  // Sub-nav só aparece se pelo menos um dos modos especiais está habilitado
  const specialsAvailable =
    (bolao.champion_enabled ?? true) || (bolao.special_predictions_enabled ?? true);

  // Copy contextual do card de convite — varia com member_count
  const inviteHeadline =
    memberCount === 1
      ? 'Só você ainda. Chame a galera.'
      : memberCount < 4
        ? `${memberCount} jogadores. Chame mais — fica mais disputado a partir de 4.`
        : `${memberCount} jogadores. Chame mais se quiser.`;

  return (
    <div className="bg-canvas">
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-8">
        {/* ─── Header ─── */}
        <div className="flex items-start gap-3 mb-6">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="w-9 h-9 rounded-rebrand-md hover:bg-canvas-2 text-ink-2 flex items-center justify-center transition-colors shrink-0 mt-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
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
            <div className="flex items-center gap-3 mt-2 text-[12px] text-ink-2 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Users className="w-3 h-3" />
                {memberCount} jogador{memberCount !== 1 ? 'es' : ''}
              </span>
              <span className="inline-flex items-center gap-1">
                <Hash className="w-3 h-3 text-ink-3" />
                <span className="font-mono">{bolao.invite_code}</span>
              </span>
              <span>
                Pontuação:{' '}
                <span className="text-ink">
                  {bolao.scoring_result}pt resultado · {bolao.scoring_exact}pt placar exato
                </span>
              </span>
            </div>
          </div>
          {/* Configurações: owner edita; membro vê read-only */}
          {currentUserId && (
            <Button
              variant="outline"
              size="sm"
              onClick={onConfigurar}
              className="rounded-rebrand-md gap-1.5 bg-white border border-line text-ink-2 hover:bg-canvas-2 hover:text-ink shrink-0"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Configurações</span>
            </Button>
          )}
        </div>

        {/* ─── Sub-nav: Palpites | Especiais | Tabela | Ranking ─── */}
        <div className="flex items-center gap-0.5 border-b border-line mb-5 overflow-x-auto overflow-y-hidden -mx-4 px-4 sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* Aba "Palpites" — conteúdo principal (hero + convidar) */}
          <button
            type="button"
            onClick={() => setActiveTab('palpites')}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 -mb-px border-b-2 text-[13px] font-semibold whitespace-nowrap transition-colors shrink-0 ${
              activeTab === 'palpites'
                ? 'border-forest text-forest'
                : 'border-transparent text-ink-2 hover:text-ink hover:border-line-2'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            Palpites
          </button>
          {/* Aba "Especiais" — abre modal (não é tab inline porque o conteúdo é interativo de palpite) */}
          {specialsAvailable && (
            <button
              type="button"
              onClick={onSpecialPicks}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 -mb-px border-b-2 border-transparent text-ink-2 hover:text-ink hover:border-line-2 text-[13px] font-semibold whitespace-nowrap transition-colors shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Especiais
              {!bolao.is_premium && (bolao.special_predictions_enabled ?? true) && (
                <span className="text-[9px] font-bold tracking-wider px-1 py-0.5 rounded bg-amber/15 text-amber-2 border border-amber/30 ml-0.5">
                  PREMIUM
                </span>
              )}
            </button>
          )}
          {/* Aba "Tabela" — grupos da Copa */}
          <button
            type="button"
            onClick={() => setActiveTab('tabela')}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 -mb-px border-b-2 text-[13px] font-semibold whitespace-nowrap transition-colors shrink-0 ${
              activeTab === 'tabela'
                ? 'border-forest text-forest'
                : 'border-transparent text-ink-2 hover:text-ink hover:border-line-2'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Tabela
          </button>
          {/* Aba "Ranking" — ranking do bolão até o momento */}
          <button
            type="button"
            onClick={() => setActiveTab('ranking')}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 -mb-px border-b-2 text-[13px] font-semibold whitespace-nowrap transition-colors shrink-0 ${
              activeTab === 'ranking'
                ? 'border-forest text-forest'
                : 'border-transparent text-ink-2 hover:text-ink hover:border-line-2'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Ranking
          </button>
        </div>

        {/* ─── Conteúdo da aba "Palpites": Hero + Convidar ─── */}
        {activeTab === 'palpites' && (
          <>
        {/* ─── HERO: Palpitar (forest, full-width, destaque máximo) ─── */}
        <div className="bg-forest text-white rounded-rebrand-xl p-7 sm:p-9 mb-4 relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-amber/10 pointer-events-none" />
          <div className="absolute right-32 top-12 w-24 h-24 rounded-full bg-amber/10 pointer-events-none" />
          <div className="relative max-w-[640px]">
            <h2 className="font-display text-[28px] sm:text-[36px] font-extrabold leading-[1.05] mb-3">
              Faça seus {totalMatches} palpites
            </h2>
            <p className="text-[14px] opacity-80 leading-relaxed mb-6 max-w-[480px]">
              Pode palpitar agora ou deixar o Quick Pick preencher por você. Edita um por um quando quiser.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mb-6">
              <Button
                variant="amber"
                size="lg"
                onClick={onPalpitar}
                className="rounded-rebrand-md gap-2 justify-center"
              >
                <Target className="w-4 h-4" />
                Começar a palpitar
              </Button>
              <Button
                size="lg"
                onClick={onQuickPick}
                className="rounded-rebrand-md gap-2 justify-center bg-white/10 text-white border border-white/30 hover:bg-white/20 hover:border-white/50 transition-colors"
              >
                <Wand2 className="w-4 h-4 shrink-0" />
                Quick Pick — preencher em 1 clique
              </Button>
            </div>
            {/* Info de prazo + primeiro jogo */}
            <div className="flex items-center gap-x-5 gap-y-1.5 pt-4 border-t border-white/15 text-[12px] flex-wrap">
              {nextDeadlineLabel && (
                <div className="inline-flex items-center gap-1.5">
                  <span className="opacity-60">Próximo prazo:</span>
                  <span className="font-medium tabular-nums">{nextDeadlineLabel}</span>
                </div>
              )}
              {nextMatch && (
                <div className="inline-flex items-center gap-1.5">
                  <span className="opacity-60">Primeiro jogo:</span>
                  <span className="inline-flex items-center gap-1 font-medium">
                    <TeamFlag code={nextMatch.home_team_code} size="sm" />
                    {nextMatch.home_team} × {nextMatch.away_team}
                    <TeamFlag code={nextMatch.away_team_code} size="sm" />
                  </span>
                </div>
              )}
              {!nextMatch && pendingCount > 0 && (
                <span className="opacity-80">
                  {pendingCount} jogo{pendingCount !== 1 ? 's' : ''} pra palpitar
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ─── Card secundário: Convidar amigos (sempre visível) ─── */}
        <div className="bg-white border border-line rounded-rebrand-xl p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-rebrand-md bg-canvas-2 grid place-items-center text-forest shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-[15px] font-bold text-ink leading-tight">
                {inviteHeadline}
              </p>
              <p className="text-[12px] text-ink-2 mt-0.5 leading-relaxed">
                Manda o link no zap. Pode chamar quantos quiser — o ranking fica interessante a partir de 4.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3 flex-wrap sm:flex-nowrap">
            <input
              readOnly
              value={inviteUrl.replace(/^https?:\/\//, '')}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 min-w-0 h-10 px-3 rounded-rebrand-md bg-canvas-2 border border-line text-ink text-[12px] font-mono truncate focus:outline-none focus:border-forest"
            />
            <button
              type="button"
              onClick={handleShareInvite}
              className="h-10 px-3.5 inline-flex items-center gap-1.5 rounded-rebrand-md bg-forest text-white hover:bg-forest-2 font-semibold text-[12px] shrink-0 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Compartilhar
            </button>
          </div>
          <div className="flex items-center gap-4 text-[12px]">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 text-ink-2 hover:text-forest transition-colors"
            >
              {linkCopied ? (
                <Check className="w-3.5 h-3.5 text-status-success" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {linkCopied ? 'Copiado!' : 'Copiar link'}
            </button>
            <span className="text-ink-3">·</span>
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-ink-2 hover:text-forest transition-colors"
            >
              <BrandIcon brand="telegram" className="w-3.5 h-3.5" />
              Telegram
            </a>
          </div>
        </div>
          </>
        )}

        {/* ─── Conteúdo da aba "Tabela" ─── */}
        {activeTab === 'tabela' && (
          <div className="bg-white border border-line rounded-rebrand-xl p-5 sm:p-6">
            <div className="mb-4">
              <h2 className="font-display text-[18px] font-bold text-ink">Tabela dos grupos</h2>
              <p className="text-[12px] text-ink-2 mt-0.5">
                Como estão os 12 grupos da Copa 2026. Atualiza após cada resultado.
              </p>
            </div>
            <CopaGruposView />
          </div>
        )}

        {/* ─── Conteúdo da aba "Ranking" ─── */}
        {activeTab === 'ranking' && (
          <div>
            <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
              <div>
                <h2 className="font-display text-[18px] font-bold text-ink">Ranking do bolão</h2>
                <p className="text-[12px] text-ink-2 mt-0.5">
                  Pontuação dos jogadores até agora. {memberCount < 4 && 'Fica mais interessante a partir de 4 jogadores.'}
                </p>
              </div>
              {/* Botões de share da imagem do ranking — aparecem com pelo menos 1
                  entry (geralmente só o dono em pré-Copa). Antes o gate era > 1
                  pra esconder "ranking solo", mas isso impedia o criador de testar
                  o fluxo de compartilhar antes de chamar amigos. */}
              {ranking && ranking.length >= 1 && (
                <div className="flex items-center gap-3 text-[12px] text-ink-2">
                  <span className="text-ink-3">Compartilhar:</span>
                  <button
                    type="button"
                    onClick={() => void rankingShareFeed.shareToWhatsApp()}
                    aria-label="Compartilhar ranking via WhatsApp (mobile: sheet nativo; desktop: download + WhatsApp Web)"
                    className="inline-flex items-center gap-1.5 hover:text-forest transition-colors"
                  >
                    <BrandIcon brand="whatsapp" className="w-3.5 h-3.5" />
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => void rankingShareStories.share()}
                    aria-label="Compartilhar ranking nos Stories (1080×1920)"
                    className="inline-flex items-center gap-1.5 hover:text-forest transition-colors"
                  >
                    <BrandIcon brand="instagram" className="w-3.5 h-3.5" />
                    Stories
                  </button>
                  <button
                    type="button"
                    onClick={() => void rankingShareFeed.download()}
                    aria-label="Baixar imagem do ranking"
                    className="inline-flex items-center gap-1.5 hover:text-forest transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar
                  </button>
                </div>
              )}
            </div>
            <BolaoRankingTable
              ranking={ranking ?? []}
              currentUserId={currentUserId}
              /* onInviteFriends muda a aba pra "palpites" — lá tem o card de convite. */
              onInviteFriends={() => setActiveTab('palpites')}
            />
          </div>
        )}
      </div>

      {/* ─── Off-screen render dos cards de ranking pra captura via html2canvas ─── */}
      {ranking && ranking.length >= 1 && (
        <>
          <RankingShareImage
            ref={rankingShareFeed.captureRef}
            bolaoName={bolao.name}
            inviteCode={bolao.invite_code}
            ranking={ranking}
            currentUserId={currentUserId}
          />
          <RankingShareImageStories
            ref={rankingShareStories.captureRef}
            bolaoName={bolao.name}
            inviteCode={bolao.invite_code}
            ranking={ranking}
            currentUserId={currentUserId}
          />
        </>
      )}
    </div>
  );
};
