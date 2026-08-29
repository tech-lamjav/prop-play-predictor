import { describe, expect, it } from 'vitest';
import {
  normalizeFutebolFixtureValueRows,
  normalizeFutebolValueBoardRows,
} from './futebol-score-contract';

const boardBase = {
  fixture_id: 101,
  home_team_id: 1,
  away_team_id: 2,
  home_team_name: 'Casa',
  away_team_name: 'Fora',
  competition: 'brasileirao',
  kickoff_utc: '2026-08-30T20:00:00',
  status_short: 'NS',
  market: 'goals_over_under',
  outcome: 'Over',
  line_value: 1.5,
  edge: 0.04,
  best_odd: 1.8,
  best_book: 'Casa A',
  avg_odd: 1.75,
  n_casas: 6,
  janela_usada: 't1h',
  prob_justa_fechamento: 0.58,
  pts_premissas: 42,
  penalidades: 0,
  score: 62,
  faixa: 'Alta',
  evidencias: ['Contexto favorável'],
  premissas_sem_dado: 0,
};

const fixtureBase = {
  market: 'goals_over_under',
  outcome: 'Over',
  outcome_order: 1,
  line_value: 1.5,
  edge: 0.04,
  best_odd: 1.8,
  best_book: 'Casa A',
  avg_odd: 1.75,
  n_casas: 6,
  janela_usada: 't1h',
  prob_justa_fechamento: 0.58,
  pts_premissas: 42,
  penalidades: 0,
  penalidades_especificas_pts: 0,
  score: 62,
  faixa: 'Alta',
  modelo_api_concorda: false,
  linha_sharp_confirma: false,
  evidencias: ['Contexto favorável'],
  avisos: [],
  contras: [],
  premissas_sem_dado: 0,
};

describe('compatibilidade do contrato do Score de contexto', () => {
  it('identifica como legacy uma linha antiga e preserva seus componentes', () => {
    const [row] = normalizeFutebolValueBoardRows([{
      ...boardBase,
      pts_valor: 20,
      pts_corroboracao: 8,
    }]);

    expect(row.score_versao).toBe('legacy');
    expect(row.pts_valor).toBe(20);
    expect(row.pts_corroboracao).toBe(8);
  });

  it('aceita contexto_v1 sem exigir os componentes removidos', () => {
    const [row] = normalizeFutebolValueBoardRows([{
      ...boardBase,
      score_versao: 'contexto_v1',
    }]);

    expect(row.score_versao).toBe('contexto_v1');
    expect(row.pts_valor).toBe(0);
    expect(row.pts_corroboracao).toBe(0);
  });

  it('rejeita a forma nova quando contexto_v1 não foi declarado', () => {
    expect(() => normalizeFutebolValueBoardRows([boardBase])).toThrow(
      'O contrato novo do Score exige score_versao: contexto_v1',
    );
  });

  it('não permite rotular a forma nova como legacy', () => {
    expect(() => normalizeFutebolValueBoardRows([{
      ...boardBase,
      score_versao: 'legacy',
    }])).toThrow('O contrato legacy exige pts_valor e pts_corroboracao');
  });

  it('adapta o detalhe novo sem exigir penalidade global de odd', () => {
    const [row] = normalizeFutebolFixtureValueRows([{
      ...fixtureBase,
      score_versao: 'contexto_v1',
    }]);

    expect(row.score_versao).toBe('contexto_v1');
    expect(row.pts_valor).toBe(0);
    expect(row.pts_corroboracao).toBe(0);
    expect(row.penalidades_globais_pts).toBe(0);
  });

  it('preserva o contrato legacy do detalhe usado em produção', () => {
    const [row] = normalizeFutebolFixtureValueRows([{
      ...fixtureBase,
      pts_valor: 20,
      pts_corroboracao: 8,
      penalidades_globais_pts: 5,
    }]);

    expect(row.score_versao).toBe('legacy');
    expect(row.pts_valor).toBe(20);
    expect(row.pts_corroboracao).toBe(8);
    expect(row.penalidades_globais_pts).toBe(5);
  });

  it('rejeita uma versão desconhecida em vez de mascarar contrato inválido', () => {
    expect(() => normalizeFutebolValueBoardRows([{
      ...boardBase,
      score_versao: 'contexto_v2',
    }])).toThrow('Versão do Score desconhecida: contexto_v2');
  });
});
