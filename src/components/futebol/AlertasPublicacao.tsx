import { ArrowRight, Bell, Send, X } from 'lucide-react';

// Superfícies do controle de alertas dentro de Oportunidades. Ficam aqui, sem
// hook nem navegação própria, para que a página continue sendo a única dona do
// estado e para que cada estado seja testável isoladamente.

export interface AlertasPublicacaoEstado {
  telegramLinked: boolean;
  accessActive: boolean;
  enabled: boolean;
}

/**
 * Cartão explicativo mostrado uma única vez a quem já tem Telegram conectado e
 * acesso ativo. "Entendi" dispensa só a explicação: não pausa nada.
 */
export function AlertasPublicacaoCartao({
  onDismiss,
  isDismissing = false,
}: {
  onDismiss: () => void;
  isDismissing?: boolean;
}) {
  return (
    <div
      role="region"
      aria-label="Novidade: alertas de oportunidades no Telegram"
      className="w-full rounded-rebrand-md bg-forest-tint border border-forest/20 px-4 py-3 flex items-start gap-3"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest/10">
        <Bell className="w-4 h-4 text-forest" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-ink">Agora avisamos no Telegram</p>
        <p className="text-[12px] text-ink-2 mt-0.5">
          Quando uma oportunidade nova for publicada aqui antes do jogo, o Betinho te manda no chat.
          Já está ligado — você pode pausar quando quiser.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          disabled={isDismissing}
          className="mt-2.5 inline-flex items-center rounded-lg bg-forest px-3 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-forest-soft disabled:opacity-60"
        >
          {isDismissing ? 'Salvando...' : 'Entendi'}
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        disabled={isDismissing}
        aria-label="Dispensar explicação"
        className="shrink-0 text-ink-3 hover:text-ink transition-colors disabled:opacity-60"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Status persistente de quem já conectou o Telegram. Recebe o mesmo estado que
 * o convite ao lado para que as duas superfícies leiam a situação da mesma
 * forma. Sem acesso ativo ele continua aparecendo: a preferência é persistente
 * e some-la deixaria a pessoa sem saber se um dia ligou os alertas.
 */
export function AlertasPublicacaoStatus({
  estado,
  onOpenSettings,
}: {
  estado: AlertasPublicacaoEstado;
  onOpenSettings: () => void;
}) {
  const { accessActive, enabled } = estado;
  const ativo = accessActive && enabled;
  const rotulo = !accessActive
    ? 'Alertas sem acesso'
    : enabled ? 'Telegram ativo' : 'Telegram pausado';
  return (
    <div
      role="region"
      aria-label="Status dos alertas no Telegram"
      className={`w-full sm:w-auto min-h-[52px] rounded-rebrand-md border px-3 py-2 flex items-center gap-2 ${
        ativo ? 'bg-forest-tint border-forest/20' : 'bg-canvas-2 border-line'
      }`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${ativo ? 'bg-forest/10' : 'bg-ink-3/10'}`}>
        <Bell className={`w-3.5 h-3.5 ${ativo ? 'text-forest' : 'text-ink-3'}`} />
      </span>
      <div className="flex min-w-0 flex-col">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ativo ? 'bg-forest' : 'bg-ink-3'}`} />
          <p className="text-[12px] font-bold whitespace-nowrap text-ink">{rotulo}</p>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Gerenciar alertas do Telegram"
            className="ml-1 text-[11px] font-semibold text-forest hover:text-forest-soft underline underline-offset-2"
          >
            Gerenciar
          </button>
        </div>
        {/* Visível, não só para leitor de tela: sem a frase, quem perdeu o
            acesso lê "Alertas sem acesso" e conclui que a preferência sumiu. */}
        {!accessActive && (
          <p className="text-[11px] leading-snug text-ink-2 mt-0.5 max-w-[34ch]">
            Sua preferência está salva e volta a valer quando o acesso retornar.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Convite de conexão para quem ainda não pode receber alertas. Não aparece
 * para quem já conectou nem para quem está sem acesso ativo.
 */
export function AlertasPublicacaoAtalho({
  estado,
  onConnect,
}: {
  estado: AlertasPublicacaoEstado;
  onConnect: () => void;
}) {
  const { telegramLinked, accessActive } = estado;
  if (!accessActive || telegramLinked) return null;

  return (
    <button
      type="button"
      onClick={onConnect}
      className="w-full rounded-rebrand-md bg-forest-tint border border-forest/25 px-4 py-3.5 text-left flex flex-col items-stretch gap-3 hover:bg-forest/10 transition-colors sm:flex-row sm:items-center sm:gap-3.5"
    >
      <span className="flex min-w-0 flex-1 items-center gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest">
          <Send className="w-[18px] h-[18px] text-white" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-ink">Receba alertas de publicação no Telegram</span>
          <span className="block text-[12px] text-ink-2 mt-0.5">Conecte sua conta para ser avisado quando uma oportunidade for publicada no painel, antes do jogo.</span>
        </span>
      </span>
      <span className="w-full shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-forest px-3.5 py-2 text-[13px] font-bold text-white sm:w-auto">
        Conectar Telegram
        <ArrowRight className="w-3.5 h-3.5" />
      </span>
    </button>
  );
}
