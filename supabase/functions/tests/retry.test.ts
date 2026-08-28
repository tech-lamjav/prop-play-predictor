// Testes do readWithRetry (shared/retry.ts) — delay 0 pra não arrastar o CI.
import { assertEquals } from "./_assert.ts";
import { readWithRetry } from "../shared/retry.ts";

const fast = { delayMs: 0 };

Deno.test("sucesso de primeira → uma chamada só", async () => {
  let n = 0;
  const res = await readWithRetry("x", () => {
    n++;
    return Promise.resolve({ data: "ok", error: null });
  }, fast);
  assertEquals([n, res.data], [1, "ok"]);
});

Deno.test("falha transitória → repete e entrega o sucesso", async () => {
  let n = 0;
  const res = await readWithRetry("x", () => {
    n++;
    return Promise.resolve(
      n < 3 ? { data: null, error: { message: "JWT issued at future" } } : { data: "ok", error: null },
    );
  }, fast);
  assertEquals([n, res.data, res.error], [3, "ok", null]);
});

Deno.test("erro permanente → desiste no teto e devolve o erro", async () => {
  let n = 0;
  const res = await readWithRetry("x", () => {
    n++;
    return Promise.resolve({ data: null, error: { message: "column does not exist" } });
  }, fast);
  assertEquals([n, (res.error as { message: string }).message], [3, "column does not exist"]);
});

Deno.test("attempts=1 não repete", async () => {
  let n = 0;
  await readWithRetry("x", () => {
    n++;
    return Promise.resolve({ data: null, error: { message: "erro" } });
  }, { attempts: 1, delayMs: 0 });
  assertEquals(n, 1);
});
