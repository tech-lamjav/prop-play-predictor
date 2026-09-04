import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// Vitest config separado do vite.config pra não poluir build de produção.
// Usa o mesmo alias "@" pra imports baterem com o projeto.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,            // expõe describe/it/expect globalmente (sem precisar importar)
    environment: 'jsdom',     // simula DOM do browser pra testar componentes React
    setupFiles: ['./src/test/setup.ts'],
    css: false,               // não processa CSS nos testes (mais rápido)
    /**
     * Quanto cada teste pode levar antes de o vitest matá-lo.
     *
     * São DOIS limites independentes, e confundi-los custa tempo: este cobre o
     * teste inteiro (importar, montar, esperar), e o `asyncUtilTimeout` da
     * testing-library, no setup, governa cada `findBy`/`waitFor` de dentro. Os
     * testes que usam `userEvent` estouravam O DESTE — a mensagem é "Test timed
     * out in 5000ms", não a da testing-library.
     *
     * `userEvent` digita caractere a caractere e espera o React entre os passos.
     * Com a suíte inteira em paralelo — e mais ainda com um `tsc` dividindo a
     * CPU na mesma máquina —, os 5s padrão estouram por saturação, não por
     * regressão: os mesmos testes passam sozinhos, no mesmo commit. Aconteceu em
     * quatro arquivos diferentes, todos os que usam `userEvent`.
     *
     * Um teste que pisca é pior que um teste lento: ele ensina o time a
     * reexecutar sem ler.
     */
    testTimeout: 20_000,
    // Por padrão, Vitest descobre todos os arquivos *.test.ts(x) e *.spec.ts(x)
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
