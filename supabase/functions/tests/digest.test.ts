// Testes do digest de auto-liquidações (notify-settlement/digest.ts, Onda 5).
import { assert, assertEquals } from "./_assert.ts";
import {
  type DigestItem,
  buildDigestMessage,
  digestButtonRows,
  digestCounts,
  profitForVerdict,
} from "../notify-settlement/digest.ts";
import type { Candidate } from "../notify-settlement/verdict.ts";

function bet(desc: string, stake: number, ret: number, id = "b1"): Candidate {
  return {
    bet_id: id, user_id: "u1", chat_id: "c1", user_name: null, bet_type: "single",
    sport: "Futebol", league: null, betting_market: null,
    match_description: null, bet_description: desc,
    odds: 2, stake_amount: stake, potential_return: ret, bet_date: "", match_date: null, reminder_count: 0,
  };
}
const item = (desc: string, stake: number, ret: number, verdict: DigestItem["verdict"], id = "b1"): DigestItem =>
  ({ bet: bet(desc, stake, ret, id), verdict });

// ── profitForVerdict (espelha o profitForBet do app) ──
Deno.test("profit: won = retorno - stake", () => assertEquals(profitForVerdict(50, 105, "won"), 55));
Deno.test("profit: lost = -stake", () => assertEquals(profitForVerdict(50, 105, "lost"), -50));
Deno.test("profit: void = 0 (devolvida)", () => assertEquals(profitForVerdict(50, 105, "void"), 0));
Deno.test("profit: half_won = metade do lucro", () => assertEquals(profitForVerdict(50, 105, "half_won"), 27.5));
Deno.test("profit: half_lost = -metade do stake", () => assertEquals(profitForVerdict(50, 105, "half_lost"), -25));

// ── contagem do cabeçalho ──
Deno.test("counts: 2 green · 1 red", () => {
  const items = [item("a", 10, 20, "won"), item("b", 10, 20, "won"), item("c", 10, 20, "lost")];
  assertEquals(digestCounts(items), "2 green · 1 red");
});
Deno.test("counts: inclui anulada/meio só quando existem", () => {
  const items = [item("a", 10, 20, "won"), item("b", 10, 20, "void"), item("c", 10, 20, "half_lost")];
  assertEquals(digestCounts(items), "1 green · 1 meio red · 1 anulada");
});

// ── mensagem ──
Deno.test("mensagem: cabeçalho, linhas, saldo assinado, rodapé Corrigir", () => {
  const items = [
    item("Vitória do Palmeiras", 50, 100, "won", "b1"),   // +50
    item("Mais de 1.5 gols", 20, 40, "won", "b2"),        // +20
    item("Flamengo ML", 30, 60, "lost", "b3"),            // -30
  ];
  const t = buildDigestMessage(items);
  assert(t.includes("Fechei 3 apostas: 2 green · 1 red"), "cabeçalho");
  assert(t.includes("✅ <b>Vitória do Palmeiras</b> · +R$ 50,00"), "linha won");
  assert(t.includes("❌ <b>Flamengo ML</b> · −R$ 30,00"), "linha lost");
  assert(t.includes("Saldo: <b>+R$ 40,00</b>"), "saldo");
  assert(t.includes("Toca em Corrigir"), "rodapé");
});
Deno.test("mensagem: void mostra 'devolvida', saldo negativo com −", () => {
  const items = [item("A", 50, 100, "void", "b1"), item("B", 30, 60, "lost", "b2"), item("C", 10, 15, "lost", "b3")];
  const t = buildDigestMessage(items);
  assert(t.includes("↔️ <b>A</b> · devolvida"), "void devolvida");
  assert(t.includes("Saldo: <b>−R$ 40,00</b>"), "saldo negativo");
});
Deno.test("mensagem: escapa HTML na descrição", () => {
  const t = buildDigestMessage([item("A <b>&", 10, 20, "won"), item("B", 10, 20, "won"), item("C", 10, 20, "won")]);
  assert(t.includes("A &lt;b&gt;&amp;"), "esc");
});

// ── teclado ──
Deno.test("teclado: 3 apostas → 3 linhas de Corrigir + banca", () => {
  const items = [item("A", 10, 20, "won", "x1"), item("B", 10, 20, "won", "x2"), item("C", 10, 20, "lost", "x3")];
  const rows = digestButtonRows(items, "https://site/bets") as any[];
  assertEquals(rows.length, 4);
  assertEquals(rows[0][0].callback_data, "fix:x1");
  assertEquals(rows[2][0].callback_data, "fix:x3");
  assertEquals(rows[3][0].text, "Ver minha banca");
});
Deno.test("teclado: 9 apostas → Corrigir vai pro site (2 linhas)", () => {
  const items = Array.from({ length: 9 }, (_, i) => item(`A${i}`, 10, 20, "won", `x${i}`));
  const rows = digestButtonRows(items, "https://site/bets") as any[];
  assertEquals(rows.length, 2);
  assertEquals(rows[0][0].text, "Corrigir pelo site");
});
Deno.test("teclado: descrição longa é truncada no botão", () => {
  const longa = "Uma descrição de aposta absurdamente comprida que não cabe";
  const rows = digestButtonRows([item(longa, 10, 20, "won"), item("B", 10, 20, "won"), item("C", 10, 20, "won")], "u") as any[];
  assert(rows[0][0].text.length <= 32, "truncado");
  assert(rows[0][0].text.includes("…"), "elipse");
});
