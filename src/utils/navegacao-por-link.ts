import type { MouseEvent } from 'react';

/**
 * Navegação por link, e não por `navigate()` (issue #341).
 *
 * O módulo de futebol navegava com `<button onClick={() => navigate(...)}>`.
 * Botão não é link: o navegador não enxerga destino nenhum, porque o destino só
 * existe dentro do JavaScript no instante do clique. Por isso clique do meio,
 * Ctrl+clique, "abrir em nova aba" do botão direito, o destino no rodapé ao
 * passar o mouse e o anúncio como link no leitor de tela não funcionavam.
 *
 * Nada disso se implementa: tudo vem de graça de uma tag `<a href>` de verdade,
 * que é o que o `<Link>` do react-router gera. O trabalho é a troca.
 *
 * Sobra um caso onde as duas ações DIVERGEM de propósito: a linha da lista de
 * Jogos, em que o clique simples abre o painel lateral (mesma página) e o clique
 * do meio deve abrir a tela do jogo em outra aba. Ali o `href` aponta para a
 * tela do jogo — que é o destino "de verdade" — e interceptamos apenas o clique
 * simples. É este módulo que decide o que é "apenas".
 */

/** O mínimo que precisamos saber de um clique para decidir de quem ele é. */
export type CliqueDeMouse = Pick<
  MouseEvent,
  'button' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'
>;

/**
 * O clique é nosso para interceptar?
 *
 * Só o esquerdo puro. Cada modificador é uma intenção EXPLÍCITA do usuário sobre
 * onde a página deve abrir — Ctrl e Cmd para aba nova, Shift para janela nova,
 * Alt para baixar —, e o botão do meio é a mesma coisa sem tecla. Interceptar
 * qualquer um deles é desobedecer um pedido claro, e foi por isso que a decisão
 * de produto ficou sendo "clique simples nunca abre aba nova, e clique com
 * modificador nunca deixa de abrir".
 */
export function ehCliqueSimples(e: CliqueDeMouse): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

/**
 * Um `onClick` para `<Link>` que roda `acao` no clique simples e sai do caminho
 * em todo o resto.
 *
 * O `preventDefault` mora aqui de propósito: ele é o que impede o `<Link>` de
 * navegar, e chamá-lo no clique errado mataria justamente a aba nova que o
 * recurso existe para dar.
 */
export function interceptarCliqueSimples(acao: () => void) {
  // Pede o mínimo que usa — a decisão mais o `preventDefault` — e não o
  // `MouseEvent` inteiro. Exigir o evento completo obrigava o teste a inventar
  // um DOM ou a mentir com `as never`, e um `as never` no teste é o teste
  // deixando de provar o formato que a função realmente precisa.
  return (e: CliqueDeMouse & Pick<MouseEvent, 'preventDefault'>): void => {
    if (!ehCliqueSimples(e)) return;
    e.preventDefault();
    acao();
  };
}
