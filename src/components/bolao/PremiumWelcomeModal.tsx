import React, { useEffect, useState } from 'react';
import {
  Crown, Sparkles, Users, SlidersHorizontal, Star, Zap, Palette, Check,
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

const FEATURES = [
  { icon: Users,             text: 'Participantes ilimitados' },
  { icon: SlidersHorizontal, text: 'Pontuação customizável' },
  { icon: Star,              text: 'Palpites especiais (campeão, finalistas...)' },
  { icon: Zap,               text: 'Multiplicador por fase: até 5× nos mata-matas' },
  { icon: Palette,           text: 'Logo e cor personalizados' },
];

export const PremiumWelcomeModal: React.FC<PremiumWelcomeModalProps> = ({
  open, onOpenChange, onShare, onConfigure,
}) => {
  const [revealed, setRevealed] = useState(0);

  // Stagger feature reveal — 100ms por item, fica festivo sem ser exagerado.
  useEffect(() => {
    if (!open) {
      setRevealed(0);
      return;
    }
    const id = setInterval(() => {
      setRevealed(r => {
        if (r >= FEATURES.length) {
          clearInterval(id);
          return r;
        }
        return r + 1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-terminal-bg border-yellow-500/40 max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="sr-only">Bolão Premium ativado</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6">
          {/* Hero */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30">
              <Crown className="w-8 h-8 text-terminal-bg" />
            </div>
            <h2 className="text-xl font-bold text-yellow-300 flex items-center justify-center gap-2">
              <PartyPopper className="w-5 h-5" />
              Bolão Premium ativado!
              <Sparkles className="w-5 h-5" />
            </h2>
            <p className="text-sm opacity-60 mt-1">
              Pagamento confirmado · Você desbloqueou tudo isso:
            </p>
          </div>

          {/* Features list with stagger animation */}
          <ul className="space-y-2.5 mb-6">
            {FEATURES.map((f, i) => {
              const isShown = i < revealed;
              return (
                <li
                  key={f.text}
                  className={`flex items-center gap-3 transition-all duration-300 ${
                    isShown ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <f.icon className="w-3.5 h-3.5 text-yellow-400/80 shrink-0" />
                    <span className="text-sm">{f.text}</span>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* CTAs */}
          <div className="space-y-2">
            <Button
              onClick={onShare}
              className="w-full bg-yellow-500 text-terminal-bg hover:bg-yellow-400 active:bg-yellow-600 font-bold gap-1.5 h-12 text-sm"
            >
              <Users className="w-4 h-4" />
              Convidar amigos agora
            </Button>
            <Button
              variant="outline"
              onClick={onConfigure}
              className="w-full border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10 gap-1.5 h-11 text-sm"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Configurar pontuação e palpites especiais
            </Button>
          </div>

          <p className="text-[11px] opacity-40 text-center mt-4">
            Você pode mudar essas configurações a qualquer momento
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
