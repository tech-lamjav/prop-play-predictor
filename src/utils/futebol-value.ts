// ============================================================
// ⚠️ DEPRECATED (2026-06) — motor client-side APOSENTADO.
// O Score agora é calculado no BACKEND (pipeline dbt → fact_value_opportunities)
// e lido via get_futebol_value_board / get_futebol_fixture_value. A apresentação
// fica em src/utils/futebol-score.ts. Este arquivo não é mais importado por
// nenhuma tela — mantido só como referência da lógica original (devig/Poisson/Kelly).
// ============================================================
// futebol-value.ts — valor (edge), Score de Confiabilidade e Kelly
// ============================================================
// O coração do value bet. Para cada mercado de partição limpa (Resultado,
// Over/Under 2,5, Ambos marcam), estima a PROBABILIDADE JUSTA removendo a margem
// (devig) da linha sharp da Pinnacle — ou, quando a Pinnacle não cobre, do
// consenso. Compara a MELHOR odd disponível com essa prob. justa → edge.
//
// IMPORTANTE (metodologia v2): ranquear por EDGE CRU engana — em odds altas o
// edge explode com ruído (1 casa fora da curva vira "+6%") e ignora risco. Por
// isso usamos um SCORE DE CONFIABILIDADE (0–100) que combina:
//   1. Kelly (quanto a aposta vale de fato — pune longshot sozinho)
//   2. Banda de odds sã (~1.4–4.0; zebra e juice perdem peso)
//   3. Corroboração (melhor odd não pode ser outlier solitário vs a média)
//   4. Âncora sharp (valor confirmado contra a Pinnacle, não só consenso)
//   5. Movimento de linha (t24h→t1h)
// Stake sugerido = ½ Kelly (gestão de banca conservadora). Mercados sem odds
// (escanteios/cartões) NÃO entram aqui — só tendência descritiva.
// ============================================================

export interface FutebolOddsRow {
  market_key: 'match_winner' | 'over_under' | 'btts' | 'double_chance' | 'asian_handicap';
  market_label: string;
  outcome_label: string;
  outcome_order: number;
  line: number | null;   // Over/Under (ex.: 2.5) ou handicap asiático (perspectiva do mandante); null nos demais
  pinnacle_odd: number | null;
  avg_odd: number | null;
  best_odd: number;
  best_book: string;
  n_books: number;
  pin_open: number | null;
  pin_close: number | null;
}

export type ValueTier = 'value' | 'slight' | 'fair' | 'low';

export interface ValueOutcome {
  marketKey: string;
  marketLabel: string;   // PT, ex.: "Vencedor (1X2)"
  outcomeKey: string;
  outcomeLabel: string;
  fairProb: number;      // 0..1
  bestOdd: number;
  avgOdd: number;
  bestBook: string;
  nBooks: number;
  edge: number;          // bestOdd × fairProb − 1
  kelly: number;         // edge / (bestOdd − 1), full Kelly (fração da banca)
  stake: number;         // ½ Kelly (stake sugerido)
  score: number;         // 0..100 — Score de Confiabilidade
  tier: ValueTier;
  suspect: boolean;      // melhor odd é outlier / poucas casas → linha suspeita
  anchor: 'pinnacle' | 'consensus';
  moveDir: 'up' | 'down' | null;
  // Corroboração (preenchido só quando há nosso modelo): nossa leitura concorda
  // com o valor que o mercado mostra? Divergência sem respaldo derruba o Score.
  modelProb: number | null;     // prob. do nosso Poisson p/ ESTE outcome
  modelEdge: number | null;     // bestOdd × modelProb − 1 (nosso modelo vê valor?)
  apiAgree: boolean | null;     // modelo da API concorda na direção (só 1X2)
  convergence: 'alta' | 'media' | 'baixa' | null;
}

export interface ValueMarket {
  key: string;
  label: string;
  anchor: 'pinnacle' | 'consensus';
  margin: number;
  outcomes: ValueOutcome[];
}

export interface FixtureValue {
  markets: ValueMarket[];
  best: ValueOutcome | null; // maior SCORE do jogo (não maior edge)
}

// Linhas de Over/Under expostas (as acionáveis; 0,5 e 4,5 quase nunca dão valor)
const OU_LINES = [1.5, 2.5, 3.5];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function outcomePt(key: string, homeName: string, awayName: string): string {
  switch (key) {
    case 'Home': return homeName;
    case 'Away': return awayName;
    case 'Draw': return 'Empate';
    case 'Yes': return 'Sim';
    case 'No': return 'Não';
    case 'Home/Draw': return `${homeName} ou empate`;
    case 'Home/Away': return `${homeName} ou ${awayName}`;
    case 'Draw/Away': return `empate ou ${awayName}`;
  }
  const m = key.match(/^(Over|Under)\s+([\d.]+)$/);
  if (m) {
    const n = m[2].replace('.', ',');
    return m[1] === 'Over' ? `Mais de ${n}` : `Menos de ${n}`;
  }
  // Handicap asiático: a API guarda a linha na perspectiva do mandante.
  // "Home -1.5" = mandante -1,5; "Away -1.5" = visitante com handicap OPOSTO (+1,5).
  const ah = key.match(/^(Home|Away)\s+([+-]?[\d.]+)$/);
  if (ah) {
    const raw = parseFloat(ah[2]);
    const isHome = ah[1] === 'Home';
    const hcp = isHome ? raw : -raw;
    return `${isHome ? homeName : awayName} ${fmtHcp(hcp)}`;
  }
  return key;
}

// Handicap com sinal explícito e vírgula decimal (ex.: +1,5 / -0,5)
function fmtHcp(n: number): string {
  const s = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${s}${Math.abs(n).toFixed(1).replace('.', ',')}`;
}

// Crédito cheio em odds "sãs"; decai em zebra (>4) e em juice (<1.4)
function oddsBandFactor(odd: number): number {
  if (odd >= 1.4 && odd <= 4.0) return 1;
  if (odd < 1.4) return clamp((odd - 1.15) / (1.4 - 1.15), 0, 1);
  return clamp((6.5 - odd) / (6.5 - 4.0), 0, 1); // zera em odd ≥ 6.5
}

// Melhor odd muito acima da média das casas = provável linha desatualizada/limite
function corroboration(best: number, avg: number, nBooks: number): { factor: number; suspect: boolean } {
  let factor = 1;
  let suspect = false;
  if (avg && avg > 1) {
    const ratio = best / avg;
    if (ratio >= 1.12) { factor = 0.35; suspect = true; }
    else if (ratio > 1.05) factor = 1 - ((ratio - 1.05) / (1.12 - 1.05)) * 0.65;
  }
  if (nBooks < 4) { factor *= 0.55; suspect = true; }
  else if (nBooks < 8) factor *= 0.85;
  return { factor: clamp(factor, 0, 1), suspect };
}

// ---------- Nosso modelo (Poisson sobre λ) → prob. por outcome ----------
// Matriz de placar P[i][j] = Poisson(i;λcasa)·Poisson(j;λvis). Dela sai a prob.
// do MESMO outcome que o mercado oferece, pra checar se nossa leitura corrobora.
type ScoreMatrix = number[][];

function poissonMatrix(lh: number, la: number, n = 10): ScoreMatrix {
  const fact = (k: number) => { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; };
  const pmf = (k: number, l: number) => (Math.exp(-l) * Math.pow(l, k)) / fact(k);
  const ph = Array.from({ length: n + 1 }, (_, i) => pmf(i, lh));
  const pa = Array.from({ length: n + 1 }, (_, j) => pmf(j, la));
  return ph.map((p) => pa.map((q) => p * q));
}

// soma das células onde pred(i,j) é verdadeiro
function matSum(M: ScoreMatrix, pred: (i: number, j: number) => boolean): number {
  let s = 0;
  for (let i = 0; i < M.length; i++) for (let j = 0; j < M[i].length; j++) if (pred(i, j)) s += M[i][j];
  return s;
}

// Prob. do nosso modelo p/ um outcome. `family` = mercado base; `line` = O/U ou
// handicap (ótica do mandante); `order` 1=casa/over/sim, 2=visitante/under/não.
function modelProbForOutcome(
  M: ScoreMatrix, family: string, outcomeKey: string, order: number, line: number | null
): number | null {
  switch (family) {
    case 'match_winner':
      if (outcomeKey === 'Home') return matSum(M, (i, j) => i > j);
      if (outcomeKey === 'Draw') return matSum(M, (i, j) => i === j);
      if (outcomeKey === 'Away') return matSum(M, (i, j) => i < j);
      return null;
    case 'over_under': {
      if (line == null) return null;
      const over = matSum(M, (i, j) => i + j > line);
      return order === 1 ? over : 1 - over;
    }
    case 'btts': {
      const yes = matSum(M, (i, j) => i >= 1 && j >= 1);
      return order === 1 ? yes : 1 - yes;
    }
    case 'double_chance':
      if (outcomeKey === 'Home/Draw') return matSum(M, (i, j) => i >= j);
      if (outcomeKey === 'Home/Away') return matSum(M, (i, j) => i !== j);
      if (outcomeKey === 'Draw/Away') return matSum(M, (i, j) => i <= j);
      return null;
    case 'asian_handicap': {
      if (line == null) return null;
      // mandante cobre se (i−j) + line > 0 ; visitante = complemento (meia-linha, sem push)
      const homeCovers = matSum(M, (i, j) => (i - j) + line > 0);
      return order === 1 ? homeCovers : 1 - homeCovers;
    }
    default:
      return null;
  }
}

const KELLY_FULL_CAP = 0.06; // 6% full-Kelly = score 100 nesse eixo

function tierFromScore(score: number, suspect: boolean): ValueTier {
  if (suspect) return 'low';
  if (score >= 55) return 'value';
  if (score >= 30) return 'slight';
  if (score > 0) return 'fair';
  return 'low';
}

export interface ModelInputs {
  model?: { lh: number; la: number } | null;        // nosso Poisson (λ casa/vis)
  api?: { home: number; draw: number; away: number } | null; // probs 1X2 da API (0..1)
}

export function computeFixtureValue(
  rows: FutebolOddsRow[],
  homeName: string,
  awayName: string,
  inputs: ModelInputs = {}
): FixtureValue {
  const markets: ValueMarket[] = [];
  const M = inputs.model ? poissonMatrix(inputs.model.lh, inputs.model.la) : null;
  const api = inputs.api ?? null;

  // Constrói um mercado (devig por normalização). normTarget=1 p/ partição limpa
  // (1X2, O/U, BTTS); normTarget=2 p/ Dupla Chance (cada outcome cobre 2 dos 3 resultados).
  const build = (key: string, label: string, group: FutebolOddsRow[], normTarget: number) => {
    if (group.length < 2) return;
    const sorted = [...group].sort((a, b) => a.outcome_order - b.outcome_order);
    const hasPinAll = sorted.every((r) => r.pinnacle_odd != null && r.pinnacle_odd > 1);
    const anchor: 'pinnacle' | 'consensus' = hasPinAll ? 'pinnacle' : 'consensus';
    const anchorOdd = (r: FutebolOddsRow) => (anchor === 'pinnacle' ? r.pinnacle_odd : r.avg_odd) ?? null;

    const implied = sorted.map((r) => {
      const o = anchorOdd(r);
      return o && o > 1 ? 1 / o : null;
    });
    if (implied.some((p) => p == null)) return;
    const sum = implied.reduce((s, p) => s + (p as number), 0);
    if (sum <= 0) return;

    const outcomes: ValueOutcome[] = sorted.map((r, i) => {
      const fairProb = ((implied[i] as number) / sum) * normTarget;
      const edge = r.best_odd * fairProb - 1;
      const kelly = r.best_odd > 1 ? Math.max(0, edge / (r.best_odd - 1)) : 0;
      const avgOdd = r.avg_odd ?? r.best_odd;
      const { factor: corrobFactor, suspect } = corroboration(r.best_odd, avgOdd, r.n_books);

      let moveDir: 'up' | 'down' | null = null;
      if (r.pin_open != null && r.pin_close != null && r.pin_open !== r.pin_close) {
        moveDir = r.pin_close > r.pin_open ? 'up' : 'down';
      }
      const moveFactor = moveDir === 'up' ? 1.06 : moveDir === 'down' ? 0.92 : 1;

      // Corroboração: nossa leitura (Poisson) e a API concordam com o valor?
      const family = key.startsWith('ou_') ? 'over_under' : key.startsWith('ah_') ? 'asian_handicap' : key;
      const modelProb = M ? modelProbForOutcome(M, family, r.outcome_label, r.outcome_order, r.line) : null;
      const modelEdge = modelProb != null ? r.best_odd * modelProb - 1 : null;
      // API só fala de 1X2
      let apiAgree: boolean | null = null;
      if (api && family === 'match_winner') {
        const ap = r.outcome_label === 'Home' ? api.home : r.outcome_label === 'Draw' ? api.draw : r.outcome_label === 'Away' ? api.away : null;
        if (ap != null) apiAgree = ap >= fairProb * 0.97;
      }

      // fator de convergência aplicado ao Score (divergência sem respaldo derruba)
      let convergence: 'alta' | 'media' | 'baixa' | null = null;
      let convFactor = 1;
      if (modelProb != null) {
        if ((modelEdge as number) > 0.005) { convergence = 'alta'; convFactor = 1.15; }
        else if (modelProb >= fairProb * 0.97) { convergence = 'media'; convFactor = 1; }
        else { convergence = 'baixa'; convFactor = 0.6; }
      }
      const apiFactor = apiAgree == null ? 1 : apiAgree ? 1.05 : 0.85;

      let score = 0;
      if (edge > 0) {
        const kellyNorm = clamp(kelly / KELLY_FULL_CAP, 0, 1);
        const band = oddsBandFactor(r.best_odd);
        const sharp = anchor === 'pinnacle' ? 1 : 0.72;
        score = Math.round(clamp(100 * kellyNorm * band * corrobFactor * sharp * moveFactor * convFactor * apiFactor, 0, 100));
      }

      return {
        marketKey: key,
        marketLabel: label,
        outcomeKey: r.outcome_label,
        outcomeLabel: outcomePt(r.outcome_label, homeName, awayName),
        fairProb,
        bestOdd: r.best_odd,
        avgOdd,
        bestBook: r.best_book,
        nBooks: r.n_books,
        edge,
        kelly,
        stake: kelly / 2,
        score,
        tier: tierFromScore(score, suspect),
        suspect,
        anchor,
        moveDir,
        modelProb,
        modelEdge,
        apiAgree,
        convergence,
      };
    });

    markets.push({ key, label, anchor, margin: sum / normTarget - 1, outcomes });
  };

  build('match_winner', 'Vencedor (1X2)', rows.filter((r) => r.market_key === 'match_winner'), 1);

  const ouRows = rows.filter((r) => r.market_key === 'over_under');
  for (const L of OU_LINES) {
    const lineRows = ouRows.filter((r) => r.line === L);
    if (lineRows.length >= 2) build(`ou_${L}`, `Mais/Menos ${String(L).replace('.', ',')} gols`, lineRows, 1);
  }

  build('btts', 'Ambos marcam', rows.filter((r) => r.market_key === 'btts'), 1);
  build('double_chance', 'Dupla chance', rows.filter((r) => r.market_key === 'double_chance'), 2);

  // Handicap asiático: cada linha (meia-linha, sem empate técnico) é uma partição
  // limpa de 2 saídas → devig normTarget=1, igual ao Over/Under.
  const ahRows = rows.filter((r) => r.market_key === 'asian_handicap');
  const ahLines = [...new Set(ahRows.map((r) => r.line))]
    .filter((l): l is number => l != null)
    .sort((a, b) => a - b);
  for (const L of ahLines) {
    const lineRows = ahRows.filter((r) => r.line === L);
    if (lineRows.length >= 2) build(`ah_${L}`, `Handicap ${fmtHcp(L)}`, lineRows, 1);
  }

  // hero = maior SCORE do jogo (não maior edge)
  const best = markets
    .flatMap((m) => m.outcomes)
    .reduce<ValueOutcome | null>((b, o) => (b == null || o.score > b.score ? o : b), null);

  return { markets, best };
}

export const fmtPct = (p: number) => `${(p * 100).toFixed(0)}%`;
export const fmtEdge = (e: number) => `${e >= 0 ? '+' : ''}${(e * 100).toFixed(1)}%`;
export const fmtStake = (s: number) => `${(s * 100).toFixed(1)}%`;

/** Limiar pra um valor virar destaque/hero (abaixo disso: "sem valor claro"). */
export const HERO_MIN_SCORE = 35;
/** Limiar pra entrar na lista de oportunidades. */
export const OPP_MIN_SCORE = 12;

// ---------- Board de oportunidades (todos os jogos com odds) ----------

export interface BoardRow extends FutebolOddsRow {
  fixture_id: number;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  away_team_name: string;
  competition: string;
  kickoff_utc: string | null;
  status_short: string | null;
}

export interface Opportunity extends ValueOutcome {
  fixtureId: number;
  homeId: number;
  awayId: number;
  homeName: string;
  awayName: string;
  competition: string;
  kickoffUtc: string | null;
}

export interface MonitoredFixture {
  fixtureId: number;
  homeId: number;
  awayId: number;
  homeName: string;
  awayName: string;
  competition: string;
  kickoffUtc: string | null;
  best: ValueOutcome | null;
}

export interface BoardResult {
  fixtures: number;
  opportunities: Opportunity[]; // score >= OPP_MIN_SCORE, ordenadas por score desc
  monitored: MonitoredFixture[]; // todos os jogos com odds, ordenados por melhor score
}

export function computeBoardOpportunities(rows: BoardRow[]): BoardResult {
  const byFixture = new Map<number, BoardRow[]>();
  for (const r of rows) {
    const arr = byFixture.get(r.fixture_id);
    if (arr) arr.push(r);
    else byFixture.set(r.fixture_id, [r]);
  }

  const opportunities: Opportunity[] = [];
  const monitored: MonitoredFixture[] = [];

  for (const [fid, frows] of byFixture) {
    const meta = frows[0];
    const fv = computeFixtureValue(frows, meta.home_team_name, meta.away_team_name);
    monitored.push({
      fixtureId: fid, homeId: meta.home_team_id, awayId: meta.away_team_id,
      homeName: meta.home_team_name, awayName: meta.away_team_name,
      competition: meta.competition, kickoffUtc: meta.kickoff_utc,
      best: fv.best,
    });
    for (const o of fv.markets.flatMap((m) => m.outcomes)) {
      if (o.score >= OPP_MIN_SCORE) {
        opportunities.push({
          ...o, fixtureId: fid, homeId: meta.home_team_id, awayId: meta.away_team_id,
          homeName: meta.home_team_name, awayName: meta.away_team_name,
          competition: meta.competition, kickoffUtc: meta.kickoff_utc,
        });
      }
    }
  }

  opportunities.sort((a, b) => b.score - a.score);
  monitored.sort((a, b) => (b.best?.score ?? 0) - (a.best?.score ?? 0));
  return { fixtures: byFixture.size, opportunities, monitored };
}
