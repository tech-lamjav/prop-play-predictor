import { assertEquals } from "./_assert.ts";
import {
  acessoDaSituacao,
  fimDoPeriodoDaFatura,
  situacaoCrua,
} from "../shared/situacao-do-stripe.ts";

/**
 * O que este arquivo protege: que o webhook pare de DESTRUIR a informação sem
 * mudar quem tem acesso.
 *
 * As duas metades erram de jeitos opostos e igualmente caros. Afrouxar o acesso
 * dá produto a quem não pagou. Endurecer derruba quem pagou — e aí o cliente
 * reclama, o que pelo menos aparece. Perder a situação crua não aparece nunca:
 * a tela simplesmente não consegue distinguir cartão recusado de cancelamento,
 * e a conversa que daria para salvar não acontece.
 */

Deno.test("active e trialing dão acesso", () => {
  assertEquals(acessoDaSituacao("active"), "premium");
  // Assinatura ativa em período de teste DO STRIPE. Tratar como sem acesso
  // bloquearia na hora quem acabou de assinar.
  assertEquals(acessoDaSituacao("trialing"), "premium");
});

Deno.test("cartão recusado não dá acesso, mas continua sendo dito", () => {
  // As duas metades do ticket numa asserção só: o portão fecha, e a palavra
  // sobrevive para a tela poder dizer "cobrança falhando".
  assertEquals(acessoDaSituacao("past_due"), "free");
  assertEquals(situacaoCrua("past_due"), "past_due");
});

Deno.test("cancelado e não pago não dão acesso", () => {
  assertEquals(acessoDaSituacao("canceled"), "free");
  assertEquals(acessoDaSituacao("unpaid"), "free");
  assertEquals(acessoDaSituacao("incomplete"), "free");
  assertEquals(acessoDaSituacao("incomplete_expired"), "free");
  assertEquals(acessoDaSituacao("paused"), "free");
});

Deno.test("situação desconhecida NÃO dá acesso", () => {
  // ⚠️ O Stripe pode criar um estado novo amanhã, e este teste decide o que
  // acontece nesse dia. Conceder a mais do que foi pago é pior que conceder de
  // menos, porque ninguém reclama.
  assertEquals(acessoDaSituacao("estado_que_o_stripe_inventou"), "free");
});

Deno.test("ausência não dá acesso e não vira texto vazio", () => {
  assertEquals(acessoDaSituacao(null), "free");
  assertEquals(acessoDaSituacao(undefined), "free");
  assertEquals(acessoDaSituacao(""), "free");
  assertEquals(situacaoCrua(""), null);
  assertEquals(situacaoCrua("   "), null);
  assertEquals(situacaoCrua(null), null);
});

Deno.test("a situação crua não é validada contra lista nossa", () => {
  // ⚠️ O Stripe é dono do vocabulário. Uma lista nossa recusaria um estado novo
  // na hora de GRAVAR, que é o pior momento para descobrir que o vocabulário
  // mudou. Guardar o que veio deixa a tela dizer que não conhece o estado, em
  // vez de mentir.
  assertEquals(situacaoCrua("ESTADO_NOVO"), "estado_novo");
  assertEquals(situacaoCrua("  Past_Due  "), "past_due");
});

Deno.test("o fim do período sai do que a FATURA declara", () => {
  // Nunca de assumir que todo plano é mensal: o código nunca leu o intervalo do
  // preço, e um preço anual cadastrado passaria despercebido.
  const fatura = { lines: { data: [{ period: { end: 1790000000 } }] } };
  assertEquals(fimDoPeriodoDaFatura(fatura), new Date(1790000000 * 1000).toISOString());
});

Deno.test("cai para o período da fatura quando a linha não traz", () => {
  assertEquals(
    fimDoPeriodoDaFatura({ period_end: 1790000000 }),
    new Date(1790000000 * 1000).toISOString(),
  );
});

Deno.test("fatura sem período não vira data inventada", () => {
  // Nulo é resposta. Uma data chutada aqui viraria conversa de renovação no dia
  // errado, e o sócio confia nessa data para falar com a pessoa.
  assertEquals(fimDoPeriodoDaFatura({}), null);
  assertEquals(fimDoPeriodoDaFatura(null), null);
  assertEquals(fimDoPeriodoDaFatura({ lines: { data: [] } }), null);
  assertEquals(fimDoPeriodoDaFatura({ period_end: 0 }), null);
  assertEquals(fimDoPeriodoDaFatura({ period_end: "amanhã" }), null);
});
