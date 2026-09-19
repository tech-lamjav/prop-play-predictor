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
/**
 * Determina pra onde redirecionar o user após login/signup bem-sucedido.
 *
 * 1. Se houver `location.state.from` (ProtectedRoute setou — ex: link de
 *    convite, deep link), respeita. Mantém compatibilidade com fluxos que
 *    dependem disso (BolaoLP `/bolao/comecar` passa `state.from`, e as landings
 *    do futebol passam o onboarding com o destino na query).
 * 2. Senão, usa o `fallback` que o chamador passar. Login manda o resultado do
 *    `resolveHomePath` (/inicio ou /onboarding); cadastro manda
 *    `/onboarding?src=signup`.
 *
 * Bug histórico que esta função corrige: `handleSignUp` ignorava
 * `state.from` (hard-coded `/onboarding`), então quem vinha da LP do bolão
 * via signup caía no onboarding em vez do bolão.
 *
 * Mora aqui, e não dentro da tela de login, porque é decisão de roteamento
 * pós-login como o `resolveHomePath` abaixo — e porque lá dentro ela era
 * privada e ninguém conseguia testá-la.
 */
export function getRedirectTarget(
  state: unknown,
  // Sem default: os dois chamadores passam destino explícito, e um default
  // implícito aqui já apontou pro `/bolao` muito depois da Copa acabar.
  fallback: string,
): string {
  const from = (state as { from?: { pathname?: string; search?: string } } | null)?.from;
  if (
    from?.pathname &&
    from.pathname.startsWith('/') &&
    !from.pathname.startsWith('//') // proteção contra open redirect
  ) {
    return from.pathname + (from.search || '');
  }
  return fallback;
}

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
