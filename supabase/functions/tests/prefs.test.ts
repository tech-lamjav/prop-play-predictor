// Testes do centro de controle /mensagens (telegram-webhook/prefs.ts, Onda 6).
import { assert, assertEquals } from "./_assert.ts";
import { prefsKeyboard, prefsText } from "../telegram-webhook/prefs.ts";

Deno.test("texto: tudo ativado", () => {
  const t = prefsText({ settlementMuted: false, weeklyMuted: false, publicationEnabled: true, publicationAvailable: true });
  assert(t.includes("Liquidação de apostas — <b>ativada</b>"), "liq ativada");
  assert(t.includes("Resumo semanal — <b>ativado</b>"), "resumo ativado");
  assert(t.includes("Alertas de oportunidades — <b>ativados</b>"), "alertas ativos");
});
Deno.test("texto: estados silenciados refletidos", () => {
  const t = prefsText({ settlementMuted: true, weeklyMuted: true, publicationEnabled: false, publicationAvailable: true });
  assert(t.includes("Liquidação de apostas — <b>silenciada 🔕</b>"), "liq silenciada");
  assert(t.includes("Resumo semanal — <b>silenciado 🔕</b>"), "resumo silenciado");
  assert(t.includes("Alertas de oportunidades — <b>pausados 🔕</b>"), "alertas pausados");
});
Deno.test("texto: acesso inativo não é confundido com alerta pausado", () => {
  const t = prefsText({ settlementMuted: false, weeklyMuted: false, publicationEnabled: true, publicationAvailable: false });
  assert(t.includes("Alertas de oportunidades — <b>indisponíveis</b>"), "indisponível");
  assert(t.includes("preferência está ativada"), "preferência preservada");
});
Deno.test("teclado: rótulo é a AÇÃO (ativado → Silenciar)", () => {
  const rows = prefsKeyboard({ settlementMuted: false, weeklyMuted: false, publicationEnabled: true, publicationAvailable: true }) as any[];
  assertEquals(rows[0][0].text, "Silenciar liquidação");
  assertEquals(rows[1][0].text, "Silenciar resumo semanal");
  assertEquals(rows[2][0].text, "Pausar alertas de oportunidades");
});
Deno.test("teclado: rótulo inverte quando silenciado", () => {
  const rows = prefsKeyboard({ settlementMuted: true, weeklyMuted: true, publicationEnabled: false, publicationAvailable: true }) as any[];
  assertEquals(rows[0][0].text, "Reativar liquidação");
  assertEquals(rows[1][0].text, "Reativar resumo semanal");
  assertEquals(rows[2][0].text, "Retomar alertas de oportunidades");
});
Deno.test("teclado: callbacks estáveis", () => {
  const rows = prefsKeyboard({ settlementMuted: true, weeklyMuted: false, publicationEnabled: true, publicationAvailable: true }) as any[];
  assertEquals(rows[0][0].callback_data, "prefliq");
  assertEquals(rows[1][0].callback_data, "prefres");
  assertEquals(rows[2][0].callback_data, "prefpub");
});
Deno.test("teclado: estados independentes", () => {
  const rows = prefsKeyboard({ settlementMuted: true, weeklyMuted: false, publicationEnabled: true, publicationAvailable: true }) as any[];
  assertEquals(rows[0][0].text, "Reativar liquidação");
  assertEquals(rows[1][0].text, "Silenciar resumo semanal");
});
