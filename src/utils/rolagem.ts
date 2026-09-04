/**
 * Alinha o topo de um elemento logo abaixo do cabeçalho fixo.
 *
 * O nome diz o alvo, e não "rolar ao topo": a página NÃO vai para o começo, o
 * elemento é que sobe até encostar no cabeçalho.
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
export function alinharAbaixoDoCabecalho(el: HTMLElement | null | undefined): void {
  if (!el || typeof window === 'undefined') return;

  // Depois da pintura: o conteúdo que acabou de abrir ainda não tem altura no
  // mesmo quadro do clique, e medir antes disso erra o destino.
  requestAnimationFrame(() => {
    // A barra do produto é o único `nav` colado no topo em todas as telas de
    // futebol. Se um dia houver outro, o `data-cabecalho` é o lugar de marcar
    // qual conta — a busca genérica pegaria o primeiro do documento.
    const nav = document.querySelector('[data-cabecalho], nav');
    const caixa = nav?.getBoundingClientRect();
    // `top` entra na conta porque a barra pode não estar colada no zero (é o
    // caso com a faixa de DEV por cima dela).
    const cabecalho = caixa ? caixa.height + Math.max(0, caixa.top) : 0;
    const alvo = window.scrollY + el.getBoundingClientRect().top - cabecalho - 8;
    const suave = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: Math.max(0, alvo), behavior: suave ? 'smooth' : 'auto' });
  });
}
