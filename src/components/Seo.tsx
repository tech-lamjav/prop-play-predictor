import { Helmet } from "react-helmet-async";
import publicRoutes from "@/seo/public-routes.json";

/**
 * Origem canônica do site em produção. Todo canonical/og:url é montado a partir
 * daqui, então nunca hardcode o domínio nas páginas — passe só o `path`.
 */
export const SITE_URL = "https://www.smartbetting.app";

const DEFAULT_TITLE =
  "Smart Betting · Análises, Gestão e Ferramentas para Apostadores";
const DEFAULT_DESCRIPTION =
  "Análise de prop bets NBA, gestão de banca e ferramentas para apostadores que querem decidir com dados. Controle suas apostas e acompanhe seus resultados.";
// Card social 1200×630 da marca ("Decida com dados."). Cards por produto em
// /og/og-futebol.jpg e /og/og-nba.jpg — as páginas passam via prop `image`.
const DEFAULT_IMAGE = `${SITE_URL}/og/og-default.jpg`;

/**
 * Tabela de title/description/imagem por rota pública. É a MESMA fonte que o
 * `scripts/gen-route-heads.mjs` usa pra gerar o <head> servido no HTML e que o
 * `scripts/gen-sitemap.mjs` usa pra montar o sitemap. Um só lugar pra editar
 * essa copy, então o que o WhatsApp mostra nunca divirge do que a página diz.
 */
const ROUTE_META = new Map(publicRoutes.map((r) => [r.path, r]));

/** Monta uma URL absoluta a partir de um caminho relativo ("/futebol") ou
 * devolve a própria string se já vier absoluta. */
function toAbsolute(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const clean = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${clean}`;
}

export type SeoProps = {
  /**
   * Rota pública (ex.: "/futebol"). Puxa title/description/imagem/canonical da
   * tabela `src/seo/public-routes.json`, a mesma que gera o <head> servido e o
   * sitemap. É a forma preferida: as props abaixo só existem pra sobrescrever
   * caso a caso ou pra páginas fora da tabela.
   */
  route?: string;
  /** Título da aba e do card social. Sem sufixo automático: passe completo. */
  title?: string;
  description?: string;
  /**
   * Caminho relativo da rota (ex.: "/futebol"). Vira `canonical` + `og:url`
   * absolutos. Omita em páginas que NÃO devem canonicalizar (ex.: rotas com
   * parâmetro variável sem versão pública fixa).
   */
  path?: string;
  /** Imagem de compartilhamento — caminho relativo ou URL absoluta (1200×630). */
  image?: string;
  type?: "website" | "article";
  /** Card do Twitter/X. Default grande — todos os nossos cards são 1200×630. */
  twitterCard?: "summary" | "summary_large_image";
  /** true → `noindex,nofollow`. Use em páginas públicas mas não-indexáveis. */
  noindex?: boolean;
  /** JSON-LD schema.org (objeto único ou lista). Serializado num <script>. */
  jsonLd?: object | object[];
  /** Tags extras de <head> específicas da página. */
  children?: React.ReactNode;
};

/**
 * Fonte única de verdade do `<head>` por rota. Centraliza title/description,
 * canonical, Open Graph e Twitter Card num só lugar — antes cada página
 * repetia isso na mão (inconsistente) e o canonical estático do index.html
 * colidia com o da página.
 */
export function Seo({
  route,
  title,
  description,
  path,
  image,
  type = "website",
  twitterCard = "summary_large_image",
  noindex = false,
  jsonLd,
  children,
}: SeoProps) {
  // Precedência: prop explícita > tabela da rota > default da marca.
  const meta = route ? ROUTE_META.get(route) : undefined;
  const finalTitle = title ?? meta?.title ?? DEFAULT_TITLE;
  const finalDescription = description ?? meta?.description ?? DEFAULT_DESCRIPTION;
  const finalImage = image ?? meta?.image ?? DEFAULT_IMAGE;
  // `canonical` da tabela existe pra rotas que apontam pra outra URL
  // (ex.: /termos canonicaliza em /privacidade, evitando conteúdo duplicado).
  const canonicalPath = path ?? meta?.canonical ?? route;

  const canonical = canonicalPath ? toAbsolute(canonicalPath) : undefined;
  const imageAbs = toAbsolute(finalImage);
  const jsonLdArray = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];

  return (
    <Helmet>
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      <meta
        name="robots"
        content={noindex ? "noindex,nofollow" : "index,follow"}
      />
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Open Graph */}
      <meta property="og:title" content={finalTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:type" content={type} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:image" content={imageAbs} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="pt_BR" />
      <meta property="og:site_name" content="Smart Betting" />

      {/* Twitter / X */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:site" content="@smartbetting" />
      <meta name="twitter:title" content={finalTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={imageAbs} />

      {jsonLdArray.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}

      {children}
    </Helmet>
  );
}

export default Seo;
