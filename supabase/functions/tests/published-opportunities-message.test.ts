import { assert } from "./_assert.ts";
import {
  brtQuando,
  type PublishedMessageOpportunity,
  publishedMessageText,
} from "../notify-published-opportunities/message.ts";

const opportunity = (
  fixture_id: number,
  score: number,
): PublishedMessageOpportunity => ({
  alert_id: `alert-${fixture_id}`,
  fixture_id,
  home_team_name: `Casa ${fixture_id}`,
  away_team_name: `Fora ${fixture_id}`,
  competition: "Brasileirão",
  kickoff_utc: "2026-08-27T19:30:00.000Z",
  market: "goals_over_under",
  outcome: "Over",
  line_value: 1.5,
  best_odd: 1.8,
  score,
  faixa: "Média",
  evidencias: ["O jogo cria chances dos dois lados"],
});

// O relógio entra por parâmetro porque "Hoje" e "Amanhã" só existem em
// relação a ele. Sem fixar, o teste passaria hoje e quebraria amanhã.
const NO_DIA = new Date("2026-08-27T12:00:00.000Z");

Deno.test("mensagem de publicação: oportunidade única aponta a nova leitura", () => {
  const text = publishedMessageText(
    [opportunity(1, 46)],
    new Map([["alert-1", "https://example.test/jogo-1"]]),
    NO_DIA,
  );

  assert(text.includes("Nova oportunidade mapeada"), "título individual");
  assert(text.includes("Casa 1 × Fora 1"), "jogo");
  assert(
    text.includes("Mais de 1,5 gols · odd 1.8 · Score <b>46 · Média</b>"),
    "dados da oportunidade",
  );
});

Deno.test("mensagem de publicação: lote grande detalha as três maiores e aponta o restante no painel", () => {
  const text = publishedMessageText(
    [
      opportunity(1, 40),
      opportunity(2, 64),
      opportunity(3, 58),
      opportunity(4, 70),
    ],
    new Map([
      ["alert-1", "u1"],
      ["alert-2", "u2"],
      ["alert-3", "u3"],
      ["alert-4", "u4"],
    ]),
  );

  assert(text.includes("Novas oportunidades mapeadas"), "título consolidado");
  assert(text.includes("4 no painel"), "quantidade consolidada");
  assert(text.includes("Casa 4 × Fora 4"), "maior Score entra");
  assert(text.includes("Casa 2 × Fora 2"), "segunda maior entra");
  assert(text.includes("Casa 3 × Fora 3"), "terceira maior entra");
  assert(!text.includes("Casa 1 × Fora 1"), "quarta não ocupa detalhe");
  assert(text.includes("+ 1 oportunidade no painel."), "restante explícito");
});

// ============================================================
// Quando o jogo começa
// ============================================================
// A hora sozinha não dizia se era daqui a pouco ou outro dia, e o lote mistura
// os dois. A conversão é em Brasília, não no fuso de quem roda o teste.
// ============================================================

Deno.test("quando: jogo do mesmo dia é 'Hoje'", () => {
  // 19:30 UTC é 16:30 em Brasília, mesmo dia civil.
  assert(
    brtQuando("2026-08-27T19:30:00.000Z", new Date("2026-08-27T12:00:00.000Z")) ===
      "Hoje 16:30",
    "mesmo dia",
  );
});

Deno.test("quando: jogo do dia seguinte é 'Amanhã'", () => {
  assert(
    brtQuando("2026-08-28T19:30:00.000Z", new Date("2026-08-27T12:00:00.000Z")) ===
      "Amanhã 16:30",
    "dia seguinte",
  );
});

Deno.test("quando: mais longe que amanhã traz dia da semana e data", () => {
  // 2026-08-29 é um sábado.
  assert(
    brtQuando("2026-08-29T19:30:00.000Z", new Date("2026-08-27T12:00:00.000Z")) ===
      "Sáb 29/08 16:30",
    "dia da semana e data",
  );
});

Deno.test("quando: a virada do dia segue Brasília, não o UTC", () => {
  // 01:00 UTC do dia 28 ainda é 22:00 do dia 27 em Brasília: quem recebe às
  // 20h precisa ler "Hoje", e não "Amanhã".
  assert(
    brtQuando("2026-08-28T01:00:00.000Z", new Date("2026-08-27T23:00:00.000Z")) ===
      "Hoje 22:00",
    "dia civil de Brasília",
  );
});

Deno.test("mensagem de publicação: a data acompanha a hora do jogo", () => {
  const text = publishedMessageText(
    [opportunity(1, 46)],
    new Map([["alert-1", "u1"]]),
    new Date("2026-08-26T12:00:00.000Z"),
  );

  assert(text.includes("· Amanhã 16:30"), "data junto da hora");
});
