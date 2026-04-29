/**
 * Quick Pick — preenche 100+ palpites em 1 clique baseado em 3 personas:
 *
 *  - Realista: favorito ganha, placar conservador. Empate só com ranks próximos.
 *  - Patriota: Brasil (ou seleção escolhida) avança longe; resto realista.
 *  - Zebreiro: 30% upsets calculados + placares improváveis.
 *
 * Mata-mata nunca tem empate (prorrogação fictícia +1 gol pro favorito).
 * TBD games são pulados (sem time definido ainda).
 */
import { getFifaRank, CLEAR_FAVORITE_RANK_DIFF } from '@/data/fifa-rankings';
import type { WcMatch } from '@/services/bolao.service';

export type QuickPickPersona = 'realist' | 'patriot' | 'zebra';

export interface QuickPickPrediction {
  match_id: number;
  predicted_home_score: number;
  predicted_away_score: number;
}

interface PickContext {
  /** Time do "patriota" — default 'BRA' */
  patriotCode?: string;
  /** Seed pseudoaleatório pra reprodutibilidade (ex: bolao_id hash) */
  seed?: number;
}

const KNOCKOUT_STAGES = new Set(['round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final']);

/**
 * Gera palpites pra todos os matches conforme persona.
 * Retorna array compatível com `upsertPredictionsBatch` do service.
 */
export function generateQuickPickPredictions(
  matches: WcMatch[],
  persona: QuickPickPersona,
  ctx: PickContext = {}
): QuickPickPrediction[] {
  const patriotCode = ctx.patriotCode ?? 'BRA';
  const rng = makeSeededRng(ctx.seed ?? 42);
  const predictions: QuickPickPrediction[] = [];

  for (const match of matches) {
    // Skip jogos finalizados (já têm resultado real)
    if (match.is_finished) continue;
    // Skip TBD (mata-mata sem times definidos)
    if (match.home_team_code === 'TBD' || match.away_team_code === 'TBD') continue;
    if (!match.home_team_code || !match.away_team_code) continue;

    const isKnockout = KNOCKOUT_STAGES.has(match.stage);

    let { home, away } = pickScore(match, persona, isKnockout, patriotCode, rng);

    // Mata-mata: nunca empata
    if (isKnockout && home === away) {
      const homeRank = getFifaRank(match.home_team_code);
      const awayRank = getFifaRank(match.away_team_code);
      // Favorito (rank menor) ganha por +1 gol
      if (homeRank <= awayRank) home += 1;
      else away += 1;
    }

    predictions.push({
      match_id: match.id,
      predicted_home_score: home,
      predicted_away_score: away,
    });
  }

  return predictions;
}

/**
 * Decide placar de um jogo isolado conforme persona.
 * Lógica intencionalmente simples — 80% acerta a vibe, user edita o resto.
 */
function pickScore(
  match: WcMatch,
  persona: QuickPickPersona,
  isKnockout: boolean,
  patriotCode: string,
  rng: () => number
): { home: number; away: number } {
  const homeCode = match.home_team_code!.toUpperCase();
  const awayCode = match.away_team_code!.toUpperCase();
  const homeRank = getFifaRank(homeCode);
  const awayRank = getFifaRank(awayCode);
  const rankDiff = Math.abs(homeRank - awayRank);
  const homeIsFavorite = homeRank < awayRank;

  // Patriota: time escolhido (Brasil default) sempre vai bem
  if (persona === 'patriot') {
    if (homeCode === patriotCode) {
      return goleadaOrTight(rng, true, isKnockout);
    }
    if (awayCode === patriotCode) {
      const r = goleadaOrTight(rng, true, isKnockout);
      return { home: r.away, away: r.home };
    }
    // Outros jogos: vira realista
  }

  // Zebreiro: 30% chance de upset + placares improváveis
  if (persona === 'zebra' && rng() < 0.3) {
    // Upset: o "underdog" (rank pior) ganha de +1
    const underdog = homeIsFavorite ? 'away' : 'home';
    const score = randomScoreWeird(rng, isKnockout);
    if (underdog === 'home') return { home: score.winner, away: score.loser };
    return { home: score.loser, away: score.winner };
  }

  // Default — Realista (e fallback do Patriota/Zebreiro)
  // Empate quando ranks muito próximos (não em mata-mata)
  if (!isKnockout && rankDiff <= 4) {
    return { home: 1, away: 1 };
  }

  // Favorito ganha placar conservador
  const winnerScore = pickConservativeWinScore(rankDiff, rng);
  const loserScore = rankDiff > CLEAR_FAVORITE_RANK_DIFF ? 0 : (rng() < 0.4 ? 1 : 0);

  if (homeIsFavorite) return { home: winnerScore, away: loserScore };
  return { home: loserScore, away: winnerScore };
}

function pickConservativeWinScore(rankDiff: number, rng: () => number): number {
  // Diff grande = goleada possível (2-3). Diff pequeno = 1-2.
  if (rankDiff > 20) return rng() < 0.5 ? 3 : 2;
  if (rankDiff > 10) return rng() < 0.6 ? 2 : 1;
  return rng() < 0.4 ? 2 : 1;
}

/**
 * Patriota: time escolhido vence "bonito" — placares com 2-3 gols.
 */
function goleadaOrTight(rng: () => number, big: boolean, isKnockout: boolean): { home: number; away: number } {
  if (big) {
    const home = isKnockout ? (rng() < 0.5 ? 2 : 3) : (rng() < 0.4 ? 3 : 2);
    const away = rng() < 0.7 ? 0 : 1;
    return { home, away };
  }
  return { home: 1, away: 0 };
}

/**
 * Zebreiro: placares improváveis (3×2, 4×3, 2×1 com underdog).
 */
function randomScoreWeird(rng: () => number, isKnockout: boolean): { winner: number; loser: number } {
  const r = rng();
  if (r < 0.3) return { winner: 1, loser: 0 };
  if (r < 0.55) return { winner: 2, loser: 1 };
  if (r < 0.75) return { winner: 3, loser: 2 };
  if (r < 0.9) return { winner: 2, loser: 0 };
  return { winner: isKnockout ? 4 : 3, loser: isKnockout ? 3 : 2 };
}

/**
 * RNG determinístico (mulberry32) — mesmo seed gera mesma sequência.
 * Permite reprodutibilidade pra debugging e evita "shuffle" diferente
 * a cada render.
 */
function makeSeededRng(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
