// Testes do centro de controle /mensagens (telegram-webhook/prefs.ts, Onda 6).
import { assert, assertEquals } from "./_assert.ts";
import { prefsKeyboard, prefsText } from "../telegram-webhook/prefs.ts";

Deno.test("texto: tudo ativado", () => {
  const t = prefsText({ settlementMuted: false, weeklyMuted: false });
  assert(t.includes("Liquidação de apostas — <b>ativada</b>"), "liq ativada");
  assert(t.includes("Resumo semanal — <b>ativado</b>"), "resumo ativado");
  assert(t.includes("Oportunidades do dia — <b>automático</b>"), "daily informativo");
});
Deno.test("texto: estados silenciados refletidos", () => {
  const t = prefsText({ settlementMuted: true, weeklyMuted: true });
  assert(t.includes("Liquidação de apostas — <b>silenciada 🔕</b>"), "liq silenciada");
  assert(t.includes("Resumo semanal — <b>silenciado 🔕</b>"), "resumo silenciado");
});
Deno.test("teclado: rótulo é a AÇÃO (ativado → Silenciar)", () => {
  const rows = prefsKeyboard({ settlementMuted: false, weeklyMuted: false }) as any[];
  assertEquals(rows[0][0].text, "Silenciar liquidação");
  assertEquals(rows[1][0].text, "Silenciar resumo semanal");
});
Deno.test("teclado: rótulo inverte quando silenciado", () => {
  const rows = prefsKeyboard({ settlementMuted: true, weeklyMuted: true }) as any[];
  assertEquals(rows[0][0].text, "Reativar liquidação");
  assertEquals(rows[1][0].text, "Reativar resumo semanal");
});
Deno.test("teclado: callbacks estáveis", () => {
  const rows = prefsKeyboard({ settlementMuted: true, weeklyMuted: false }) as any[];
  assertEquals(rows[0][0].callback_data, "prefliq");
  assertEquals(rows[1][0].callback_data, "prefres");
});
Deno.test("teclado: estados independentes", () => {
  const rows = prefsKeyboard({ settlementMuted: true, weeklyMuted: false }) as any[];
  assertEquals(rows[0][0].text, "Reativar liquidação");
  assertEquals(rows[1][0].text, "Silenciar resumo semanal");
});
