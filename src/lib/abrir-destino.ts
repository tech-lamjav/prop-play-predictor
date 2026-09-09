import type { NavigateFunction } from 'react-router-dom';

/**
 * O destino é externo ao app?
 *
 * A checagem é pelo esquema completo, e não por um `startsWith('http')`: uma
 * rota interna chamada "/https-guia" casaria com o segundo e sairia do app.
 *
 * Exportada porque o rodapé precisa da MESMA resposta para outra pergunta —
 * ele não navega, ele escolhe entre desenhar uma âncora e desenhar um botão.
 * Duas leituras do que é "externo" é como as duas divergem.
 */
export function ehExterno(href: string): boolean {
  return /^https?:\/\//.test(href);
}

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
 * pessoa para fora perderia a tela em que ela estava. `mailto` não ganha aba: o
 * navegador entrega ao cliente de e-mail sem navegar, e a aba ficaria em branco
 * atrás.
 */
export function abrirDestino(href: string, navigate: NavigateFunction): void {
  if (ehExterno(href)) {
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }
  if (href.startsWith('mailto:')) {
    window.location.href = href;
    return;
  }
  navigate(href);
}
