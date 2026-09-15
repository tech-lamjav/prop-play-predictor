// O corte de valor, do lado das notificações. Linha cortada no painel e não no
// Telegram é o vazamento que esta regra existe para impedir.
import { assertEquals } from "./_assert.ts";
import {
  carregarLimiaresDeValor,
  CORTE_FALLBACK,
  filtrarCorteDeValor,
} from "../shared/corte-de-valor.ts";

const CORTE = [{ market: "asian_handicap", limiar: -0.02 }];
const linha = (market: string, edge: number | null, id: number) => ({ market, edge, fixture_id: id });

Deno.test("filtra a linha abaixo do limiar e deixa o resto", () => {
  const linhas = [
    linha("asian_handicap", 0.01, 1),
    linha("asian_handicap", -0.05, 2),
    linha("goals_over_under", -0.05, 3),
  ];
  assertEquals(filtrarCorteDeValor(linhas, CORTE), [linha("asian_handicap", 0.01, 1), linha("goals_over_under", -0.05, 3)]);
});

Deno.test("o limiar em si corta", () => {
  assertEquals(filtrarCorteDeValor([linha("asian_handicap", -0.02, 1)], CORTE), []);
});

Deno.test("linha sem vantagem gravada corta", () => {
  assertEquals(filtrarCorteDeValor([linha("asian_handicap", null, 1)], CORTE), []);
});

Deno.test("sem limiar devolve tudo", () => {
  const linhas = [linha("asian_handicap", -0.5, 1)];
  assertEquals(filtrarCorteDeValor(linhas, []), linhas);
});

Deno.test("carrega o corte da RPC, e aceita limiar que chega como texto", async () => {
  const supabase = {
    rpc: (nome: string) => {
      assertEquals(nome, "get_futebol_limiar_valor");
      // `numeric` pode chegar como string dependendo da serialização.
      return Promise.resolve({
        data: [{ market: "asian_handicap", limiar: "-0.02", vigente_desde: "2026-09-15T00:00:00Z" }],
        error: null,
      });
    },
  };
  assertEquals(await carregarLimiaresDeValor(supabase), { limiares: CORTE, origem: "banco" });
});

Deno.test("banco sem nenhum limiar é banco, e não fallback", async () => {
  const supabase = { rpc: () => Promise.resolve({ data: [], error: null }) };
  assertEquals(await carregarLimiaresDeValor(supabase), { limiares: [], origem: "banco" });
});

Deno.test("RPC com erro cai para o fallback, e a mensagem sai COM o corte", async () => {
  const supabase = { rpc: () => Promise.resolve({ data: null, error: { message: "boom" } }) };
  assertEquals(await carregarLimiaresDeValor(supabase), { limiares: [...CORTE_FALLBACK], origem: "fallback" });
});

Deno.test("RPC inexistente (código antes da migration) cai para o fallback", async () => {
  const supabase = { rpc: () => Promise.reject(new Error("function does not exist")) };
  assertEquals(await carregarLimiaresDeValor(supabase), { limiares: [...CORTE_FALLBACK], origem: "fallback" });
});

Deno.test("limiar ilegível derruba a leitura para o fallback, em vez de deixar o mercado sem corte", async () => {
  const supabase = {
    rpc: () => Promise.resolve({ data: [{ market: "asian_handicap", limiar: "abc" }], error: null }),
  };
  assertEquals(await carregarLimiaresDeValor(supabase), { limiares: [...CORTE_FALLBACK], origem: "fallback" });
});
