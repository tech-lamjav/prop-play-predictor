import { assert } from "./_assert.ts";
import {
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

Deno.test("mensagem de publicação: oportunidade única aponta a nova leitura", () => {
  const text = publishedMessageText(
    [opportunity(1, 46)],
    new Map([["alert-1", "https://example.test/jogo-1"]]),
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
