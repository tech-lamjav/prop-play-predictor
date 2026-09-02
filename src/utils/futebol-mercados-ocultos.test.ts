import { describe, expect, it } from 'vitest';
import { filtrarMercadosOcultos, mercadoEstaOculto } from './futebol-mercados-ocultos';

const linha = (market: string, id: number) => ({ market, fixture_id: id });

describe('mercadoEstaOculto', () => {
  it('reconhece o mercado que está na lista', () => {
    expect(mercadoEstaOculto('asian_handicap', ['asian_handicap'])).toBe(true);
  });

  it('não esconde mercado fora da lista', () => {
    expect(mercadoEstaOculto('goals_over_under', ['asian_handicap'])).toBe(false);
  });

  it('com a lista vazia nada está oculto', () => {
    expect(mercadoEstaOculto('asian_handicap', [])).toBe(false);
  });
});

describe('filtrarMercadosOcultos', () => {
  it('remove as linhas do mercado oculto', () => {
    const linhas = [
      linha('goals_over_under', 1),
      linha('asian_handicap', 2),
      linha('match_winner', 3),
      linha('asian_handicap', 4),
    ];

    expect(filtrarMercadosOcultos(linhas, ['asian_handicap'])).toEqual([
      linha('goals_over_under', 1),
      linha('match_winner', 3),
    ]);
  });

  it('preserva a ordem das linhas que ficam', () => {
    const linhas = [linha('btts', 1), linha('asian_handicap', 2), linha('double_chance', 3)];

    expect(filtrarMercadosOcultos(linhas, ['asian_handicap']).map((l) => l.fixture_id)).toEqual([
      1, 3,
    ]);
  });

  it('esconde mais de um mercado quando a lista tem mais de um', () => {
    const linhas = [linha('goals_over_under', 1), linha('asian_handicap', 2), linha('btts', 3)];

    expect(filtrarMercadosOcultos(linhas, ['asian_handicap', 'btts'])).toEqual([
      linha('goals_over_under', 1),
    ]);
  });

  it('devolve tudo quando não há mercado oculto', () => {
    const linhas = [linha('goals_over_under', 1), linha('asian_handicap', 2)];

    expect(filtrarMercadosOcultos(linhas, [])).toEqual(linhas);
  });

  it('não muda o array recebido', () => {
    const linhas = [linha('goals_over_under', 1), linha('asian_handicap', 2)];

    filtrarMercadosOcultos(linhas, ['asian_handicap']);

    expect(linhas).toHaveLength(2);
  });
});
