import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface ScoreStepperProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
  min?: number;
  max?: number;
}

/**
 * Score input with +/− buttons. Number is editable directly (click & type).
 * Used in match prediction cards — designed for fast tap-tap entry on mobile
 * while still letting power users type a number.
 */
export const ScoreStepper: React.FC<ScoreStepperProps> = ({
  value,
  onChange,
  disabled,
  ariaLabel,
  min = 0,
  max = 20,
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
    const current = numeric ?? -1; // empty + → 0
    const next = Math.min(max, current + 1);
    onChange(String(next));
  };

  const onInputChange = (raw: string) => {
    if (raw === '') {
      onChange('');
      return;
    }
    // Strip non-digits, clamp, no leading zeros
    const digits = raw.replace(/[^\d]/g, '');
    if (digits === '') {
      onChange('');
      return;
    }
    const n = Math.min(max, Math.max(min, Number(digits)));
    onChange(String(n));
  };

  return (
    <div className="inline-flex items-center" role="group" aria-label={ariaLabel}>
      <button
        type="button"
        onClick={dec}
        disabled={disabled || (numeric ?? 0) <= min}
        aria-label={`Diminuir ${ariaLabel}`}
        className="w-8 h-9 flex items-center justify-center rounded text-terminal-text hover:bg-terminal-gray/40 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onInputChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        className="w-11 h-11 text-center text-lg font-bold bg-terminal-dark-gray border border-terminal-border rounded focus:border-terminal-green focus:outline-none focus:ring-1 focus:ring-terminal-green/40 disabled:opacity-40 text-terminal-text tabular-nums"
        placeholder="-"
      />
      <button
        type="button"
        onClick={inc}
        disabled={disabled || (numeric ?? -1) >= max}
        aria-label={`Aumentar ${ariaLabel}`}
        className="w-8 h-9 flex items-center justify-center rounded text-terminal-text hover:bg-terminal-gray/40 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
