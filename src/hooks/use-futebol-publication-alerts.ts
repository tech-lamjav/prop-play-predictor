import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface FutebolPublicationAlerts {
  enabled: boolean;
  telegramLinked: boolean;
  accessActive: boolean;
  /** O cartão explicativo já foi dispensado alguma vez, em qualquer dispositivo. */
  onboardingAcknowledged: boolean;
}

function hasActiveFutebolAccess(status: string | null, trialStartedAt: string | null): boolean {
  if (status === 'premium') return true;
  if (!trialStartedAt) return false;
  return new Date(trialStartedAt).getTime() + 7 * 24 * 60 * 60 * 1000 > Date.now();
}

/**
 * Uma única fonte para o controle que existe no site e no Telegram. A consulta
 * não chama get_futebol_access porque abrir Configurações não deve iniciar o
 * teste gratuito de sete dias.
 */
export function useFutebolPublicationAlerts() {
  const { user } = useAuth();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const queryKey = ['futebol', 'publication-alerts', user?.id ?? 'anon'];

  const query = useQuery<FutebolPublicationAlerts | null>({
    queryKey,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('telegram_chat_id, futebol_publication_alerts_enabled, futebol_publication_alerts_ack_at, futebol_subscription_status, futebol_trial_started_at')
        .eq('id', user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        enabled: data.futebol_publication_alerts_enabled ?? true,
        telegramLinked: !!data.telegram_chat_id,
        accessActive: hasActiveFutebolAccess(data.futebol_subscription_status, data.futebol_trial_started_at),
        onboardingAcknowledged: !!data.futebol_publication_alerts_ack_at,
      };
    },
    staleTime: 30 * 1000,
  });

  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      const { error } = await supabase
        .from('users')
        .update({ futebol_publication_alerts_enabled: enabled })
        .eq('id', user.id);
      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => {
      queryClient.setQueryData<FutebolPublicationAlerts | null>(queryKey, (current) =>
        current ? { ...current, enabled } : current,
      );
    },
  });

  // Dispensar a explicação é independente de pausar: grava só o reconhecimento
  // e nunca toca em futebol_publication_alerts_enabled.
  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      const { error } = await supabase
        .from('users')
        .update({ futebol_publication_alerts_ack_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.setQueryData<FutebolPublicationAlerts | null>(queryKey, (current) =>
        current ? { ...current, onboardingAcknowledged: true } : current,
      );
    },
  });

  return {
    ...query,
    setEnabled: mutation.mutateAsync,
    isSaving: mutation.isPending,
    acknowledgeOnboarding: acknowledgeMutation.mutateAsync,
    isAcknowledging: acknowledgeMutation.isPending,
  };
}
