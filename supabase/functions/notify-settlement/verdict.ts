// ============================================================
// verdict.ts — matching aposta↔jogo + veredito pelos 90' (código PURO)
// ============================================================
// Extraído de index.ts na Onda 3 da revisão (move-only, zero mudança de
// lógica) pra ser testável: supabase/functions/tests/verdict.test.ts roda
// estes casos no CI antes de qualquer deploy. NÃO importar nada com side
// effects aqui — este módulo precisa rodar offline no `deno test`.

// ── Normalização e casamento de times ────────────────────────
export function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (marcas combinantes)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Nome em inglês (print de casa gringa) → nome PT usado em wc_matches.
// Chaves e valores já normalizados (sem acento, minúsculas).
const EN_ALIASES: Record<string, string> = {
  "brazil": "brasil",
  "france": "franca",
  "germany": "alemanha",
  "spain": "espanha",
  "netherlands": "holanda",
  "england": "inglaterra",
  "portugal": "portugal",
  "argentina": "argentina",
  "uruguay": "uruguai",
  "colombia": "colombia",
  "ecuador": "equador",
  "paraguay": "paraguai",
  "mexico": "mexico",
  "united states": "estados unidos",
  "usa": "estados unidos",
  "canada": "canada",
  "belgium": "belgica",
  "croatia": "croacia",
  "switzerland": "suica",
  "italy": "italia",
  "poland": "polonia",
  "austria": "austria",
  "denmark": "dinamarca",
  "norway": "noruega",
  "sweden": "suecia",
  "scotland": "escocia",
  "turkey": "turquia",
  "turkiye": "turquia",
  "morocco": "marrocos",
  "senegal": "senegal",
  "ghana": "gana",
  "egypt": "egito",
  "algeria": "argelia",
  "tunisia": "tunisia",
  "nigeria": "nigeria",
  "cameroon": "camaroes",
  "ivory coast": "costa do marfim",
  "cote d'ivoire": "costa do marfim",
  "south africa": "africa do sul",
  "japan": "japao",
  "south korea": "coreia do sul",
  "korea republic": "coreia do sul",
  "saudi arabia": "arabia saudita",
  "iran": "ira",
  "qatar": "catar",
  "jordan": "jordania",
  "uzbekistan": "uzbequistao",
  "australia": "australia",
  "new zealand": "nova zelandia",
  "panama": "panama",
  "costa rica": "costa rica",
  "haiti": "haiti",
  "curacao": "curacao",
  "cape verde": "cabo verde",
};

// true se ALGUM dos nomes aparece como palavra inteira no texto normalizado
export function hasTeam(textNorm: string, names: string[]): boolean {
  return names.some((n) => {
    if (!n || n.length < 3) return false;
    return new RegExp(`(^|[^a-z])${escapeRegex(n)}([^a-z]|$)`).test(textNorm);
  });
}

// Variações reconhecíveis de um time de wc_matches (nome PT + aliases EN + código)
export function teamNames(namePt: string, code: string): string[] {
  const base = norm(namePt);
  const names = [base, norm(code)];
  for (const [en, pt] of Object.entries(EN_ALIASES)) if (pt === base) names.push(en);
  return names;
}

// ── Aliases de clube pro coletor multi-liga (F2) ─────────────
// A tabela public.fixtures traz o nome como a API-Football escreve (ex.:
// "Atletico-MG", "RB Bragantino"). O casamento primário é pelo próprio nome
// normalizado; aqui só as VARIAÇÕES ESTRUTURAIS que divergem do que o
// usuário/print costuma trazer (prefixo "rb", "da gama", forma por extenso do
// "-MG/-PR"). Apelidos/torcida (galo, verdão) ficam de fora de propósito: risco
// de falso-positivo > ganho. Curadoria fina futura entra em public.team_aliases
// (por api_team_id), carregada abaixo.
// CHAVE = nome da API normalizado (norm(); mantém o hífen). Valores normalizados.
const CLUB_ALIASES: Record<string, string[]> = {
  "rb bragantino": ["bragantino", "red bull bragantino"],
  "vasco da gama": ["vasco"],
  "atletico-mg": ["atletico mineiro"],
  "atletico-go": ["atletico goianiense"],
  "athletico-pr": ["athletico paranaense", "atletico paranaense"],
  "america-mg": ["america mineiro"],
  "sao paulo": ["sao paulo fc"],
  "gremio": ["gremio fbpa"],
};

// Nomes reconhecíveis de um time do coletor: nome da API + variações estruturais
// + aliases curados por id (team_aliases). Descarta tokens curtos (<3) e o
// perigoso "atletico"/"america" sozinho (colide entre clubes).
export function fixtureTeamNames(apiName: string, teamId: number | null, aliasById: Map<number, string[]>): string[] {
  const base = norm(apiName);
  const out = new Set<string>([base]);
  for (const a of CLUB_ALIASES[base] ?? []) out.add(a);
  if (teamId != null) for (const a of aliasById.get(teamId) ?? []) out.add(norm(a));
  return [...out].filter((n) => n.length >= 3);
}

// ── Fonte de placar unificada (wc_matches ∪ fixtures) ────────
// O motor de veredito e as mensagens operam sobre esta forma, agnóstica à fonte.
// ft_*  = placar dos 90' (BASE de liquidação). score_* = final (inclui prorrog.),
// só pra exibição. Copa aparece nas DUAS fontes na janela de dual-run → 'wc'
// tem prioridade no dedup (fonte provada do Marco 0).
export interface FinishedMatch {
  source: "wc" | "fixtures";
  id: string; // rótulo de evidência ("wc_matches 123" / "fixtures 456")
  home_team: string;
  away_team: string;
  home_names: string[];
  away_names: string[];
  ft_home: number | null;
  ft_away: number | null;
  score_home: number | null;
  score_away: number | null;
  kickoff: number; // epoch ms
}

export interface Candidate {
  bet_id: string;
  user_id: string;
  chat_id: string;
  user_name: string | null;
  bet_type: string | null;
  sport: string | null;
  league: string | null;
  betting_market: string | null;
  match_description: string | null;
  bet_description: string | null;
  odds: number;
  stake_amount: number;
  potential_return: number;
  bet_date: string;
  match_date: string | null;
  reminder_count: number;
}

// ── Veredito pelo placar dos 90' ─────────────────────────────
// Só para mercados diretos; qualquer ambiguidade → null (pergunta sem afirmar).
// Handicap asiático (quick win do parecer do coletor) pode devolver void
// (push em linha inteira) e meio-resultados (linha quarter ±0.25/±0.75) —
// os status half_won/half_lost/void já existem no banco e no dashboard.
export type Verdict = "won" | "lost" | "void" | "half_won" | "half_lost" | null;

// meia-aposta do handicap: ajustado >0 ganha, <0 perde, =0 devolve (push)
function settleAhHalf(adjusted: number): "won" | "lost" | "void" {
  if (adjusted > 0.001) return "won";
  if (adjusted < -0.001) return "lost";
  return "void";
}

// Handicap asiático pelos 90': margin = gols do time apostado − adversário;
// line = handicap NA ÓTICA do time apostado (como escrito na aposta).
// Linha quarter (x.25/x.75) decompõe em duas metades — padrão do mercado.
export function settleAsianHandicap(margin: number, line: number): Verdict {
  const isQuarter = Math.abs((line * 4) % 2) === 1;
  if (!isQuarter) return settleAhHalf(margin + line);
  const a = settleAhHalf(margin + (line - 0.25));
  const b = settleAhHalf(margin + (line + 0.25));
  if (a === b) return a;                              // won+won / lost+lost
  if (a === "won" || b === "won") return "half_won";  // won + push
  return "half_lost";                                 // push + lost
}

export function computeVerdict(bet: Candidate, m: FinishedMatch): Verdict {
  // múltipla/sistema: pernas em jogos diversos, nunca decidível por 1 placar
  const type = norm(bet.bet_type);
  if (type === "multiple" || type === "system") return null;

  const ftH = m.ft_home;
  const ftA = m.ft_away;
  if (ftH == null || ftA == null) return null; // sem placar de 90' → sem veredito

  const desc = norm(bet.bet_description);
  const market = norm(bet.betting_market);

  // mercados fora do tempo normal / com regra própria → não arriscar
  if (
    /classific|avanc|qualif|prorrog|penalt|penalti|escanteio|cartao|cartoes|chute|finalizac|jogador|marca a qualquer|primeiro gol/.test(desc) ||
    /1[oº°]?\s*tempo|2[oº°]?\s*tempo|primeiro tempo|segundo tempo|intervalo|halftime|1st half|2nd half/.test(desc)
  ) {
    return null;
  }

  const total = ftH + ftA;

  // Over/Under de gols — "mais de 2,5", "over 2.5", "menos de 3"
  const over = desc.match(/(?:mais de|over|acima de)\s*(\d+(?:[.,]\d+)?)/);
  const under = desc.match(/(?:menos de|under|abaixo de)\s*(\d+(?:[.,]\d+)?)/);
  if (over || under) {
    // precisa ser de GOLS (explícito ou pelo mercado classificado)
    const isGoals = /gol/.test(desc) || market === "over/under";
    if (!isGoals) return null;
    const line = parseFloat((over ?? under)![1].replace(",", "."));
    if (Number.isNaN(line)) return null;
    if (total === line) return null; // linha exata = push/void → usuário decide
    if (over) return total > line ? "won" : "lost";
    return total < line ? "won" : "lost";
  }

  // Ambas marcam (BTTS) — "não" explícito vira aposta no NÃO; cuidado com o
  // "no" preposição do PT ("gols no jogo"): só conta como negativa em fim de
  // frase ou depois de dois-pontos ("Ambas marcam: No")
  if (market === "ambas marcam" || /ambas\s+(as\s+)?(equipes\s+)?marcam|btts|both teams to score/.test(desc)) {
    const both = ftH > 0 && ftA > 0;
    const betNo = /\bnao\b/.test(desc) || /:\s*no\b/.test(desc) || /\bno\s*$/.test(desc);
    return (betNo ? !both : both) ? "won" : "lost";
  }

  // linha com sinal ("−1,5", "-0.5", "+0,25") — presença dela indica handicap;
  // também desarma o ML (um "Vencedor: Belgium -1.5" não é money line puro)
  const lineMatch = desc.replace(/−/g, "-").match(/([+-])\s*(\d+(?:[.,]\d+)?)/);

  // Money Line / 1x2 — em qual time a aposta foi?
  if (!lineMatch && (market === "money line" || /\bml\b|money\s?line|vencedor|para vencer|vence\b|1x2/.test(desc))) {
    const homeNames = m.home_names;
    const awayNames = m.away_names;
    const isDraw = /empate/.test(desc);
    const pickedHome = hasTeam(desc, homeNames);
    const pickedAway = hasTeam(desc, awayNames);

    if (isDraw && !pickedHome && !pickedAway) return ftH === ftA ? "won" : "lost";
    if (pickedHome && !pickedAway) return ftH > ftA ? "won" : "lost";
    if (pickedAway && !pickedHome) return ftA > ftH ? "won" : "lost";
    return null; // ambíguo (dois times citados / nenhum) → não afirmar
  }

  // Handicap asiático — "Belgium −1,5", "Handicap -0.5 Atletico" (aritmética
  // dos 90' como os demais). Europeu ("empate (-1)") fica fora: regra diverge.
  if (lineMatch && !/empate/.test(desc)) {
    const raw = parseFloat(lineMatch[2].replace(",", "."));
    const line = (lineMatch[1] === "-" ? -1 : 1) * raw;
    // sanidade: linha múltipla de 0.25 e dentro do plausível
    if (!Number.isInteger(line * 4) || Math.abs(line) > 6) return null;

    const homeNames = m.home_names;
    const awayNames = m.away_names;
    const pickedHome = hasTeam(desc, homeNames);
    const pickedAway = hasTeam(desc, awayNames);
    if (pickedHome === pickedAway) return null; // nenhum ou os dois → ambíguo

    const margin = pickedHome ? ftH - ftA : ftA - ftH;
    return settleAsianHandicap(margin, line);
  }

  return null;
}
