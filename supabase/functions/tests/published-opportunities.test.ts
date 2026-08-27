import { assertEquals } from "./_assert.ts";
import { planPublicationBatch } from "../notify-published-opportunities/planner.ts";

const now = new Date("2026-08-27T12:00:00.000Z");

Deno.test("publicação: uma oportunidade pré-live nova entra no lote uma única vez", () => {
  const batch = planPublicationBatch({
    now,
    alreadyAlerted: new Set<string>(),
    board: [{
      fixture_id: 1520835,
      market: "goals_over_under",
      outcome: "Over",
      line_value: 1.5,
      kickoff_utc: "2026-08-27 19:30:00",
      score: 46,
    }],
  });

  assertEquals(batch.newOpportunities.map((opportunity) => opportunity.key), [
    "1520835:goals_over_under:Over:1.5",
  ]);
  assertEquals(batch.detailedOpportunities.length, 1);
});

Deno.test("publicação: a mesma oportunidade não volta ao lote quando já foi alertada", () => {
  const batch = planPublicationBatch({
    now,
    alreadyAlerted: new Set(["1520835:goals_over_under:Over:1.5"]),
    board: [{
      fixture_id: 1520835,
      market: "goals_over_under",
      outcome: "Over",
      line_value: 1.5,
      kickoff_utc: "2026-08-27 19:30:00",
      score: 62,
    }],
  });

  assertEquals(batch.newOpportunities.length, 0);
});

Deno.test("publicação: não inclui oportunidade depois do kickoff", () => {
  const batch = planPublicationBatch({
    now,
    alreadyAlerted: new Set<string>(),
    board: [{
      fixture_id: 1520835,
      market: "goals_over_under",
      outcome: "Over",
      line_value: 1.5,
      kickoff_utc: "2026-08-27 11:59:59",
      score: 62,
    }],
  });

  assertEquals(batch.newOpportunities.length, 0);
});

Deno.test("publicação: candidata abaixo da régua do painel não entra no lote", () => {
  const batch = planPublicationBatch({
    now,
    alreadyAlerted: new Set<string>(),
    board: [{
      fixture_id: 1520835,
      market: "goals_over_under",
      outcome: "Over",
      line_value: 1.5,
      kickoff_utc: "2026-08-27T19:30:00Z",
      score: 39,
    }],
  });

  assertEquals(batch.newOpportunities.length, 0);
});

Deno.test("publicação: lote mantém todas as novas e detalha as três de maior Score", () => {
  const batch = planPublicationBatch({
    now,
    alreadyAlerted: new Set<string>(),
    board: [
      {
        fixture_id: 1,
        market: "goals_over_under",
        outcome: "Over",
        line_value: 1.5,
        kickoff_utc: "2026-08-27 19:30:00",
        score: 43,
      },
      {
        fixture_id: 2,
        market: "goals_over_under",
        outcome: "Over",
        line_value: 1.5,
        kickoff_utc: "2026-08-27 19:30:00",
        score: 58,
      },
      {
        fixture_id: 3,
        market: "goals_over_under",
        outcome: "Over",
        line_value: 1.5,
        kickoff_utc: "2026-08-27 19:30:00",
        score: 70,
      },
      {
        fixture_id: 4,
        market: "goals_over_under",
        outcome: "Over",
        line_value: 1.5,
        kickoff_utc: "2026-08-27 19:30:00",
        score: 51,
      },
    ],
  });

  assertEquals(batch.newOpportunities.length, 4);
  assertEquals(
    batch.detailedOpportunities.map((opportunity) => opportunity.fixture_id),
    [3, 2, 4],
  );
});
