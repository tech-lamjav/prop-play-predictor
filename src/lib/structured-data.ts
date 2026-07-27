// ============================================================
// structured-data.ts — helpers de JSON-LD (schema.org).
// Regra de ouro do Google: o conteúdo do JSON-LD PRECISA bater com o que está
// visível na página. Por isso os helpers recebem os MESMOS dados que a tela
// renderiza (ex.: o array de FAQ) — nunca duplique o texto num lugar só pro
// schema, senão vira "structured data mismatch" e o Google descarta.
// ============================================================

import { SITE_URL } from "@/components/Seo";

export type FaqItem = { q: string; a: string };

/** FAQPage a partir da MESMA lista de perguntas que a página renderiza.
 *  Elegível a rich result de FAQ no Google. */
export function faqPageSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

/** WebSite do site — ajuda o Google a entender o nome/idioma do site.
 *  Sem SearchAction de propósito: não há endpoint público de busca por URL
 *  (inventar um daria erro de validação). */
export function webSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Smart Betting",
    url: SITE_URL,
    inLanguage: "pt-BR",
  };
}
