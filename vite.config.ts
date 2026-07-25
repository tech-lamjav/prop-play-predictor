import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
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
