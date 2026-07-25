// ============================================================
// gen-sitemap.mjs — gera public/sitemap.xml a partir de src/seo/public-routes.json.
// Roda no `prebuild` (antes do vite build), então o sitemap que vai pro dist
// está sempre em sincronia. Antes era mantido na mão e ficou defasado (5 URLs).
//
// A lista de rotas NÃO vive aqui: vive no public-routes.json, que também
// alimenta o <Seo> das páginas e o gen-route-heads (o <head> servido). Um só
// lugar pra editar, então não existe rota que entre no sitemap e não no shell.
// Ao mexer, bump o `lastmod` da rota só quando o conteúdo dela mudar de fato
// (data de build faria o lastmod mudar todo dia e o Google passaria a ignorar).
// ============================================================
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SITE_URL = "https://www.smartbetting.app";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// `sitemap: false` marca rota que tem <head> próprio mas fica fora do índice
// (ex.: /betinho/bolao, variante de campanha da mesma página).
const ROUTES = JSON.parse(
  readFileSync(join(ROOT, "src", "seo", "public-routes.json"), "utf8"),
).filter((r) => r.sitemap);

const body = ROUTES.map(
  (r) =>
    `  <url>\n` +
    `    <loc>${SITE_URL}${r.path}</loc>\n` +
    `    <lastmod>${r.sitemap.lastmod}</lastmod>\n` +
    `    <changefreq>${r.sitemap.changefreq}</changefreq>\n` +
    `    <priority>${r.sitemap.priority}</priority>\n` +
    `  </url>`,
).join("\n");

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  `${body}\n` +
  `</urlset>\n`;

const outPath = join(ROOT, "public", "sitemap.xml");
writeFileSync(outPath, xml, "utf8");
console.log(`[gen-sitemap] ${ROUTES.length} URLs → public/sitemap.xml`);
