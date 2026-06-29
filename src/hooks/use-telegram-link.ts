import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/integrations/supabase/client';

/**
 * Status do link de Telegram do usuário (dono do bolão). Usado pra decidir, no
 * admin, se mostramos o switch de aviso de kickoff ou o botão "Conectar Telegram".
 * O linking em si acontece no bot (fluxo já existente em Settings) — aqui só lemos.
 */
export function useTelegramLink(userId: string | undefined) {
  return useQuery({
    queryKey: ['telegram-link', userId],
    enabled: !!userId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('users')
        .select('telegram_chat_id, telegram_username')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return {
        linked: !!data?.telegram_chat_id,
        username: data?.telegram_username ?? null,
      };
    },
  });
}
