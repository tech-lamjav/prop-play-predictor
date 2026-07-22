import type { createClient } from '@/integrations/supabase/client';

/**
 * Destino "casa" de um usuário JÁ logado (fonte única de verdade do roteamento
 * pós-login). Regra (decisão de produto, Opção 1 — sem flag/migration):
 *
 *   conectou o Telegram (onboardou) → /inicio (hub dispatcher)
 *   ainda não conectou               → /onboarding (completa o vínculo)
 *
 * Usado no login por e-mail (Auth) e no callback do OAuth (AuthCallback). O
 * cadastro novo NÃO passa por aqui: vai direto pro /onboarding. E o /inicio
 * não re-gateia (quem pulou o onboarding ainda alcança o hub nesta sessão).
 */
export async function resolveHomePath(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from('users')
    .select('telegram_chat_id')
    .eq('id', userId)
    .maybeSingle();
  return data?.telegram_chat_id ? '/inicio' : '/onboarding';
}
