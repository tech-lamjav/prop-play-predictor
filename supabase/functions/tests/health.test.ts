// Testes da lógica de streak do ops-healthcheck (health.ts).
import { assertEquals } from "./_assert.ts";
import { failingStreaks, type RunRow } from "../ops-healthcheck/health.ts";

const r = (fn: string, ok: boolean): RunRow => ({ fn, ok });

Deno.test("3 falhas seguidas → alerta", () => {
  assertEquals(failingStreaks([r("a", false), r("a", false), r("a", false)]), ["a"]);
});
Deno.test("2 falhas → sem alerta (abaixo do threshold)", () => {
  assertEquals(failingStreaks([r("a", false), r("a", false)]), []);
});
Deno.test("falha-ok-falha → sem alerta (não é streak)", () => {
  assertEquals(failingStreaks([r("a", false), r("a", true), r("a", false)]), []);
});
Deno.test("recuperou (ok mais recente) → sem alerta mesmo com falhas antigas", () => {
  assertEquals(failingStreaks([r("a", true), r("a", false), r("a", false), r("a", false)]), []);
});
Deno.test("só os 3 mais recentes contam (4ª falha antiga irrelevante)", () => {
  // mais recente primeiro: fail, fail, fail, ok → streak de 3 → alerta
  assertEquals(failingStreaks([r("a", false), r("a", false), r("a", false), r("a", true)]), ["a"]);
});
Deno.test("funções independentes: uma falhando, outra saudável", () => {
  const rows = [
    r("b", true), r("a", false), r("b", true), r("a", false), r("b", true), r("a", false),
  ];
  assertEquals(failingStreaks(rows), ["a"]);
});
Deno.test("função nova (1 run) nunca alarma", () => {
  assertEquals(failingStreaks([r("nova", false)]), []);
});
