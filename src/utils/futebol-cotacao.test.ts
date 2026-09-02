import { describe, expect, it } from 'vitest';
import type { FutebolFixtureValueRow, FutebolOddsRow } from '@/services/futebol-data.service';
import { leituraDaCotacao } from './futebol-cotacao';

const odd: FutebolOddsRow = {
  market_key: 'over_under',
  market_label: 'Goals Over/Under',
  outcome_label: 'Over 1.5',
  outcome_order: 1,
  line: 1.5,
  pinnacle_odd: null,
  avg_odd: 1.63,
  reference_odd: 1.6,
  best_odd: 1.72,
  best_book: 'Casa A',
  n_books: 4,
  pin_open: null,
  pin_close: null,
};

describe('leituraDaCotacao', () => {
  it('classifica como cotada a linha rejeitada pelos filtros e usa a odd de referência', () => {
    expect(leituraDaCotacao('goals_over_under', 'Over', 1.5, [], [odd])).toEqual({
      estado: 'cotada',
      odd: 1.6,
    });
  });

  it('mantém a oportunidade publicada acima da cotação bruta', () => {
    const oportunidade = {
      market: 'goals_over_under',
      outcome: 'Over',
      line_value: 1.5,
      best_odd: 1.72,
    } as FutebolFixtureValueRow;

    expect(leituraDaCotacao('goals_over_under', 'Over', 1.5, [oportunidade], [odd])).toEqual({
      estado: 'oportunidade',
      odd: 1.72,
      oportunidade,
    });
  });

  it('não confunde outra linha cotada com a linha selecionada', () => {
    expect(leituraDaCotacao('goals_over_under', 'Over', 2.5, [], [odd])).toEqual({
      estado: 'sem_cotacao',
      odd: null,
    });
  });
});
