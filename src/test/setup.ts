/**
 * Setup global executado antes de todos os testes.
 * - Adiciona matchers extras do jest-dom (toBeInTheDocument, toHaveClass, etc.)
 * - Faz cleanup automático do DOM entre testes
 * - Dá folga ao limite de espera da testing-library (ver abaixo)
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

/**
 * O limite de cada `findBy`/`waitFor`, e por que ele não é o padrão de 1s.
 *
 * `userEvent` digita caractere a caractere e espera o React entre cada passo.
 * Com a suíte inteira em paralelo — e mais ainda quando um `tsc` divide a CPU
 * na mesma máquina —, esse 1s estoura por saturação e não por regressão: os
 * mesmos testes passam sozinhos, no mesmo commit. Já apareceu em três arquivos
 * diferentes (Onboarding, OportunidadesFiltros, RegistrarAposta), sempre nos
 * que usam `userEvent`.
 *
 * Vive AQUI e não em cada arquivo porque o valor já estava copiado em três
 * lugares com o mesmo comentário — e um teste que pisca é pior que um teste
 * lento: ele ensina o time a reexecutar sem ler.
 */
configure({ asyncUtilTimeout: 10_000 });

/**
 * `matchMedia`, que o jsdom não implementa.
 *
 * O `useIsMobile` chama isto para saber a largura, e sem o stub qualquer
 * componente que decida arranjo por breakpoint quebra o teste com
 * "window.matchMedia is not a function" — um erro que fala de ambiente e não do
 * que o teste queria dizer.
 *
 * Responde SEMPRE `matches: false`, ou seja, desktop. É o mesmo lado que o
 * `window.innerWidth` padrão do jsdom (1024) já dá ao estado inicial do hook,
 * então o stub concorda com ele em vez de criar um terceiro comportamento.
 * Teste que precise do celular mocka o hook, como o da FaixaPartida faz.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((consulta: string) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
});
