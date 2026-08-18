import { describe, it, expect } from 'vitest';
import {
  brtDay, brtDayFromMs, kickoffMs, addDaysBrt, historyWindow,
  opportunityKey, mergeBoardAndHistory,
} from '@/utils/futebol-history';
import type { FutebolValueBoardRow } from '@/services/futebol-data.service';

// Linha mínima do board/histórico: só o que a fusão olha.
function row(p: Partial<FutebolValueBoardRow> & { fixture_id: number; kickoff_utc: string }): FutebolValueBoardRow {
  return {
    fixture_id: p.fixture_id,
    home_team_id: 1, away_team_id: 2,
    home_team_name: 'A', away_team_name: 'B',
    competition: 'brasileirao', kickoff_utc: p.kickoff_utc, status_short: p.status_short ?? 'NS',
    market: p.market ?? 'match_winner', outcome: p.outcome ?? 'Home', line_value: p.line_value ?? null,
    edge: p.edge ?? 0.05, best_odd: 2, best_book: 'Pinnacle', avg_odd: 1.9, n_casas: 5,
    janela_usada: 't1h', prob_justa_fechamento: 0.5,
    pts_valor: 10, pts_premissas: 10, pts_corroboracao: 10, penalidades: 0,
    score: p.score ?? 50, faixa: p.faixa ?? 'Média', evidencias: [],
  };
}

describe('dia de Brasília', () => {
  it('joga o 21:30 BRT no dia certo, não no dia UTC seguinte', () => {
    // 2026-08-17 21:30 BRT == 2026-08-18 00:30 UTC
    expect(brtDay('2026-08-18T00:30:00')).toBe('2026-08-17');
  });

  it('trata kickoff sem sufixo de fuso como UTC', () => {
    expect(kickoffMs('2026-08-18T00:30:00')).toBe(Date.UTC(2026, 7, 18, 0, 30));
  });

  it('devolve null pra kickoff ausente', () => {
    expect(brtDay(null)).toBeNull();
    expect(kickoffMs(null)).toBeNull();
  });
});

describe('janela de 30 dias', () => {
  it('vai de hoje-29 até hoje (30 dias, inclusive nas pontas)', () => {
    expect(historyWindow('2026-08-18')).toEqual({ from: '2026-07-20', to: '2026-08-18' });
  });

  it('atravessa virada de mês e ano', () => {
    expect(addDaysBrt('2026-01-05', -29)).toBe('2025-12-07');
  });
});

describe('opportunityKey', () => {
  it('espelha o opportunity_key do banco (line nula vira NONE)', () => {
    expect(opportunityKey({ fixture_id: 1489404, market: 'match_winner', outcome: 'Home', line_value: null }))
      .toBe('1489404|match_winner|Home|NONE');
    expect(opportunityKey({ fixture_id: 1489383, market: 'goals_over_under', outcome: 'Over', line_value: 2.25 }))
      .toBe('1489383|goals_over_under|Over|2.25');
  });
});

describe('mergeBoardAndHistory', () => {
  const NOW = Date.UTC(2026, 7, 18, 19, 5); // 18/08 16:05 BRT
  const TODAY = '2026-08-18';

  it('descarta o passado do board e usa só o PIT', () => {
    const passado = '2026-08-10T22:00:00';
    const board = [row({ fixture_id: 10, kickoff_utc: passado, score: 88 })];
    const hist = [row({ fixture_id: 10, kickoff_utc: passado, score: 41 })];
    const out = mergeBoardAndHistory(board, hist, NOW);
    expect(out).toHaveLength(1);
    expect(out[0].score).toBe(41);
  });

  it('some com a linha que só existiu depois do apito (sem PIT, não aparece)', () => {
    const board = [row({ fixture_id: 11, kickoff_utc: '2026-08-11T22:00:00' })];
    expect(mergeBoardAndHistory(board, [], NOW)).toHaveLength(0);
  });

  it('mantém o jogo das 16h na tela às 16h05 — uma vez só, pela versão PIT', () => {
    const k = '2026-08-18T19:00:00'; // 16:00 BRT, já começou
    const board = [row({ fixture_id: 12, kickoff_utc: k, score: 90 })];
    const hist = [row({ fixture_id: 12, kickoff_utc: k, score: 55 })];
    const out = mergeBoardAndHistory(board, hist, NOW);
    expect(out).toHaveLength(1);
    expect(out[0].score).toBe(55);
  });

  it('no dia corrente com kickoff no futuro, o board vence', () => {
    const k = '2026-08-18T23:00:00'; // 20:00 BRT, ainda não começou
    const board = [row({ fixture_id: 13, kickoff_utc: k, score: 70 })];
    const hist = [row({ fixture_id: 13, kickoff_utc: k, score: 30 })];
    const out = mergeBoardAndHistory(board, hist, NOW);
    expect(out).toHaveLength(1);
    expect(out[0].score).toBe(70);
  });

  it('não confunde chaves diferentes do mesmo jogo', () => {
    const k = '2026-08-18T19:00:00';
    const hist = [
      row({ fixture_id: 14, kickoff_utc: k, market: 'goals_over_under', outcome: 'Over', line_value: 2.5, score: 61 }),
      row({ fixture_id: 14, kickoff_utc: k, market: 'goals_over_under', outcome: 'Over', line_value: 3.5, score: 44 }),
    ];
    const out = mergeBoardAndHistory([], hist, NOW);
    expect(out.map((r) => r.line_value).sort()).toEqual([2.5, 3.5]);
  });

  it('mantém dias futuros vindos do board', () => {
    const board = [row({ fixture_id: 15, kickoff_utc: '2026-08-20T22:00:00', score: 62 })];
    const out = mergeBoardAndHistory(board, [], NOW);
    expect(out).toHaveLength(1);
    expect(brtDay(out[0].kickoff_utc)).toBe('2026-08-20');
  });

  it('ignora linha sem kickoff', () => {
    const board = [row({ fixture_id: 16, kickoff_utc: '2026-08-20T22:00:00' })];
    board[0].kickoff_utc = null;
    expect(mergeBoardAndHistory(board, [], NOW)).toHaveLength(0);
  });

  it('dia passado sem nenhuma linha PIT não entra na lista (some do stepper)', () => {
    const board = [
      row({ fixture_id: 17, kickoff_utc: '2026-08-12T22:00:00' }),
      row({ fixture_id: 18, kickoff_utc: '2026-08-13T22:00:00' }),
    ];
    const hist = [row({ fixture_id: 18, kickoff_utc: '2026-08-13T22:00:00' })];
    const dias = new Set(mergeBoardAndHistory(board, hist, NOW).map((r) => brtDay(r.kickoff_utc)));
    expect([...dias]).toEqual(['2026-08-13']);
  });

  it('brtDayFromMs concorda com brtDay', () => {
    expect(brtDayFromMs(NOW)).toBe(TODAY);
  });
});
