// ============================================================
// futebol-settlement.ts — liquida uma oportunidade pelo placar final
// ============================================================
// Usado no histórico da tela de Oportunidades ("bateu / não bateu"). O placar
// vem de fact_fixtures (goals_home/goals_away). Convenções (espelham pickLabel):
//  - asian_handicap / goals_over_under: line_value na ótica do MANDANTE.
//  - Linhas asiáticas (quarto de gol) → meio-ganho/meio-perda pela regra do "d".
// ============================================================

export type BetResult = 'won' | 'half_won' | 'push' | 'half_lost' | 'lost';

// Regra genérica de liquidação asiática pelo saldo `d` (o quanto a aposta está
// à frente da linha). Passos de 0,25 cobrem linha cheia, .5, .25 e .75.
function mapAsian(dRaw: number): BetResult {
  const d = Math.round(dRaw * 4) / 4; // evita ruído de ponto flutuante
  if (d >= 0.5) return 'won';
  if (d === 0.25) return 'half_won';
  if (d === 0) return 'push';
  if (d === -0.25) return 'half_lost';
  return 'lost';
}

/**
 * Liquida a oportunidade. Retorna null se o jogo não tem placar (ainda) ou o
 * mercado é desconhecido.
 */
export function settleFutebol(
  market: string,
  outcome: string,
  line: number | null,
  goalsHome: number | null | undefined,
  goalsAway: number | null | undefined,
): BetResult | null {
  if (goalsHome == null || goalsAway == null) return null;
  const diff = goalsHome - goalsAway; // ótica do mandante
  const total = goalsHome + goalsAway;
  const res = diff > 0 ? 'Home' : diff < 0 ? 'Away' : 'Draw';

  switch (market) {
    case 'match_winner':
      return outcome === res ? 'won' : 'lost';

    case 'btts': {
      const both = goalsHome > 0 && goalsAway > 0;
      const yes = outcome === 'Yes';
      return yes === both ? 'won' : 'lost';
    }

    case 'double_chance': {
      const ok =
        outcome === '1X' ? res === 'Home' || res === 'Draw'
        : outcome === 'X2' ? res === 'Draw' || res === 'Away'
        : res === 'Home' || res === 'Away'; // '12'
      return ok ? 'won' : 'lost';
    }

    case 'goals_over_under': {
      if (line == null) return null;
      const d = outcome === 'Over' ? total - line : line - total;
      return mapAsian(d);
    }

    case 'asian_handicap': {
      if (line == null) return null;
      // line na ótica do mandante; visitante = oposto (mesma lógica do pickLabel)
      const d = outcome === 'Home' ? diff + line : -diff - line;
      return mapAsian(d);
    }

    default:
      return null;
  }
}

/** Rótulo + tom pro selo de resultado. */
export function resultBadge(r: BetResult): { label: string; tone: 'won' | 'lost' | 'push' } {
  switch (r) {
    case 'won': return { label: 'Bateu', tone: 'won' };
    case 'half_won': return { label: '½ Bateu', tone: 'won' };
    case 'push': return { label: 'Anulada', tone: 'push' };
    case 'half_lost': return { label: '½ Não', tone: 'lost' };
    case 'lost': return { label: 'Não bateu', tone: 'lost' };
  }
}

/** Conta positiva pro resumo do dia (meio-ganho conta como acerto). */
export function isHit(r: BetResult): boolean {
  return r === 'won' || r === 'half_won';
}
