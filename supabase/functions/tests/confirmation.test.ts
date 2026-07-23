// Testes do teclado do recibo de registro (telegram-webhook/telegram-api.ts).
// Recibo com botões [✅ Green][❌ Red] / [✏️ Editar][📊 Ver banca]: o Editar
// deep-linka pro modal de edição (?edit=<id>) e Green/Red reusam o mesmo
// handler settle:<id>:<won|lost> do lembrete/auto-liquidação.
import { assert, assertEquals } from "./_assert.ts";
import { confirmationKeyboard } from "../telegram-webhook/keyboards.ts";

Deno.test("recibo: layout 2x2 (settle em cima, links embaixo)", () => {
  const kb = confirmationKeyboard("bet-123");
  assertEquals(kb.inline_keyboard.length, 2, "duas linhas");
  assertEquals(kb.inline_keyboard[0].length, 2, "linha 1: Green + Red");
  assertEquals(kb.inline_keyboard[1].length, 2, "linha 2: Editar + Ver banca");
});

Deno.test("recibo: Green/Red reusam o handler settle:<id>:<outcome>", () => {
  const kb = confirmationKeyboard("bet-123");
  const [green, red] = kb.inline_keyboard[0];
  assertEquals(green.callback_data, "settle:bet-123:won");
  assertEquals(red.callback_data, "settle:bet-123:lost");
  assert(!("url" in green), "Green é callback, não link");
});

Deno.test("recibo: Editar deep-linka pro modal de edição (?edit=<id>)", () => {
  const kb = confirmationKeyboard("bet-123");
  const [editar, verBanca] = kb.inline_keyboard[1];
  assertEquals(editar.url, "https://www.smartbetting.app/bets?edit=bet-123");
  assertEquals(verBanca.url, "https://www.smartbetting.app/bets");
  assert(!("callback_data" in editar), "Editar é link, não callback");
});
