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
    // Por padrão, Vitest descobre todos os arquivos *.test.ts(x) e *.spec.ts(x)
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
