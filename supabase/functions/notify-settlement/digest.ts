// ============================================================
// digest.ts — DM única pra rajada de auto-liquidações (código PURO)
// ============================================================
// Onda 5 da revisão de UX: apostador com 3+ apostas no mesmo jogo recebia
// 3+ DMs em sequência no apito — spam justamente pro usuário mais intenso.
// Com >= DIGEST_MIN auto-liquidações no mesmo run, vira UMA mensagem com
// [↩️ Corrigir] por aposta. <= 2 continua individual (mensagem rica, com
// placar). Perguntas (mercado não-computável) continuam individuais sempre —
// precisam dos botões Green/Red próprios.
// Testado no CI: supabase/functions/tests/digest.test.ts
import { esc } from "../shared/format.ts";
import type { Candidate, Verdict } from "./verdict.ts";

export type SettleStatus = Exclude<Verdict, null>;
export interface DigestItem {
  bet: Candidate;
  verdict: SettleStatus;
}

export const DIGEST_MIN = 3;   // a partir de quantas auto-liquidações vira digest
const MAX_FIX_ROWS = 8;        // acima disso, Corrigir vai pro site (teto prático de teclado)

export const money = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const signedMoney = (v: number) => `${v < 0 ? "−" : "+"}${money(Math.abs(v))}`;

// lucro da aposta pelo veredito — espelha o profitForBet do app
export function profitForVerdict(stake: number, potentialReturn: number, v: SettleStatus): number {
  if (v === "won") return potentialReturn - stake;
  if (v === "lost") return -stake;
  if (v === "half_won") return (stake + potentialReturn) / 2 - stake;
  if (v === "half_lost") return -stake / 2;
  return 0; // void: devolvida
}

const VERDICT_META: Record<SettleStatus, { emoji: string; label: string }> = {
  won: { emoji: "✅", label: "green" },
  lost: { emoji: "❌", label: "red" },
  half_won: { emoji: "✅", label: "meio green" },
  half_lost: { emoji: "❌", label: "meio red" },
  void: { emoji: "↔️", label: "anulada" },
};

// "2 green · 1 red · 1 anulada" — só o que existe, na ordem do VERDICT_META
export function digestCounts(items: DigestItem[]): string {
  const order: SettleStatus[] = ["won", "lost", "half_won", "half_lost", "void"];
  const parts: string[] = [];
  for (const v of order) {
    const n = items.filter((i) => i.verdict === v).length;
    if (n > 0) parts.push(`${n} ${VERDICT_META[v].label}`);
  }
  return parts.join(" · ");
}

export function buildDigestMessage(items: DigestItem[]): string {
  const saldo = items.reduce(
    (a, i) => a + profitForVerdict(i.bet.stake_amount, i.bet.potential_return, i.verdict), 0
  );
  const lines = items.map((i) => {
    const meta = VERDICT_META[i.verdict];
    const valor = i.verdict === "void"
      ? "devolvida"
      : signedMoney(profitForVerdict(i.bet.stake_amount, i.bet.potential_return, i.verdict));
    return `${meta.emoji} <b>${esc(i.bet.bet_description)}</b> · ${valor}`;
  });
  return [
    `🏁 <b>Fechei ${items.length} apostas: ${digestCounts(items)}</b>`,
    "",
    ...lines,
    "",
    `Saldo: <b>${signedMoney(saldo)}</b> · banca atualizada 📊`,
    "",
    `<i>Liquidei pelo placar dos 90 minutos. Errei alguma? Toca em Corrigir.</i>`,
  ].join("\n");
}

const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

// Teclado: [↩️ <aposta>] por linha (até MAX_FIX_ROWS) + [Ver minha banca].
// Rajada maior que o teto → Corrigir vai pro site (nunca teclado quilométrico).
export function digestButtonRows(items: DigestItem[], betsUrl: string): unknown[][] {
  const rows: unknown[][] =
    items.length <= MAX_FIX_ROWS
      ? items.map((i) => [
          { text: `↩️ ${truncate(String(i.bet.bet_description ?? "aposta"), 28)}`, callback_data: `fix:${i.bet.bet_id}` },
        ])
      : [[{ text: "Corrigir pelo site", url: betsUrl }]];
  rows.push([{ text: "Ver minha banca", url: betsUrl }]);
  return rows;
}
