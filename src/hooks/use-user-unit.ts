import { useState, useEffect } from 'react';
import { createClient } from '../integrations/supabase/client';
import { useAuth } from './use-auth';

export type UnitCalculationMethod = 'direct' | 'division' | null;

export interface UserUnitConfig {
  unit_value: number | null;
  unit_calculation_method: UnitCalculationMethod;
  bank_amount: number | null;
}

export interface UnitConfigInput {
  method: 'direct' | 'division';
  unitValue?: number; // For direct method
  bankAmount?: number; // For division method
  divisor?: number; // For division method
}

/**
 * Hook to manage user unit configuration
 */
export function useUserUnit() {
  const { user } = useAuth();
  const supabase = createClient();
  const [config, setConfig] = useState<UserUnitConfig>({
    unit_value: null,
    unit_calculation_method: null,
    bank_amount: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user unit configuration
  useEffect(() => {
    const fetchConfig = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('unit_value, unit_calculation_method, bank_amount')
          .eq('id', user.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          // PGRST116 is "not found" which is OK for new users
          throw fetchError;
        }

        if (data) {
          setConfig({
            unit_value: data.unit_value ? parseFloat(data.unit_value.toString()) : null,
            unit_calculation_method: data.unit_calculation_method as UnitCalculationMethod,
            bank_amount: data.bank_amount ? parseFloat(data.bank_amount.toString()) : null,
          });
        }
      } catch (err) {
        console.error('Error fetching unit config:', err);
        setError(err instanceof Error ? err.message : 'Erro ao buscar configuração');
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [user?.id, supabase]);

  /**
   * Update user unit configuration
   */
  const updateConfig = async (input: UnitConfigInput): Promise<boolean> => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      let unitValue: number;
      let bankAmount: number | null = null;

      if (input.method === 'direct') {
        if (!input.unitValue || input.unitValue <= 0) {
          throw new Error('Valor da unidade deve ser maior que zero');
        }
        unitValue = input.unitValue;
      } else {
        // division method
        if (!input.bankAmount || input.bankAmount <= 0) {
          throw new Error('Valor da banca deve ser maior que zero');
        }
        if (!input.divisor || input.divisor <= 0) {
          throw new Error('Divisor deve ser maior que zero');
        }
        unitValue = input.bankAmount / input.divisor;
        bankAmount = input.bankAmount;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({
          unit_value: unitValue,
          unit_calculation_method: input.method,
          bank_amount: bankAmount,
        })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state
      setConfig({
        unit_value: unitValue,
        unit_calculation_method: input.method,
        bank_amount: bankAmount,
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar configuração';
      setError(errorMessage);
      console.error('Error updating unit config:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Clear unit configuration
   */
  const clearConfig = async (): Promise<boolean> => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          unit_value: null,
          unit_calculation_method: null,
          bank_amount: null,
        })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      setConfig({
        unit_value: null,
        unit_calculation_method: null,
        bank_amount: null,
      });

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao limpar configuração';
      setError(errorMessage);
      console.error('Error clearing unit config:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Convert monetary value to units
   */
  const toUnits = (monetaryValue: number): number | null => {
    if (!config.unit_value || config.unit_value <= 0) {
      return null;
    }
    return monetaryValue / config.unit_value;
  };

  /**
   * Format value in units
   */
  const formatUnits = (units: number | null, decimals: number = 2): string => {
    if (units === null) {
      return '';
    }
    return `${units.toFixed(decimals)} u`;
  };

  /**
   * Format monetary value with units (if configured)
   */
  const formatWithUnits = (monetaryValue: number, decimals: number = 2): string => {
    const units = toUnits(monetaryValue);
    if (units === null) {
      return formatCurrency(monetaryValue);
    }
    return `${formatCurrency(monetaryValue)} / ${formatUnits(units, decimals)}`;
  };

  /**
   * Format currency (helper function)
   */
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  /**
   * Check if unit system is configured
   */
  const isConfigured = (): boolean => {
    return config.unit_value !== null && config.unit_value > 0;
  };

  return {
    config,
    isLoading,
    error,
    updateConfig,
    clearConfig,
    toUnits,
    formatUnits,
    formatWithUnits,
    formatCurrency,
    isConfigured,
  };
}

