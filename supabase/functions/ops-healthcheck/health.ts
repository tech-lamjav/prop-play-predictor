// health.ts — lógica pura do healthcheck (testada no CI).
export interface RunRow {
  fn: string;
  ok: boolean;
}

// rows ordenados do MAIS RECENTE pro mais antigo. Devolve as funções cujos
// últimos `threshold` runs falharam TODOS (streak de falha = alerta).
// Menos runs que o threshold = sem veredito (função nova não alarma).
export function failingStreaks(rows: RunRow[], threshold = 3): string[] {
  const byFn = new Map<string, boolean[]>();
  for (const r of rows) {
    const list = byFn.get(r.fn) ?? [];
    if (list.length < threshold) list.push(r.ok);
    byFn.set(r.fn, list);
  }
  const out: string[] = [];
  for (const [fn, oks] of byFn) {
    if (oks.length >= threshold && oks.every((ok) => !ok)) out.push(fn);
  }
  return out.sort();
}
