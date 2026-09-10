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

describe('contrato do Score de contexto', () => {
  // ==========================================================================
  // A versão é DECLARADA, nunca deduzida da forma da linha (#310)
  // ==========================================================================
  // Durante a expansão o contrato aceitava linha sem `score_versao` e deduzia a
  // versão pela presença dos componentes de preço. Era andaime: a RPC ainda
  // podia responder na forma antiga enquanto o mart migrava.
  //
  // As três RPCs declaram a versão desde a virada de 03/09 (conferido em
  // produção por `pg_get_functiondef`). Manter a dedução depois disso é pior do
  // que inútil: uma resposta malformada seria silenciosamente carimbada de
  // `legacy` e classificada na régua errada, sem ninguém saber.
  // ==========================================================================

  it('linha sem versão declarada é contrato malformado, e não legacy', () => {
    expect(() => normalizeFutebolValueBoardRows([boardBase])).toThrow(
      'O contrato do Score exige score_versao',
    );
  });

  it('nem a forma antiga faz a linha passar sem declarar a versão', () => {
    // Este era o caminho da dedução: componentes de preço numéricos viravam
    // `legacy` por conta própria.
    expect(() =>
      normalizeFutebolValueBoardRows([
        { ...boardBase, pts_valor: 20, pts_corroboracao: 8 },
      ]),
    ).toThrow('O contrato do Score exige score_versao');
  });

  it('aceita contexto_v1', () => {
    const [row] = normalizeFutebolValueBoardRows([{
      ...boardBase,
      score_versao: 'contexto_v1',
    }]);

    expect(row.score_versao).toBe('contexto_v1');
  });

  it('aceita legacy, que é o que o histórico point-in-time devolve', () => {
    // `legacy` deixou de ser um contrato de entrada e virou um DADO DO PASSADO:
    // 19.229 linhas anteriores ao cutover, calculadas na escala antiga. Elas
    // continuam abrindo, e a régua delas é outra — ver futebol-faixas.test.ts.
    const [row] = normalizeFutebolValueBoardRows([{
      ...boardBase,
      score_versao: 'legacy',
    }]);

    expect(row.score_versao).toBe('legacy');
  });

  it('o detalhe segue a mesma regra', () => {
    const [row] = normalizeFutebolFixtureValueRows([{
      ...fixtureBase,
      score_versao: 'contexto_v1',
    }]);

    expect(row.score_versao).toBe('contexto_v1');
    expect(() => normalizeFutebolFixtureValueRows([fixtureBase])).toThrow(
      'O contrato do Score exige score_versao',
    );
  });

  it('rejeita uma versão desconhecida em vez de mascarar contrato inválido', () => {
    expect(() => normalizeFutebolValueBoardRows([{
      ...boardBase,
      score_versao: 'contexto_v2',
    }])).toThrow('Versão do Score desconhecida: contexto_v2');
  });
});
