import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../integrations/supabase/client';
import { useAuth } from './use-auth';

export interface UserProfile {
  name: string | null;
  email: string;
  whatsapp_number: string | null;
  created_at: string;
}

export interface UserProfileUpdate {
  name?: string | null;
  email?: string;
  whatsapp_number?: string | null;
}

/**
 * Hook to manage user profile (name, email, phone/Telegram)
 * Fetches from users table and supports updates with immediate state reflection.
 */
export function useUserProfile() {
  const { user } = useAuth();
  const supabase = createClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('name, email, whatsapp_number, created_at')
        .eq('id', user.id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        setProfile({
          name: data.name ?? null,
          email: data.email ?? '',
          whatsapp_number: data.whatsapp_number ?? null,
          created_at: data.created_at ?? '',
        });
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar perfil');
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (input: UserProfileUpdate): Promise<boolean> => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.email !== undefined) updates.email = input.email;
      if (input.whatsapp_number !== undefined) updates.whatsapp_number = input.whatsapp_number;

      if (Object.keys(updates).length === 0) {
        setIsSaving(false);
        return true;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state immediately (no refresh needed)
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              ...updates,
            }
          : null
      );

      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erro ao salvar alterações';
      setError(errorMessage);
      console.error('Error updating profile:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    profile,
    isLoading,
    isSaving,
    error,
    updateProfile,
    refetchProfile: fetchProfile,
  };
}
