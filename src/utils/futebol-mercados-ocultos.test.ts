import { describe, expect, it } from 'vitest';
import {
  filtrarMercadosOcultos,
  mercadoEstaOculto,
  mercadoOcultoNaData,
} from './futebol-mercados-ocultos';

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

// ============================================================================
// A data de corte
// ============================================================================
// O predicado por nome só sabe responder sobre o presente. Este sabe QUANDO,
// e é a diferença entre a linha que esteve na tela e a que nunca esteve.
// ============================================================================

describe('mercadoOcultoNaData', () => {
  const VITRINE = [{ market: 'asian_handicap', ocultoDesde: '2026-09-01T00:00:00Z' }];
  const AGORA = Date.parse('2026-09-05T15:00:00Z');

  it('esconde o que é a partir do corte', () => {
    expect(mercadoOcultoNaData('asian_handicap', '2026-09-03T13:00:00', VITRINE, AGORA))
      .toBe(true);
  });

  it('mantém o que é anterior ao corte', () => {
    expect(mercadoOcultoNaData('asian_handicap', '2026-08-31T13:00:00', VITRINE, AGORA))
      .toBe(false);
  });

  it('o instante exato do corte já está escondido', () => {
    // A fronteira é fechada de um lado só. Deixá-la aberta poria o jogo da
    // meia-noite do dia do corte do lado errado, e é o caso que ninguém testa.
    expect(mercadoOcultoNaData('asian_handicap', '2026-09-01T00:00:00', VITRINE, AGORA))
      .toBe(true);
  });

  it('mercado fora da vitrine nunca esconde', () => {
    expect(mercadoOcultoNaData('goals_over_under', '2026-09-03T13:00:00', VITRINE, AGORA))
      .toBe(false);
  });

  it('kickoff ilegível esconde, porque não dá para situá-lo', () => {
    expect(mercadoOcultoNaData('asian_handicap', 'nao é data', VITRINE, AGORA)).toBe(true);
    expect(mercadoOcultoNaData('asian_handicap', null, VITRINE, AGORA)).toBe(true);
  });

  describe('sem data (o escuro)', () => {
    const SEM_DATA = [{ market: 'asian_handicap', ocultoDesde: null }];

    it('esconde de hoje em diante', () => {
      expect(mercadoOcultoNaData('asian_handicap', '2026-09-05T18:00:00', SEM_DATA, AGORA))
        .toBe(true);
    });

    it('não toca no passado', () => {
      expect(mercadoOcultoNaData('asian_handicap', '2026-09-04T13:00:00', SEM_DATA, AGORA))
        .toBe(false);
    });
  });
});
