import React from 'react';

/**
 * Wrapper de `React.lazy` que detecta falha de fetch de chunk (típico
 * após deploy novo com hashes de chunks diferentes — chunks antigos
 * cacheados pelo navegador apontam pra arquivos que não existem mais
 * no servidor) e força `window.location.reload()` pra pegar o build novo.
 *
 * Bug original: user com tab aberta há horas, deploy entra em prod, hash
 * dos chunks mudam. User clica em algo que dispara lazy load → "Failed to
 * fetch dynamically imported module" → tela branca/preta.
 *
 * Estratégia:
 *   1. Tenta carregar normalmente
 *   2. Se erro casar com `Failed to fetch dynamically imported module`
 *      (ou padrões similares em outros browsers), seta uma flag em
 *      sessionStorage e força reload
 *   3. A flag previne loop infinito: se já tentou reload nessa sessão
 *      e ainda falha, propaga o erro (vai pro ErrorBoundary ou tela de
 *      erro genérica)
 *
 * Uso:
 *   const BolaoWelcome = lazyWithRetry(() => import('./pages/BolaoWelcome'));
 */
export function lazyWithRetry<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const sessionKey = '__lazy-reload-attempted__';

    try {
      const mod = await factory();
      // Sucesso: limpa a flag pra próximo deploy começar limpo
      try {
        sessionStorage.removeItem(sessionKey);
      } catch {
        // sessionStorage pode falhar em modo privado — ignora
      }
      return mod;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isChunkLoadError =
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes("error loading dynamically imported module") ||
        msg.includes("Loading chunk");

      if (!isChunkLoadError) {
        // Outro tipo de erro (sintaxe, runtime no módulo, etc.) — propaga
        throw err;
      }

      // Anti-loop: se já tentou reload nessa sessão, desiste e propaga
      let alreadyTried = false;
      try {
        alreadyTried = sessionStorage.getItem(sessionKey) === '1';
      } catch {
        // sessionStorage inacessível — força propagação pra evitar loop
        throw err;
      }

      if (alreadyTried) {
        // Já tentamos reload uma vez nessa sessão e ainda falhou —
        // problema persistente (CDN broken, browser corrupto, etc.).
        // Propaga pra ErrorBoundary mostrar mensagem útil.
        throw err;
      }

      try {
        sessionStorage.setItem(sessionKey, '1');
      } catch {
        // ignora — vamos tentar reload mesmo assim
      }

      window.location.reload();

      // Reload é assíncrono no browser. Retornamos uma Promise que nunca
      // resolve pra impedir React de re-renderizar com erro enquanto a
      // navegação acontece.
      return new Promise<{ default: T }>(() => {});
    }
  });
}
