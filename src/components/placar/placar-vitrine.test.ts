import { describe, expect, it } from 'vitest';
import type { LinhaPublicada } from './placar-agregacao';
import { esteveNaVitrine, seloDeOculto, soAVitrine } from './placar-vitrine';

const OCULTOS = [{ market: 'asian_handicap', ocultoDesde: '2026-09-01T00:00:00Z' }];

const linha = (p: Partial<LinhaPublicada> = {}): LinhaPublicada =>
  ({
    opportunity_key: 'k',
    fixture_id: 1,
    competition: 'Brasileirão',
    home_team_name: 'Casa',
    away_team_name: 'Fora',
    kickoff_utc: '2026-09-10T23:00:00',
    status_short: 'FT',
    goals_home: 2,
    goals_away: 0,
    detectada_em: '2026-09-10T03:00:00',
    market: 'match_winner',
    outcome: 'Home',
    line_value: null,
    best_odd: 2,
    edge: 1,
    score: 65,
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
    ...p,
  }) satisfies LinhaPublicada;

describe('esteve na vitrine', () => {
  it('mercado que nunca saiu da tela, sempre esteve', () => {
    expect(esteveNaVitrine(linha({ market: 'match_winner' }), OCULTOS)).toBe(true);
  });

  it('mercado oculto, publicado depois do corte, não esteve', () => {
    expect(
      esteveNaVitrine(
        linha({ market: 'asian_handicap', detectada_em: '2026-09-10T03:00:00' }),
        OCULTOS,
      ),
    ).toBe(false);
  });

  it('mercado oculto, publicado ANTES do corte, esteve — e isso é o ponto da data', () => {
    // Excluir o mercado inteiro apagaria o que o assinante de fato viu em
    // agosto, e a comparação antes/depois de esconder deixaria de existir.
    expect(
      esteveNaVitrine(
        linha({ market: 'asian_handicap', detectada_em: '2026-08-20T03:00:00' }),
        OCULTOS,
      ),
    ).toBe(true);
  });

  it('vale pelo dia da detecção, não pelo do jogo', () => {
    // Publicada em 31/08, jogo em 02/09: ela apareceu na tela antes do corte.
    expect(
      esteveNaVitrine(
        linha({
          market: 'asian_handicap',
          detectada_em: '2026-08-31T03:00:00',
          kickoff_utc: '2026-09-02T23:00:00',
        }),
        OCULTOS,
      ),
    ).toBe(true);
  });
});

describe('só a vitrine', () => {
  it('deixa fora o que o assinante não viu, e mantém o resto', () => {
    const dentro = soAVitrine(
      [
        linha({ market: 'match_winner' }),
        linha({ market: 'asian_handicap' }),
        linha({ market: 'asian_handicap', detectada_em: '2026-08-10T03:00:00' }),
      ],
      OCULTOS,
    );
    expect(dentro).toHaveLength(2);
    expect(dentro.every((l) => esteveNaVitrine(l, OCULTOS))).toBe(true);
  });

  it('sem mercado oculto nenhum, não recorta nada', () => {
    const linhas = [linha(), linha({ market: 'asian_handicap' })];
    expect(soAVitrine(linhas, [])).toHaveLength(2);
  });
});

describe('o selo', () => {
  it('marca o mercado que está fora da vitrine hoje', () => {
    expect(seloDeOculto('asian_handicap', OCULTOS)).toBe('fora da vitrine');
  });

  it('e não marca o que está na tela — selo em toda linha não marca nada', () => {
    expect(seloDeOculto('match_winner', OCULTOS)).toBeNull();
  });
});

describe('a vitrine sem data', () => {
  // Acontece quando a leitura da vitrine falha e o fallback entra: a lista vem
  // com o nome do mercado e sem o corte. A regra compartilhada trata esse caso,
  // e é por isso que ela mora lá e não aqui — esta versão do arquivo tinha
  // reimplementado a comparação e perdido justamente ele.
  const SEM_DATA = [{ market: 'asian_handicap', ocultoDesde: null }];
  const agora = Date.parse('2026-09-12T12:00:00Z');

  it('esconde do presente para a frente', () => {
    expect(
      esteveNaVitrine(
        linha({ market: 'asian_handicap', detectada_em: '2026-09-12T13:00:00' }),
        SEM_DATA,
        agora,
      ),
    ).toBe(false);
  });

  it('e não toca no passado, que é o comportamento de antes', () => {
    expect(
      esteveNaVitrine(
        linha({ market: 'asian_handicap', detectada_em: '2026-09-01T13:00:00' }),
        SEM_DATA,
        agora,
      ),
    ).toBe(true);
  });
});
