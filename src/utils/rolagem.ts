/**
 * Leva o topo de um elemento para o topo da área visível, respeitando o
 * cabeçalho fixo.
 *
 * Existe por causa da leitura no celular: ao abrir uma premissa, o conteúdo
 * nascia embaixo do dedo e a pessoa ficava no MEIO do que acabou de abrir —
 * tinha de rolar para cima para ler do começo. Abrir e já estar no começo é o
 * comportamento que qualquer sanfona tem.
 *
 * A altura do cabeçalho é MEDIDA, não constante: ela muda entre celular e
 * desktop, e a faixa de ambiente local empurra a barra mais 24px para baixo.
 * Um número fixo acertaria num caso e esconderia o título nos outros.
 *
 * Sem animação para quem pediu menos movimento no sistema — a rolagem continua
 * acontecendo, só que instantânea.
 */
export function rolarParaOTopo(el: HTMLElement | null | undefined): void {
  if (!el || typeof window === 'undefined') return;

  // Depois da pintura: o conteúdo que acabou de abrir ainda não tem altura no
  // mesmo quadro do clique, e medir antes disso erra o destino.
  requestAnimationFrame(() => {
    const nav = document.querySelector('nav');
    const caixa = nav?.getBoundingClientRect();
    // `top` entra na conta porque a barra pode não estar colada no zero (é o
    // caso com a faixa de DEV por cima dela).
    const cabecalho = caixa ? caixa.height + Math.max(0, caixa.top) : 0;
    const alvo = window.scrollY + el.getBoundingClientRect().top - cabecalho - 8;
    const suave = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, alvo), behavior: suave ? 'smooth' : 'auto' });
  });
}
