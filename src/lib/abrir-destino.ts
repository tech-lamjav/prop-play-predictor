import type { NavigateFunction } from 'react-router-dom';

/**
 * Abre o destino de um item de menu, seja ele rota interna ou link externo.
 *
 * Existe porque a escolha errada aqui é silenciosa e leva a pessoa ao 404: o
 * `navigate` do router trata QUALQUER string como caminho interno, então um
 * link do WhatsApp vira a rota "/https://wa.me/...". O menu da conta e a tela
 * de perfil faziam essa distinção cada um por conta própria, e bastava um deles
 * ganhar um link externo para o defeito aparecer só naquele.
 *
 * Link externo abre em aba nova de propósito: o menu é atalho, e mandar a
 * pessoa para fora perderia a tela em que ela estava. `mailto` e `tel` não
 * ganham aba: o navegador entrega ao aplicativo sem navegar, e a aba ficaria
 * em branco atrás.
 */
export function abrirDestino(href: string, navigate: NavigateFunction): void {
  if (/^https?:\/\//.test(href)) {
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }
  if (/^(mailto|tel):/.test(href)) {
    window.location.href = href;
    return;
  }
  navigate(href);
}
