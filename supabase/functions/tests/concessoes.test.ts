import { assertEquals } from "./_assert.ts";
import {
  camposDoPlano,
  PREFIXO_DE_METADADOS,
  prefixosDoPlano,
  statusDoPlano,
} from "../shared/concessoes.ts";

/**
 * O que este arquivo protege: quem paga recebe o que a página vendeu, e quem
 * cancela perde tudo que o plano dava. Errar aqui não quebra a tela — o
 * pagamento entra normalmente e o acesso simplesmente não aparece, que é o
 * bug mais caro possível: o cliente pagou e reclama.
 */

const ordenado = (xs: string[]) => [...xs].sort();

Deno.test("Entrada dá só o Betinho", () => {
  assertEquals(camposDoPlano("entrada"), ["betinho_subscription_status"]);
  assertEquals(camposDoPlano("betinho"), ["betinho_subscription_status"]);
});

Deno.test("Essencial dá futebol E Betinho — a escada é cumulativa", () => {
  assertEquals(ordenado(camposDoPlano("essencial")), [
    "betinho_subscription_status",
    "futebol_subscription_status",
  ]);
  // 'futebol' é o productType que o checkout manda hoje; precisa dar o mesmo.
  assertEquals(ordenado(camposDoPlano("futebol")), ordenado(camposDoPlano("essencial")));
});

Deno.test("Completo dá os três", () => {
  assertEquals(ordenado(camposDoPlano("completo")), [
    "analytics_subscription_status",
    "betinho_subscription_status",
    "futebol_subscription_status",
  ]);
});

Deno.test("nomes legados continuam valendo — assinante vivo carrega esses no Stripe", () => {
  assertEquals(camposDoPlano("analytics"), ["analytics_subscription_status"]);
  assertEquals(camposDoPlano("platform"), ["analytics_subscription_status"]);
});

Deno.test("plano desconhecido, vazio ou nulo cai no Betinho — erra para menos", () => {
  for (const entrada of [undefined, null, "", "   ", "plano_que_nao_existe"]) {
    assertEquals(camposDoPlano(entrada), ["betinho_subscription_status"]);
  }
});

Deno.test("caixa e espaço não mudam a concessão", () => {
  assertEquals(ordenado(camposDoPlano("  EsSeNcIaL  ")), ordenado(camposDoPlano("essencial")));
});

Deno.test("statusDoPlano marca todos os acessos do plano", () => {
  assertEquals(statusDoPlano("completo", "premium"), {
    futebol_subscription_status: "premium",
    betinho_subscription_status: "premium",
    analytics_subscription_status: "premium",
  });
});

Deno.test("cancelar o Essencial derruba os dois acessos, não só o futebol", () => {
  const revogado = statusDoPlano("essencial", "free");
  assertEquals(revogado.futebol_subscription_status, "free");
  assertEquals(revogado.betinho_subscription_status, "free");
});

Deno.test("o futebol não tem colunas de metadados — gravar derrubaria o UPDATE", () => {
  assertEquals(PREFIXO_DE_METADADOS.futebol_subscription_status, undefined);
  // Essencial toca futebol + betinho, mas só o betinho tem prefixo.
  assertEquals(prefixosDoPlano("essencial"), ["betinho_subscription"]);
});

Deno.test("Completo grava metadados dos dois que têm colunas", () => {
  assertEquals(ordenado(prefixosDoPlano("completo")), [
    "analytics_subscription",
    "betinho_subscription",
  ]);
});
