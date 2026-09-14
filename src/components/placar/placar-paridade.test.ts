import { describe, expect, it } from 'vitest';
import {
  celulaDe,
  liquidarTudo,
  type Celula,
  faixaDeOdd as nossaFaixaDeOdd,
  faixaDoScore as nossaFaixaDoScore,
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
import {
  ehAcerto,
  estatistica,
  faixaDeOdd,
  faixaDoScore,
  liquidar,
  lucroDaAposta,
} from '../../../scripts/futebol-roi.mjs';

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
    premissas_acesas: [],
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

/**
 * A mesma conta, pelo caminho do script.
 *
 * O `estatistica` do script devolve n, ROI, erro-padrão e taxa. Acertos e
 * anuladas saem do MESMO array de medidas, com as funções dele — `ehAcerto` e a
 * comparação com `push` —, para a comparação cobrir os seis números da célula e
 * não só os quatro que ele já resume.
 */
function pelaMaoDoScript(linhas: LinhaPublicada[]) {
  const medidas = linhas
    .map((l) => {
      const resultado = liquidar(l.market, l.outcome, l.line_value, l.goals_home, l.goals_away);
      return resultado ? { resultado, lucro: lucroDaAposta(resultado, l.best_odd) } : null;
    })
    .filter((x): x is { resultado: string; lucro: number } => x !== null);

  return {
    ...estatistica(medidas),
    acertos: medidas.filter((m) => ehAcerto(m.resultado)).length,
    anuladas: medidas.filter((m) => m.resultado === 'push').length,
  };
}

/** Os seis números da célula, comparados um por um. */
function exigirAcordo(nossa: Celula, dele: ReturnType<typeof pelaMaoDoScript>) {
  expect(nossa.n).toBe(dele.n);
  expect(nossa.acertos).toBe(dele.acertos);
  expect(nossa.anuladas).toBe(dele.anuladas);
  expect(nossa.roi).toBeCloseTo(dele.roi, 12);
  expect(nossa.ep).toBeCloseTo(dele.ep, 12);
  expect(nossa.taxa).toBeCloseTo(dele.taxa, 12);
}

describe('o placar e o script medem igual', () => {
  it('a amostra é grande e cobre os cinco mercados', () => {
    expect(amostra.length).toBeGreaterThan(200);
    expect(new Set(amostra.map((l) => l.market)).size).toBe(5);
  });

  it('na amostra inteira', () => {
    const { liquidadas } = liquidarTudo(amostra);
    exigirAcordo(celulaDe('tudo', liquidadas), pelaMaoDoScript(amostra));
  });

  for (const { market } of SAIDAS.filter(
    (s, idx, todos) => todos.findIndex((o) => o.market === s.market) === idx,
  )) {
    it(`no mercado ${market}`, () => {
      const doMercado = amostra.filter((l) => l.market === market);
      const { liquidadas } = liquidarTudo(doMercado);
      exigirAcordo(celulaDe(market, liquidadas), pelaMaoDoScript(doMercado));
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

describe('as faixas são as mesmas dos dois lados', () => {
  it('faixa de Score, nota por nota', () => {
    // Divergir aqui daria duas verdades para a mesma semana: a tela diria que a
    // faixa Alta rende X e o terminal diria Y, com as mesmas apostas dentro.
    for (let s = 0; s <= 100; s++) {
      expect(nossaFaixaDoScore(s)).toBe(faixaDoScore(s));
    }
  });

  it('faixa de odd, centavo por centavo', () => {
    for (let o = 100; o <= 400; o++) {
      const odd = o / 100;
      expect(nossaFaixaDeOdd(odd)).toBe(faixaDeOdd(odd));
    }
  });
});

describe('e concorda nas quebras que o script também produz', () => {
  // O script quebra por mercado, faixa de Score, faixa de odd, campeonato e
  // dia. As três primeiras já estão cobertas acima e nos testes de fronteira;
  // esta fecha campeonato, que é a única em que os dois lados leem o nome de
  // FONTES diferentes — a RPC pega `competition` de fact_fixtures e o script
  // pega do histórico. Se as duas divergirem, é aqui que aparece.
  const campeonatos = ['Brasileirão', 'Série B', 'Libertadores'];

  const porCampeonato = amostra.map((l, i) => ({
    ...l,
    competition: campeonatos[i % campeonatos.length],
  }));

  for (const campeonato of campeonatos) {
    it(`no campeonato ${campeonato}`, () => {
      const doCampeonato = porCampeonato.filter((l) => l.competition === campeonato);
      const { liquidadas } = liquidarTudo(doCampeonato);
      exigirAcordo(celulaDe(campeonato, liquidadas), pelaMaoDoScript(doCampeonato));
    });
  }
});
