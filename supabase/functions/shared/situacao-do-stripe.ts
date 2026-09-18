/**
 * O que o gateway disse, e o que isso libera.
 *
 * ============================================================================
 * Duas perguntas que estavam coladas numa linha só
 * ============================================================================
 * O webhook decidia acesso com um ternário solto:
 *
 *   const ativa = status === 'active' || status === 'trialing';
 *   const status = ativa ? 'premium' : 'free';
 *
 * E gravava só o resultado. Com isso, `past_due` — cartão recusado, pessoa
 * ainda cliente, conversa que dá para salvar — virava exatamente a mesma coisa
 * que uma assinatura cancelada há um ano. A informação era DESTRUÍDA na
 * gravação, e nenhuma tela conseguia distinguir os dois depois.
 *
 * Aqui as duas perguntas ficam separadas:
 *
 *   1. quem entra no produto  → `acessoDaSituacao`, que continua devolvendo só
 *      `premium` ou `free`, porque é isso que as colunas de portão entendem;
 *   2. o que o gateway relatou → `situacaoCrua`, guardada como veio.
 *
 * ⚠️ A regra de acesso NÃO muda neste módulo. Ela é copiada como estava, de
 * propósito: mexer em quem entra é outro assunto, e faria um conserto de
 * visibilidade virar incidente de acesso.
 */

/**
 * As situações que liberam o produto.
 *
 * `trialing` está aqui porque é assinatura ativa em período de teste DO STRIPE,
 * e tratar como sem acesso bloquearia na hora quem acabou de assinar. Hoje o
 * teste do futebol é do banco e não do gateway, então isso não dispara — mas
 * ligar `trial_period_days` no Stripe um dia não pode derrubar assinante.
 */
export const SITUACOES_COM_ACESSO = ["active", "trialing"] as const;

/** `premium` ou `free`: o que as colunas de portão entendem, e só isso. */
export function acessoDaSituacao(cru: string | null | undefined): "premium" | "free" {
  const s = situacaoCrua(cru);
  /*
   * ⚠️ Situação desconhecida NÃO dá acesso.
   *
   * O Stripe pode criar um estado novo amanhã, e o padrão aqui decide o que
   * acontece nesse dia. Conceder acesso a mais do que foi pago é pior que
   * conceder de menos, porque ninguém reclama — é o mesmo raciocínio que
   * `camposDoPlano` já usa para plano desconhecido.
   */
  return s !== null && (SITUACOES_COM_ACESSO as readonly string[]).includes(s)
    ? "premium"
    : "free";
}

/**
 * A situação como o gateway relatou, normalizada só no espaço e na caixa.
 *
 * ⚠️ NÃO valida contra uma lista. O Stripe é dono do vocabulário dele, e uma
 * lista nossa recusaria um estado novo justamente na hora de gravar — que é o
 * pior momento para descobrir que o vocabulário mudou. Guardar o que veio deixa
 * a tela mostrar "não conheço este estado" em vez de mentir.
 */
export function situacaoCrua(cru: string | null | undefined): string | null {
  const s = (cru ?? "").trim().toLowerCase();
  return s === "" ? null : s;
}

/**
 * O fim do período que uma fatura declara, em ISO, ou nulo.
 *
 * ⚠️ Sai do período DECLARADO pela fatura, e nunca de assumir que todo plano é
 * mensal. Hoje todo preço cadastrado é mensal, mas o código nunca leu o
 * intervalo do preço: se alguém apontar uma variável de preço para um preço
 * anual, nada perceberia. Ler o período faz o caso anual aparecer como fato.
 *
 * Existe porque `invoice.paid` nunca atualizava a data de renovação — só o
 * evento de assinatura criada ou alterada fazia isso. Então a data envelhecia
 * depois da PRIMEIRA renovação, e era justamente a data que o sócio ia olhar.
 */
export function fimDoPeriodoDaFatura(fatura: unknown): string | null {
  const f = fatura as {
    lines?: { data?: { period?: { end?: number | null } }[] };
    period_end?: number | null;
  };
  const segundos = f?.lines?.data?.[0]?.period?.end ?? f?.period_end ?? null;
  if (typeof segundos !== "number" || !Number.isFinite(segundos) || segundos <= 0) return null;
  return new Date(segundos * 1000).toISOString();
}
