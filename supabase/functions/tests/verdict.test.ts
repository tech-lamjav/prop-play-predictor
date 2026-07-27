// Testes do matching aposta↔jogo + veredito pelos 90' (notify-settlement).
// Rodam no CI ANTES de qualquer deploy (gate). Casos portados dos ensaios do
// F2 (PR #208) + handicap asiático (PR #197) — incluem os anti-falso-positivo
// críticos e a regressão do decimal que quase subiu (fix 545ccbb).
import { assert, assertEquals } from "./_assert.ts";
import {
  type Candidate,
  type FinishedMatch,
  computeVerdict,
  fixtureTeamNames,
  hasTeam,
  norm,
  settleAsianHandicap,
  teamNames,
} from "../notify-settlement/verdict.ts";

// helpers de construção
function fx(home: string, away: string, ftH: number | null, ftA: number | null,
  homeId: number | null = null, awayId: number | null = null,
  aliasById: Map<number, string[]> = new Map()): FinishedMatch {
  return {
    source: "fixtures", id: "fixtures 1", home_team: home, away_team: away,
    home_names: fixtureTeamNames(home, homeId, aliasById),
    away_names: fixtureTeamNames(away, awayId, aliasById),
    ft_home: ftH, ft_away: ftA, score_home: ftH, score_away: ftA, kickoff: 1000,
  };
}
function bet(desc: string, market: string | null, type = "single"): Candidate {
  return {
    bet_id: "b1", user_id: "u1", chat_id: "c1", user_name: null, bet_type: type,
    sport: "Futebol", league: null, betting_market: market,
    match_description: null, bet_description: desc,
    odds: 2, stake_amount: 10, potential_return: 20, bet_date: "", match_date: null, reminder_count: 0,
  };
}
function matches(matchDesc: string, betDesc: string, m: FinishedMatch): boolean {
  const text = norm(`${matchDesc} ${betDesc}`);
  return hasTeam(text, m.home_names) && hasTeam(text, m.away_names);
}

// ── norm: NÃO normaliza hífen/ponto (regressão 545ccbb — quebrava "2.5") ──
Deno.test("norm preserva pontuação de linha decimal", () => {
  assertEquals(norm("Mais de 2.5 Gols"), "mais de 2.5 gols");
  assertEquals(norm("Atlético-MG"), "atletico-mg");
});

// ── matching multi-liga (fixtures) ──
Deno.test("Palmeiras x Vasco casa com fixture Vasco da Gama", () => {
  assert(matches("Palmeiras x Vasco", "Vitória do Palmeiras", fx("Palmeiras", "Vasco da Gama", 2, 1)));
});
Deno.test("Corinthians x RB Bragantino casa", () => {
  assert(matches("Corinthians vs RB Bragantino", "RB Bragantino +0.5", fx("Corinthians", "RB Bragantino", 1, 1)));
});
Deno.test("usuário 'Bragantino' casa fixture 'RB Bragantino'", () => {
  assert(matches("Corinthians x Bragantino", "Bragantino vence", fx("Corinthians", "RB Bragantino", 1, 1)));
});
Deno.test("usuário 'Atlético-MG' casa fixture 'Atletico-MG'", () => {
  assert(matches("Cruzeiro x Atlético-MG", "Atlético-MG vence", fx("Cruzeiro", "Atletico-MG", 0, 1)));
});
Deno.test("usuário 'Atlético Mineiro' casa 'Atletico-MG'", () => {
  assert(matches("Cruzeiro x Atlético Mineiro", "vitória do Atlético Mineiro", fx("Cruzeiro", "Atletico-MG", 0, 1)));
});
Deno.test("Athletico Paranaense casa 'Athletico-PR'", () => {
  assert(matches("Athletico Paranaense x Coritiba", "Athletico Paranaense", fx("Athletico-PR", "Coritiba", 2, 0)));
});
Deno.test("anti-falso-positivo: Atlético-MG NÃO casa Atlético-GO", () => {
  assert(!matches("Vila Nova x Atlético-GO", "Atlético-GO", fx("Cruzeiro", "Atletico-MG", 0, 1)));
});
Deno.test("anti-falso-positivo: Atlético de Madrid NÃO vira Atlético-MG", () => {
  assert(!matches("Arsenal x Atlético de Madrid", "Atlético Madrid", fx("Cruzeiro", "Atletico-MG", 0, 1)));
});
Deno.test("um time só presente → não casa", () => {
  assert(!matches("Palmeiras x Santos", "Palmeiras vence", fx("Palmeiras", "Vasco da Gama", 2, 1)));
});
Deno.test("alias curado por id (team_aliases)", () => {
  const ab = new Map([[100, ["galo"]]]);
  assert(matches("Cruzeiro x Galo", "Galo vence", fx("Cruzeiro", "XYZ", 0, 1, null, 100, ab)));
});
Deno.test("matching da Copa: seleção PT + alias EN + código", () => {
  const names = teamNames("Inglaterra", "ENG");
  assert(hasTeam(norm("England vence"), names));
  assert(hasTeam(norm("aposta na ENG"), names));
  assert(!hasTeam(norm("Argentina vence"), names));
});

// ── veredito: money line / over-under / btts ──
Deno.test("ML: Palmeiras vence 2-1 → won", () => {
  assertEquals(computeVerdict(bet("Vitória do Palmeiras", "Money Line"), fx("Palmeiras", "Vasco da Gama", 2, 1)), "won");
});
Deno.test("O/U: 'Mais de 1.5 gols' com 1-1 → won (decimal intacto)", () => {
  assertEquals(computeVerdict(bet("Mais de 1.5 gols", "Over/Under"), fx("Corinthians", "RB Bragantino", 1, 1)), "won");
});
Deno.test("O/U: 'Menos de 2.5 gols' com total 3 → lost", () => {
  assertEquals(computeVerdict(bet("Menos de 2.5 gols", "Over/Under"), fx("A FC", "B FC", 2, 1)), "lost");
});
Deno.test("O/U: linha exata (2.0 com total 2) → null (push, usuário decide)", () => {
  assertEquals(computeVerdict(bet("Mais de 2.0 gols", "Over/Under"), fx("A FC", "B FC", 1, 1)), null);
});
Deno.test("BTTS sim com 1-1 → won", () => {
  assertEquals(computeVerdict(bet("Ambas marcam", "Ambas Marcam"), fx("A FC", "B FC", 1, 1)), "won");
});
Deno.test("BTTS 'não' com 1-0 → won", () => {
  assertEquals(computeVerdict(bet("Ambas marcam: não", "Ambas Marcam"), fx("A FC", "B FC", 1, 0)), "won");
});

// ── veredito: handicap asiático (sinal desarma ML; quarters) ──
Deno.test("handicap 'Palmeiras -1.5' vence por 2 → won", () => {
  assertEquals(computeVerdict(bet("Palmeiras -1.5", "Handicap"), fx("Palmeiras", "Vasco da Gama", 2, 0)), "won");
});
Deno.test("handicap 'Palmeiras -1.5' vence por 1 → lost", () => {
  assertEquals(computeVerdict(bet("Palmeiras -1.5", "Handicap"), fx("Palmeiras", "Vasco da Gama", 2, 1)), "lost");
});
Deno.test("AH -0.75 vence por 1 → half_won (quarter decompõe)", () => {
  assertEquals(computeVerdict(bet("Palmeiras -0.75", "Handicap Asiático"), fx("Palmeiras", "Vasco da Gama", 2, 1)), "half_won");
});
Deno.test("AH linha inteira -1 vence por 1 → void (push)", () => {
  assertEquals(settleAsianHandicap(1, -1), "void");
});
Deno.test("AH +0.25 empate → half_won", () => {
  assertEquals(settleAsianHandicap(0, 0.25), "half_won");
});

// ── veredito: conservadorismo (nunca chutar) ──
Deno.test("escanteios → null (mercado exótico)", () => {
  assertEquals(computeVerdict(bet("Mais de 9.5 escanteios", "Over/Under"), fx("A FC", "B FC", 1, 1)), null);
});
Deno.test("1º tempo → null", () => {
  assertEquals(computeVerdict(bet("Mais de 0.5 gols no 1º tempo", "Over/Under"), fx("A FC", "B FC", 2, 0)), null);
});
Deno.test("múltipla → null sempre", () => {
  assertEquals(computeVerdict(bet("Palmeiras vence", "Múltipla", "multiple"), fx("Palmeiras", "Vasco da Gama", 2, 1)), null);
});
Deno.test("ML ambíguo (dois times citados) → null", () => {
  assertEquals(computeVerdict(bet("Palmeiras x Vasco vencedor", "Money Line"), fx("Palmeiras", "Vasco da Gama", 2, 1)), null);
});
Deno.test("sem placar de 90' → null", () => {
  assertEquals(computeVerdict(bet("Vitória do Palmeiras", "Money Line"), fx("Palmeiras", "Vasco da Gama", null, null)), null);
});
