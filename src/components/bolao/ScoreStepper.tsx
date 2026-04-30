import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface ScoreStepperProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
  min?: number;
  max?: number;
  /**
   * Quando true, os botões +/− ficam ocultos em desktop (sm e maior) — usado
   * no modal de palpites onde o user prefere editar via teclado/click no
   * input e não precisa dos steppers visíveis.
   * Em mobile, os botões aparecem normalmente.
   */
  hideButtonsOnDesktop?: boolean;
}

/**
 * Score input with +/− buttons. Number is editable directly (click & type).
 * Used in match prediction rows — designed for fast tap-tap entry on mobile
 * while still letting power users type a number.
 */
export const ScoreStepper: React.FC<ScoreStepperProps> = ({
  value,
  onChange,
  disabled,
  ariaLabel,
  min = 0,
  max = 20,
  hideButtonsOnDesktop,
}) => {
  const numeric = value === '' ? null : Number(value);

  const dec = () => {
    if (disabled) return;
    const current = numeric ?? 0;
    const next = Math.max(min, current - 1);
    onChange(String(next));
  };

  const inc = () => {
    if (disabled) return;
    const current = numeric ?? -1;
    const next = Math.min(max, current + 1);
    onChange(String(next));
  };

  const onInputChange = (raw: string) => {
    if (raw === '') {
      onChange('');
      return;
    }
    const digits = raw.replace(/[^\d]/g, '');
    if (digits === '') {
      onChange('');
      return;
    }
    const n = Math.min(max, Math.max(min, Number(digits)));
    onChange(String(n));
  };

  const buttonHideClass = hideButtonsOnDesktop ? 'sm:hidden' : '';

  return (
    <div
      className="inline-flex items-center gap-1.5"
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={dec}
        disabled={disabled || (numeric ?? 0) <= min}
        aria-label={`Diminuir ${ariaLabel}`}
        className={`w-9 h-9 flex items-center justify-center rounded-rebrand-md border border-line bg-white text-ink-2 hover:bg-canvas-2 hover:text-ink hover:border-line-2 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all ${buttonHideClass}`}
      >
        <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onInputChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className="w-12 h-11 text-center text-lg font-bold bg-white border border-line rounded-rebrand-md focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/25 disabled:opacity-40 text-ink tabular-nums shadow-sm"
        placeholder="-"
      />
      <button
        type="button"
        onClick={inc}
        disabled={disabled || (numeric ?? -1) >= max}
        aria-label={`Aumentar ${ariaLabel}`}
        className={`w-9 h-9 flex items-center justify-center rounded-rebrand-md border border-line bg-white text-ink-2 hover:bg-canvas-2 hover:text-ink hover:border-line-2 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all ${buttonHideClass}`}
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );
};
