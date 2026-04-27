/**
 * Testes dos helpers puros de deadline.
 * Funções testadas:
 *  - computeMatchDeadline (3 modos: per_match | per_round | tournament_start)
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

  it('per_round → retorna kickoff do PRIMEIRO jogo da MESMA fase', () => {
    const target  = fakeMatch({ id: 3, stage: 'group', match_date: '2026-06-15', match_time_brasilia: '16:00:00' });
    const earlier = fakeMatch({ id: 1, stage: 'group', match_date: '2026-06-11', match_time_brasilia: '13:00:00' });
    const later   = fakeMatch({ id: 2, stage: 'group', match_date: '2026-06-12', match_time_brasilia: '16:00:00' });
    // Outra fase, mesmo dia mais cedo — não pode interferir
    const otherStage = fakeMatch({ id: 99, stage: 'final', match_date: '2026-06-10', match_time_brasilia: '10:00:00' });
    const all = [target, earlier, later, otherStage];

    const deadline = computeMatchDeadline(target, 'per_round', all);
    expect(deadline.toISOString()).toBe('2026-06-11T16:00:00.000Z'); // 13h Brasília = 16h UTC
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

  it('lock quando bolao está fechado', () => {
    const m = fakeMatch({ match_date: '2027-01-01' });
    expect(isMatchPredictionLocked(m, 'per_match', [m], true)).toBe(true);
  });

  it('lock quando deadline já passou (per_match)', () => {
    const m = fakeMatch({ match_date: '2026-06-12', match_time_brasilia: '10:00:00' });
    expect(isMatchPredictionLocked(m, 'per_match', [m], false)).toBe(true);
  });

  it('aberto quando deadline ainda no futuro', () => {
    const m = fakeMatch({ match_date: '2026-06-15', match_time_brasilia: '16:00:00' });
    expect(isMatchPredictionLocked(m, 'per_match', [m], false)).toBe(false);
  });

  it('per_round: bloqueia mesmo um jogo futuro se o 1º da fase já começou', () => {
    const past   = fakeMatch({ id: 1, stage: 'group', match_date: '2026-06-11', match_time_brasilia: '13:00:00', is_finished: true });
    const future = fakeMatch({ id: 2, stage: 'group', match_date: '2026-06-15', match_time_brasilia: '16:00:00' });
    expect(isMatchPredictionLocked(future, 'per_round', [past, future], false)).toBe(true);
  });

  it('tournament_start: bloqueia tudo se a Copa já começou', () => {
    const opener = fakeMatch({ id: 1, match_date: '2026-06-11', match_time_brasilia: '13:00:00', is_finished: true });
    const future = fakeMatch({ id: 2, stage: 'final', match_date: '2026-07-19', match_time_brasilia: '16:00:00' });
    expect(isMatchPredictionLocked(future, 'tournament_start', [opener, future], false)).toBe(true);
  });
});
