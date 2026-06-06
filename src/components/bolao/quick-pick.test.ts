/**
 * Testes do gerador de Quick Pick — foca nos comportamentos invariantes:
 *  - skip de jogos finalizados / TBD
 *  - persona 'fixed' aplica X×Y a todos
 *  - persona 'fixed' em mata-mata empatado: favorito ganha por +1
 *  - personas aleatórias (realist/patriot/zebra) são determinísticas com seed
 */
import { describe, it, expect } from 'vitest';
import { generateQuickPickPredictions } from './quick-pick';
import type { WcMatch } from '@/services/bolao.service';

function fakeMatch(partial: Partial<WcMatch> = {}): WcMatch {
  return {
    id: 1,
    match_number: 1,
    stage: 'group',
    group_name: 'A',
    home_team: 'Brasil',
    away_team: 'México',
    home_team_code: 'BRA',
    away_team_code: 'MEX',
    match_date: '2026-06-15',
    match_time_brasilia: '16:00:00',
    venue: null,
    city: null,
    home_score: null,
    away_score: null,
    is_finished: false,
    ...partial,
  } as unknown as WcMatch;
}

describe('generateQuickPickPredictions — skip rules', () => {
  it('pula jogos finalizados', () => {
    const matches = [
      fakeMatch({ id: 1, is_finished: true }),
      fakeMatch({ id: 2 }),
    ];
    const out = generateQuickPickPredictions(matches, 'realist', { seed: 1 });
    expect(out).toHaveLength(1);
    expect(out[0].match_id).toBe(2);
  });

  it('pula jogos TBD (sem times definidos)', () => {
    const matches = [
      fakeMatch({ id: 1, home_team_code: 'TBD' }),
      fakeMatch({ id: 2, away_team_code: 'TBD' }),
      fakeMatch({ id: 3 }),
    ];
    const out = generateQuickPickPredictions(matches, 'realist', { seed: 1 });
    expect(out).toHaveLength(1);
    expect(out[0].match_id).toBe(3);
  });
});

describe('generateQuickPickPredictions — persona "fixed"', () => {
  it('aplica o placar fixo a todos os jogos de fase de grupos', () => {
    const matches = [
      fakeMatch({ id: 1, home_team_code: 'BRA', away_team_code: 'MEX' }),
      fakeMatch({ id: 2, home_team_code: 'GER', away_team_code: 'JPN' }),
      fakeMatch({ id: 3, home_team_code: 'CRC', away_team_code: 'MAR' }),
    ];
    const out = generateQuickPickPredictions(matches, 'fixed', {
      fixedScore: { home: 2, away: 1 },
    });
    expect(out).toHaveLength(3);
    for (const p of out) {
      expect(p.predicted_home_score).toBe(2);
      expect(p.predicted_away_score).toBe(1);
    }
  });

  it('default fixedScore = 1×1 quando não passado', () => {
    const matches = [fakeMatch({ id: 1, stage: 'group' })];
    const out = generateQuickPickPredictions(matches, 'fixed', {});
    expect(out[0]).toMatchObject({
      predicted_home_score: 1,
      predicted_away_score: 1,
    });
  });

  it('mata-mata empate: favorito ganha por +1 (BRA mandante)', () => {
    // BRA tem rank melhor que MEX → BRA é favorito
    const matches = [
      fakeMatch({
        id: 1,
        stage: 'final',
        home_team_code: 'BRA',
        away_team_code: 'MEX',
      }),
    ];
    const out = generateQuickPickPredictions(matches, 'fixed', {
      fixedScore: { home: 1, away: 1 },
    });
    expect(out[0].predicted_home_score).toBe(2);
    expect(out[0].predicted_away_score).toBe(1);
  });

  it('mata-mata empate: favorito visitante quebra empate', () => {
    // BRA (rank 5) visitante contra MEX (rank 16) — BRA é o favorito
    const matches = [
      fakeMatch({
        id: 1,
        stage: 'semi',
        home_team_code: 'MEX',
        away_team_code: 'BRA',
      }),
    ];
    const out = generateQuickPickPredictions(matches, 'fixed', {
      fixedScore: { home: 0, away: 0 },
    });
    // 0×0 vira 0×1 (favorito BRA marca)
    expect(out[0].predicted_home_score).toBe(0);
    expect(out[0].predicted_away_score).toBe(1);
  });

  it('mata-mata sem empate: respeita o placar fixo', () => {
    const matches = [
      fakeMatch({
        id: 1,
        stage: 'final',
        home_team_code: 'BRA',
        away_team_code: 'MEX',
      }),
    ];
    const out = generateQuickPickPredictions(matches, 'fixed', {
      fixedScore: { home: 3, away: 0 },
    });
    expect(out[0].predicted_home_score).toBe(3);
    expect(out[0].predicted_away_score).toBe(0);
  });

  it('grupos com placar fixo X×X: empate é mantido (não há tiebreak)', () => {
    const matches = [
      fakeMatch({
        id: 1,
        stage: 'group',
        home_team_code: 'BRA',
        away_team_code: 'MEX',
      }),
    ];
    const out = generateQuickPickPredictions(matches, 'fixed', {
      fixedScore: { home: 2, away: 2 },
    });
    expect(out[0].predicted_home_score).toBe(2);
    expect(out[0].predicted_away_score).toBe(2);
  });
});

describe('generateQuickPickPredictions — determinismo com seed', () => {
  it('mesmo seed gera mesmo resultado pra realist', () => {
    const matches = [
      fakeMatch({ id: 1, home_team_code: 'BRA', away_team_code: 'MEX' }),
      fakeMatch({ id: 2, home_team_code: 'ALE', away_team_code: 'JAP' }),
    ];
    const a = generateQuickPickPredictions(matches, 'realist', { seed: 42 });
    const b = generateQuickPickPredictions(matches, 'realist', { seed: 42 });
    expect(a).toEqual(b);
  });

  it('persona aleatória: nunca empata em mata-mata', () => {
    const matches = Array.from({ length: 20 }, (_, i) =>
      fakeMatch({
        id: i + 1,
        stage: 'quarter',
        home_team_code: i % 2 === 0 ? 'BRA' : 'MEX',
        away_team_code: i % 2 === 0 ? 'MEX' : 'BRA',
      })
    );
    for (const persona of ['realist', 'patriot', 'zebra'] as const) {
      const out = generateQuickPickPredictions(matches, persona, { seed: 7 });
      for (const p of out) {
        expect(p.predicted_home_score).not.toBe(p.predicted_away_score);
      }
    }
  });
});
