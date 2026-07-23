// ============================================================
// gen-sitemap.mjs — gera public/sitemap.xml a partir da lista de rotas públicas.
// Roda no `prebuild` (antes do vite build), então o sitemap que vai pro dist
// está sempre em sincronia com esta lista. Antes era mantido na mão e ficou
// defasado (5 URLs, faltando /futebol, /bolao, /como-usar...).
//
// Fonte única das rotas indexáveis. Ao criar/remover uma página pública,
// atualize AQUI (e bump o `lastmod` quando o conteúdo da página mudar — não
// use a data do build, senão o lastmod muda todo dia sem o conteúdo mudar e o
// Google passa a ignorá-lo).
// ============================================================
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SITE_URL = "https://www.smartbetting.app";

// Só rotas públicas de conteúdo. NÃO listar: rotas com login (ProtectedRoute),
// paywalls, checkout, waitlist, nem rotas com parâmetro dinâmico sem versão
// pública fixa. Precisa bater com o Disallow do robots.txt.
const ROUTES = [
  { path: "/", changefreq: "daily", priority: "1.0", lastmod: "2026-07-22" },
  { path: "/nba", changefreq: "weekly", priority: "0.9", lastmod: "2026-07-22" },
  { path: "/futebol", changefreq: "daily", priority: "0.9", lastmod: "2026-07-22" },
  { path: "/futebol/comecar", changefreq: "weekly", priority: "0.8", lastmod: "2026-07-22" },
  { path: "/betinho", changefreq: "weekly", priority: "0.8", lastmod: "2026-07-22" },
  { path: "/bolao", changefreq: "weekly", priority: "0.7", lastmod: "2026-07-22" },
  { path: "/bolao/comecar", changefreq: "weekly", priority: "0.7", lastmod: "2026-07-22" },
  { path: "/como-usar", changefreq: "monthly", priority: "0.6", lastmod: "2026-07-22" },
  { path: "/privacidade", changefreq: "yearly", priority: "0.3", lastmod: "2026-07-22" },
  { path: "/termos", changefreq: "yearly", priority: "0.3", lastmod: "2026-07-22" },
];

const body = ROUTES.map(
  (r) =>
    `  <url>\n` +
    `    <loc>${SITE_URL}${r.path}</loc>\n` +
    `    <lastmod>${r.lastmod}</lastmod>\n` +
    `    <changefreq>${r.changefreq}</changefreq>\n` +
    `    <priority>${r.priority}</priority>\n` +
    `  </url>`,
).join("\n");

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  `${body}\n` +
  `</urlset>\n`;

const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sitemap.xml");
writeFileSync(outPath, xml, "utf8");
console.log(`[gen-sitemap] ${ROUTES.length} URLs → public/sitemap.xml`);
