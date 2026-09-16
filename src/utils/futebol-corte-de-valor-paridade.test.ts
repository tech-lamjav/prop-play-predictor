import { describe, expect, it } from 'vitest';
import * as painel from './futebol-corte-de-valor';
import * as notificacao from '../../supabase/functions/shared/corte-de-valor';

// ============================================================================
// A guarda que impede as duas cópias do corte de valor de divergirem
// ============================================================================
// Mesma fronteira e mesmo risco da vitrine (`futebol-mercados-ocultos-paridade`):
// o painel roda no browser e as DMs rodam em Deno, então a regra existe duas
// vezes. Se uma cópia mudar e a outra não, a linha some da tela e continua
// chegando no celular — e ninguém vê, porque tela e DM são lidas por pessoas
// diferentes em momentos diferentes.
//
// Compara COMPORTAMENTO, caso a caso, e não texto.
// ============================================================================

const CORTE = [{ market: 'asian_handicap', limiar: -0.02 }];

const PREDICADO: [string, number | null | undefined, { market: string; limiar: number }[]][] = [
  ['goals_over_under', -0.3, CORTE],
  ['asian_handicap', -0.019, CORTE],
  ['asian_handicap', -0.02, CORTE],
  ['asian_handicap', -0.074, CORTE],
  ['asian_handicap', 0.04, CORTE],
  ['asian_handicap', null, CORTE],
  ['asian_handicap', undefined, CORTE],
  ['asian_handicap', Number.NaN, CORTE],
  ['asian_handicap', -0.5, []],
  ['btts', -0.05, [...CORTE, { market: 'btts', limiar: -0.04 }]],
  ['btts', -0.03, [...CORTE, { market: 'btts', limiar: -0.04 }]],
];

describe('as duas cópias do corte concordam', () => {
  it.each(PREDICADO)('passaNoCorteDeValor · %s %s', (market, edge, limiares) => {
    expect(notificacao.passaNoCorteDeValor(market, edge, limiares)).toBe(
      painel.passaNoCorteDeValor(market, edge, limiares),
    );
  });

  it('filtrarCorteDeValor devolve as mesmas linhas', () => {
    const linhas = PREDICADO.map(([market, edge], i) => ({ market, edge, fixture_id: i }));
    expect(notificacao.filtrarCorteDeValor(linhas, CORTE)).toEqual(painel.filtrarCorteDeValor(linhas, CORTE));
    expect(notificacao.filtrarCorteDeValor(linhas, [])).toEqual(painel.filtrarCorteDeValor(linhas, []));
  });
});

describe('o fallback do corte é o mesmo dos dois lados', () => {
  it('CORTE_FALLBACK bate', () => {
    expect([...notificacao.CORTE_FALLBACK]).toEqual([...painel.CORTE_FALLBACK]);
  });

  it('o fallback corta alguma coisa — lista vazia derrotaria o propósito', () => {
    expect(painel.CORTE_FALLBACK.length).toBeGreaterThan(0);
  });
});
