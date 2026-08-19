import { describe, it, expect } from 'vitest';
import {
  mergeBoardAndHistory,
  opportunityKey,
  historyWindow,
  HISTORY_WINDOW_DAYS,
} from './futebol-history';
import type { FutebolValueBoardRow } from '@/services/futebol-data.service';

// Testes portados do PR #259 do Matheus e estendidos. A regra que eles guardam:
// passado é território da foto do apito, futuro é do board, e HOJE depende de a
// bola já ter rolado. É a única parte da fusão que dá pra testar sem tela.

// 2026-08-18 15:00 BRT = 18:00 UTC. Um horário de tarde de propósito: com ele o
// mesmo dia BRT tem jogo antes e depois de agora.
const AGORA = Date.parse('2026-08-18T18:00:00Z');
const HOJE = '2026-08-18';

function linha(over: Partial<FutebolValueBoardRow> & { kickoff_utc: string }): FutebolValueBoardRow {
  return {
    fixture_id: 1, home_team_id: 10, away_team_id: 20,
    home_team_name: 'Casa', away_team_name: 'Fora', competition: 'brasileirao',
    status_short: 'NS', market: 'match_winner', outcome: 'Home', line_value: null,
    edge: 5, best_odd: 2, best_book: 'x', avg_odd: 1.9, n_casas: 8,
    janela_usada: 't24h', prob_justa_fechamento: 0.5,
    pts_valor: 10, pts_premissas: 10, pts_corroboracao: 0, penalidades: 0,
    score: 50, faixa: 'Média', evidencias: [], premissas_sem_dado: 0,
    ...over,
  } as FutebolValueBoardRow;
}

describe('opportunityKey', () => {
  it('separa mercados diferentes do mesmo jogo', () => {
    const a = opportunityKey({ fixture_id: 1, market: 'match_winner', outcome: 'Home', line_value: null });
    const b = opportunityKey({ fixture_id: 1, market: 'goals_over_under', outcome: 'Over', line_value: 2.5 });
    expect(a).not.toBe(b);
  });

  it('separa linhas diferentes do mesmo mercado', () => {
    const a = opportunityKey({ fixture_id: 1, market: 'goals_over_under', outcome: 'Over', line_value: 2.5 });
    const b = opportunityKey({ fixture_id: 1, market: 'goals_over_under', outcome: 'Over', line_value: 3.5 });
    expect(a).not.toBe(b);
  });

  it('trata linha nula e ausente como a mesma coisa', () => {
    const a = opportunityKey({ fixture_id: 1, market: 'btts', outcome: 'Yes', line_value: null });
    const b = opportunityKey({ fixture_id: 1, market: 'btts', outcome: 'Yes', line_value: null });
    expect(a).toBe(b);
  });
});

describe('historyWindow', () => {
  it('cobre 30 dias contando hoje', () => {
    const { from, to } = historyWindow('2026-08-18');
    expect(to).toBe('2026-08-18');
    expect(from).toBe('2026-07-20'); // 18/08 menos 29 dias
    expect(HISTORY_WINDOW_DAYS).toBe(30);
  });

  it('atravessa virada de mês sem quebrar', () => {
    expect(historyWindow('2026-03-01').from).toBe('2026-01-31');
  });
});

describe('mergeBoardAndHistory', () => {
  it('dia passado vem só do histórico, nunca do board', () => {
    const board = [linha({ kickoff_utc: '2026-08-10T20:00:00', score: 99 })];
    const hist = [linha({ kickoff_utc: '2026-08-10T20:00:00', score: 44 })];
    const r = mergeBoardAndHistory(board, hist, AGORA);
    expect(r).toHaveLength(1);
    expect(r[0].score).toBe(44); // a nota publicada, não a recalculada
  });

  // O coração do conserto: linha que o board inventou depois do jogo não tem
  // versão viva no apito, então não existe no histórico e some da tela.
  it('linha que só o board tem no passado desaparece', () => {
    const board = [linha({ kickoff_utc: '2026-08-10T20:00:00' })];
    const r = mergeBoardAndHistory(board, [], AGORA);
    expect(r).toHaveLength(0);
  });

  it('dia futuro vem só do board', () => {
    const board = [linha({ kickoff_utc: '2026-08-25T20:00:00', score: 70 })];
    const r = mergeBoardAndHistory(board, [], AGORA);
    expect(r).toHaveLength(1);
    expect(r[0].score).toBe(70);
  });

  // Sem esta regra, o jogo das 16h sumiria da tela às 16h05 e só voltaria no
  // dia seguinte, porque o board (pós-expurgo) larga a linha no apito.
  it('hoje, jogo que JÁ COMEÇOU vence pelo histórico', () => {
    const kickoff = '2026-08-18T17:00:00'; // 1h atrás
    const board = [linha({ kickoff_utc: kickoff, score: 88 })];
    const hist = [linha({ kickoff_utc: kickoff, score: 55 })];
    const r = mergeBoardAndHistory(board, hist, AGORA);
    expect(r).toHaveLength(1);
    expect(r[0].score).toBe(55);
  });

  it('hoje, jogo que AINDA NÃO começou vence pelo board', () => {
    const kickoff = '2026-08-18T22:00:00'; // daqui a 4h
    const board = [linha({ kickoff_utc: kickoff, score: 88 })];
    const hist = [linha({ kickoff_utc: kickoff, score: 55 })];
    const r = mergeBoardAndHistory(board, hist, AGORA);
    expect(r).toHaveLength(1);
    expect(r[0].score).toBe(88);
  });

  it('hoje, nunca duplica a mesma oportunidade', () => {
    const kickoff = '2026-08-18T17:00:00';
    const r = mergeBoardAndHistory(
      [linha({ kickoff_utc: kickoff })],
      [linha({ kickoff_utc: kickoff })],
      AGORA,
    );
    expect(r).toHaveLength(1);
  });

  it('hoje, jogo que começou e só o histórico tem continua aparecendo', () => {
    const kickoff = '2026-08-18T17:00:00';
    const r = mergeBoardAndHistory([], [linha({ kickoff_utc: kickoff, score: 33 })], AGORA);
    expect(r).toHaveLength(1);
    expect(r[0].score).toBe(33);
  });

  it('hoje, jogo que não começou e só o histórico tem não é descartado', () => {
    const kickoff = '2026-08-18T22:00:00';
    const r = mergeBoardAndHistory([], [linha({ kickoff_utc: kickoff, score: 33 })], AGORA);
    expect(r).toHaveLength(1);
  });

  it('mercados diferentes do mesmo jogo não se canibalizam', () => {
    const kickoff = '2026-08-18T17:00:00';
    const r = mergeBoardAndHistory(
      [linha({ kickoff_utc: kickoff, market: 'match_winner' })],
      [
        linha({ kickoff_utc: kickoff, market: 'match_winner' }),
        linha({ kickoff_utc: kickoff, market: 'goals_over_under', outcome: 'Over', line_value: 2.5 }),
      ],
      AGORA,
    );
    expect(r).toHaveLength(2);
  });

  // 21:30 BRT é 00:30 UTC do dia seguinte, horário de metade do calendário
  // brasileiro. Agrupar por dia UTC jogaria esse jogo pro dia errado.
  it('jogo noturno conta no dia de Brasília, não no dia UTC', () => {
    // 2026-08-17 21:30 BRT = 2026-08-18 00:30 UTC → é dia 17, e é passado.
    const hist = [linha({ kickoff_utc: '2026-08-18T00:30:00', score: 41 })];
    const board = [linha({ kickoff_utc: '2026-08-18T00:30:00', score: 99 })];
    const r = mergeBoardAndHistory(board, hist, AGORA);
    expect(r).toHaveLength(1);
    expect(r[0].score).toBe(41); // tratado como passado, então veio do histórico
  });

  it('linha sem kickoff é ignorada em vez de derrubar a lista', () => {
    const r = mergeBoardAndHistory(
      [linha({ kickoff_utc: null as unknown as string })],
      [linha({ kickoff_utc: '2026-08-10T20:00:00' })],
      AGORA,
    );
    expect(r).toHaveLength(1);
  });

  it('duas listas vazias devolvem lista vazia', () => {
    expect(mergeBoardAndHistory([], [], AGORA)).toEqual([]);
  });
});
