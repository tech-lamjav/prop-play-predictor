// Testes da faixa + copy do resumo semanal (notify-weekly-summary/tiers.ts).
// Casos do ensaio do item 04 (PR #212): 3 faixas × com/sem unidade + thresholds.
import { assert, assertEquals } from "./_assert.ts";
import { buildMessage, pickTier, type WeeklyCandidate } from "../notify-weekly-summary/tiers.ts";

function cand(over: Partial<WeeklyCandidate>): WeeklyCandidate {
  return {
    user_id: "u1", chat_id: "c1", user_name: "Teste",
    n_settled: 3, total_stake: 100, total_profit: 0,
    unit_value_rs: null, best_market: null, best_market_profit: null,
    ...over,
  };
}

// ── thresholds (com unidade em u; sem unidade em ROI) ──
Deno.test("com unidade: +0.6u → positive", () => assertEquals(pickTier(30, 0.02, 50), "positive"));
Deno.test("com unidade: +0.4u → neutral", () => assertEquals(pickTier(20, 0.02, 50), "neutral"));
Deno.test("com unidade: -1.2u → negative", () => assertEquals(pickTier(-60, -0.04, 50), "negative"));
Deno.test("sem unidade: ROI 4% → neutral", () => assertEquals(pickTier(40, 0.04, null), "neutral"));
Deno.test("sem unidade: ROI 6% → positive", () => assertEquals(pickTier(60, 0.06, null), "positive"));
Deno.test("sem unidade: ROI -12% → negative", () => assertEquals(pickTier(-120, -0.12, null), "negative"));

// ── copy: conteúdo-chave por faixa ──
Deno.test("positiva com unidade: mostra u, R$, ROI e melhor mercado", () => {
  const c = cand({ n_settled: 11, total_stake: 1500, total_profit: 210, unit_value_rs: 50, best_market: "Over/Under gols" });
  const t = buildMessage(c, "positive", 0.14);
  assert(t.includes("+4,2u"), "unidades");
  assert(t.includes("+R$ 210,00"), "reais");
  assert(t.includes("ROI <b>+14%"), "roi");
  assert(t.includes("melhor mercado: <b>Over/Under gols"), "mercado");
  assert(t.includes("o que sustentou isso"), "narrativa consistência");
  assert(!t.includes("acerto"), "NUNCA taxa de acerto");
});
Deno.test("neutra: narrativa de ajuste fino", () => {
  const c = cand({ n_settled: 8, total_stake: 1200, total_profit: 15, unit_value_rs: 50, best_market: "Money Line" });
  const t = buildMessage(c, "neutral", 0.0125);
  assert(t.includes("Variação controlada"), "narrativa neutra");
  assert(t.includes("+0,3u"), "unidades");
});
Deno.test("negativa: protetiva, SEM melhor mercado, sem correr atrás", () => {
  const c = cand({ n_settled: 9, total_stake: 1290, total_profit: -155, unit_value_rs: 50, best_market: "Handicap" });
  const t = buildMessage(c, "negative", -0.12);
  assert(t.includes("−3,1u"), "sinal de menos tipográfico");
  assert(!t.includes("melhor mercado"), "negativa não cutuca métrica");
  assert(t.includes("Sem correr atrás do prejuízo"), "anti-tilt");
});
Deno.test("sem unidade: cai pra R$ puro (sem 'u')", () => {
  const c = cand({ n_settled: 6, total_stake: 600, total_profit: 90, best_market: "Ambas marcam" });
  const t = buildMessage(c, "positive", 0.15);
  assert(t.includes("Resultado: <b>+R$ 90,00</b>"), "R$ direto");
  assert(!/\d,\du/.test(t), "sem unidades");
});
// ── item 18: streak no resumo ──
Deno.test("streak: aparece na positiva com >=5 dias", () => {
  const c = cand({ total_profit: 90, best_market: "Money Line" });
  const t = buildMessage(c, "positive", 0.15, 7);
  assert(t.includes("Sequência viva: <b>7 dias</b>"), "linha do streak");
});
Deno.test("streak: NUNCA na semana negativa (mesmo com streak alto)", () => {
  const c = cand({ total_profit: -100 });
  const t = buildMessage(c, "negative", -0.2, 30);
  assert(!t.includes("Sequência"), "negativa não cutuca");
});
Deno.test("streak: ausente sem dado (flag off) e abaixo do patamar", () => {
  const c = cand({ total_profit: 90 });
  assert(!buildMessage(c, "positive", 0.15, null).includes("Sequência"), "null");
  assert(!buildMessage(c, "positive", 0.15, 4).includes("Sequência"), "<5");
});

Deno.test("melhor mercado escapa HTML", () => {
  const c = cand({ total_profit: 90, best_market: "A <b> & C" });
  const t = buildMessage(c, "positive", 0.15);
  assert(t.includes("A &lt;b&gt; &amp; C"), "esc aplicado");
});
