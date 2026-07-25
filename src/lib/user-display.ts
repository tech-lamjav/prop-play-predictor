/**
 * Iniciais para o avatar (máx. 2 letras). Compartilhado entre o pill do
 * header (UserNav) e a tela `/perfil`, que precisam bater visualmente.
 */
export function getInitials(name?: string | null): string {
  const parts = (name ?? '')
    .split(' ')
    .map((w) => w.trim())
    .filter(Boolean);

  if (parts.length === 0) return 'U';

  return parts
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
