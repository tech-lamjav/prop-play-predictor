/**
 * Testes dos helpers puros de deadline.
 * Funções testadas:
 *  - computeMatchDeadline (5 modos: per_match | per_day | per_round | per_stage | tournament_start)
 *  - getNextDeadline (escolhe o próximo prazo válido)
 *  - formatDeadlineRelative (rotulagem em português)
 *  - isDeadlineUrgent (<1h pulsante)
 *  - isMatchPredictionLocked (combina tudo + is_closed/is_finished)
 *
 * Os helpers não dependem de React nem Supabase — testes super rápidos.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  computeMatchDeadline,
  getNextDeadline,
  formatDeadlineRelative,
  isDeadlineUrgent,
  isMatchPredictionLocked,
} from './use-bolao';
import type { WcMatch } from '@/services/bolao.service';

// Helper pra construir um WcMatch fake só com os campos relevantes
function fakeMatch(partial: Partial<WcMatch>): WcMatch {
  return {
    id: 1,
    match_number: 1,
    stage: 'group',
    group_name: null,
    home_team: 'Team A',
    away_team: 'Team B',
    home_team_code: 'AAA',
    away_team_code: 'BBB',
    match_date: '2026-06-11',
    match_time_brasilia: '13:00:00',
    venue: null,
    city: null,
    home_score: null,
    away_score: null,
    is_finished: false,
    home_team_is_b2b_game: false,
    visitor_team_is_b2b_game: false,
    game_datetime_brasilia: null,
    ...partial,
  } as unknown as WcMatch;
}

describe('computeMatchDeadline', () => {
  it('per_match → retorna kickoff do próprio jogo', () => {
    const match = fakeMatch({ id: 1, match_date: '2026-06-15', match_time_brasilia: '16:00:00' });
    const deadline = computeMatchDeadline(match, 'per_match', [match]);
    // 16:00 em Brasília = 19:00 UTC
    expect(deadline.toISOString()).toBe('2026-06-15T19:00:00.000Z');
  });

  it('per_stage → retorna kickoff do PRIMEIRO jogo da MESMA fase', () => {
    const target  = fakeMatch({ id: 3, stage: 'group', match_date: '2026-06-15', match_time_brasilia: '16:00:00' });
    const earlier = fakeMatch({ id: 1, stage: 'group', match_date: '2026-06-11', match_time_brasilia: '13:00:00' });
    const later   = fakeMatch({ id: 2, stage: 'group', match_date: '2026-06-12', match_time_brasilia: '16:00:00' });
    // Outra fase, mesmo dia mais cedo — não pode interferir
    const otherStage = fakeMatch({ id: 99, stage: 'final', match_date: '2026-06-10', match_time_brasilia: '10:00:00' });
    const all = [target, earlier, later, otherStage];

    const deadline = computeMatchDeadline(target, 'per_stage', all);
    expect(deadline.toISOString()).toBe('2026-06-11T16:00:00.000Z'); // 13h Brasília = 16h UTC
  });

  it('per_day → retorna kickoff do PRIMEIRO jogo do MESMO dia', () => {
    const target = fakeMatch({ id: 3, match_date: '2026-06-12', match_time_brasilia: '20:00:00' });
    const sameDayEarlier = fakeMatch({ id: 1, match_date: '2026-06-12', match_time_brasilia: '13:00:00' });
    const otherDay = fakeMatch({ id: 99, match_date: '2026-06-11', match_time_brasilia: '10:00:00' });
    const all = [target, sameDayEarlier, otherDay];

    const deadline = computeMatchDeadline(target, 'per_day', all);
    expect(deadline.toISOString()).toBe('2026-06-12T16:00:00.000Z'); // 13h Brasília = 16h UTC
  });

  it('per_round (group) → retorna kickoff do PRIMEIRO jogo da rodada (R1/R2/R3)', () => {
    // Grupo A: 6 jogos. R1 = primeiros 2 (cronológicos), R2 = 3-4, R3 = 5-6
    const a1 = fakeMatch({ id: 1, stage: 'group', group_name: 'A', match_date: '2026-06-11', match_time_brasilia: '13:00:00' });
    const a2 = fakeMatch({ id: 2, stage: 'group', group_name: 'A', match_date: '2026-06-11', match_time_brasilia: '16:00:00' });
    const a3 = fakeMatch({ id: 3, stage: 'group', group_name: 'A', match_date: '2026-06-15', match_time_brasilia: '13:00:00' });
    const a4 = fakeMatch({ id: 4, stage: 'group', group_name: 'A', match_date: '2026-06-15', match_time_brasilia: '16:00:00' });
    // Grupo B: também 6 jogos, com R1 começando antes do A
    const b1 = fakeMatch({ id: 11, stage: 'group', group_name: 'B', match_date: '2026-06-10', match_time_brasilia: '20:00:00' });
    const b2 = fakeMatch({ id: 12, stage: 'group', group_name: 'B', match_date: '2026-06-11', match_time_brasilia: '10:00:00' });
    const b3 = fakeMatch({ id: 13, stage: 'group', group_name: 'B', match_date: '2026-06-15', match_time_brasilia: '10:00:00' });
    const b4 = fakeMatch({ id: 14, stage: 'group', group_name: 'B', match_date: '2026-06-15', match_time_brasilia: '20:00:00' });
    const all = [a1, a2, a3, a4, b1, b2, b3, b4];

    // a3 é R2 do grupo A. Deadline = primeiro kickoff da R2 (incluindo b3 do grupo B = 10h)
    const deadline = computeMatchDeadline(a3, 'per_round', all);
    expect(deadline.toISOString()).toBe('2026-06-15T13:00:00.000Z'); // 10h Brasília = 13h UTC
  });

  it('per_round (knockout) → cada stage é uma rodada própria', () => {
    const oitavas1 = fakeMatch({ id: 73, stage: 'round_of_32', match_date: '2026-06-27', match_time_brasilia: '13:00:00' });
    const oitavas2 = fakeMatch({ id: 74, stage: 'round_of_32', match_date: '2026-06-27', match_time_brasilia: '16:00:00' });
    const quartas = fakeMatch({ id: 89, stage: 'quarter', match_date: '2026-07-08', match_time_brasilia: '13:00:00' });
    const all = [oitavas1, oitavas2, quartas];

    const deadline = computeMatchDeadline(oitavas2, 'per_round', all);
    expect(deadline.toISOString()).toBe('2026-06-27T16:00:00.000Z'); // 13h Brasília = 16h UTC
  });

  it('tournament_start → retorna kickoff do PRIMEIRO jogo de toda a Copa', () => {
    const target  = fakeMatch({ id: 30, stage: 'final', match_date: '2026-07-19', match_time_brasilia: '16:00:00' });
    const opener  = fakeMatch({ id: 1, stage: 'group', match_date: '2026-06-11', match_time_brasilia: '13:00:00' });
    const middle  = fakeMatch({ id: 15, stage: 'group', match_date: '2026-06-20', match_time_brasilia: '13:00:00' });
    const all = [target, opener, middle];

    const deadline = computeMatchDeadline(target, 'tournament_start', all);
    expect(deadline.toISOString()).toBe('2026-06-11T16:00:00.000Z');
  });

  it('fallback → quando allMatches vazio, devolve kickoff do próprio jogo', () => {
    const match = fakeMatch({ match_date: '2026-06-15', match_time_brasilia: '20:00:00' });
    const deadline = computeMatchDeadline(match, 'per_round', undefined);
    expect(deadline.toISOString()).toBe('2026-06-15T23:00:00.000Z');
  });
});

describe('getNextDeadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T15:00:00Z')); // 12h Brasília
  });
  afterEach(() => vi.useRealTimers());

  it('retorna null se o bolão está fechado', () => {
    const match = fakeMatch({});
    expect(getNextDeadline('per_match', [match], true)).toBeNull();
  });

  it('retorna null se não há jogos', () => {
    expect(getNextDeadline('per_match', [], false)).toBeNull();
    expect(getNextDeadline('per_match', undefined, false)).toBeNull();
  });

  it('escolhe o jogo cujo deadline é o mais próximo no futuro', () => {
    const past   = fakeMatch({ id: 1, match_date: '2026-06-11', match_time_brasilia: '13:00:00', is_finished: true });
    const next   = fakeMatch({ id: 2, match_date: '2026-06-12', match_time_brasilia: '16:00:00' });
    const later  = fakeMatch({ id: 3, match_date: '2026-06-15', match_time_brasilia: '16:00:00' });

    const result = getNextDeadline('per_match', [past, next, later], false);
    expect(result?.match.id).toBe(2);
    expect(result?.deadline.toISOString()).toBe('2026-06-12T19:00:00.000Z');
  });

  it('ignora jogos finalizados (mesmo se kickoff é no futuro)', () => {
    const finished = fakeMatch({ id: 1, match_date: '2026-06-12', match_time_brasilia: '16:00:00', is_finished: true });
    const next     = fakeMatch({ id: 2, match_date: '2026-06-15', match_time_brasilia: '16:00:00' });

    const result = getNextDeadline('per_match', [finished, next], false);
    expect(result?.match.id).toBe(2);
  });

  it('retorna null se todos os deadlines já passaram', () => {
    // now = 2026-06-12 15:00 UTC. Esses jogos já são passado.
    const past1 = fakeMatch({ id: 1, match_date: '2026-06-11', match_time_brasilia: '13:00:00' });
    const past2 = fakeMatch({ id: 2, match_date: '2026-06-12', match_time_brasilia: '10:00:00' });
    expect(getNextDeadline('per_match', [past1, past2], false)).toBeNull();
  });
});

describe('formatDeadlineRelative', () => {
  const now = new Date('2026-06-12T18:00:00-03:00'); // 12 jun, 18h Brasília

  it('"Encerrado" quando o deadline já passou', () => {
    const past = new Date('2026-06-12T17:00:00-03:00');
    expect(formatDeadlineRelative(past, now)).toBe('Encerrado');
  });

  it('em minutos quando faltam <1h', () => {
    const target = new Date('2026-06-12T18:47:00-03:00'); // +47min
    expect(formatDeadlineRelative(target, now)).toBe('47min');
  });

  it('em horas+minutos quando faltam de 1h a <12h', () => {
    const target = new Date('2026-06-12T20:15:00-03:00'); // +2h15min
    expect(formatDeadlineRelative(target, now)).toBe('2h 15min');
  });

  it('em horas redondas quando minutos = 0', () => {
    const target = new Date('2026-06-12T21:00:00-03:00'); // +3h
    expect(formatDeadlineRelative(target, now)).toBe('3h');
  });

  it('"Hoje HH:MM" quando é mesmo dia mas >12h', () => {
    // Caso borderline: poderia precisar de tomorrow se >12h sai do dia
    const lateNow = new Date('2026-06-12T08:00:00-03:00'); // 8h da manhã
    const target  = new Date('2026-06-12T22:00:00-03:00'); // 22h, mesmo dia, +14h
    expect(formatDeadlineRelative(target, lateNow)).toBe('Hoje 22:00');
  });

  it('"Amanhã HH:MM" quando o dia seguinte', () => {
    const target = new Date('2026-06-13T22:00:00-03:00'); // dia seguinte
    expect(formatDeadlineRelative(target, now)).toBe('Amanhã 22:00');
  });

  it('formato completo "DD/MM HH:MM" quando >2 dias', () => {
    const target = new Date('2026-06-23T20:00:00-03:00');
    expect(formatDeadlineRelative(target, now)).toBe('23/06 20:00');
  });
});

describe('isDeadlineUrgent', () => {
  const now = new Date('2026-06-12T18:00:00-03:00');

  it('true quando faltam <1h', () => {
    const target = new Date('2026-06-12T18:30:00-03:00');
    expect(isDeadlineUrgent(target, now)).toBe(true);
  });

  it('false quando faltam exatamente 1h ou mais', () => {
    const target = new Date('2026-06-12T19:00:00-03:00');
    expect(isDeadlineUrgent(target, now)).toBe(false);
  });

  it('false quando o deadline já passou', () => {
    const past = new Date('2026-06-12T17:00:00-03:00');
    expect(isDeadlineUrgent(past, now)).toBe(false);
  });
});

describe('isMatchPredictionLocked', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T15:00:00Z')); // 12h Brasília
  });
  afterEach(() => vi.useRealTimers());

  it('lock quando match.is_finished', () => {
    const m = fakeMatch({ is_finished: true, match_date: '2027-01-01' });
    expect(isMatchPredictionLocked(m, 'per_match', [m], false)).toBe(true);
  });

  it('NAO lock quando bolao tem inscricoes encerradas (is_closed nao afeta palpites)', () => {
    // is_closed eh sobre NOVAS inscricoes, nao sobre palpites de quem
    // ja esta no bolao. Match futuro continua palpitavel.
    const m = fakeMatch({ match_date: '2027-01-01' });
    expect(isMatchPredictionLocked(m, 'per_match', [m], true)).toBe(false);
  });

  it('lock quando deadline já passou (per_match)', () => {
    const m = fakeMatch({ match_date: '2026-06-12', match_time_brasilia: '10:00:00' });
    expect(isMatchPredictionLocked(m, 'per_match', [m], false)).toBe(true);
  });

  it('aberto quando deadline ainda no futuro', () => {
    const m = fakeMatch({ match_date: '2026-06-15', match_time_brasilia: '16:00:00' });
    expect(isMatchPredictionLocked(m, 'per_match', [m], false)).toBe(false);
  });

  it('per_stage: bloqueia mesmo um jogo futuro se o 1º da fase já começou', () => {
    const past   = fakeMatch({ id: 1, stage: 'group', group_name: 'A', match_date: '2026-06-11', match_time_brasilia: '13:00:00', is_finished: true });
    const future = fakeMatch({ id: 2, stage: 'group', group_name: 'A', match_date: '2026-06-15', match_time_brasilia: '16:00:00' });
    expect(isMatchPredictionLocked(future, 'per_stage', [past, future], false)).toBe(true);
  });

  it('tournament_start: bloqueia tudo se a Copa já começou', () => {
    const opener = fakeMatch({ id: 1, match_date: '2026-06-11', match_time_brasilia: '13:00:00', is_finished: true });
    const future = fakeMatch({ id: 2, stage: 'final', match_date: '2026-07-19', match_time_brasilia: '16:00:00' });
    expect(isMatchPredictionLocked(future, 'tournament_start', [opener, future], false)).toBe(true);
  });
});
