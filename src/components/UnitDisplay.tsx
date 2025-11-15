import React from 'react';
import { useUserUnit } from '@/hooks/use-user-unit';
import { cn } from '@/lib/utils';

interface UnitDisplayProps {
  /**
   * Monetary value in reais (R$)
   */
  value: number;
  /**
   * Number of decimal places for unit display (default: 2)
   */
  unitDecimals?: number;
  /**
   * Custom className for the container
   */
  className?: string;
  /**
   * Show only monetary value (ignore unit configuration)
   */
  monetaryOnly?: boolean;
  /**
   * Show only unit value (ignore monetary)
   */
  unitOnly?: boolean;
  /**
   * Custom formatter for monetary value
   */
  formatMonetary?: (value: number) => string;
}

/**
 * Component to display monetary values with optional unit conversion
 * 
 * @example
 * <UnitDisplay value={150.50} />
 * // Output: "R$ 150,50 / 1.51 u" (if unit configured)
 * // Output: "R$ 150,50" (if unit not configured)
 */
export function UnitDisplay({
  value,
  unitDecimals = 2,
  className,
  monetaryOnly = false,
  unitOnly = false,
  formatMonetary,
}: UnitDisplayProps) {
  const { formatCurrency, formatUnits, toUnits, isConfigured } = useUserUnit();

  const formatMonetaryValue = formatMonetary || formatCurrency;
  const units = toUnits(value);
  const hasUnits = isConfigured() && units !== null && !monetaryOnly;

  if (unitOnly && hasUnits && units !== null) {
    return (
      <span className={className}>
        {formatUnits(units, unitDecimals)}
      </span>
    );
  }

  if (!hasUnits || monetaryOnly) {
    return (
      <span className={className}>
        {formatMonetaryValue(value)}
      </span>
    );
  }

  return (
    <span className={cn("flex flex-col gap-0.5 w-full max-w-full", className)}>
      <span className="whitespace-nowrap">{formatMonetaryValue(value)}</span>
      <span className="whitespace-nowrap text-muted-foreground sm:text-foreground text-xs sm:text-sm">/ {formatUnits(units, unitDecimals)}</span>
    </span>
  );
}

/**
 * Simplified component for displaying only unit values
 */
export function UnitValue({ value, decimals = 2, className }: { value: number; decimals?: number; className?: string }) {
  return <UnitDisplay value={value} unitOnly unitDecimals={decimals} className={className} />;
}

/**
 * Simplified component for displaying only monetary values
 */
export function MonetaryValue({ value, className, formatMonetary }: { value: number; className?: string; formatMonetary?: (value: number) => string }) {
  return <UnitDisplay value={value} monetaryOnly formatMonetary={formatMonetary} className={className} />;
}

