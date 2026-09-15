// Acesso ao futebol lido pelo Telegram (shared/acesso-ao-futebol.ts).
//
// A regra estava copiada no callback das preferências e no /mensagens, com
// `início + 7 * 86400000` nos dois. Agora é uma função só, e ela lê o FIM
// gravado — não a duração. Estes casos existem para provar que ela não voltou a
// saber quanto o teste dura.
import { assert, assertEquals } from "./_assert.ts";
import { temAcessoAoFutebol } from "../shared/acesso-ao-futebol.ts";

const AGORA = Date.parse("2026-09-12T12:00:00Z");
const emHoras = (h: number) => new Date(AGORA + h * 3600000).toISOString();

Deno.test("assinante entra, mesmo sem teste nenhum", () => {
  assert(
    temAcessoAoFutebol({ futebol_subscription_status: "premium", futebol_trial_ends_at: null }, AGORA),
  );
});

Deno.test("teste correndo entra", () => {
  assert(temAcessoAoFutebol({ futebol_trial_ends_at: emHoras(1) }, AGORA));
});

Deno.test("teste vencido nao entra", () => {
  assertEquals(temAcessoAoFutebol({ futebol_trial_ends_at: emHoras(-1) }, AGORA), false);
});

Deno.test("quem nunca abriu o modulo nao entra", () => {
  // Fim nulo é quem ainda não tem relógio: o teste só larga no primeiro acesso
  // ao futebol, e é a RPC de acesso que grava. O Telegram nunca larga o relógio.
  assertEquals(temAcessoAoFutebol({ futebol_trial_ends_at: null }, AGORA), false);
});

Deno.test("as duas coortes vivas passam pela mesma conta", () => {
  // Quem começou antes do corte tem 7 dias gravados; quem começou depois tem 48
  // horas. A função não distingue, e é exatamente isso que ela precisa provar.
  assert(temAcessoAoFutebol({ futebol_trial_ends_at: emHoras(24 * 6) }, AGORA), "coorte de 7 dias");
  assert(temAcessoAoFutebol({ futebol_trial_ends_at: emHoras(47) }, AGORA), "coorte de 48 horas");
});

Deno.test("linha sem dados nao entra", () => {
  assertEquals(temAcessoAoFutebol(null, AGORA), false);
  assertEquals(temAcessoAoFutebol(undefined, AGORA), false);
  assertEquals(temAcessoAoFutebol({}, AGORA), false);
});

Deno.test("data ilegivel nao entra", () => {
  assertEquals(temAcessoAoFutebol({ futebol_trial_ends_at: "sei lá" }, AGORA), false);
});

Deno.test("o instante exato do fim ja esta fora", () => {
  // Empate conta como vencido: o fim é o primeiro instante SEM acesso, e é essa
  // a borda que a RPC de acesso usa (`now() < v_ends`).
  assertEquals(temAcessoAoFutebol({ futebol_trial_ends_at: emHoras(0) }, AGORA), false);
});
