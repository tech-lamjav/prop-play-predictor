/**
 * A parte pura da sonda: o que sai na resposta, e o que nunca sai.
 *
 * Mora separada do handler por um motivo só — aqui existe uma regra de
 * segurança que merece teste, e o resto da sonda é encanamento.
 */

/**
 * Os únicos cabeçalhos cujo VALOR sai daqui.
 *
 * ⚠️ O resto sai só como NOME. A requisição carrega `authorization` e `apikey`
 * no mesmo mapa, e devolver o mapa inteiro seria entregar credencial na
 * resposta. Nome de cabeçalho não é segredo; valor pode ser.
 *
 * A lista é generosa de propósito: o objetivo é descobrir o que existe, e um
 * palpite a mais custa uma linha de JSON. Todos em minúsculo — a comparação é
 * feita em minúsculo.
 */
export const VALORES_LIBERADOS: readonly string[] = [
  // Cloudflare
  "cf-ipcountry",
  "cf-connecting-ip",
  "cf-ipcity",
  "cf-region",
  "cf-region-code",
  "cf-iplatitude",
  "cf-iplongitude",
  "cf-timezone",
  "cf-ray",
  // Genéricos de proxy
  "x-forwarded-for",
  "x-real-ip",
  "x-client-ip",
  "true-client-ip",
  "x-envoy-external-address",
  // Fly e Deno Deploy, que já serviram de borda por baixo do Supabase
  "fly-client-ip",
  "fly-region",
  "x-deno-region",
  // Chutes de país com outros nomes
  "x-country-code",
  "x-geo-country",
  "x-vercel-ip-country",
];

export interface LeituraDaOrigem {
  /** A pergunta principal: algum cabeçalho já trouxe o país, sem eu pedir? */
  pais_chegou_de_graca: boolean;
  /** Só os da lista liberada. */
  valores_de_origem: Record<string, string>;
  /** Todos os nomes, em ordem — é assim que se descobre o que ninguém previu. */
  todos_os_nomes: string[];
}

export function lerOrigem(headers: Headers): LeituraDaOrigem {
  const nomes: string[] = [];
  const valores: Record<string, string> = {};

  for (const [nome, valor] of headers.entries()) {
    const chave = nome.toLowerCase();
    nomes.push(chave);
    if (VALORES_LIBERADOS.includes(chave)) valores[chave] = valor;
  }
  nomes.sort();

  return {
    // "country" e não uma lista fixa: se a borda mandar o país com um nome que
    // ninguém previu, a sonda ainda assim percebe — e perceber é o trabalho
    // dela.
    pais_chegou_de_graca: Object.keys(valores).some((c) => c.includes("country")),
    valores_de_origem: valores,
    todos_os_nomes: nomes,
  };
}
