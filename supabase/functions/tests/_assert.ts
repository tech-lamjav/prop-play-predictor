// mini-assert local — mantém os testes 100% offline (sem baixar std/jsr no CI)
export function assertEquals(got: unknown, expected: unknown, label = ""): void {
  const g = JSON.stringify(got);
  const e = JSON.stringify(expected);
  if (g !== e) throw new Error(`${label ? label + ": " : ""}esperado ${e}, veio ${g}`);
}

export function assert(cond: boolean, label = "assert"): void {
  if (!cond) throw new Error(label);
}
