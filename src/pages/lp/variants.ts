// ============================================================
// Registry das landing pages de teste.
//
// O documento de copy tem QUATRO títulos e cada um é uma LP diferente. O bloco
// de um título NÃO aparece nas outras páginas. Dentro de cada LP, a copy segue
// a ordem do documento:
//
//   LP 1 · "Entre em cada aposta com mais razões..."
//          título + texto de apoio + [PROVA SOCIAL]
//   LP 2 · "Uma boa estatística, sozinha, pode contar a história errada"
//          título + dado isolado + os 10 filtros medindo o mesmo lado
//   LP 3 · "Analisar sem método resulta em RED"
//          título + [PROVA SOCIAL] + "para analisar um jogo sozinho" +
//          "A Smart Betting automatiza esse processo" + na prática 1-2-3 +
//          [PROVA SOCIAL]
//   LP 4 · "Mais clareza para analisar. Mais segurança para decidir"
//          título + não depender de palpite + o "você consegue"
//
// As quatro fecham igual: "O que dizem nossos usuários", "Ainda está em
// dúvida?", a oferta, o bônus, o preço e o CTA.
//
// Nada além do documento. Se aparecer bloco novo aqui, é porque alguém inventou.
//
// Marcação dentro da copy: ==destaque== sai com marca-texto âmbar,
// !!alerta!! sai em vermelho (ver components/lp/Marcado.tsx).
// ============================================================

/** Blocos do roteiro. */
export type LpBloco =
  | "problema" // 2. a estatística sozinha contra os 10 filtros
  | "manual" // 3. analisar sem método, e as abas que você abriria
  | "automatiza" // 4. a Smart Betting automatiza, na prática 1-2-3
  | "beneficios" // 5. mais clareza, o "você consegue"
  | "depoimentos" // 6. o que dizem nossos usuários
  | "faq" // 7. ainda está em dúvida
  | "oferta"; // 8. assinatura, bônus, preço e CTA

export interface LpVariant {
  slug: string;
  /** Qual título do documento abre esta LP. Vai pro PostHog. */
  gancho: string;
  seo: { title: string; description: string };
  hero: {
    titulo: string;
    /**
     * Texto de apoio do documento, logo abaixo do título. `null` quando o
     * documento não tem texto ali (a LP 3 abre só com o título, porque a frase
     * dela vem depois da prova social).
     */
    lead: string | null;
  };
  blocos: LpBloco[];
  /**
   * Qual bloco do roteiro subiu pro hero desta LP. Ele entra logo depois do
   * hero só com o visual, sem repetir título e texto. `undefined` quando o
   * título do hero não é de nenhum bloco do corpo (caso da LP 1).
   */
  ganchoBloco?: LpBloco;
  cta: { label: string; microcopy: string };
  preco: { valor: string; de: string };
}

const PRECO = { valor: "39,90", de: "49,90" };

/**
 * CTA do teste grátis de 7 dias, que é o que o produto entrega hoje: o reverse
 * trial do Futebol libera tudo por 7 dias, sem cartão.
 *
 * O documento de copy fecha em "QUERO ACESSAR A SMARTBET" com acesso após o
 * pagamento, mas o gateway não existe (/futebol/assinar mostra "Pagamento via
 * PIX em breve"). Prometer pagamento seria prometer o que a página não entrega,
 * e o trial é verdade e converte melhor em tráfego frio.
 */
const CTA = {
  label: "Quero testar 7 dias grátis",
  microcopy: "Sem cartão para testar. Depois, R$ 39,90 por mês, e cancela quando quiser.",
};

/**
 * Fecho compartilhado pelas quatro. O resto do documento não se repete: cada
 * título é de uma LP só, e o bloco que pertence a um título não aparece nas
 * outras páginas.
 */
const FECHO: LpBloco[] = ["depoimentos", "faq", "oferta"];

export const LP_VARIANTS: LpVariant[] = [
  // LP 1 · título da promessa. O roteiro segue inteiro, sem promoção.
  {
    slug: "mais-razoes",
    gancho: "promessa",
    seo: {
      title: "Mais razões para acreditar na sua aposta | Smart Betting",
      description:
        "A Inteligência Artificial testa cada cenário do jogo em 10 filtros e mede quantos dados apontam para o mesmo lado. Teste 7 dias grátis, sem cartão.",
    },
    hero: {
      titulo:
        "Entre em cada aposta com mais razões para acreditar que está fazendo a escolha certa.",
      lead:
        "A partir do histórico esportivo, nosso sistema de Inteligência Artificial testa cada cenário " +
        "possível em ==10 filtros== e mede ==quantos dados apontam para o mesmo lado== antes de apontar " +
        "uma oportunidade.",
    },
    blocos: FECHO,
    cta: CTA,
    preco: PRECO,
  },

  // LP 2 · título do problema.
  {
    slug: "estatistica-sozinha",
    gancho: "problema",
    seo: {
      title: "Uma estatística sozinha conta a história errada | Smart Betting",
      description:
        "Dado isolado justifica quase qualquer aposta. Uma oportunidade só ganha força quando diferentes sinais apontam para o mesmo lado. Teste 7 dias grátis.",
    },
    hero: {
      titulo: "Uma boa estatística, sozinha, pode contar a história errada.",
      lead:
        "Dado isolado pode justificar quase qualquer aposta. Uma oportunidade só ganha força quando " +
        "==diferentes sinais apontam para o mesmo lado==, e é exatamente o que fazem os nossos 10 filtros.",
    },
    blocos: ["problema", ...FECHO],
    ganchoBloco: "problema",
    cta: CTA,
    preco: PRECO,
  },

  // LP 3 · título do método.
  {
    slug: "sem-metodo",
    gancho: "metodo",
    seo: {
      title: "Analisar sem método resulta em RED | Smart Betting",
      description:
        "Em vez de abrir vários sites antes de apostar, a Inteligência Artificial aplica 10 filtros no jogo e entrega a leitura pronta. Teste 7 dias grátis.",
    },
    hero: {
      titulo: "Analisar sem método resulta em !!RED!!. A Smart Betting dá método baseado em fato.",
      // No documento, o "para analisar um jogo sozinho" vem DEPOIS da prova
      // social, então ele fica no bloco seguinte, não aqui.
      lead: null,
    },
    // O bloco do "automatiza esse processo" pertence a este título no
    // documento, então ele fica só aqui.
    blocos: ["manual", "automatiza", ...FECHO],
    ganchoBloco: "manual",
    cta: CTA,
    preco: PRECO,
  },

  // LP 4 · título do benefício.
  {
    slug: "mais-clareza",
    gancho: "beneficio",
    seo: {
      title: "Mais clareza para analisar, mais segurança para decidir | Smart Betting",
      description:
        "Sem depender apenas de palpite, de opinião ou de uma estatística isolada. Veja quantos dos 10 filtros apontam para o mesmo lado. Teste 7 dias grátis.",
    },
    hero: {
      titulo: "Mais clareza para analisar. Mais segurança para decidir.",
      lead:
        "Com a Smart Betting você não precisa depender apenas de palpite, de opinião ou de " +
        "==uma estatística isolada==.",
    },
    blocos: ["beneficios", ...FECHO],
    ganchoBloco: "beneficios",
    cta: CTA,
    preco: PRECO,
  },
];

export function findVariant(slug: string | undefined): LpVariant | undefined {
  return LP_VARIANTS.find((v) => v.slug === slug);
}
