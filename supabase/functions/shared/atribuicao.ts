// ============================================================================
// shared/atribuicao.ts — a corrente que liga envio, clique e chegada
// ============================================================================
// Hoje o funil do bot se parte no meio. O envio (`*_opportunities_sent`) nasce
// com um `trace_id` por RODADA do cron, compartilhado por todos os
// destinatários; o clique (`go/index.ts`) gera um `trace_id` NOVO na hora. Os
// dois nunca se encontram — a única forma de casar um com o outro no PostHog é
// por `distinct_id` mais horário, que é adivinhação, não correlação.
//
// A chave canônica passa a ser o `delivery_id`: uma entrega, para uma pessoa,
// numa campanha. Ele viaja no link, é devolvido pelo redirecionador na URL de
// destino, e o site o reporta na chegada. Mesma string nos três eventos.
//
// ── Por que DETERMINÍSTICO, e não um UUID ───────────────────────────────────
//
// Porque reenvio existe. O `notify-published-opportunities` roda `deliverPending`
// a cada execução do cron e retoma o que ficou pendente de rodadas anteriores;
// o diário simplesmente tenta de novo no dia seguinte. Com `crypto.randomUUID()`
// a mesma tentativa lógica ganharia um id diferente a cada retomada, e o painel
// contaria duas entregas onde houve uma — inflando o denominador de toda taxa
// de clique.
//
// Derivar de dados estáveis resolve isso sem tabela nova e sem migration: a
// mesma entrada dá sempre a mesma saída, em qualquer execução, em qualquer
// máquina.
//
// Tudo aqui é função PURA. É o que permite testar no CI com `deno test`, que é
// o único lugar onde os testes das Edge Functions rodam.
// ============================================================================

/**
 * Digest curto e estável de um texto.
 *
 * 16 hex (64 bits) — a mesma largura que `shared/links.ts` já usa para a
 * assinatura HMAC, então os ids nascem do tamanho que as URLs do bot já
 * carregam. Colisão em 64 bits exige da ordem de bilhões de entregas para
 * virar provável; o volume aqui é de milhares por dia.
 *
 * SHA-256 e não HMAC: isto é um IDENTIFICADOR, não uma credencial. Quem protege
 * o link contra forjamento é a assinatura `s=`, que continua onde estava.
 */
export async function digestCurto(msg: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

/**
 * O lote: todas as entregas que saíram da mesma decisão de envio.
 *
 * `lote` é o que identifica a rodada. No alerta de publicação existe um
 * `batch_id` de verdade, vindo da tabela `futebol_publication_alert_deliveries`
 * — passe ele. No diário não existe tabela de entrega, e a rodada É o dia:
 * passe a data BRT do envio.
 */
export async function chaveDoLote(campanha: string, lote: string): Promise<string> {
  return await digestCurto(`lote:${campanha}:${lote}`);
}

/**
 * A entrega: um lote, uma pessoa.
 *
 * É a chave canônica do funil. Duas execuções do cron com a mesma rodada e a
 * mesma pessoa produzem o MESMO id, que é exatamente o que impede o reenvio de
 * virar entrega nova.
 */
export async function chaveDeEntrega(
  campanha: string,
  lote: string,
  userId: string,
): Promise<string> {
  return await digestCurto(`entrega:${campanha}:${lote}:${userId}`);
}

/**
 * O link: uma entrega, um destino.
 *
 * Uma mensagem pode levar vários links (três picks e um "ver todas"), e sem
 * isto os quatro cliques seriam indistinguíveis dentro da mesma entrega — a
 * pergunta "qual CTA funciona" ficaria sem resposta.
 */
export async function chaveDoLink(deliveryId: string, destino: string): Promise<string> {
  return await digestCurto(`link:${deliveryId}:${destino}`);
}

/**
 * As campanhas que o redirecionador reconhece.
 *
 * É a MESMA lista que o `go` usa para escolher o nome do evento de clique. Uma
 * campanha fora dela cai no evento de resumo semanal por engano — e, no
 * `campaign_type`, um valor solto cria uma fatia nova em todo gráfico que
 * quebra por campanha, até o gráfico ficar ilegível.
 */
export const CAMPANHAS = [
  "daily_opportunities",
  "published_opportunities",
  "weekly_summary",
] as const;

export type Campanha = (typeof CAMPANHAS)[number] | "other";

/**
 * A campanha, validada. Fora da lista vira `other`.
 *
 * O `c=` da URL é texto CRU vindo de fora: qualquer um pode montar um link do
 * `go` com a campanha que quiser. Sem esta porta, esse texto entrava direto no
 * `campaign_type` do evento.
 */
export function campanhaValida(valor: string | null | undefined): Campanha {
  if (!valor) return "other";
  return (CAMPANHAS as readonly string[]).includes(valor)
    ? (valor as Campanha)
    : "other";
}

/** Tudo o que descreve uma entrega, para viajar junto. */
export type Atribuicao = {
  deliveryId: string;
  batchId: string;
  linkId: string;
  campaignId: string;
  campaignType: string;
  segment?: string | null;
  /** ISO do envio. Vira `time_since_sent_ms` do outro lado. */
  sentAt?: string | null;
  opportunityId?: string | null;
  utmContent?: string | null;
};

/**
 * Os parâmetros que o redirecionador põe na URL final do site.
 *
 * `utm_source`, `utm_medium` e `utm_campaign` são a parte que qualquer
 * ferramenta entende. O resto é o contrato desta casa, e é ele que dá a
 * correlação exata — UTM sozinha diz "veio do Telegram", não diz de QUAL
 * mensagem.
 *
 * Devolve pares em vez de string montada: quem chama já tem um `URLSearchParams`
 * do destino (com `mercado`, `saida`, `linha`) e só precisa acrescentar.
 * Montar string aqui obrigaria a concatenar `?` ou `&` na ponta, que é o tipo
 * de detalhe que produz `??` na URL uma vez a cada seis meses.
 */
export function paramsDaAtribuicao(a: Atribuicao): [string, string][] {
  const pares: [string, string][] = [
    ["utm_source", "telegram"],
    ["utm_medium", "bot"],
    ["utm_campaign", a.campaignType],
    ["delivery_id", a.deliveryId],
    ["batch_id", a.batchId],
    ["link_id", a.linkId],
    ["campaign_id", a.campaignId],
    ["campaign_type", a.campaignType],
  ];
  // Os opcionais só entram quando existem: `utm_content=null` na URL vira a
  // string "null" do outro lado, e "null" é um valor que aparece em relatório.
  if (a.utmContent) pares.push(["utm_content", a.utmContent]);
  if (a.segment) pares.push(["segment", a.segment]);
  if (a.sentAt) pares.push(["sent_at", a.sentAt]);
  if (a.opportunityId) pares.push(["opportunity_id", a.opportunityId]);
  return pares;
}

/**
 * A identidade da oportunidade a partir do `dest` do link.
 *
 * O `dest` do bot é `jogo-<fixture>|<mercado>|<saída>|<linha>`, e o front
 * identifica oportunidade por `<fixture>|<mercado>|<saída>|<linha>` — a MESMA
 * composição, com um prefixo a mais. Tirar o prefixo é toda a tradução
 * necessária, e é por isso que ela cabe numa função de três linhas.
 *
 * Devolve nulo para `board`, `bank`, `assinar` e para `jogo-123` sem saída:
 * esses destinos são telas, não oportunidades, e carimbar um `opportunity_id`
 * neles inventaria uma oportunidade que a mensagem não citou.
 */
export function oportunidadeDoDestino(dest: string): string | null {
  const m = dest.match(/^jogo-(\d+)\|(.+)$/);
  return m ? `${m[1]}|${m[2]}` : null;
}
