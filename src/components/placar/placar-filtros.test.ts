import { describe, expect, it } from 'vitest';
import type { LinhaPublicada } from './placar-agregacao';
import { aplicarRecorte, passaNoRecorte, SEM_RECORTE, temRecorte } from './placar-filtros';

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
    detectada_em: '2026-09-09T03:00:00',
    market: 'match_winner',
    outcome: 'Home',
    line_value: null,
    best_odd: 2,
    edge: -0.03,
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
    premissas_acesas: [],
    ...p,
  }) satisfies LinhaPublicada;

describe('sem recorte', () => {
  it('não filtra nada e se declara vazio', () => {
    expect(temRecorte(SEM_RECORTE)).toBe(false);
    expect(aplicarRecorte([linha(), linha({ score: 10 })], SEM_RECORTE)).toHaveLength(2);
  });
});

describe('o corte por faixa de Score', () => {
  it('deixa passar só as faixas escolhidas', () => {
    const recorte = { faixas: ['Alta (60–79)'], valorMinimo: null };
    expect(passaNoRecorte(linha({ score: 65 }), recorte)).toBe(true);
    expect(passaNoRecorte(linha({ score: 85 }), recorte)).toBe(false);
    expect(passaNoRecorte(linha({ score: 20 }), recorte)).toBe(false);
  });

  it('e aceita mais de uma faixa', () => {
    const recorte = { faixas: ['Alta (60–79)', 'Alta (80+)'], valorMinimo: null };
    const dentro = aplicarRecorte([linha({ score: 65 }), linha({ score: 85 }), linha({ score: 20 })], recorte);
    expect(dentro).toHaveLength(2);
  });
});

describe('o corte por valor', () => {
  it('barra o preço pior que o corte', () => {
    // O corte é em fração: −2% é −0,02.
    const recorte = { faixas: [], valorMinimo: -0.02 };
    expect(passaNoRecorte(linha({ edge: -0.01 }), recorte)).toBe(true);
    expect(passaNoRecorte(linha({ edge: -0.02 }), recorte)).toBe(true);
    expect(passaNoRecorte(linha({ edge: -0.03 }), recorte)).toBe(false);
  });

  it('linha sem valor gravado não passa', () => {
    // Incluí-la seria afirmar que ela atende um critério que ninguém mediu.
    expect(passaNoRecorte(linha({ edge: null }), { faixas: [], valorMinimo: -0.02 })).toBe(false);
  });

  it('e sem corte de valor ela passa', () => {
    expect(passaNoRecorte(linha({ edge: null }), SEM_RECORTE)).toBe(true);
  });
});

describe('os dois cortes juntos', () => {
  it('exigem as duas condições', () => {
    const recorte = { faixas: ['Alta (80+)'], valorMinimo: 0 };
    expect(passaNoRecorte(linha({ score: 85, edge: 0.01 }), recorte)).toBe(true);
    expect(passaNoRecorte(linha({ score: 85, edge: -0.01 }), recorte)).toBe(false);
    expect(passaNoRecorte(linha({ score: 40, edge: 0.01 }), recorte)).toBe(false);
  });
});
