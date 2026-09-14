import { describe, expect, it } from 'vitest';
import type { LinhaPublicada } from './placar-agregacao';
import { margemEmPalavras, placarFinal } from './placar-margem';

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
    goals_away: 1,
    detectada_em: '2026-09-09T03:00:00',
    market: 'goals_over_under',
    outcome: 'Over',
    line_value: 2.5,
    best_odd: 2,
    edge: -0.02,
    score: 44,
    faixa: 'Média',
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
    ...p,
  }) satisfies LinhaPublicada;

describe('o placar final', () => {
  it('é o mandante primeiro', () => {
    expect(placarFinal(linha({ goals_home: 3, goals_away: 1 }))).toBe('3–1');
  });

  it('e não existe sem placar', () => {
    expect(placarFinal(linha({ goals_home: null, goals_away: null }))).toBeNull();
  });
});

describe('a distância até a linha, em gols', () => {
  it('diz quanto faltou num Over que não bateu', () => {
    // 2–1 são 3 gols? Não: 2+1 = 3, linha 3,5 → faltou 0,5.
    expect(margemEmPalavras(linha({ line_value: 3.5, goals_home: 2, goals_away: 1 }))).toBe(
      'faltou 0,5',
    );
  });

  it('e quanto sobrou quando bateu', () => {
    expect(margemEmPalavras(linha({ line_value: 2.5, goals_home: 2, goals_away: 1 }))).toBe(
      'sobrou 0,5',
    );
  });

  it('no Under, a conta vira do outro lado', () => {
    // 3 gols numa linha de Under 2,5: faltou 0,5 para o Under bater.
    expect(
      margemEmPalavras(linha({ outcome: 'Under', line_value: 2.5, goals_home: 2, goals_away: 1 })),
    ).toBe('faltou 0,5');
  });

  it('no handicap, é o saldo contra a linha do mandante', () => {
    // Mandante ganhou por 2 com handicap −1,5: sobrou 0,5.
    expect(
      margemEmPalavras(
        linha({ market: 'asian_handicap', outcome: 'Home', line_value: -1.5, goals_home: 2, goals_away: 0 }),
      ),
    ).toBe('sobrou 0,5');
  });

  it('e do lado do visitante o sinal inverte', () => {
    expect(
      margemEmPalavras(
        linha({ market: 'asian_handicap', outcome: 'Away', line_value: -1.5, goals_home: 2, goals_away: 0 }),
      ),
    ).toBe('faltou 0,5');
  });

  it('empate exato na linha é "na linha", que é a anulada', () => {
    expect(
      margemEmPalavras(
        linha({ market: 'asian_handicap', outcome: 'Home', line_value: 0, goals_home: 1, goals_away: 1 }),
      ),
    ).toBe('na linha');
  });

  it('mercado sem linha não tem margem: o placar já é a resposta inteira', () => {
    for (const market of ['match_winner', 'btts', 'double_chance']) {
      expect(margemEmPalavras(linha({ market, outcome: 'Home', line_value: null }))).toBeNull();
    }
  });
});
