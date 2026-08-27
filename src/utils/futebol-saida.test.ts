import { describe, expect, it } from 'vitest';
import { linhaDaSaida } from './futebol-saida';

describe('linhaDaSaida', () => {
  it('espelha o handicap para a ótica do visitante', () => {
    expect(linhaDaSaida({ market: 'asian_handicap', outcome: 'Away', line_value: -2.5 })).toBe(2.5);
  });

  it('mantém a linha do mandante e as linhas de outros mercados', () => {
    expect(linhaDaSaida({ market: 'asian_handicap', outcome: 'Home', line_value: -2.5 })).toBe(-2.5);
    expect(linhaDaSaida({ market: 'goals_over_under', outcome: 'Over', line_value: 2.5 })).toBe(2.5);
  });
});
