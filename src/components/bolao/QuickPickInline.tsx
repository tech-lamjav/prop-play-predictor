import React from 'react';
import { Target, Flag, Dice5, Loader2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/bolao/ConfirmDialog';
import type { QuickPickPersona } from '@/components/bolao/quick-pick';

const PERSONAS: {
  id: QuickPickPersona;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  iconColor: string;
  borderColor: string;
  bgColor: string;
}[] = [
  {
    id: 'realist',
    icon: Target,
    label: 'Realista',
    description: 'Favorito ganha',
    iconColor: 'text-terminal-blue',
    borderColor: 'border-terminal-blue/40',
    bgColor: 'bg-terminal-blue/10',
  },
  {
    id: 'patriot',
    icon: Flag,
    label: 'Patriota',
    description: 'Brasil vai longe',
    iconColor: 'text-terminal-green',
    borderColor: 'border-terminal-green/40',
    bgColor: 'bg-terminal-green/10',
  },
  {
    id: 'zebra',
    icon: Dice5,
    label: 'Zebreiro',
    description: 'Surpresas',
    iconColor: 'text-orange-400',
    borderColor: 'border-orange-400/40',
    bgColor: 'bg-orange-400/10',
  },
];

interface QuickPickInlineProps {
  remaining: number;
  alreadyFilled: number;
  onApply: (persona: QuickPickPersona) => void;
  isApplying: boolean;
}

/**
 * Banner inline com 3 personas como botões diretos. Mostra um ConfirmDialog
 * antes de aplicar (evita clique acidental sobrescrever palpites existentes).
 */
export const QuickPickInline: React.FC<QuickPickInlineProps> = ({
  remaining,
  alreadyFilled,
  onApply,
  isApplying,
}) => {
  const [activePersona, setActivePersona] = React.useState<QuickPickPersona | null>(null);
  const [pendingPersona, setPendingPersona] = React.useState<QuickPickPersona | null>(null);

  const handleClick = (p: QuickPickPersona) => {
    setPendingPersona(p);
  };

  const handleConfirm = () => {
    if (!pendingPersona) return;
    setActivePersona(pendingPersona);
    onApply(pendingPersona);
    setPendingPersona(null);
  };

  const pendingMeta = PERSONAS.find((p) => p.id === pendingPersona);

  return (
    <>
      <div className="mb-4 rounded-lg border border-terminal-border bg-terminal-dark-gray/30 p-4">
        <p className="text-sm font-bold mb-1">Palpitar tudo em 1 clique</p>
        <p className="text-xs opacity-60 mb-3">
          Escolhe um estilo e a gente preenche os {remaining} jogos pra você. Edita só o que quiser.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PERSONAS.map((p) => {
            const Icon = p.icon;
            const isActive = activePersona === p.id && isApplying;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleClick(p.id)}
                disabled={isApplying}
                className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-lg border-2 transition-all active:scale-95 ${p.borderColor} ${p.bgColor} hover:brightness-125 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100`}
              >
                {isActive ? (
                  <Loader2 className={`w-5 h-5 animate-spin ${p.iconColor}`} />
                ) : (
                  <Icon className={`w-5 h-5 ${p.iconColor}`} />
                )}
                <span className={`text-xs font-bold ${p.iconColor}`}>{p.label}</span>
                <span className="text-[10px] opacity-60">{p.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={pendingPersona !== null}
        onOpenChange={(o) => !o && setPendingPersona(null)}
        title={pendingMeta ? `Aplicar Quick Pick "${pendingMeta.label}"?` : 'Aplicar Quick Pick?'}
        description={
          alreadyFilled > 0
            ? `Você já tem ${alreadyFilled} palpite${alreadyFilled !== 1 ? 's' : ''} feito${alreadyFilled !== 1 ? 's' : ''} — eles serão substituídos. Você poderá desfazer logo após aplicar.`
            : `Vamos preencher ${remaining} palpites pra você. Você pode editar qualquer um depois.`
        }
        confirmLabel={pendingMeta ? `Aplicar ${pendingMeta.label}` : 'Aplicar'}
        onConfirm={handleConfirm}
      />
    </>
  );
};
