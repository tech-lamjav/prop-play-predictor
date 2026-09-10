import { describe, expect, it } from 'vitest';
import { settleFutebol } from './futebol-settlement';
import type { Saida } from './futebol-saida';
// O script de operação, em .mjs. O `allowJs` do projeto o resolve sozinho.
import { liquidar, lucroDaAposta } from '../../scripts/futebol-roi.mjs';

// ============================================================================
// O script de ROI liquida igual ao produto
// ============================================================================
// `scripts/futebol-roi.mjs` reimplementa a regra de `futebol-settlement.ts`,
// porque é um .mjs de operação e não consegue importar o TypeScript do app.
//
// Duas cópias da mesma regra divergem sozinhas, e a divergência aqui é do pior
// tipo: silenciosa e para trás. O script não quebra — ele passa a devolver uma
// taxa de acerto diferente da que a tela mostra para o mesmo jogo, e a decisão
// de peso de premissa é tomada em cima do número errado.
//
// Este teste é o que impede isso. Ele varre a grade inteira de mercados,
// saídas, linhas e placares, e exige acordo caso a caso.
// ============================================================================

const PLACARES: [number, number][] = [
  [0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [0, 2],
  [2, 1], [1, 2], [3, 1], [2, 2], [3, 3], [4, 0],
];

const CASOS: { market: string; outcome: string; linhas: (number | null)[] }[] = [
  { market: 'match_winner', outcome: 'Home', linhas: [null] },
  { market: 'match_winner', outcome: 'Away', linhas: [null] },
  { market: 'match_winner', outcome: 'Draw', linhas: [null] },
  { market: 'btts', outcome: 'Yes', linhas: [null] },
  { market: 'btts', outcome: 'No', linhas: [null] },
  { market: 'double_chance', outcome: '1X', linhas: [null] },
  { market: 'double_chance', outcome: 'X2', linhas: [null] },
  { market: 'double_chance', outcome: '12', linhas: [null] },
  // Linha cheia, meia, quarto e três quartos — é onde mora meio-green e anulada.
  { market: 'goals_over_under', outcome: 'Over', linhas: [1.5, 2, 2.25, 2.5, 2.75, 3, 3.5] },
  { market: 'goals_over_under', outcome: 'Under', linhas: [1.5, 2, 2.25, 2.5, 2.75, 3, 3.5] },
  { market: 'asian_handicap', outcome: 'Home', linhas: [-1.5, -1, -0.75, -0.5, -0.25, 0, 0.5, 1] },
  { market: 'asian_handicap', outcome: 'Away', linhas: [-1.5, -1, -0.75, -0.5, -0.25, 0, 0.5, 1] },
];

describe('paridade entre o script de ROI e a liquidação do produto', () => {
  it('as duas implementações concordam em toda a grade', () => {
    const divergencias: string[] = [];
    let comparados = 0;

    for (const { market, outcome, linhas } of CASOS) {
      for (const line of linhas) {
        for (const [gh, ga] of PLACARES) {
          const saida = { market, outcome, line_value: line } as unknown as Saida;
          const doProduto = settleFutebol(saida, gh, ga);
          const doScript = liquidar(market, outcome, line, gh, ga);
          comparados++;
          if (doProduto !== doScript) {
            divergencias.push(
              `${market} ${outcome} linha ${line} placar ${gh}x${ga}: produto=${doProduto} script=${doScript}`,
            );
          }
        }
      }
    }

    expect(divergencias).toEqual([]);
    // Guarda contra a grade encolher sem ninguém notar: um `CASOS` esvaziado
    // faria o teste passar sem comparar nada.
    expect(comparados).toBeGreaterThan(300);
  });

  it('mercado desconhecido não é liquidado por engano', () => {
    expect(liquidar('total_de_escanteios', 'Over', 9.5, 3, 1)).toBeNull();
  });

  it('jogo sem placar não é liquidado', () => {
    expect(liquidar('match_winner', 'Home', null, null, null)).toBeNull();
  });
});

describe('lucro de uma aposta plana de 1 unidade', () => {
  it('paga a odd menos a unidade no green, e metade no meio-green', () => {
    expect(lucroDaAposta('won', 2.5)).toBeCloseTo(1.5);
    expect(lucroDaAposta('half_won', 2.5)).toBeCloseTo(0.75);
  });

  it('anulada devolve a aposta, meio-red perde metade, red perde tudo', () => {
    expect(lucroDaAposta('push', 2.5)).toBe(0);
    expect(lucroDaAposta('half_lost', 2.5)).toBe(-0.5);
    expect(lucroDaAposta('lost', 2.5)).toBe(-1);
  });
});
