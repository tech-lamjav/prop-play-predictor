import { describe, expect, it } from 'vitest';
import {
  celulaDe,
  liquidarTudo,
  lucroDaAposta as nossoLucro,
  type LinhaPublicada,
} from './placar-agregacao';
/**
 * O script de operação, em .mjs.
 *
 * ⚠️ O import chega SEM TIPO, pela mesma razão explicada em
 * `src/utils/futebol-roi-script.test.ts`: o tsconfig que compila não tem
 * `allowJs`, e o compilador não confere nada aqui. É por isso que a paridade
 * tem de ser verificada em EXECUÇÃO, célula por célula, como está abaixo.
 */
import { estatistica, liquidar, lucroDaAposta } from '../../../scripts/futebol-roi.mjs';

// ============================================================================
// A tela e o terminal dão o mesmo número
// ============================================================================
// `scripts/futebol-roi.mjs` é a referência de terminal do ROI das oportunidades,
// e o placar é a mesma conta numa tela. Duas implementações da mesma aritmética
// divergem sozinhas, e a divergência aqui é do pior tipo: silenciosa. Nenhum dos
// dois quebra — eles passam a responder taxas diferentes para a mesma semana, e
// a decisão de peso de premissa é tomada em cima de um dos dois.
//
// Este teste roda a MESMA amostra pelos dois caminhos e exige acordo em cada
// número da célula: n, acertos, anuladas, taxa, ROI e erro-padrão.
//
// Ele não confere as faixas nem as quebras: cada uma tem teste de fronteira no
// arquivo da agregação. O que ele confere é a conta, que é o que os dois lados
// implementam em duplicidade.
// ============================================================================

const base: LinhaPublicada = {
  opportunity_key: 'k',
  fixture_id: 1,
  competition: 'Brasileirão',
  home_team_name: 'Casa',
  away_team_name: 'Fora',
  kickoff_utc: '2026-09-10T23:00:00',
  status_short: 'FT',
  goals_home: 0,
  goals_away: 0,
  detectada_em: '2026-09-10T03:00:00',
  market: 'match_winner',
  outcome: 'Home',
  line_value: null,
  best_odd: 2,
  edge: 1,
  score: 60,
  faixa: 'Alta',
  score_versao: 'contexto_v1',
  pts_premissas: 20,
  penalidades: 0,
  premissas_sem_dado: 0,
  modelo_api_concorda: true,
  linha_sharp_confirma: false,
  pen_odd_outlier: false,
  pen_poucas_casas: false,
  pen_odd_longshot: false,
  pen_odd_juice: false,
};

const PLACARES: [number, number][] = [
  [0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [0, 2], [2, 1], [1, 2], [3, 3], [4, 0],
];

const SAIDAS: { market: string; outcome: string; linhas: (number | null)[] }[] = [
  { market: 'match_winner', outcome: 'Home', linhas: [null] },
  { market: 'match_winner', outcome: 'Draw', linhas: [null] },
  { market: 'match_winner', outcome: 'Away', linhas: [null] },
  { market: 'btts', outcome: 'Yes', linhas: [null] },
  { market: 'btts', outcome: 'No', linhas: [null] },
  { market: 'double_chance', outcome: '1X', linhas: [null] },
  { market: 'double_chance', outcome: 'X2', linhas: [null] },
  { market: 'goals_over_under', outcome: 'Over', linhas: [1.5, 2.25, 2.5, 3.75] },
  { market: 'goals_over_under', outcome: 'Under', linhas: [1.5, 2.25, 2.5, 3.75] },
  { market: 'asian_handicap', outcome: 'Home', linhas: [-2.25, -1.75, -1, 0, 0.25] },
  { market: 'asian_handicap', outcome: 'Away', linhas: [-1.75, -0.5, 0, 1.25] },
];

const ODDS = [1.3, 1.85, 2.4, 3.6];

/** A amostra inteira: toda saída, com toda linha, contra todo placar. */
const amostra: LinhaPublicada[] = [];
let i = 0;
for (const { market, outcome, linhas } of SAIDAS) {
  for (const line_value of linhas) {
    for (const [goals_home, goals_away] of PLACARES) {
      amostra.push({
        ...base,
        opportunity_key: `k${i}`,
        market,
        outcome,
        line_value,
        goals_home,
        goals_away,
        best_odd: ODDS[i % ODDS.length],
      });
      i++;
    }
  }
}

/** A mesma conta, pelo caminho do script. */
function pelaMaoDoScript(linhas: LinhaPublicada[]) {
  const medidas = linhas
    .map((l) => {
      const resultado = liquidar(l.market, l.outcome, l.line_value, l.goals_home, l.goals_away);
      return resultado ? { resultado, lucro: lucroDaAposta(resultado, l.best_odd) } : null;
    })
    .filter((x): x is { resultado: string; lucro: number } => x !== null);
  return estatistica(medidas);
}

describe('o placar e o script medem igual', () => {
  it('a amostra é grande e cobre os cinco mercados', () => {
    expect(amostra.length).toBeGreaterThan(200);
    expect(new Set(amostra.map((l) => l.market)).size).toBe(5);
  });

  it('na amostra inteira', () => {
    const { liquidadas } = liquidarTudo(amostra);
    const nossa = celulaDe('tudo', liquidadas);
    const dele = pelaMaoDoScript(amostra);

    expect(nossa.n).toBe(dele.n);
    expect(nossa.roi).toBeCloseTo(dele.roi, 12);
    expect(nossa.ep).toBeCloseTo(dele.ep, 12);
    expect(nossa.taxa).toBeCloseTo(dele.taxa, 12);
  });

  for (const { market } of SAIDAS.filter(
    (s, idx, todos) => todos.findIndex((o) => o.market === s.market) === idx,
  )) {
    it(`no mercado ${market}`, () => {
      const doMercado = amostra.filter((l) => l.market === market);
      const { liquidadas } = liquidarTudo(doMercado);
      const nossa = celulaDe(market, liquidadas);
      const dele = pelaMaoDoScript(doMercado);

      expect(nossa.n).toBe(dele.n);
      expect(nossa.roi).toBeCloseTo(dele.roi, 12);
      expect(nossa.ep).toBeCloseTo(dele.ep, 12);
      expect(nossa.taxa).toBeCloseTo(dele.taxa, 12);
    });
  }

  it('e concorda no lucro de cada veredito, unidade por unidade', () => {
    // A conta do lucro é curta e está escrita nos dois lados. Meio green e meio
    // red são os dois que ninguém confere de cabeça.
    for (const odd of [1.01, 1.3, 1.85, 2.4, 3.6, 12]) {
      for (const veredito of ['won', 'half_won', 'push', 'half_lost', 'lost'] as const) {
        expect(nossoLucro(veredito, odd)).toBeCloseTo(lucroDaAposta(veredito, odd), 12);
      }
    }
  });
});
