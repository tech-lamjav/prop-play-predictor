import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '../integrations/supabase/client';

export type CapitalMovementType = 'deposit' | 'withdrawal';
export type CapitalMovementSource = 'manual' | 'bankroll_edit';

export interface CapitalMovement {
  id: string;
  user_id: string;
  type: CapitalMovementType;
  amount: number;
  movement_date: string;
  description: string | null;
  source: CapitalMovementSource;
  affects_balance: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddCapitalMovementInput {
  type: CapitalMovementType;
  amount: number;
  movement_date?: string;
  description?: string;
  source?: CapitalMovementSource;
  affects_balance?: boolean;
}

export function useCapitalMovements(userId: string | undefined) {
  const [movements, setMovements] = useState<CapitalMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const fetchMovements = useCallback(async () => {
    if (!userId) {
      setMovements([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('capital_movements')
        .select('*')
        .eq('user_id', userId)
        .order('movement_date', { ascending: true });

      if (fetchError) throw fetchError;

      setMovements(
        (data || []).map((row) => ({
          ...row,
          type: row.type as CapitalMovementType,
          source: row.source as CapitalMovementSource,
          amount: parseFloat(row.amount?.toString() ?? '0'),
        })) as CapitalMovement[]
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar movimentações');
      setMovements([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  const addMovement = useCallback(
    async (input: AddCapitalMovementInput): Promise<CapitalMovement | null> => {
      if (!userId) return null;

      try {
        const { data, error: insertError } = await supabase
          .from('capital_movements')
          .insert({
            user_id: userId,
            type: input.type,
            amount: input.amount,
            movement_date: input.movement_date ?? new Date().toISOString(),
            description: input.description ?? null,
            source: input.source ?? 'manual',
            affects_balance: input.affects_balance ?? true,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        const movement: CapitalMovement = {
          ...data,
          type: data.type as CapitalMovementType,
          source: data.source as CapitalMovementSource,
          amount: parseFloat(data.amount?.toString() ?? '0'),
        };
        setMovements((prev) => [...prev, movement].sort((a, b) => new Date(a.movement_date).getTime() - new Date(b.movement_date).getTime()));
        return movement;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao adicionar movimentação');
        throw err;
      }
    },
    [userId, supabase]
  );

  const updateMovement = useCallback(
    async (id: string, input: Partial<AddCapitalMovementInput>): Promise<CapitalMovement | null> => {
      if (!userId) return null;

      const updates: Record<string, unknown> = {};
      if (input.amount !== undefined) updates.amount = input.amount;
      if (input.description !== undefined) updates.description = input.description ?? null;
      if (input.movement_date !== undefined) updates.movement_date = input.movement_date;
      if (input.type !== undefined) updates.type = input.type;
      if (Object.keys(updates).length === 0) return null;

      try {
        const { data, error: updateError } = await supabase
          .from('capital_movements')
          .update(updates)
          .eq('id', id)
          .eq('user_id', userId)
          .select()
          .single();

        if (updateError) throw updateError;

        const movement: CapitalMovement = {
          ...data,
          type: data.type as CapitalMovementType,
          source: data.source as CapitalMovementSource,
          amount: parseFloat(data.amount?.toString() ?? '0'),
        };
        setMovements((prev) =>
          prev.map((m) => (m.id === id ? movement : m)).sort((a, b) => new Date(a.movement_date).getTime() - new Date(b.movement_date).getTime())
        );
        return movement;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao atualizar movimentação');
        throw err;
      }
    },
    [userId, supabase]
  );

  const deleteMovement = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId) return false;

      try {
        const { error: deleteError } = await supabase.from('capital_movements').delete().eq('id', id).eq('user_id', userId);

        if (deleteError) throw deleteError;

        setMovements((prev) => prev.filter((m) => m.id !== id));
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao excluir movimentação');
        throw err;
      }
    },
    [userId, supabase]
  );

  const netBalanceImpact = useMemo(() => {
    return movements
      .filter((m) => m.affects_balance)
      .reduce((sum, m) => (m.type === 'deposit' ? sum + m.amount : sum - m.amount), 0);
  }, [movements]);

  const movementsOrderedByDate = useMemo(() => {
    return [...movements].sort((a, b) => new Date(a.movement_date).getTime() - new Date(b.movement_date).getTime());
  }, [movements]);

  return {
    movements: movementsOrderedByDate,
    isLoading,
    error,
    fetchMovements,
    addMovement,
    updateMovement,
    deleteMovement,
    netBalanceImpact,
  };
}
