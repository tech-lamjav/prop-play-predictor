import React from 'react';
import { Target, Flag, Dice5, Loader2, ChevronDown, Sparkles, Hash, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/bolao/ConfirmDialog';
import { useUserBoloes } from '@/hooks/use-bolao';
import type {
  QuickPickPersona,
  QuickPickMode,
  QuickPickApplyOpts,
} from '@/components/bolao/quick-pick';

export type { QuickPickApplyOpts, QuickPickMode };

const PERSONAS: {
  id: QuickPickPersona;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  example: string;
  iconColor: string;
}[] = [
  {
    id: 'realist',
    icon: Target,
    label: 'Realista',
    description: 'O favorito sempre ganha',
    example: 'ex: BRA 2×0 SEN, ALE 3×0 CUR',
    iconColor: 'text-status-info',
  },
  {
    id: 'patriot',
    icon: Flag,
    label: 'Patriota',
    description: 'Brasil vai à final',
    example: 'ex: BRA tetra, escapa pelos pênaltis',
    iconColor: 'text-status-success',
  },
  {
    id: 'zebra',
    icon: Dice5,
    label: 'Zebreiro',
    description: 'Surpresa em todo canto',
    example: 'ex: JAP elimina ALE, MAR vai longe',
    iconColor: 'text-status-warning',
  },
  {
    id: 'fixed',
    icon: Hash,
    label: 'Placar fixo',
    description: 'O mesmo placar em todos os jogos',
    example: 'mata-mata: vence o favorito por +1',
    iconColor: 'text-amber-2',
  },
];

interface QuickPickInlineProps {
  remaining: number;
  alreadyFilled: number;
  /** Bolão atual — usado pra excluir da lista de "Copiar de outro bolão" */
  currentBolaoId: string;
  onApply: (opts: QuickPickApplyOpts) => void;
  isApplying: boolean;
}

type PendingState =
  | { kind: 'persona'; persona: QuickPickPersona; fixedScore?: { home: number; away: number } }
  | { kind: 'copy'; sourceBolaoId: string; sourceBolaoName: string };

/**
 * Banner Quick Pick collapsible (rebrand: amber soft).
 * 5 cards: 4 personas + 1 "Copiar de outro bolão" (mostra apenas se o user
 * tem outro bolão com palpites). Confirmação dá 2 opções: preencher só
 * pendentes (default) ou substituir todos (com 2ª confirmação destrutiva).
 */
export const QuickPickInline: React.FC<QuickPickInlineProps> = ({
  remaining,
  alreadyFilled,
  currentBolaoId,
  onApply,
  isApplying,
}) => {
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<PendingState | null>(null);
  const [destructiveConfirm, setDestructiveConfirm] = React.useState<PendingState | null>(null);
  const [open, setOpen] = React.useState(true);
  const [fixedHome, setFixedHome] = React.useState(1);
  const [fixedAway, setFixedAway] = React.useState(1);
  const [selectedSourceId, setSelectedSourceId] = React.useState<string>('');

  // Bolões do usuário com palpites — exclui o atual
  const { data: userBoloes } = useUserBoloes();
  const copyableBoloes = React.useMemo(
    () =>
      (userBoloes ?? [])
        .filter((b) => b.id !== currentBolaoId && b.user_predictions > 0)
        .sort((a, b) => b.user_predictions - a.user_predictions),
    [userBoloes, currentBolaoId]
  );

  const handlePersonaClick = (persona: QuickPickPersona) => {
    if (persona === 'fixed') {
      setPending({ kind: 'persona', persona, fixedScore: { home: fixedHome, away: fixedAway } });
    } else {
      setPending({ kind: 'persona', persona });
    }
  };

  const handleCopyClick = () => {
    const source = copyableBoloes.find((b) => b.id === selectedSourceId);
    if (!source) return;
    setPending({ kind: 'copy', sourceBolaoId: source.id, sourceBolaoName: source.name });
  };

  const dispatch = (state: PendingState, mode: QuickPickMode) => {
    if (state.kind === 'persona') {
      setActiveKey(`persona:${state.persona}`);
      onApply({ kind: 'persona', persona: state.persona, mode, fixedScore: state.fixedScore });
    } else {
      setActiveKey(`copy:${state.sourceBolaoId}`);
      onApply({
        kind: 'copy',
        sourceBolaoId: state.sourceBolaoId,
        sourceBolaoName: state.sourceBolaoName,
        mode,
      });
    }
  };

  const apply = (mode: QuickPickMode) => {
    if (!pending) return;
    dispatch(pending, mode);
    setPending(null);
  };

  const requestSubstituir = () => {
    if (!pending) return;
    if (alreadyFilled === 0) {
      apply('substituir');
      return;
    }
    setDestructiveConfirm(pending);
    setPending(null);
  };

  const confirmSubstituir = () => {
    if (!destructiveConfirm) return;
    dispatch(destructiveConfirm, 'substituir');
    setDestructiveConfirm(null);
  };

  const fixedSummary = (s?: { home: number; away: number }) =>
    s ? ` ${s.home}×${s.away}` : '';

  const titleFor = (s: PendingState | null) => {
    if (!s) return 'Quick Pick';
    if (s.kind === 'persona') {
      const meta = PERSONAS.find((p) => p.id === s.persona);
      return `Quick Pick: ${meta?.label ?? ''}${fixedSummary(s.fixedScore)}`;
    }
    return `Copiar de "${s.sourceBolaoName}"`;
  };

  const sourceLabel = (b: typeof copyableBoloes[number]) =>
    `${b.name} · ${b.user_predictions} palpite${b.user_predictions !== 1 ? 's' : ''}`;

  return (
    <>
      <div className="mb-4 rounded-rebrand-md border border-amber/60 bg-amber/[0.32] shadow-sm overflow-hidden">
        {/* Header clicável (collapse toggle) */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-amber/[0.42] transition-colors"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-amber-2 shrink-0" />
            <p className="text-[13px] font-semibold text-ink truncate">
              Palpitar os {remaining} jogos restantes em 1 clique
            </p>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-ink-2 shrink-0 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        {open && (
          <div className="px-4 pb-4">
            <p className="text-[12px] text-ink-2 mb-3">
              Escolhe um estilo, a gente preenche, você edita o que quiser depois.
            </p>
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${
                copyableBoloes.length > 0
                  ? 'lg:grid-cols-3 xl:grid-cols-5'
                  : 'lg:grid-cols-4'
              }`}
            >
              {PERSONAS.map((p) => {
                const Icon = p.icon;
                const isActive = activeKey === `persona:${p.id}` && isApplying;
                const isFixed = p.id === 'fixed';
                return (
                  <div
                    key={p.id}
                    className="group flex flex-col gap-1.5 p-3 rounded-rebrand-sm border border-line bg-white text-left transition-colors hover:border-amber"
                  >
                    <div className="flex items-center gap-1.5">
                      {isActive ? (
                        <Loader2 className={`w-3.5 h-3.5 animate-spin ${p.iconColor}`} />
                      ) : (
                        <Icon className={`w-3.5 h-3.5 ${p.iconColor}`} />
                      )}
                      <span className="text-[12px] font-bold text-ink">{p.label}</span>
                    </div>
                    <span className="text-[11px] text-ink-2">{p.description}</span>
                    <span className="text-[10px] text-ink-3 italic">{p.example}</span>

                    {isFixed ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <ScoreInput
                          value={fixedHome}
                          onChange={setFixedHome}
                          ariaLabel="Gols mandante"
                        />
                        <span className="text-ink-3 text-[12px] font-bold">×</span>
                        <ScoreInput
                          value={fixedAway}
                          onChange={setFixedAway}
                          ariaLabel="Gols visitante"
                        />
                        <button
                          type="button"
                          onClick={() => handlePersonaClick('fixed')}
                          disabled={isApplying}
                          className="ml-auto h-7 px-2.5 rounded-rebrand-sm bg-forest text-white text-[11px] font-bold hover:bg-forest-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Aplicar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePersonaClick(p.id)}
                        disabled={isApplying}
                        className="mt-1 h-7 px-2.5 rounded-rebrand-sm border border-line text-ink-2 text-[11px] font-semibold hover:border-amber hover:bg-amber/[0.12] hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Usar este estilo
                      </button>
                    )}
                  </div>
                );
              })}

              {/* 5º card: Copiar de outro bolão (só aparece se há fonte disponível) */}
              {copyableBoloes.length > 0 && (
                <div className="group flex flex-col gap-1.5 p-3 rounded-rebrand-sm border border-line bg-white text-left transition-colors hover:border-amber">
                  <div className="flex items-center gap-1.5">
                    {activeKey?.startsWith('copy:') && isApplying ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-forest" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-forest" />
                    )}
                    <span className="text-[12px] font-bold text-ink">Copiar de outro bolão</span>
                  </div>
                  <span className="text-[11px] text-ink-2">
                    Reutiliza palpites que você já fez
                  </span>
                  <span className="text-[10px] text-ink-3 italic">
                    {copyableBoloes.length} bol{copyableBoloes.length !== 1 ? 'ões' : 'ão'} disponí
                    {copyableBoloes.length !== 1 ? 'veis' : 'vel'}
                  </span>

                  <select
                    value={selectedSourceId}
                    onChange={(e) => setSelectedSourceId(e.target.value)}
                    disabled={isApplying}
                    aria-label="Bolão de origem"
                    className="mt-1 h-7 px-2 rounded-rebrand-sm border border-line bg-canvas-2 text-[11px] text-ink focus:border-forest focus:ring-2 focus:ring-forest/15 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">Escolher bolão…</option>
                    {copyableBoloes.map((b) => (
                      <option key={b.id} value={b.id}>
                        {sourceLabel(b)}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleCopyClick}
                    disabled={isApplying || !selectedSourceId}
                    className="mt-1 h-7 px-2.5 rounded-rebrand-sm bg-forest text-white text-[11px] font-bold hover:bg-forest-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Copiar palpites
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 1ª confirmação: 2 caminhos (pendentes vs substituir) */}
      <Dialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) setPending(null);
        }}
      >
        <DialogContent className="theme-bolao bg-canvas border border-line w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-md p-5 rounded-rebrand-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-[18px] font-bold text-ink">
              {titleFor(pending)}
            </DialogTitle>
          </DialogHeader>

          <div className="text-[13px] text-ink-2 leading-relaxed space-y-2 mt-1">
            {alreadyFilled > 0 ? (
              <p>
                Você já tem <span className="font-bold text-ink">{alreadyFilled}</span>{' '}
                palpite{alreadyFilled !== 1 ? 's' : ''} feito
                {alreadyFilled !== 1 ? 's' : ''} e <span className="font-bold text-ink">{remaining}</span>{' '}
                em branco. O que prefere?
              </p>
            ) : (
              <p>
                Vamos preencher os <span className="font-bold text-ink">{remaining}</span> jogos
                restantes. Pode editar qualquer um depois.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-4">
            {alreadyFilled > 0 && remaining > 0 && (
              <button
                type="button"
                onClick={() => apply('pendentes')}
                className="h-11 px-4 rounded-rebrand-md bg-forest text-white text-[13px] font-bold hover:bg-forest-2 transition-colors shadow-sm"
              >
                Preencher só os {remaining} pendentes
              </button>
            )}
            {alreadyFilled === 0 && remaining > 0 && (
              <button
                type="button"
                onClick={() => apply('pendentes')}
                className="h-11 px-4 rounded-rebrand-md bg-forest text-white text-[13px] font-bold hover:bg-forest-2 transition-colors shadow-sm"
              >
                Preencher os {remaining} jogos
              </button>
            )}
            {alreadyFilled > 0 && (
              <button
                type="button"
                onClick={requestSubstituir}
                className="h-11 px-4 rounded-rebrand-md border border-status-danger/40 bg-status-danger/[0.06] text-status-danger text-[13px] font-semibold hover:bg-status-danger/[0.12] transition-colors"
              >
                Substituir todos ({alreadyFilled + remaining})
              </button>
            )}
            <button
              type="button"
              onClick={() => setPending(null)}
              className="h-10 px-4 rounded-rebrand-md text-[13px] font-medium text-ink-2 hover:text-ink hover:bg-canvas-2 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2ª confirmação destrutiva (só aparece se usuário pediu Substituir) */}
      <ConfirmDialog
        open={destructiveConfirm !== null}
        onOpenChange={(o) => !o && setDestructiveConfirm(null)}
        title="Substituir todos os palpites?"
        description={
          destructiveConfirm?.kind === 'copy' ? (
            <p>
              Vai sobrescrever os <span className="font-bold text-ink">{alreadyFilled}</span> palpite
              {alreadyFilled !== 1 ? 's' : ''} que você já fez aqui pelos do bolão{' '}
              <span className="font-bold text-ink">"{destructiveConfirm.sourceBolaoName}"</span>.
              Você pode desfazer logo após aplicar.
            </p>
          ) : (
            <p>
              Vai sobrescrever os <span className="font-bold text-ink">{alreadyFilled}</span> palpite
              {alreadyFilled !== 1 ? 's' : ''} que você já fez com o Quick Pick{' '}
              <span className="font-bold text-ink">
                {destructiveConfirm?.kind === 'persona' &&
                  PERSONAS.find((p) => p.id === destructiveConfirm.persona)?.label}
                {destructiveConfirm?.kind === 'persona' && fixedSummary(destructiveConfirm.fixedScore)}
              </span>
              . Você pode desfazer logo após aplicar.
            </p>
          )
        }
        confirmLabel="Sim, substituir"
        variant="destructive"
        onConfirm={confirmSubstituir}
      />
    </>
  );
};

const ScoreInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  ariaLabel: string;
}> = ({ value, onChange, ariaLabel }) => (
  <input
    type="number"
    min={0}
    max={9}
    inputMode="numeric"
    value={value}
    onChange={(e) => {
      const raw = parseInt(e.target.value, 10);
      if (!Number.isFinite(raw)) {
        onChange(0);
        return;
      }
      onChange(Math.min(9, Math.max(0, raw)));
    }}
    aria-label={ariaLabel}
    className="w-9 h-7 text-center text-[13px] font-bold tabular-nums text-ink bg-canvas-2 border border-line rounded-rebrand-sm focus:border-forest focus:ring-2 focus:ring-forest/15 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  />
);
