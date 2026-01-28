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
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = 'TODOS',
  className,
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

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'terminal-input w-full md:w-auto md:min-w-[120px] text-xs px-3 py-1.5 rounded-sm justify-between text-left font-normal h-auto flex items-center',
            className
          )}
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-[var(--radix-popover-trigger-width)] max-w-[400px] p-0 bg-terminal-dark-gray border-terminal-border"
        align="start"
      >
        <div className="p-2">
          <div className="flex items-center justify-between mb-2 px-2">
            <span className="text-xs font-bold text-terminal-text uppercase">
              {label}
            </span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-terminal-red hover:text-terminal-red-bright flex items-center gap-1"
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
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-terminal-black cursor-pointer rounded-sm transition-colors"
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggle(option.value)}
                    className="border-terminal-border data-[state=checked]:bg-terminal-green data-[state=checked]:border-terminal-green shrink-0"
                  />
                  <span className="text-xs text-terminal-text whitespace-nowrap">
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
