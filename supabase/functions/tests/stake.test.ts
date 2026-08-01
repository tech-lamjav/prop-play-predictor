// Testes do parsing de valor do item 15 (telegram-webhook/stake.ts).
// Regra-mestra: decisão pela FORMA (número puro × resto) — um registro de
// aposta real nunca é interceptado.
import { assert, assertEquals } from "./_assert.ts";
import { isBareNumber, parseStake } from "../telegram-webhook/stake.ts";

// ── parseStake ──
Deno.test("parseStake: '75' → 75", () => assertEquals(parseStake("75"), 75));
Deno.test("parseStake: 'R$ 50' → 50", () => assertEquals(parseStake("R$ 50"), 50));
Deno.test("parseStake: '50,00' → 50 (vírgula)", () => assertEquals(parseStake("50,00"), 50));
Deno.test("parseStake: '12.5' → 12.5", () => assertEquals(parseStake("12.5"), 12.5));
Deno.test("parseStake: sem dígito → null", () => assertEquals(parseStake("cinquenta reais"), null));
Deno.test("parseStake: zero → null", () => assertEquals(parseStake("0"), null));
Deno.test("parseStake: acima do teto (1M) → null", () => assertEquals(parseStake("2000000"), null));

// ── isBareNumber (o portão do interceptador) ──
Deno.test("bare: '75' ✓", () => assert(isBareNumber("75")));
Deno.test("bare: 'r$ 50,5' ✓", () => assert(isBareNumber("r$ 50,5")));
Deno.test("bare: '50 reais' ✓", () => assert(isBareNumber("50 reais")));
Deno.test("bare: '30 conto' ✓", () => assert(isBareNumber("30 conto")));
Deno.test("NÃO bare: aposta real nunca intercepta", () => {
  assert(!isBareNumber("Palmeiras ML 50"));
  assert(!isBareNumber("ganhei 50 na bet"));
  assert(!isBareNumber("Mais de 2.5 gols, odd 1.80, R$ 50"));
});
Deno.test("NÃO bare: vazio/ruído", () => {
  assert(!isBareNumber(""));
  assert(!isBareNumber("ok"));
});
