import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    watch: {
      // As worktrees têm um `node_modules` e um `dist` cada uma, e o vigia do
      // Vite entrava nelas: cada recompilação de uma worktree virava centenas
      // de "page reload" aqui, e a memória subia até o sistema derrubar o
      // servidor. Aconteceu duas vezes numa tarde.
      //
      // `dist/` também fica de fora: é saída de build, e vigiar o que a gente
      // mesmo gera é recarregar a página por causa do próprio build.
      //
      // ⚠️ Função, e não padrão de glob. A primeira versão era
      // `**/worktrees/**`, e o vigia compara com o caminho ABSOLUTO do arquivo:
      // um servidor rodando de dentro de uma worktree tem "worktrees" no
      // próprio caminho, então ignorava todos os arquivos e a recarga
      // automática morria. Um caminho absoluto no padrão também não serve no
      // Windows, onde a barra invertida vira escape de glob. Relativo à raiz,
      // com a barra normalizada, vale nos dois casos.
      ignored: (arquivo: string) => {
        const relativo = path.relative(__dirname, arquivo).replace(/\\/g, "/");
        return ["dist", ".claude/worktrees"].some(
          (pasta) => relativo === pasta || relativo.startsWith(`${pasta}/`),
        );
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Por padrão o Vite varre todo `**/*.html` atrás de entry points e tenta
    // resolver os imports. Os UI kits estáticos em docs/design-system/ são
    // protótipos (CDN, caminhos relativos) e quebram o scan — a app tem um
    // entry point só.
    entries: ["index.html"],
  },
}));
