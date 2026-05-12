import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Check } from 'lucide-react';

interface AILoadingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  betCount: number;
  onComplete?: () => void;
}

const STEPS = [
  'Carregando histórico',
  'Calculando ROI por liga × mercado',
  'Detectando padrões e vazamentos',
  'Gerando recomendações',
];

const STEP_DURATION = 800; // ms per step
const FINAL_DWELL = 600; // ms to linger on "all done" before closing

export const AILoadingModal: React.FC<AILoadingModalProps> = ({
  open,
  onOpenChange,
  betCount,
  onComplete,
}) => {
  // step is the index currently active. step === STEPS.length means all done.
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep(0);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    // Advance steps sequentially
    for (let i = 1; i <= STEPS.length; i++) {
      timers.push(
        setTimeout(() => {
          setStep(i);
        }, i * STEP_DURATION)
      );
    }
    // Close after final step + dwell
    timers.push(
      setTimeout(
        () => {
          onComplete?.();
          onOpenChange(false);
        },
        STEPS.length * STEP_DURATION + FINAL_DWELL
      )
    );

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [open, onComplete, onOpenChange]);

  const allDone = step >= STEPS.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="theme-rebrand bg-white border-line max-w-md p-8 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.3)] [&>button]:hidden">
        {/* Avatar with spinning ring */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-full bg-forest grid place-items-center relative">
            <span className="text-amber-400 text-[24px] font-bold leading-none">B</span>
            {!allDone && (
              <div className="absolute -inset-1 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            )}
          </div>
        </div>

        <DialogTitle
          className="text-[18px] font-extrabold tracking-tight text-ink text-center"
          style={{ letterSpacing: '-0.01em' }}
        >
          {allDone ? 'Análise pronta' : 'Betinho está analisando…'}
        </DialogTitle>
        <DialogDescription className="text-[12px] text-ink-2 text-center mt-1">
          {allDone
            ? `${betCount} ${betCount === 1 ? 'aposta processada' : 'apostas processadas'}`
            : `Cruzando ${betCount} ${betCount === 1 ? 'aposta' : 'apostas'} do período`}
        </DialogDescription>

        <div className="space-y-2 mt-5">
          {STEPS.map((label, i) => {
            const done = step > i;
            const active = step === i;
            return (
              <div
                key={i}
                className={`flex items-center gap-2.5 text-[12px] ${
                  done ? 'text-forest' : active ? 'text-ink' : 'text-ink-2'
                }`}
              >
                {done ? (
                  <Check className="w-4 h-4 shrink-0" />
                ) : active ? (
                  <div className="w-4 h-4 rounded-full border-2 border-forest border-t-transparent animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-line shrink-0" />
                )}
                <span className={done ? 'line-through opacity-70' : 'font-bold'}>{label}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-line text-center">
          <div className="text-[10px] text-ink-2">
            {allDone ? 'Pronto!' : 'Geralmente leva 3–5 segundos'}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
