import { Helmet } from "react-helmet-async";

/**
 * Origem canônica do site em produção. Todo canonical/og:url é montado a partir
 * daqui, então nunca hardcode o domínio nas páginas — passe só o `path`.
 */
export const SITE_URL = "https://www.smartbetting.app";

const DEFAULT_TITLE =
  "Smart Betting — Análises, Gestão e Ferramentas para Apostadores";
const DEFAULT_DESCRIPTION =
  "Análise de prop bets NBA, gestão de banca e ferramentas para apostadores que querem decidir com dados. Controle suas apostas e acompanhe seus resultados.";
// Enquanto não temos um card social 1200×630 aprovado, o fallback é o logo.
// Ao subir o card, troque só esta constante (e o default de `twitterCard`).
const DEFAULT_IMAGE = `${SITE_URL}/logo-sem-texto.png`;

/** Monta uma URL absoluta a partir de um caminho relativo ("/futebol") ou
 * devolve a própria string se já vier absoluta. */
function toAbsolute(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const clean = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_URL}${clean}`;
}

export type SeoProps = {
  /** Título da aba/aba social. Sem sufixo automático — passe o título completo. */
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
  /** Card do Twitter/X. `summary_large_image` quando houver card próprio. */
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
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path,
  image = DEFAULT_IMAGE,
  type = "website",
  twitterCard = "summary",
  noindex = false,
  jsonLd,
  children,
}: SeoProps) {
  const canonical = path ? toAbsolute(path) : undefined;
  const imageAbs = toAbsolute(image);
  const jsonLdArray = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta
        name="robots"
        content={noindex ? "noindex,nofollow" : "index,follow"}
      />
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:image" content={imageAbs} />
      <meta property="og:locale" content="pt_BR" />
      <meta property="og:site_name" content="Smart Betting" />

      {/* Twitter / X */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:site" content="@smartbetting" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
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
