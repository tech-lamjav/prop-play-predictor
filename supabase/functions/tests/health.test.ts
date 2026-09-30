// Testes da lógica do ops-healthcheck (health.ts).
import { assertEquals } from "./_assert.ts";
import { avisoDoPorteiro, failingStreaks, flakyFns, type RunRow } from "../ops-healthcheck/health.ts";

const T0 = Date.parse("2026-08-27T12:00:00Z"); // "agora" fixo dos testes
const MIN = 60_000;
const HOUR = 3_600_000;

// r("a", false, 15) = run da função "a", falhou, 15 min atrás
const r = (fn: string, ok: boolean, minsAgo: number): RunRow => ({
  fn,
  ok,
  ran_at: new Date(T0 - minsAgo * MIN).toISOString(),
});
const streaks = (rows: RunRow[]) => failingStreaks(rows, 3, { now: T0 });
const flaky = (rows: RunRow[]) => flakyFns(rows, { now: T0 });

// ── streak: quebrada de verdade ──────────────────────────────
Deno.test("3 falhas seguidas e recentes → alerta", () => {
  assertEquals(streaks([r("a", false, 0), r("a", false, 15), r("a", false, 30)]), ["a"]);
});
Deno.test("2 falhas → sem alerta (abaixo do threshold)", () => {
  assertEquals(streaks([r("a", false, 0), r("a", false, 15)]), []);
});
Deno.test("falha-ok-falha → sem alerta (não é streak)", () => {
  assertEquals(streaks([r("a", false, 0), r("a", true, 15), r("a", false, 30)]), []);
});
Deno.test("recuperou (ok mais recente) → sem alerta mesmo com falhas antigas", () => {
  assertEquals(
    streaks([r("a", true, 0), r("a", false, 15), r("a", false, 30), r("a", false, 45)]),
    [],
  );
});
Deno.test("só os 3 mais recentes contam (4ª falha antiga irrelevante)", () => {
  assertEquals(
    streaks([r("a", false, 0), r("a", false, 15), r("a", false, 30), r("a", true, 45)]),
    ["a"],
  );
});
Deno.test("funções independentes: uma falhando, outra saudável", () => {
  const rows = [
    r("b", true, 0), r("a", false, 1), r("b", true, 15), r("a", false, 16),
    r("b", true, 30), r("a", false, 31),
  ];
  assertEquals(streaks(rows), ["a"]);
});
Deno.test("função nova (1 run) nunca alarma", () => {
  assertEquals(streaks([r("nova", false, 0)]), []);
});

// ── o span: o incidente de 26/08 ─────────────────────────────
// 3 falhas espalhadas por 2 dias eram as 3 últimas linhas da tabela (a função
// só grava run com candidato ou erro) e viravam alarme de "quebrada".
Deno.test("3 falhas espalhadas por 2 dias NÃO são streak", () => {
  assertEquals(
    streaks([r("a", false, 30), r("a", false, 14 * 60), r("a", false, 40 * 60)]),
    [],
  );
});
Deno.test("streak antigo (nada rodou desde) não alarma", () => {
  assertEquals(
    streaks([r("a", false, 20 * 60), r("a", false, 20 * 60 + 15), r("a", false, 20 * 60 + 30)]),
    [],
  );
});
Deno.test("ran_at inválido não derruba nem alarma", () => {
  const rows: RunRow[] = [
    { fn: "a", ok: false, ran_at: "sei lá" },
    r("a", false, 15),
    r("a", false, 30),
  ];
  assertEquals(streaks(rows), []);
});

// ── flaky: goteja, mas está de pé ────────────────────────────
Deno.test("falhas espalhadas na janela viram flaky", () => {
  const rows = [
    r("a", false, 30), r("a", true, 60), r("a", false, 5 * 60),
    r("a", true, 8 * 60), r("a", false, 20 * 60),
  ];
  assertEquals(flaky(rows), [{ fn: "a", failures: 3, total: 5 }]);
});
Deno.test("2 falhas na janela → abaixo do mínimo, sem ruído", () => {
  assertEquals(flaky([r("a", false, 30), r("a", true, 60), r("a", false, 5 * 60)]), []);
});
Deno.test("falhas fora da janela de 24h não contam", () => {
  const rows = [r("a", false, 30), r("a", false, 30 * 60), r("a", false, 40 * 60)];
  assertEquals(flaky(rows), []);
});
Deno.test("função saudável não vira flaky", () => {
  assertEquals(flaky([r("a", true, 30), r("a", true, 60), r("a", true, 90)]), []);
});
Deno.test("flaky ordena por nome e separa funções", () => {
  const rows = [
    r("z", false, 10), r("z", false, 20), r("z", false, 30),
    r("a", false, 10), r("a", false, 20), r("a", false, 30),
  ];
  assertEquals(flaky(rows), [
    { fn: "a", failures: 3, total: 3 },
    { fn: "z", failures: 3, total: 3 },
  ]);
});

// ── o porteiro que parou de saber (#554) ─────────────────────
//
// O porteiro deixa entrar quando não consegue decidir de onde a pessoa veio.
// É escolha, não descuido — mas fail-open silencioso é um bloqueio que morreu
// sem ninguém ver, e a operação continuaria normal para quem deveria estar
// barrado. Estes testes protegem o barulho.

const ligado = { bloqueioLigado: true };

Deno.test("porteiro cego em proporção alta → avisa", () => {
  const aviso = avisoDoPorteiro({ naoSei: 30, total: 40 }, ligado);
  assertEquals(aviso?.naoSei, 30);
  assertEquals(aviso?.total, 40);
});

Deno.test("poucos 'não sei' não viram notícia, mesmo em proporção alta", () => {
  // 1 de 2 é 50% e não diz nada num dia de movimento fraco. É por isso que a
  // proporção sozinha não basta.
  assertEquals(avisoDoPorteiro({ naoSei: 1, total: 2 }, ligado), null);
});

Deno.test("muitos 'não sei' diluídos em muito acesso não viram notícia", () => {
  // 20 em 20 mil é ruído. É por isso que o piso absoluto sozinho não basta.
  assertEquals(avisoDoPorteiro({ naoSei: 20, total: 20_000 }, ligado), null);
});

Deno.test("com o bloqueio desligado o vigia fica calado", () => {
  assertEquals(avisoDoPorteiro({ naoSei: 999, total: 1000 }, { bloqueioLigado: false }), null);
});

Deno.test("sem acesso nenhum na janela não há o que avisar", () => {
  // Sem esta guarda, zero dividido por zero viraria NaN e a comparação
  // devolveria sempre falso — calado pelo motivo errado.
  assertEquals(avisoDoPorteiro({ naoSei: 0, total: 0 }, ligado), null);
});

Deno.test("o limite pode ser afrouxado sem deploy", () => {
  const presenca = { naoSei: 6, total: 20 };
  assertEquals(avisoDoPorteiro(presenca, ligado)?.naoSei, 6);
  assertEquals(avisoDoPorteiro(presenca, { ...ligado, minimo: 50 }), null);
});

Deno.test("a proporção relatada é a que foi medida", () => {
  const aviso = avisoDoPorteiro({ naoSei: 10, total: 40 }, ligado);
  assertEquals(aviso?.proporcao, 0.25);
});
