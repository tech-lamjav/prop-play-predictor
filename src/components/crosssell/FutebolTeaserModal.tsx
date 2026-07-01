import React, { useState } from 'react';
import { Flame, ArrowRight } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ResponsiveModal } from './ResponsiveModal';

interface FutebolTeaserModalProps {
  open: boolean;
  /** Fecha sem avançar. Recebe o estado do checkbox "não mostrar de novo". */
  onDismiss: (dontShowAgain: boolean) => void;
  /** CTA principal — abre o preview. Recebe o estado do checkbox. */
  onCta: (dontShowAgain: boolean) => void;
}

/**
 * Pop-up teaser (nível 1) do cross-sell da Plataforma Futebol.
 * Estilo usa os tokens do rebrand "Direção A" via wrapper `theme-bolao`,
 * então fica consistente em qualquer página do app.
 */
export const FutebolTeaserModal: React.FC<FutebolTeaserModalProps> = ({
  open,
  onDismiss,
  onCta,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => { if (!next) onDismiss(dontShowAgain); }}
      title="Plataforma de Futebol em breve"
      className="theme-bolao bg-canvas border border-amber/50 w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-md p-0 overflow-hidden rounded-rebrand-xl sm:rounded-rebrand-xl"
    >
      <div className="px-6 pt-6 pb-6">
        {/* Hero */}
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/[0.12] border border-amber/40 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-2">
            <Flame className="w-3.5 h-3.5" />
            Em breve
          </span>
          <h2 className="font-display text-[22px] font-bold text-ink mt-3 leading-tight">
            A análise de futebol tá chegando
          </h2>
          <p className="text-[14px] text-ink-2 mt-2 leading-snug">
            Você já joga o bolão da Copa. Agora vem o app que mostra as principais
            oportunidades de aposta em cada jogo, com os prós e contras de cada uma.
          </p>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => onCta(dontShowAgain)}
          className="w-full h-12 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 inline-flex items-center justify-center gap-1.5 font-bold text-[13px] transition-colors shadow-sm"
        >
          Ver o que vem aí
          <ArrowRight className="w-4 h-4" />
        </button>

        {/* Opt-out minimalista + agora não */}
        <div className="flex items-center justify-between mt-4">
          <label className="flex items-center gap-2 cursor-pointer select-none group">
            <Checkbox
              checked={dontShowAgain}
              onCheckedChange={(v) => setDontShowAgain(v === true)}
              className="h-3.5 w-3.5 border-line-2 data-[state=checked]:bg-ink-3 data-[state=checked]:border-ink-3"
            />
            <span className="text-[11px] text-ink-3 group-hover:text-ink-2 transition-colors">
              Não mostrar de novo
            </span>
          </label>
          <button
            type="button"
            onClick={() => onDismiss(dontShowAgain)}
            className="text-[11px] text-ink-3 hover:text-ink-2 transition-colors"
          >
            Agora não
          </button>
        </div>
      </div>
    </ResponsiveModal>
  );
};
