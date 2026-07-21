// Testes da Sequência de disciplina (shared/streak.ts, item 18 / Onda 7).
// Regra de ouro: dia sem aposta é NEUTRO (só >GAP_MAX_DAYS vazios reseta).
import { assert, assertEquals } from "./_assert.ts";
import {
  brtDay,
  computeStreak,
  milestoneReached,
  receiptStreakLine,
  weeklyStreakLine,
} from "../shared/streak.ts";

// "agora": 2026-07-21 15:00 BRT (18:00 UTC)
const NOW = new Date("2026-07-21T18:00:00Z");
// helper: timestamp UTC do meio-dia BRT de N dias atrás
const daysAgo = (n: number, hourUtc = 15) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString().slice(0, 10) + `T${String(hourUtc).padStart(2, "0")}:00:00Z`;

// ── fronteira de dia BRT ──
Deno.test("brtDay: 02h30 UTC é 23h30 BRT do dia ANTERIOR", () => {
  assertEquals(brtDay("2026-07-21T02:30:00Z"), "2026-07-20");
});
Deno.test("brtDay: 15h UTC é o mesmo dia em BRT", () => {
  assertEquals(brtDay("2026-07-21T15:00:00Z"), "2026-07-21");
});

// ── streak básico ──
Deno.test("3 dias corridos apostando → streak 3, 1ª do dia", () => {
  const s = computeStreak([daysAgo(0), daysAgo(1), daysAgo(2)], NOW);
  assertEquals(s, { days: 3, firstBetOfDay: true });
});
Deno.test("várias apostas no mesmo dia contam 1 dia (e não é 1ª do dia)", () => {
  const s = computeStreak([daysAgo(0), daysAgo(0, 12), daysAgo(1)], NOW);
  assertEquals(s.days, 2);
  assertEquals(s.firstBetOfDay, false);
});

// ── dias vazios neutros (a regra de ouro) ──
Deno.test("descanso de 4 dias NÃO quebra (gap <= 7)", () => {
  const s = computeStreak([daysAgo(0), daysAgo(5)], NOW);
  assertEquals(s.days, 2);
});
Deno.test("descanso de 8+ dias vazios reseta a contagem anterior", () => {
  const s = computeStreak([daysAgo(0), daysAgo(9)], NOW);
  assertEquals(s.days, 1);
});
Deno.test("sequência morta: última aposta há 10 dias (sem aposta hoje) → 0", () => {
  const s = computeStreak([daysAgo(10), daysAgo(11)], NOW);
  assertEquals(s.days, 0);
});
Deno.test("sequência viva sem aposta hoje: última há 3 dias → conta, não é 1ª do dia", () => {
  const s = computeStreak([daysAgo(3), daysAgo(4)], NOW);
  assertEquals(s, { days: 2, firstBetOfDay: false });
});
Deno.test("sem apostas → 0", () => {
  assertEquals(computeStreak([], NOW), { days: 0, firstBetOfDay: false });
});

// ── milestones (anti-repetição no mesmo dia) ──
Deno.test("5º dia + 1ª aposta do dia → milestone 5", () => {
  const dates = [0, 1, 2, 3, 4].map((n) => daysAgo(n));
  assertEquals(milestoneReached(computeStreak(dates, NOW)), 5);
});
Deno.test("5º dia mas 2ª aposta do dia → sem milestone (não repete)", () => {
  const dates = [daysAgo(0), daysAgo(0, 12), daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(4)];
  assertEquals(milestoneReached(computeStreak(dates, NOW)), null);
});
Deno.test("6º dia → sem milestone (só 5/10/20/30/50/100)", () => {
  const dates = [0, 1, 2, 3, 4, 5].map((n) => daysAgo(n));
  assertEquals(milestoneReached(computeStreak(dates, NOW)), null);
});

// ── linhas (copy: celebra CONTROLE) ──
Deno.test("recibo: linha só em milestone", () => {
  const m5 = computeStreak([0, 1, 2, 3, 4].map((n) => daysAgo(n)), NOW);
  assertEquals(receiptStreakLine(m5), "🔥 5º dia seguido com a banca em dia");
  const m3 = computeStreak([0, 1, 2].map((n) => daysAgo(n)), NOW);
  assertEquals(receiptStreakLine(m3), null);
});
Deno.test("resumo: linha só com streak >= 5", () => {
  assertEquals(weeklyStreakLine(4), null);
  assert(weeklyStreakLine(7)!.includes("<b>7 dias</b>"));
  assertEquals(weeklyStreakLine(null), null);
});
