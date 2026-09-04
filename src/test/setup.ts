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

afterEach(() => {
  cleanup();
});
