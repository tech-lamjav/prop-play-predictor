import { describe, it, expect } from 'vitest';
import { specialDeadline, isSpecialLocked, formatDeadlineLabel } from './special-deadlines';
import type { WcMatch } from '@/services/bolao.service';

function m(stage: WcMatch['stage'], date: string, time: string): WcMatch {
  return {
    stage,
    match_date: date,
    match_time_brasilia: time,
  } as unknown as WcMatch;
}

// Calendário enxuto: abertura no grupo, depois cada fase do mata-mata.
const MATCHES: WcMatch[] = [
  m('group', '2026-06-11', '16:00:00'),
  m('group', '2026-06-12', '13:00:00'),
  m('round_of_32', '2026-06-28', '16:00:00'),
  m('round_of_32', '2026-06-29', '13:00:00'),
  m('round_of_16', '2026-07-04', '14:00:00'),
  m('quarter', '2026-07-09', '17:00:00'),
  m('semi', '2026-07-14', '16:00:00'),
  m('final', '2026-07-19', '16:00:00'),
];

const ms = (iso: string) => new Date(iso).getTime();

describe('specialDeadline', () => {
  it('16 avos e oitavas travam no início do mata-mata (1º round_of_32)', () => {
    expect(specialDeadline('round_of_32', MATCHES)?.toISOString()).toBe('2026-06-28T19:00:00.000Z');
    expect(specialDeadline('round_of_16', MATCHES)?.toISOString()).toBe('2026-06-28T19:00:00.000Z');
  });

  it('cada fase trava no início da fase que a decide', () => {
    expect(specialDeadline('quarterfinalist', MATCHES)?.toISOString()).toBe('2026-07-04T17:00:00.000Z');
    expect(specialDeadline('semifinalist', MATCHES)?.toISOString()).toBe('2026-07-09T20:00:00.000Z');
    expect(specialDeadline('finalist', MATCHES)?.toISOString()).toBe('2026-07-14T19:00:00.000Z');
    expect(specialDeadline('champion', MATCHES)?.toISOString()).toBe('2026-07-19T19:00:00.000Z');
  });

  it('prêmios de jogador travam na abertura da Copa (1º jogo de todos)', () => {
    expect(specialDeadline('top_scorer', MATCHES)?.toISOString()).toBe('2026-06-11T19:00:00.000Z');
    expect(specialDeadline('best_player', MATCHES)?.toISOString()).toBe('2026-06-11T19:00:00.000Z');
  });

  it('retorna null sem jogos da fase decisiva', () => {
    const semFinal = MATCHES.filter((x) => x.stage !== 'final');
    expect(specialDeadline('champion', semFinal)).toBeNull();
    expect(specialDeadline('round_of_32', [])).toBeNull();
  });

  it('mode "opening": tudo trava na abertura da Copa', () => {
    const cfg = { mode: 'opening' as const };
    expect(specialDeadline('round_of_32', MATCHES, cfg)?.toISOString()).toBe('2026-06-11T19:00:00.000Z');
    expect(specialDeadline('champion', MATCHES, cfg)?.toISOString()).toBe('2026-06-11T19:00:00.000Z');
  });

  it('override por tipo vence o preset', () => {
    const cfg = { mode: 'rolling' as const, overrides: { champion: '2026-07-15T20:00:00-03:00' } };
    expect(specialDeadline('champion', MATCHES, cfg)?.toISOString()).toBe('2026-07-15T23:00:00.000Z');
    // tipos sem override seguem o preset normal
    expect(specialDeadline('round_of_32', MATCHES, cfg)?.toISOString()).toBe('2026-06-28T19:00:00.000Z');
  });

  it('modo real: bracket de quem avança (16 avos → finalistas) trava no início do mata-mata', () => {
    const KO = '2026-06-28T19:00:00.000Z'; // 1º round_of_32
    expect(specialDeadline('round_of_32', MATCHES, null, true)?.toISOString()).toBe(KO);
    expect(specialDeadline('quarterfinalist', MATCHES, null, true)?.toISOString()).toBe(KO);
    expect(specialDeadline('finalist', MATCHES, null, true)?.toISOString()).toBe(KO);
    // campeão fica de fora: mantém o prazo próprio (rolling → 1º jogo da final)
    expect(specialDeadline('champion', MATCHES, null, true)?.toISOString()).toBe('2026-07-19T19:00:00.000Z');
    // prêmios de jogador não são bracket → seguem abertura da Copa
    expect(specialDeadline('top_scorer', MATCHES, null, true)?.toISOString()).toBe('2026-06-11T19:00:00.000Z');
    // override ainda vence, mesmo no modo real
    const cfg = { overrides: { finalist: '2026-07-15T20:00:00-03:00' } };
    expect(specialDeadline('finalist', MATCHES, cfg, true)?.toISOString()).toBe('2026-07-15T23:00:00.000Z');
  });
});

describe('isSpecialLocked', () => {
  it('trava só depois do prazo', () => {
    expect(isSpecialLocked('champion', MATCHES, undefined, ms('2026-07-19T18:59:00Z'))).toBe(false);
    expect(isSpecialLocked('champion', MATCHES, undefined, ms('2026-07-19T19:00:00Z'))).toBe(true);
    expect(isSpecialLocked('top_scorer', MATCHES, undefined, ms('2026-06-12T00:00:00Z'))).toBe(true);
  });

  it('respeita override ao decidir lock', () => {
    const cfg = { mode: 'rolling' as const, overrides: { champion: '2026-07-15T20:00:00-03:00' } };
    expect(isSpecialLocked('champion', MATCHES, cfg, ms('2026-07-15T22:59:00Z'))).toBe(false);
    expect(isSpecialLocked('champion', MATCHES, cfg, ms('2026-07-15T23:00:00Z'))).toBe(true);
  });
});

describe('formatDeadlineLabel', () => {
  it('mostra data em BRT antes do prazo e "encerrado" depois', () => {
    expect(formatDeadlineLabel('champion', MATCHES, undefined, ms('2026-06-01T00:00:00Z'))).toBe('fecha 19/07 16h');
    expect(formatDeadlineLabel('champion', MATCHES, undefined, ms('2026-07-20T00:00:00Z'))).toBe('encerrado');
  });
});
