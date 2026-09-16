import { describe, expect, it } from 'vitest';
import { mercadoOcultoNaData, ocultosAgora, type MercadoOculto } from './futebol-mercados-ocultos';
import { mergeBoardAndHistory } from './futebol-history';
import { esteveNaVitrine, seloDeOculto } from '@/components/placar/placar-vitrine';

// ============================================================================
// O mercado que volta à vitrine (migration 145)
// ============================================================================
// Sem o fim do período, religar o mercado tirava ele da vitrine inteira, e o
// histórico passava a mostrar todas as linhas de quando ele estava fora — que
// nunca estiveram na tela. Estes casos travam o período fechado nos três lugares
// por onde elas voltariam: a regra, a fusão com o histórico e o placar.
// ============================================================================

const AGORA = Date.parse('2026-10-10T15:00:00Z');
const FECHADO: MercadoOculto[] = [
  { market: 'asian_handicap', ocultoDesde: '2026-09-01T00:00:00Z', ocultoAte: '2026-10-01T00:00:00Z' },
];
const ABERTO: MercadoOculto[] = [
  { market: 'asian_handicap', ocultoDesde: '2026-09-01T00:00:00Z', ocultoAte: null },
];

describe('mercadoOcultoNaData com o período fechado', () => {
  it('antes de sair, a linha fica — esteve na tela', () => {
    expect(mercadoOcultoNaData('asian_handicap', '2026-08-30T18:00:00', FECHADO, AGORA)).toBe(false);
  });

  it('enquanto esteve fora, a linha some — nunca esteve na tela', () => {
    expect(mercadoOcultoNaData('asian_handicap', '2026-09-15T18:00:00', FECHADO, AGORA)).toBe(true);
  });

  it('o instante da volta já está na tela', () => {
    expect(mercadoOcultoNaData('asian_handicap', '2026-10-01T00:00:00', FECHADO, AGORA)).toBe(false);
  });

  it('depois da volta, a linha fica', () => {
    expect(mercadoOcultoNaData('asian_handicap', '2026-10-05T18:00:00', FECHADO, AGORA)).toBe(false);
  });

  it('data ilegível não esconde um mercado que já voltou', () => {
    expect(mercadoOcultoNaData('asian_handicap', null, FECHADO, AGORA)).toBe(false);
    expect(mercadoOcultoNaData('asian_handicap', 'nao é data', FECHADO, AGORA)).toBe(false);
  });

  it('com o período aberto nada muda: esconde tudo a partir da saída', () => {
    expect(mercadoOcultoNaData('asian_handicap', '2026-10-05T18:00:00', ABERTO, AGORA)).toBe(true);
    expect(mercadoOcultoNaData('asian_handicap', null, ABERTO, AGORA)).toBe(true);
  });

  it('sem o campo (vitrine de antes da 145) o período conta como aberto', () => {
    const antiga = [{ market: 'asian_handicap', ocultoDesde: '2026-09-01T00:00:00Z' }];
    expect(mercadoOcultoNaData('asian_handicap', '2026-10-05T18:00:00', antiga, AGORA)).toBe(true);
  });
});

describe('ocultosAgora', () => {
  it('o mercado que voltou não está oculto hoje', () => {
    expect(ocultosAgora(FECHADO)).toEqual([]);
  });

  it('o que continua fora está', () => {
    expect(ocultosAgora(ABERTO)).toEqual(['asian_handicap']);
    expect(ocultosAgora([{ market: 'btts', ocultoDesde: null }])).toEqual(['btts']);
  });
});

const linha = (kickoff: string, fixture: number) =>
  ({
    fixture_id: fixture,
    home_team_name: 'Casa',
    away_team_name: 'Fora',
    kickoff_utc: kickoff,
    status_short: 'FT',
    market: 'asian_handicap',
    outcome: 'Home',
    line_value: -0.5,
    edge: 0.01,
    score: 50,
    faixa: 'Média',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe('o histórico do mercado que voltou', () => {
  it('mostra o antes e o depois, e não o período em que ele esteve fora', () => {
    const historico = [
      linha('2026-08-30T18:00:00', 1), // antes de sair
      linha('2026-09-15T18:00:00', 2), // fora
      linha('2026-09-30T23:00:00', 3), // fora, na véspera da volta
      linha('2026-10-05T18:00:00', 4), // depois da volta
    ];
    const fundido = mergeBoardAndHistory([], historico, AGORA, FECHADO);
    expect(fundido.map((r) => r.fixture_id).sort()).toEqual([1, 4]);
  });
});

describe('o placar do mercado que voltou', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const publicada = (detectada: string) => ({ market: 'asian_handicap', edge: 0.01, detectada_em: detectada }) as any;

  it('a linha detectada enquanto ele estava fora não esteve na vitrine', () => {
    expect(esteveNaVitrine(publicada('2026-09-20T10:00:00'), FECHADO, AGORA)).toBe(false);
  });

  it('a detectada depois da volta esteve', () => {
    expect(esteveNaVitrine(publicada('2026-10-03T10:00:00'), FECHADO, AGORA)).toBe(true);
  });

  it('o selo de "fora da vitrine" some quando ele volta', () => {
    expect(seloDeOculto('asian_handicap', FECHADO)).toBeNull();
    expect(seloDeOculto('asian_handicap', ABERTO)).toBe('fora da vitrine');
  });
});
