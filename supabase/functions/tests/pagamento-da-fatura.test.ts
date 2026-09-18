import { assertEquals } from "./_assert.ts";
import { pagamentoDaFatura } from "../shared/pagamento-da-fatura.ts";

/**
 * O que este arquivo protege: um registro de DINHEIRO.
 *
 * Os dois erros possíveis não custam a mesma coisa. Perder um pagamento
 * aparece como total baixo, e alguém confere. INVENTAR um pagamento vira
 * receita que nunca existiu, e ninguém procura o que não sabe que está errado.
 * Por isso a função recusa em vez de adivinhar, e estes testes cobram cada
 * recusa uma a uma.
 *
 * A mesma regra roda em dois lugares — o webhook, para a fatura de amanhã, e o
 * script que importa o histórico. Se divergirem, o total de uma pessoa passa a
 * depender de por onde o dinheiro entrou.
 */

const PESSOA = "u1";

// 15/10/2026 12:00 UTC — longe da virada do dia, para o teste não depender de
// hora cheia. Em Brasília, 09:00 do mesmo dia.
const PAGO_EM = Date.UTC(2026, 9, 15, 12, 0, 0) / 1000;
const INICIO_DO_PERIODO = Date.UTC(2026, 9, 15, 12, 0, 0) / 1000;

const fatura = (over: Record<string, unknown> = {}) => ({
  id: "in_123",
  amount_paid: 3990,
  currency: "brl",
  created: PAGO_EM,
  status_transitions: { paid_at: PAGO_EM },
  lines: { data: [{ period: { start: INICIO_DO_PERIODO } }] },
  ...over,
});

function gravado(f: unknown, pessoa: string | null = PESSOA) {
  const r = pagamentoDaFatura(f, pessoa);
  if (r.tipo !== "gravar") throw new Error(`esperava gravar, veio recusa: ${r.motivo}`);
  return r.pagamento;
}

function recusa(f: unknown, pessoa: string | null = PESSOA) {
  const r = pagamentoDaFatura(f, pessoa);
  if (r.tipo !== "recusa") throw new Error("esperava recusa, veio gravar");
  return r.motivo;
}

Deno.test("uma fatura paga vira um pagamento de origem stripe", () => {
  const p = gravado(fatura());
  assertEquals(p.user_id, "u1");
  assertEquals(p.origem, "stripe");
  assertEquals(p.stripe_invoice_id, "in_123");
});

Deno.test("centavos viram reais", () => {
  // `amount_paid` é o que de fato entrou, já com desconto — e não o preço de
  // tabela do plano. Somar centavos como se fossem reais multiplicaria a
  // receita por cem.
  assertEquals(gravado(fatura({ amount_paid: 3990 })).valor, 39.9);
  assertEquals(gravado(fatura({ amount_paid: 10 })).valor, 0.1);
});

Deno.test("a competência sai do período DECLARADO pela fatura", () => {
  // Nunca de assumir que todo plano é mensal: o código nunca leu o intervalo do
  // preço, e um preço anual cadastrado passaria despercebido.
  const emAgosto = Date.UTC(2026, 7, 3, 12, 0, 0) / 1000;
  const p = gravado(fatura({ lines: { data: [{ period: { start: emAgosto } }] } }));
  assertEquals(p.competencia, "2026-08-01");
});

Deno.test("a competência é sempre o dia 1º, que é o que a tabela exige", () => {
  assertEquals(gravado(fatura()).competencia, "2026-10-01");
});

Deno.test("sem período declarado, cai para o mês em que o dinheiro caiu", () => {
  // É palpite, e o único aceitável aqui: recusar perderia dinheiro de verdade
  // do total, e o mês do pagamento acerta no caso comum.
  const p = gravado(fatura({ lines: undefined, period_start: undefined }));
  assertEquals(p.competencia, "2026-10-01");
});

Deno.test("as datas são o dia de BRASÍLIA, e não o de UTC", () => {
  // ⚠️ 01:00Z do dia 1º ainda é 31 do mês anterior aqui. Em UTC o pagamento
  // pularia de mês, e o mês é o número que decide se a pessoa está devendo.
  const madrugada = Date.UTC(2026, 9, 1, 1, 0, 0) / 1000;
  const p = gravado(
    fatura({
      status_transitions: { paid_at: madrugada },
      lines: { data: [{ period: { start: madrugada } }] },
    }),
  );
  assertEquals(p.pago_em, "2026-09-30");
  assertEquals(p.competencia, "2026-09-01");
});

Deno.test("o dia do pagamento pode ser de outro mês que o da competência", () => {
  // Uma fatura de setembro paga em outubro. Guardar só uma das datas perderia
  // a distinção que responde qual mês está em aberto.
  const setembro = Date.UTC(2026, 8, 28, 12, 0, 0) / 1000;
  const outubro = Date.UTC(2026, 9, 2, 12, 0, 0) / 1000;
  const p = gravado(
    fatura({
      status_transitions: { paid_at: outubro },
      lines: { data: [{ period: { start: setembro } }] },
    }),
  );
  assertEquals(p.competencia, "2026-09-01");
  assertEquals(p.pago_em, "2026-10-02");
});

Deno.test("sem pessoa resolvida, recusa em vez de gravar órfão", () => {
  // Pagamento sem dono é dinheiro sem pessoa, e o script de importação relata
  // isso em vez de adivinhar.
  assertEquals(recusa(fatura(), null), "sem pessoa resolvida");
  assertEquals(recusa(fatura(), ""), "sem pessoa resolvida");
});

Deno.test("sem identificador de fatura, recusa", () => {
  // O identificador é o que garante que a mesma fatura entre uma vez só. Sem
  // ele não há idempotência, e a reentrega de evento duplicaria o dinheiro.
  assertEquals(recusa(fatura({ id: undefined })), "fatura sem identificador");
  assertEquals(recusa(fatura({ id: "   " })), "fatura sem identificador");
});

Deno.test("fatura de valor zero não é dinheiro que entrou", () => {
  // Existe — cupom de cem por cento, ajuste. Gravar como pagamento inflaria o
  // total com nada.
  assertEquals(recusa(fatura({ amount_paid: 0 })), "fatura sem valor pago");
  assertEquals(recusa(fatura({ amount_paid: undefined })), "fatura sem valor pago");
});

Deno.test("moeda diferente de real é recusada, e não convertida", () => {
  // ⚠️ Converter exigiria cotação, e cotação errada num registro de dinheiro é
  // um erro que ninguém percebe depois.
  assertEquals(recusa(fatura({ currency: "usd" })), "moeda nao suportada: usd");
});

Deno.test("fatura sem data nenhuma é recusada", () => {
  assertEquals(
    recusa(fatura({ status_transitions: undefined, created: undefined })),
    "fatura sem data",
  );
});

Deno.test("lixo no lugar da fatura não derruba, recusa", () => {
  // O handler recebe o que o gateway mandar, e o formato já mudou entre
  // versões. Estourar aqui derrubaria o processamento do evento inteiro.
  assertEquals(recusa(null), "fatura sem identificador");
  assertEquals(recusa({}), "fatura sem identificador");
  assertEquals(recusa(fatura({ amount_paid: "trinta e nove" })), "fatura sem valor pago");
});
