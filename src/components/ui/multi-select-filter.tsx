import React, { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Checkbox } from './checkbox';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  /** "terminal" (default, dark) ou "rebrand" (light theme da Direção A) */
  variant?: 'terminal' | 'rebrand';
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = 'TODOS',
  className,
  variant = 'terminal',
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleClear = () => {
    onChange([]);
  };

  const displayText =
    selected.length === 0
      ? placeholder
      : selected.length === 1
      ? options.find((opt) => opt.value === selected[0])?.label || placeholder
      : `${selected.length} SELECIONADOS`;

  const isRebrand = variant === 'rebrand';
  const triggerClasses = isRebrand
    ? 'h-9 px-3 inline-flex items-center gap-2 text-[12px] text-ink-2 border border-line bg-white hover:bg-ink-3/40 rounded-md transition-colors w-full md:w-[145px] font-medium'
    : 'terminal-input w-full md:w-auto md:min-w-[120px] text-xs px-3 py-1.5 rounded-sm justify-between text-left font-normal h-auto flex items-center';
  const popoverClasses = isRebrand
    ? 'theme-rebrand w-auto min-w-[var(--radix-popover-trigger-width)] max-w-[400px] p-0 bg-white border border-line text-ink rounded-md shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)]'
    : 'w-auto min-w-[var(--radix-popover-trigger-width)] max-w-[400px] p-0 bg-terminal-dark-gray border-terminal-border';
  const headerLabelClasses = isRebrand
    ? 'text-[10px] font-semibold tracking-[0.14em] text-ink-2 uppercase'
    : 'text-xs font-bold text-terminal-text uppercase';
  const clearLinkClasses = isRebrand
    ? 'text-xs text-status-danger hover:text-status-danger/80 flex items-center gap-1'
    : 'text-xs text-terminal-red hover:text-terminal-red-bright flex items-center gap-1';
  const optionRowClasses = isRebrand
    ? 'flex items-center gap-2 px-2 py-1.5 hover:bg-canvas cursor-pointer rounded-sm transition-colors'
    : 'flex items-center gap-2 px-2 py-1.5 hover:bg-terminal-black cursor-pointer rounded-sm transition-colors';
  const checkboxClasses = isRebrand
    ? 'h-4 w-4 rounded-full border border-line-2 hover:border-forest/60 data-[state=checked]:bg-forest data-[state=checked]:border-forest [&>span>svg]:h-3 [&>span>svg]:w-3 shrink-0'
    : 'border-terminal-border data-[state=checked]:bg-terminal-green data-[state=checked]:border-terminal-green shrink-0';
  const optionLabelClasses = isRebrand
    ? 'text-xs text-ink whitespace-nowrap'
    : 'text-xs text-terminal-text whitespace-nowrap';

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(triggerClasses, className)}
        >
          {isRebrand ? (
            <>
              <span className="font-semibold uppercase tracking-[0.08em] text-[10px] text-ink-2 shrink-0">{label}</span>
              <span className="text-ink font-medium truncate min-w-0 flex-1 text-left">{displayText}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            </>
          ) : (
            <>
              <span className="truncate">{displayText}</span>
              <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className={popoverClasses} align="start">
        <div className="p-2">
          <div className="flex items-center justify-between mb-2 px-2">
            <span className={headerLabelClasses}>
              {label}
            </span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className={clearLinkClasses}
              >
                <X className="h-3 w-3" />
                Limpar
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {options.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={optionRowClasses}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggle(option.value)}
                    className={checkboxClasses}
                  />
                  <span className={optionLabelClasses}>
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
