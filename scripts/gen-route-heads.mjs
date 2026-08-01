// ============================================================
// gen-route-heads.mjs — gera um HTML por rota pública com o <head> já correto.
//
// O PROBLEMA: o site é uma SPA. O servidor entrega um index.html quase vazio e
// o JavaScript preenche o <head> depois (via <Seo>/Helmet). Os robôs de
// WhatsApp, Facebook, Telegram e X NÃO rodam JavaScript: leem o HTML cru e
// param. Resultado, sem isto: todo link compartilhado mostra o card da raiz,
// não importa a página.
//
// A SOLUÇÃO: no fim do build, copiar o index.html para dist/<rota>/index.html
// trocando o bloco entre os marcadores `seo:head` pelas tags daquela rota.
// A Vercel checa o sistema de arquivos ANTES de aplicar o rewrite catch-all
// (é por isso que /logo.png funciona hoje), então esses arquivos são servidos
// nas suas rotas, e o usuário continua recebendo a mesma SPA.
//
// Roda como `postbuild`. A fonte dos textos é src/seo/public-routes.json, a
// mesma que o <Seo> e o gen-sitemap usam, então o que o WhatsApp mostra nunca
// divirge do que a página diz.
// ============================================================
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_URL = "https://www.smartbetting.app";
const DEFAULT_IMAGE = "/og/og-default.jpg";
const START = "<!-- seo:head:start -->";
const END = "<!-- seo:head:end -->";

/** Escapa o que quebraria um atributo HTML. Títulos têm acento (ok em UTF-8),
 *  mas aspas e & precisam virar entidade. */
export function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toAbsolute(pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** Monta o bloco de <head> de uma rota. Função pura, testada em
 *  src/seo/gen-route-heads.test.ts. */
export function buildHeadBlock(route) {
  const title = escapeAttr(route.title);
  const description = escapeAttr(route.description);
  const canonical = escapeAttr(toAbsolute(route.canonical ?? route.path));
  const image = escapeAttr(toAbsolute(route.image ?? DEFAULT_IMAGE));

  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${image}" />`,
  ]
    .map((tag) => `    ${tag}`)
    .join("\n");
}

/** Troca o conteúdo entre os marcadores. Lança se os marcadores sumirem, pra
 *  falhar o build em vez de publicar silenciosamente o head errado. */
export function replaceHeadBlock(html, headBlock) {
  const startIdx = html.indexOf(START);
  const endIdx = html.indexOf(END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(
      `[gen-route-heads] marcadores ${START} / ${END} não encontrados no index.html. ` +
        `Sem eles não é possível gerar o <head> por rota.`,
    );
  }
  return (
    html.slice(0, startIdx + START.length) +
    "\n" +
    headBlock +
    "\n    " +
    html.slice(endIdx)
  );
}

// ── execução ────────────────────────────────────────────────
const routes = JSON.parse(
  readFileSync(join(ROOT, "src", "seo", "public-routes.json"), "utf8"),
);
const indexPath = join(ROOT, "dist", "index.html");
const indexHtml = readFileSync(indexPath, "utf8");

// A raiz "/" já é o próprio dist/index.html (gerado pelo vite com o head da
// marca), então não precisa de shell separado.
const shells = routes.filter((r) => r.path !== "/");
let written = 0;

for (const route of shells) {
  const html = replaceHeadBlock(indexHtml, buildHeadBlock(route));
  const segments = route.path.split("/").filter(Boolean);
  const parentDir = join(ROOT, "dist", ...segments.slice(0, -1));
  const leaf = segments[segments.length - 1];

  // Gravamos as DUAS formas de propósito:
  //   dist/futebol/index.html  → atende /futebol/ (com barra)
  //   dist/futebol.html        → atende /futebol  (sem barra)
  // Servidor estático resolve URL sem barra de jeitos diferentes, e o link
  // compartilhado quase sempre vem sem barra. Com as duas, funciona nos dois
  // casos. O conteúdo é idêntico, então não há risco de divergir.
  mkdirSync(join(parentDir, leaf), { recursive: true });
  writeFileSync(join(parentDir, leaf, "index.html"), html, "utf8");
  writeFileSync(join(parentDir, `${leaf}.html`), html, "utf8");
  written += 1;
}

console.log(
  `[gen-route-heads] ${written} rotas × 2 formas (dir/index.html + .html) em dist/, + a raiz no index.html`,
);
