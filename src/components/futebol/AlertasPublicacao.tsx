import { ArrowRight, Bell, ChevronRight, Send, X } from 'lucide-react';

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
 * Atalho compacto e permanente. Quem ainda não conectou o Telegram vai para o
 * onboarding existente; os demais vão para o mesmo controle em Configurações.
 */
export function AlertasPublicacaoAtalho({
  estado,
  onConnect,
  onOpenSettings,
}: {
  estado: AlertasPublicacaoEstado;
  onConnect: () => void;
  onOpenSettings: () => void;
}) {
  const { telegramLinked, accessActive, enabled } = estado;
  const ativo = telegramLinked && accessActive && enabled;

  // O acesso vem antes do vínculo: sem assinatura nem teste ativo, nenhum
  // alerta é entregue, então convidar para conectar levaria a pessoa a um
  // fluxo que termina numa promessa que o backend não cumpre.
  const titulo = !accessActive
    ? 'Alertas indisponíveis com o acesso atual'
    : !telegramLinked
      ? 'Conecte o Telegram para receber alertas'
      : enabled
        ? 'Alertas do Telegram ativos'
        : 'Alertas do Telegram pausados';

  const descricao = !accessActive
    ? 'Sua preferência está salva e volta a valer quando o acesso retornar.'
    : !telegramLinked
      ? 'Conecte em um toque e receba as novas oportunidades antes do jogo.'
      : enabled
        ? 'Vamos avisar quando uma oportunidade for publicada antes do jogo.'
        : 'Retome nas configurações quando quiser voltar a receber.';

  // Quem já conectou vê só status, então a linha fica discreta. Quem não
  // conectou está diante de um convite, e convite tem que parecer botão.
  if (accessActive && !telegramLinked) {
    return (
      <button
        type="button"
        onClick={onConnect}
        className="w-full rounded-rebrand-md bg-forest-tint border border-forest/25 px-4 py-3.5 text-left flex items-center gap-3.5 hover:bg-forest/10 transition-colors"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest">
          <Send className="w-[18px] h-[18px] text-white" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-ink">{titulo}</span>
          <span className="block text-[12px] text-ink-2 mt-0.5">{descricao}</span>
        </span>
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-forest px-3.5 py-2 text-[13px] font-bold text-white">
          Conectar
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenSettings}
      className="w-full rounded-rebrand-md bg-white border border-line px-4 py-3 text-left flex items-center gap-3 hover:bg-canvas-2 transition-colors"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${ativo ? 'bg-forest' : 'bg-ink-3'}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-ink">{titulo}</span>
        <span className="block text-[12px] text-ink-2 mt-0.5">{descricao}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-ink-3 shrink-0" />
    </button>
  );
}
