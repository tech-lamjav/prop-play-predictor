// health.ts — lógica pura do healthcheck (testada no CI).
//
// Duas leituras diferentes das mesmas linhas de message_runs, porque "falhou"
// não quer dizer sempre a mesma coisa:
//
//   • STREAK  — os últimos runs falharam TODOS e num intervalo CURTO. É a
//     função quebrada de verdade: um cron de 15 min quebrado acumula 3 falhas
//     em 45 min. Alerta vermelho.
//   • FLAKY   — falhas espalhadas dentro da janela. A função funciona, mas
//     goteja (ex.: 26–27/08, ~7% dos runs do notify-settlement morreram com
//     "JWT issued at future" vindo da plataforma). Alerta amarelo.
//
// O span existe porque as funções não gravam TODO run: o notify-settlement só
// registra run com candidato ou com erro (regra anti-ruído da migration 089).
// Numa madrugada sem aposta pendente, as três últimas linhas da tabela podem
// ser três falhas separadas por dois dias — sem o span, isso vira alarme de
// "função quebrada" para algo que está a 93% de saúde.
export interface RunRow {
  fn: string;
  ok: boolean;
  ran_at: string; // ISO
}

const HOUR_MS = 3_600_000;

// ran_at é timestamptz NOT NULL no banco, mas o parse é a fronteira do módulo:
// linha com carimbo ilegível é descartada aqui, e não vira nem alarme nem
// silêncio acidental mais adiante.
interface Run {
  fn: string;
  ok: boolean;
  t: number;
}

function parseRows(rows: RunRow[]): Run[] {
  const out: Run[] = [];
  for (const r of rows) {
    const t = Date.parse(r.ran_at);
    if (!Number.isNaN(t)) out.push({ fn: r.fn, ok: r.ok, t });
  }
  return out;
}

// rows ordenados do MAIS RECENTE pro mais antigo. Devolve as funções cujos
// últimos `threshold` runs falharam TODOS **e** cabem em `maxSpanMs`.
// Menos runs que o threshold = sem veredito (função nova não alarma).
export function failingStreaks(
  rows: RunRow[],
  threshold = 3,
  opts: { now?: number; maxSpanMs?: number } = {},
): string[] {
  const now = opts.now ?? Date.now();
  const maxSpanMs = opts.maxSpanMs ?? 6 * HOUR_MS;

  const byFn = new Map<string, Run[]>();
  for (const r of parseRows(rows)) {
    const list = byFn.get(r.fn) ?? [];
    if (list.length < threshold) list.push(r);
    byFn.set(r.fn, list);
  }

  const out: string[] = [];
  for (const [fn, runs] of byFn) {
    if (runs.length < threshold) continue;
    if (!runs.every((r) => !r.ok)) continue;
    // runs[último] é o mais antigo do streak: se ele já é velho, as falhas
    // estão espalhadas no tempo — isso é flaky, não quebra.
    if (now - runs[runs.length - 1].t > maxSpanMs) continue;
    out.push(fn);
  }
  return out.sort();
}

export interface FlakyFn {
  fn: string;
  failures: number;
  total: number;
}

// Falhas espalhadas na janela. Sinal mais fraco que o streak, mas real — é
// exatamente o que passava batido antes. `minFailures` evita alarmar com um
// 429 isolado do Telegram numa terça-feira.
export function flakyFns(
  rows: RunRow[],
  opts: { now?: number; windowMs?: number; minFailures?: number } = {},
): FlakyFn[] {
  const now = opts.now ?? Date.now();
  const windowMs = opts.windowMs ?? 24 * HOUR_MS;
  const minFailures = opts.minFailures ?? 3;

  const agg = new Map<string, FlakyFn>();
  for (const r of parseRows(rows)) {
    if (now - r.t > windowMs) continue;
    const cur = agg.get(r.fn) ?? { fn: r.fn, failures: 0, total: 0 };
    cur.total++;
    if (!r.ok) cur.failures++;
    agg.set(r.fn, cur);
  }

  return [...agg.values()]
    .filter((f) => f.failures >= minFailures)
    .sort((a, b) => a.fn.localeCompare(b.fn));
}
