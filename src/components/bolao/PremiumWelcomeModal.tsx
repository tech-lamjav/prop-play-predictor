import React from 'react';
import {
  Crown, Sparkles, Users, SlidersHorizontal,
  PartyPopper,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PremiumWelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare: () => void;
  onConfigure: () => void;
}

export const PremiumWelcomeModal: React.FC<PremiumWelcomeModalProps> = ({
  open, onOpenChange, onShare, onConfigure,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-bolao bg-canvas border border-amber/50 w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-md p-0 overflow-hidden rounded-rebrand-xl">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="sr-only">Bolão Premium ativado</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6">
          {/* Hero */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-amber to-amber-2 flex items-center justify-center shadow-md">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <h2 className="font-display text-[20px] font-bold text-ink flex items-center justify-center gap-2">
              <PartyPopper className="w-5 h-5 text-amber-2" />
              Premium ativado!
              <Sparkles className="w-5 h-5 text-amber-2" />
            </h2>
            <p className="text-[13px] text-ink-2 mt-2 leading-snug">
              Pagamento confirmado. Agora seu bolão aceita{' '}
              <span className="font-bold text-ink">participantes ilimitados</span> — chama a galera toda.
            </p>
          </div>

          {/* Highlight card */}
          <div className="rounded-rebrand-lg border border-amber/40 bg-amber/[0.08] p-4 mb-6 text-center">
            <Users className="w-6 h-6 text-amber-2 mx-auto mb-2" />
            <p className="text-[13px] font-bold text-ink">Sem limite de pessoas</p>
            <p className="text-[11px] text-ink-2 mt-0.5 leading-snug">
              Convide quantos amigos quiser. Todas as outras features (pontuação custom, palpites especiais, multiplicador por fase) já estavam liberadas.
            </p>
          </div>

          {/* CTAs */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={onShare}
              className="w-full h-12 rounded-rebrand-md bg-amber text-white hover:bg-amber-2 inline-flex items-center justify-center gap-1.5 font-bold text-[13px] transition-colors shadow-sm"
            >
              <Users className="w-4 h-4" />
              Convidar amigos agora
            </button>
            <button
              type="button"
              onClick={onConfigure}
              className="w-full h-11 rounded-rebrand-md border border-amber/50 text-amber-2 hover:bg-amber/[0.08] inline-flex items-center justify-center gap-1.5 font-semibold text-[13px] transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Ajustar configurações do bolão
            </button>
          </div>

          <p className="text-[11px] text-ink-3 text-center mt-4">
            Você pode mudar configurações a qualquer momento
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
