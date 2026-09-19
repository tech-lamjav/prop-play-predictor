/**
 * Captura um nó da página como PNG.
 *
 * ⚠️ O `html2canvas` é baixado SOB DEMANDA, na primeira captura. São 401 kB de
 * código-fonte (medidos por sourcemap), e o `import` estático dele punha tudo
 * isso dentro do pacote de entrada — o arquivo que TODA página espera baixar e
 * interpretar antes de desenhar o primeiro pixel. Quem abria o Futebol no
 * celular pagava a biblioteca de captura de tela do bolão para ver uma lista de
 * jogos.
 *
 * Só quem clica em "compartilhar" baixa. E como o clique já é assíncrono (a
 * captura sempre foi um `await`), a espera extra cai no mesmo lugar onde o
 * usuário já esperava.
 */
export async function capturarEmPng(
  no: HTMLElement,
  opcoes: { escala?: number } = {},
): Promise<Blob | null> {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(no, {
    backgroundColor: null,
    scale: opcoes.escala ?? 2,
    useCORS: true,
    logging: false,
  });
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png', 0.95),
  );
}
