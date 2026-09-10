/**
 * O que cada plano destrava.
 *
 * O código antigo assumia "um pagamento = um produto = um campo". A escada de
 * planos não é isso: ela é CUMULATIVA. Quem paga o Essencial leva o futebol E
 * o Betinho ilimitado; o Completo leva os três. Por isso um plano concede um
 * CONJUNTO de acessos, e não um só.
 *
 * Isto vive em `shared/` porque três lugares precisam da MESMA resposta:
 * `stripe-webhook` (compra, renovação, cancelamento), `stripe-verify-session`
 * (a volta do checkout) e os testes. Se duas cópias divergirem, o usuário vê um
 * acesso na volta do pagamento e perde outro quando o webhook chega — o tipo de
 * bug que ninguém reproduz porque depende de qual dos dois respondeu por último.
 *
 * Os nomes legados (`betinho`, `analytics`, `platform`) continuam aqui porque
 * assinantes vivos carregam esses valores no metadata da assinatura no Stripe.
 * Removê-los quebraria a renovação de quem já paga.
 */

/** Coluna de status em `public.users`, uma por produto. */
export type CampoDeAcesso =
  | "betinho_subscription_status"
  | "futebol_subscription_status"
  | "analytics_subscription_status";

export const CONCESSOES: Record<string, CampoDeAcesso[]> = {
  // Entrada — só o Betinho ilimitado.
  betinho: ["betinho_subscription_status"],
  entrada: ["betinho_subscription_status"],

  // Essencial — futebol completo + Betinho ilimitado.
  futebol: ["futebol_subscription_status", "betinho_subscription_status"],
  essencial: ["futebol_subscription_status", "betinho_subscription_status"],

  // Completo — tudo, incluindo a análise de NBA.
  completo: [
    "futebol_subscription_status",
    "betinho_subscription_status",
    "analytics_subscription_status",
  ],

  // Legado: a plataforma de análises vendida sozinha, antes da escada.
  analytics: ["analytics_subscription_status"],
  platform: ["analytics_subscription_status"],
};

/**
 * Campos que um plano concede. Plano desconhecido cai no Betinho, que era o
 * comportamento anterior — errar para menos, nunca para mais: conceder acesso
 * a mais do que foi pago é pior que conceder de menos, porque ninguém reclama.
 */
export function camposDoPlano(productType: string | undefined | null): CampoDeAcesso[] {
  const plano = (productType || "betinho").toLowerCase().trim();
  return CONCESSOES[plano] ?? CONCESSOES.betinho;
}

/** `{ campo: status }` para todos os acessos que o plano concede. */
export function statusDoPlano(
  productType: string | undefined | null,
  status: "premium" | "free",
): Record<string, string> {
  const update: Record<string, string> = {};
  for (const campo of camposDoPlano(productType)) update[campo] = status;
  return update;
}

/**
 * Prefixo das colunas de metadados (`_period_end`, `_cancel_at`,
 * `_cancel_at_period_end`) de cada acesso.
 *
 * O futebol NÃO está aqui de propósito: `public.users` tem só
 * `futebol_subscription_status`, sem as três colunas de metadados. Gravar um
 * prefixo que não existe derruba o UPDATE INTEIRO e o assinante fica sem o
 * acesso que pagou. O gate (`get_futebol_access`) só lê o status, então nada se
 * perde. Se um dia a tela de assinatura precisar mostrar a renovação do
 * futebol, aí entra migration criando as colunas — e só então este mapa muda.
 */
export const PREFIXO_DE_METADADOS: Partial<Record<CampoDeAcesso, string>> = {
  betinho_subscription_status: "betinho_subscription",
  analytics_subscription_status: "analytics_subscription",
};

/** Prefixos de metadados que o plano toca (pula os acessos sem colunas). */
export function prefixosDoPlano(productType: string | undefined | null): string[] {
  return camposDoPlano(productType)
    .map((campo) => PREFIXO_DE_METADADOS[campo])
    .filter((p): p is string => Boolean(p));
}
