// ============================================================
// tiers.ts — faixa e copy do resumo semanal (código PURO)
// ============================================================
// Extraído de index.ts na Onda 3 (move-only) pra ser testável no CI
// (supabase/functions/tests/weekly.test.ts). Sem side effects.
import { esc } from "../shared/format.ts";

// thresholds da faixa: com unidade, em u; sem unidade, em ROI
const POS_U = 0.5, NEG_U = -1.0;
const POS_ROI = 0.05, NEG_ROI = -0.10;

export type Tier = "positive" | "neutral" | "negative";

export interface WeeklyCandidate {
  user_id: string;
  chat_id: string;
  user_name: string | null;
  n_settled: number;
  total_stake: number;
  total_profit: number;
  unit_value_rs: number | null;
  best_market: string | null;
  best_market_profit: number | null;
}

const sign = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");
const moneyAbs = (v: number) => `R$ ${Math.abs(v).toFixed(2).replace(".", ",")}`;
const unitAbs = (v: number) => `${Math.abs(v).toFixed(1).replace(".", ",")}u`;
const pctAbs = (v: number) => `${Math.abs(v * 100).toFixed(0)}%`;

export function pickTier(profit: number, roi: number, unitRs: number | null): Tier {
  if (unitRs && unitRs > 0) {
    const u = profit / unitRs;
    if (u > POS_U) return "positive";
    if (u < NEG_U) return "negative";
    return "neutral";
  }
  if (roi > POS_ROI) return "positive";
  if (roi < NEG_ROI) return "negative";
  return "neutral";
}

function resultLine(c: WeeklyCandidate, roi: number): string {
  const p = c.total_profit;
  const sg = sign(p);
  if (c.unit_value_rs && c.unit_value_rs > 0) {
    return `Resultado: <b>${sg}${unitAbs(p / c.unit_value_rs)}</b> (${sg}${moneyAbs(p)}) · ROI <b>${sg}${pctAbs(roi)}</b>`;
  }
  return `Resultado: <b>${sg}${moneyAbs(p)}</b> · ROI <b>${sg}${pctAbs(roi)}</b>`;
}

export function buildMessage(c: WeeklyCandidate, tier: Tier, roi: number): string {
  const head = `📊 <b>Seus últimos 7 dias</b>`;
  const mkt = c.best_market ? ` · melhor mercado: <b>${esc(c.best_market)}</b>` : "";
  const vol = `${c.n_settled} apostas liquidadas`;

  if (tier === "positive") {
    return [
      head,
      resultLine(c, roi),
      `${vol}${mkt}`,
      "",
      `Fechou no positivo. O que importa agora é entender <b>o que sustentou isso</b> — quais mercados e stakes puxaram o resultado — pra repetir com consistência, não por sorte.`,
    ].join("\n");
  }
  if (tier === "neutral") {
    return [
      head,
      resultLine(c, roi),
      `${vol}${mkt}`,
      "",
      `Variação controlada — nem lucro nem prejuízo relevante. Bom momento pra <b>afinar</b>: onde você foi eficiente e onde deixou valor na mesa.`,
    ].join("\n");
  }
  // negative — sem destacar "melhor mercado"; foco em processo e proteção
  return [
    head,
    resultLine(c, roi),
    vol,
    "",
    `Semana negativa faz parte — o que separa quem evolui é o <b>processo</b>, não o placar de 7 dias. Antes da próxima sequência, vale revisar <b>stake, volume e escolha de mercado</b> com calma. Sem correr atrás do prejuízo.`,
  ].join("\n");
}
