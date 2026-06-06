import { describe, it, expect } from 'vitest';
import { parseSlot, matchThirds, resolveBracket, type BracketPicks } from './bracket';
import type { WcMatch } from '@/services/bolao.service';
import type { ProjectionResult, GroupProjection } from './group-projection';

// ── Helpers ────────────────────────────────────────────────────────
function ko(match_number: number, stage: string, home: string, away: string): WcMatch {
  return {
    id: match_number, match_number, stage, group_name: null,
    home_team: home, away_team: away, home_team_code: 'TBD', away_team_code: 'TBD',
  } as unknown as WcMatch;
}

/** Monta ProjectionResult a partir de { grupo: [codigos em ordem 1..4] } + terceiros classificados. */
function projection(groups: Record<string, string[]>, thirdsIn: { code: string; group: string }[]): ProjectionResult {
  const gps: GroupProjection[] = Object.entries(groups).map(([group, codes]) => ({
    group,
    complete: true,
    standings: codes.map((code, i) => ({
      code, played: 3, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0,
      position: i + 1, status: i < 2 ? 'direct' : i === 2 ? 'third_in' : 'out',
    })),
  }));
  return {
    groups: gps,
    qualifiers: [],
    thirdsRanked: thirdsIn.map((t) => ({ code: t.code, group: t.group, in: true })),
    complete: true,
  };
}

const emptyPicks: BracketPicks = { round_of_16: [], quarterfinalist: [], semifinalist: [], finalist: [], champion: null };

// ── Testes ─────────────────────────────────────────────────────────
describe('parseSlot', () => {
  it('parseia os 4 tipos de slot', () => {
    expect(parseSlot('1º Grupo E')).toEqual({ kind: 'group_pos', pos: 1, group: 'E' });
    expect(parseSlot('2º Grupo B')).toEqual({ kind: 'group_pos', pos: 2, group: 'B' });
    expect(parseSlot('3º Grupo ABCDF')).toEqual({ kind: 'third', groups: ['A', 'B', 'C', 'D', 'F'] });
    expect(parseSlot('Vencedor J74')).toEqual({ kind: 'winner', match: 74 });
    expect(parseSlot('Perdedor J101')).toEqual({ kind: 'loser', match: 101 });
  });
});

describe('matchThirds', () => {
  it('emparelha respeitando grupos permitidos (precisa de backtracking)', () => {
    // slot1 aceita A ou B; slot2 aceita só A. Atribuição válida: slot2←A3, slot1←B3.
    const res = matchThirds(
      [{ matchNumber: 1, groups: ['A', 'B'] }, { matchNumber: 2, groups: ['A'] }],
      [{ code: 'A3', group: 'A' }, { code: 'B3', group: 'B' }]
    );
    expect(res).not.toBeNull();
    expect(res!.get(2)).toBe('A3');
    expect(res!.get(1)).toBe('B3');
  });
});

describe('resolveBracket', () => {
  it('resolve 16 avos (grupo + terceiro), vencedor e feeder das oitavas', () => {
    const matches = [
      ko(1, 'round_of_32', '1º Grupo A', '2º Grupo B'),
      ko(2, 'round_of_32', '1º Grupo C', '3º Grupo ABC'),
      ko(3, 'round_of_16', 'Vencedor J1', 'Vencedor J2'),
    ];
    const proj = projection(
      { A: ['A1', 'A2', 'A3', 'A4'], B: ['B1', 'B2', 'B3', 'B4'], C: ['C1', 'C2', 'C3', 'C4'] },
      [{ code: 'A3', group: 'A' }]
    );
    const picks: BracketPicks = { ...emptyPicks, round_of_16: ['A1', 'C1'], quarterfinalist: ['A1'] };
    const r = resolveBracket(matches, proj, picks);
    const byNum = new Map(r.map((m) => [m.match_number, m]));

    expect(byNum.get(1)!.home.code).toBe('A1');
    expect(byNum.get(1)!.away.code).toBe('B2');
    expect(byNum.get(1)!.winner).toBe('A1');
    expect(byNum.get(2)!.away.code).toBe('A3');  // terceiro emparelhado
    expect(byNum.get(2)!.winner).toBe('C1');
    // oitavas: participantes = vencedores dos 16 avos
    expect(byNum.get(3)!.home.code).toBe('A1');
    expect(byNum.get(3)!.away.code).toBe('C1');
    expect(byNum.get(3)!.winner).toBe('A1'); // A1 está em quarterfinalist
  });

  it('resolve final (campeão) e disputa de 3º lugar (perdedores das semis)', () => {
    const matches = [
      ko(10, 'semi', '1º Grupo A', '1º Grupo B'),
      ko(11, 'semi', '1º Grupo C', '1º Grupo D'),
      ko(12, 'final', 'Vencedor J10', 'Vencedor J11'),
      ko(13, 'third_place', 'Perdedor J10', 'Perdedor J11'),
    ];
    const proj = projection(
      { A: ['A1', 'A2'], B: ['B1', 'B2'], C: ['C1', 'C2'], D: ['D1', 'D2'] }, []
    );
    const picks: BracketPicks = { ...emptyPicks, finalist: ['A1', 'C1'], champion: 'A1' };
    const r = resolveBracket(matches, proj, picks);
    const byNum = new Map(r.map((m) => [m.match_number, m]));

    expect(byNum.get(10)!.winner).toBe('A1'); // finalist
    expect(byNum.get(11)!.winner).toBe('C1');
    expect(byNum.get(12)!.home.code).toBe('A1');
    expect(byNum.get(12)!.away.code).toBe('C1');
    expect(byNum.get(12)!.winner).toBe('A1'); // campeão
    // 3º lugar = perdedores das semis
    expect(byNum.get(13)!.home.code).toBe('B1'); // perdedor de J10 (A1 venceu)
    expect(byNum.get(13)!.away.code).toBe('D1'); // perdedor de J11 (C1 venceu)
  });

  it('vencedor fica indefinido quando a fase seguinte não decide', () => {
    const matches = [ko(1, 'round_of_32', '1º Grupo A', '2º Grupo B')];
    const proj = projection({ A: ['A1', 'A2'], B: ['B1', 'B2'] }, []);
    const r = resolveBracket(matches, proj, emptyPicks);
    expect(r[0].winner).toBeNull();
    expect(r[0].home.code).toBe('A1');
  });
});
