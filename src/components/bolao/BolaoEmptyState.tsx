import React, { useState } from 'react';
import {
  ArrowLeft,
  Trophy,
  Settings,
  Sparkles,
  Wand2,
  Target,
  Copy,
  Check,
  Users,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TeamFlag } from '@/components/bolao/TeamFlag';
import { BrandIcon } from '@/components/bolao/BrandIcon';
import type { Bolao, BolaoPrediction, WcMatch } from '@/services/bolao.service';

interface BolaoEmptyStateProps {
  bolao: Bolao;
  matches: WcMatch[] | undefined;
  predictions: BolaoPrediction[] | undefined;
  memberCount: number;
  currentUserId: string | undefined;
  onBack: () => void;
  onPalpitar: () => void;
  onQuickPick: () => void;
  onConfigurar: () => void;
  onChampionPick: () => void;
  onSpecialPicks: () => void;
}

/**
 * Tela A do BolaoDetail — estado vazio (poucos membros).
 * Foco em 2 ações: convidar amigos + começar a palpitar.
 * Esconde ranking / insights / stats que ficam vazios sem massa crítica.
 */
export const BolaoEmptyState: React.FC<BolaoEmptyStateProps> = ({
  bolao,
  matches,
  predictions,
  memberCount,
  currentUserId,
  onBack,
  onPalpitar,
  onQuickPick,
  onConfigurar,
  onChampionPick,
  onSpecialPicks,
}) => {
  const isOwner = currentUserId === bolao.owner_id;
  const [linkCopied, setLinkCopied] = useState(false);

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

  const shareMessage = `Pra entrar no bolão da Copa 2026:\n${inviteUrl}\n\nCódigo: ${bolao.invite_code}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent('Pra entrar no bolão da Copa 2026')}`;

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
          {/* Configuracoes: owner edita, membro ve em read-only */}
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

        {/* ─── 2 cards passo-a-passo ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* PASSO 1 — Convidar (forest) */}
          <div className="bg-forest text-white rounded-rebrand-xl p-7 relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-amber/10 pointer-events-none" />
            <div className="absolute right-16 top-12 w-20 h-20 rounded-full bg-amber/10 pointer-events-none" />
            <div className="relative">
              <p className="text-[10px] uppercase tracking-[0.16em] font-bold opacity-60 mb-2">
                Passo 1 de 2
              </p>
              <h2 className="font-display text-[24px] sm:text-[28px] font-extrabold leading-[1.1] mb-3">
                Chame a galera primeiro.
                <br />
                Bolão de 2 não tem graça.
              </h2>
              <p className="text-[13px] opacity-75 leading-relaxed mb-5">
                Manda o link no zap. Pode chamar 6, 20, 50 — não tem limite. O ranking só fica
                interessante a partir de 4.
              </p>

              <div className="flex items-center gap-2 mb-3 flex-wrap sm:flex-nowrap">
                <input
                  readOnly
                  value={inviteUrl.replace(/^https?:\/\//, '')}
                  className="flex-1 min-w-0 h-11 px-3.5 rounded-rebrand-md bg-white/10 border border-white/20 text-white text-[12px] font-mono truncate focus:outline-none"
                />
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 px-4 inline-flex items-center gap-2 rounded-rebrand-md bg-amber text-forest font-bold text-[13px] hover:bg-amber-2 transition-colors shrink-0"
                >
                  <BrandIcon brand="whatsapp" className="w-4 h-4" />
                  <span>Mandar no WhatsApp</span>
                </a>
              </div>

              <div className="flex items-center gap-3 text-[12px] flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity"
                >
                  {linkCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {linkCopied ? 'Copiado!' : 'Copiar link'}
                </button>
                <span className="opacity-30">·</span>
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity"
                >
                  <BrandIcon brand="telegram" className="w-3.5 h-3.5" />
                  Telegram
                </a>
              </div>
            </div>
          </div>

          {/* PASSO 2 — Palpitar (white) */}
          <div className="bg-white border border-line rounded-rebrand-xl p-7">
            <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-ink-2 mb-2">
              Passo 2 de 2
            </p>
            <h2 className="font-display text-[24px] sm:text-[28px] font-extrabold leading-[1.1] text-ink mb-3">
              Faça seus {totalMatches} palpites
            </h2>
            <p className="text-[13px] text-ink-2 leading-relaxed mb-5">
              Pode palpitar agora ou deixar o Quick Pick preencher por você. Edita um por um quando
              quiser.
            </p>

            <div className="flex flex-col gap-2 mb-5">
              <Button
                variant="forest"
                onClick={onPalpitar}
                className="rounded-rebrand-md h-11 gap-2 justify-center"
              >
                <Target className="w-4 h-4" />
                Começar a palpitar
              </Button>
              <Button
                variant="outline-forest"
                onClick={onQuickPick}
                className="rounded-rebrand-md min-h-11 h-auto gap-2 justify-center whitespace-normal py-2 text-center leading-tight"
              >
                <Wand2 className="w-4 h-4 shrink-0" />
                <span>Quick Pick — preencher tudo em 1 clique</span>
              </Button>
            </div>

            <div className="border-t border-line pt-4 space-y-2">
              {nextDeadlineLabel && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-ink-2">Próximo prazo</span>
                  <span className="font-medium text-ink tabular-nums">{nextDeadlineLabel}</span>
                </div>
              )}
              {nextMatch && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-ink-2">Primeiro jogo</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                    <TeamFlag code={nextMatch.home_team_code} size="sm" />
                    {nextMatch.home_team} × {nextMatch.away_team}
                    <TeamFlag code={nextMatch.away_team_code} size="sm" />
                  </span>
                </div>
              )}
              {!nextMatch && pendingCount > 0 && (
                <p className="text-[12px] text-ink-2">
                  {pendingCount} jogo{pendingCount !== 1 ? 's' : ''} pra palpitar
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ─── 2 cards menores: Campeão + Especiais ─── */}
        {(bolao.champion_enabled ?? true) || (bolao.special_predictions_enabled ?? true) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(bolao.champion_enabled ?? true) && (
              <div className="bg-white border border-line rounded-rebrand-lg p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-rebrand-md bg-amber/10 border border-amber/30 grid place-items-center text-amber-2 shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink leading-tight">
                    Palpite de Campeão
                  </p>
                  <p className="text-[12px] text-ink-2 mt-0.5 leading-tight">
                    Quem ganha a Copa? Vale {bolao.champion_points || 10}pts. Pode mudar até a
                    final.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onChampionPick}
                  className="rounded-rebrand-md bg-white border border-line text-ink-2 hover:bg-canvas-2 hover:text-ink gap-1 shrink-0"
                >
                  Escolher
                </Button>
              </div>
            )}

            {(bolao.special_predictions_enabled ?? true) && (
              <div className="bg-white border border-line rounded-rebrand-lg p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-rebrand-md bg-canvas-2 border border-line grid place-items-center text-forest shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink leading-tight">
                    Palpites Especiais
                  </p>
                  <p className="text-[12px] text-ink-2 mt-0.5 leading-tight">
                    Finalistas, semis, quartas e mata-mata. Até 19pts.
                  </p>
                </div>
                {bolao.is_premium ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSpecialPicks}
                    className="rounded-rebrand-md bg-white border border-line text-ink-2 hover:bg-canvas-2 hover:text-ink gap-1 shrink-0"
                  >
                    Ver
                  </Button>
                ) : (
                  <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber/15 text-amber-2 border border-amber/30 shrink-0">
                    PREMIUM
                  </span>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
