// Destino de retorno do onboarding do Betinho.
//
// O valor chega pela URL (`/onboarding?return=...`), então a lista é fechada de
// propósito: qualquer coisa fora dela vira a rota segura, e nunca um
// redirecionamento aberto para fora do produto.

export const ONBOARDING_RETURN_FALLBACK = '/inicio';

const ALLOWED_RETURNS: readonly string[] = [
  '/inicio',
  '/futebol',
  '/futebol/oportunidades',
  '/futebol/jogos',
  '/settings',
];

/** Origem que troca a introdução do onboarding para o contexto de alertas. */
export const ONBOARDING_SRC_ALERTAS_FUTEBOL = 'alertas-futebol';

/** Origem de quem se cadastrou vindo de uma landing page do futebol. */
export const ONBOARDING_SRC_LP_FUTEBOL = 'lp-futebol';

export const ONBOARDING_PATH = '/onboarding';

export function resolveOnboardingReturn(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return ONBOARDING_RETURN_FALLBACK;

  const value = raw.trim();
  // Só caminho interno absoluto. "//host" e "/\host" são protocol-relative e
  // levariam para fora do domínio.
  if (!value.startsWith('/')) return ONBOARDING_RETURN_FALLBACK;
  if (value.startsWith('//') || value.startsWith('/\\')) return ONBOARDING_RETURN_FALLBACK;

  const path = value.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return ALLOWED_RETURNS.includes(path) ? path : ONBOARDING_RETURN_FALLBACK;
}

/**
 * O mesmo destino no formato que a tela de login espera em `state.from`.
 *
 * A landing manda quem clicou no CTA para `/auth` dizendo de onde veio, e o
 * cadastro devolve `pathname + search`. Por isso a origem e o destino viajam
 * na `search`: sem ela a pessoa termina o onboarding na rota padrão, que é o
 * hub, e não no produto de onde ela veio.
 */
export function onboardingFrom(
  src: string,
  returnTo?: string,
): { pathname: string; search: string } {
  const params = new URLSearchParams({ src });
  if (returnTo) params.set('return', returnTo);
  return { pathname: ONBOARDING_PATH, search: `?${params.toString()}` };
}

export function onboardingHref(src: string, returnTo?: string): string {
  const { pathname, search } = onboardingFrom(src, returnTo);
  return pathname + search;
}
