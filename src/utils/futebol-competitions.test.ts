import { describe, expect, it } from 'vitest';
import { fixtureScopesFor, ALL_COMPETITIONS } from './futebol-competitions';

// ============================================================================
// Escopo de calendário do painel (issue #323)
// ============================================================================
// A lista fixa de competições deixava oportunidade publicada em liga nova sem
// fixture — e sem fixture não há placar nem liquidação no histórico. Cravar uma
// temporada só tinha o mesmo efeito na virada de temporada.
// ============================================================================

const JANELA = { from: '2026-08-02', to: '2026-09-30' };

describe('fixtureScopesFor', () => {
  it('inclui toda competição da janela presente no catálogo do backend', () => {
    const escopos = fixtureScopesFor([
      { competition: 'premier_league', season: 2026, primeiro: '2026-08-15', ultimo: '2027-05-24' },
      { competition: 'ligue_1', season: 2026, primeiro: '2026-08-16', ultimo: '2027-05-30' },
      { competition: 'primeira_liga', season: 2026, primeiro: '2026-08-09', ultimo: '2027-05-18' },
    ], JANELA, 2026);

    expect(escopos).toEqual([
      { competition: 'premier_league', season: 2026 },
      { competition: 'ligue_1', season: 2026 },
      { competition: 'primeira_liga', season: 2026 },
    ]);
  });

  it('carrega as duas temporadas quando a janela atravessa a virada', () => {
    // O caso que a lista fixa apagava: um pick de 03/08 vive na temporada 2025 e
    // um de 20/08 na 2026. Carregando só uma, o outro fica sem placar.
    const escopos = fixtureScopesFor([
      { competition: 'brasileirao', season: 2025, primeiro: '2025-08-01', ultimo: '2026-08-10' },
      { competition: 'brasileirao', season: 2026, primeiro: '2026-08-12', ultimo: '2027-08-05' },
    ], JANELA, 2026);

    expect(escopos).toEqual([
      { competition: 'brasileirao', season: 2025 },
      { competition: 'brasileirao', season: 2026 },
    ]);
  });

  it('deixa de fora a temporada que não encosta na janela', () => {
    const escopos = fixtureScopesFor([
      { competition: 'brasileirao', season: 2023, primeiro: '2023-04-15', ultimo: '2023-12-03' },
      { competition: 'brasileirao', season: 2026, primeiro: '2026-08-12', ultimo: '2027-08-05' },
    ], JANELA, 2026);

    expect(escopos).toEqual([{ competition: 'brasileirao', season: 2026 }]);
  });

  it('mantém a temporada sem datas no catálogo, em vez de presumir que está fora', () => {
    const escopos = fixtureScopesFor([
      { competition: 'copa_mundo', season: 2026, primeiro: null, ultimo: null },
    ], JANELA, 2026);

    expect(escopos).toEqual([{ competition: 'copa_mundo', season: 2026 }]);
  });

  it('não repete o par liga/temporada que o catálogo trouxer duplicado', () => {
    const escopos = fixtureScopesFor([
      { competition: 'ligue_1', season: 2026, primeiro: '2026-08-16', ultimo: '2027-05-30' },
      { competition: 'ligue_1', season: 2026, primeiro: '2026-08-16', ultimo: '2027-05-30' },
    ], JANELA, 2026);

    expect(escopos).toEqual([{ competition: 'ligue_1', season: 2026 }]);
  });

  it('cai na lista fixa só enquanto o catálogo não chegou', () => {
    expect(fixtureScopesFor(undefined, JANELA, 2026)).toEqual(
      ALL_COMPETITIONS.map((competition) => ({ competition, season: 2026 })),
    );
    expect(fixtureScopesFor([], JANELA, 2026)).toEqual(
      ALL_COMPETITIONS.map((competition) => ({ competition, season: 2026 })),
    );
  });

  it('compara só a data quando o catálogo devolve timestamp completo', () => {
    // '2026-09-30T20:00:00Z' > '2026-09-30' em comparação de string crua: sem
    // recortar a data, a liga que estreia no último dia da janela ficaria fora.
    const escopos = fixtureScopesFor([
      { competition: 'copa_mundo', season: 2026, primeiro: '2026-09-30T20:00:00Z', ultimo: '2026-12-18T22:00:00Z' },
    ], JANELA, 2026);

    expect(escopos).toEqual([{ competition: 'copa_mundo', season: 2026 }]);
  });
});
