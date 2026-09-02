// ============================================================
// futebol-settlement.ts — liquida uma oportunidade pelo placar final
// ============================================================
import type { Saida } from '@/utils/futebol-saida';
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
  s: Saida,
  goalsHome: number | null | undefined,
  goalsAway: number | null | undefined,
): BetResult | null {
  const { market, outcome, line_value: line } = s;
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
    case 'won': return { label: 'Green', tone: 'won' };
    case 'half_won': return { label: 'Meio green', tone: 'won' };
    case 'push': return { label: 'Anulada', tone: 'push' };
    case 'half_lost': return { label: 'Meio red', tone: 'lost' };
    case 'lost': return { label: 'Red', tone: 'lost' };
  }
}

/** Conta positiva pro resumo do dia (meio-ganho conta como acerto). */
export function isHit(r: BetResult): boolean {
  return r === 'won' || r === 'half_won';
}

/**
 * Uma linha do dia, do ponto de vista da liquidação.
 *
 * `temFixture` é dito pelo chamador, que tem o mapa de fixtures — e não
 * inferido de `kickoff_utc` nulo. A inferência parecia equivalente e não é:
 * linha vinda do board sempre traz `kickoff_utc`, mesmo quando o calendário não
 * trouxe aquele jogo, então ela cairia em "aguardando" e a anomalia nunca
 * acenderia. Só a registrada nasce com o campo nulo.
 */
export type LinhaLiquidavel = {
  temFixture: boolean;
  resultado: BetResult | null;
};

export type ResumoDoDia = {
  hit: number;
  miss: number;
  push: number;
  /** Linhas com resultado. `hit + miss + push`. */
  settled: number;
  /** Tem fixture, ainda sem resultado: jogo por acabar, adiado ou sem placar. */
  aguardando: number;
  /** Não tem fixture. Pick publicado num jogo que o calendário não trouxe. */
  semFixture: number;
  /** Tudo que não liquidou. É o que a tela precisa dizer em vez de omitir. */
  pendentes: number;
  /** O que foi PUBLICADO no dia. É o denominador honesto. */
  total: number;
};

/**
 * O resumo do dia, contando também o que não liquidou.
 *
 * A manchete dizia "2 de 3 deram green" num dia de seis oportunidades: o resumo
 * só somava linha com resultado, então quem não tinha fixture saía da conta sem
 * deixar rastro — e a taxa de acerto ficava sobre um denominador que encolheu
 * sozinho. Ver #323.
 *
 * `aguardando` e `semFixture` são separados por CAUSA, não por visibilidade:
 * o primeiro é jogo adiado ou sem placar, o segundo é anomalia de catálogo. Os
 * dois contam em `pendentes`, e é `pendentes` que a tela mostra — num dia
 * passado, jogo que não liquidou some do resultado do mesmo jeito, e mostrar só
 * um dos dois recria o defeito com outra causa.
 */
export function resumoDoDia(linhas: readonly LinhaLiquidavel[]): ResumoDoDia {
  let hit = 0, miss = 0, push = 0, aguardando = 0, semFixture = 0;
  for (const l of linhas) {
    if (l.resultado == null) {
      if (l.temFixture) aguardando++;
      else semFixture++;
      continue;
    }
    if (l.resultado === 'push') push++;
    else if (isHit(l.resultado)) hit++;
    else miss++;
  }
  return {
    hit, miss, push,
    settled: hit + miss + push,
    aguardando, semFixture,
    pendentes: aguardando + semFixture,
    total: linhas.length,
  };
}
