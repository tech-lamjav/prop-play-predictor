/**
 * Testes do resolver — caminho persona (delega ao generator) + caminho
 * copy (busca palpites de outro bolão e mapeia pros matches válidos).
 *
 * Foca no contrato: filtro de mode (pendentes/substituir) + skip de
 * matches finalizados/TBD no copy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveQuickPickPayload } from './quick-pick-resolver';
import type { BolaoPrediction, WcMatch } from '@/services/bolao.service';

vi.mock('@/services/bolao.service', () => ({
  bolaoService: {
    getPredictions: vi.fn(),
  },
}));

import { bolaoService } from '@/services/bolao.service';
const mockedGet = vi.mocked(bolaoService.getPredictions);

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

function fakePred(matchId: number, home: number, away: number): BolaoPrediction {
  return {
    id: `p${matchId}`,
    bolao_id: 'src',
    user_id: 'u1',
    match_id: matchId,
    predicted_home_score: home,
    predicted_away_score: away,
    points_earned: null,
  } as unknown as BolaoPrediction;
}

beforeEach(() => {
  mockedGet.mockReset();
});

describe('resolveQuickPickPayload — kind: persona', () => {
  it('mode=substituir gera pra todos os matches válidos', async () => {
    const matches = [
      fakeMatch({ id: 1 }),
      fakeMatch({ id: 2, home_team_code: 'GER', away_team_code: 'JPN' }),
    ];
    const out = await resolveQuickPickPayload(
      { kind: 'persona', persona: 'fixed', mode: 'substituir', fixedScore: { home: 2, away: 1 } },
      { matches, existingPredictions: [], destBolaoId: 'dest', userId: 'u1' }
    );
    expect(out).toHaveLength(2);
    expect(out.every((p) => p.predicted_home_score === 2 && p.predicted_away_score === 1)).toBe(true);
  });

  it('mode=pendentes pula matches que já têm palpite no destino', async () => {
    const matches = [
      fakeMatch({ id: 1 }),
      fakeMatch({ id: 2, home_team_code: 'GER', away_team_code: 'JPN' }),
      fakeMatch({ id: 3, home_team_code: 'CRC', away_team_code: 'MAR' }),
    ];
    const existing = [fakePred(1, 0, 0), fakePred(2, 1, 1)];
    const out = await resolveQuickPickPayload(
      { kind: 'persona', persona: 'fixed', mode: 'pendentes', fixedScore: { home: 2, away: 0 } },
      { matches, existingPredictions: existing, destBolaoId: 'dest', userId: 'u1' }
    );
    expect(out).toHaveLength(1);
    expect(out[0].match_id).toBe(3);
  });
});

describe('resolveQuickPickPayload — kind: copy', () => {
  it('busca palpites da fonte e mapeia pros matches do destino', async () => {
    const matches = [
      fakeMatch({ id: 1 }),
      fakeMatch({ id: 2, home_team_code: 'GER', away_team_code: 'JPN' }),
    ];
    mockedGet.mockResolvedValue([fakePred(1, 3, 0), fakePred(2, 1, 2)]);

    const out = await resolveQuickPickPayload(
      { kind: 'copy', sourceBolaoId: 'src', sourceBolaoName: 'Source', mode: 'substituir' },
      { matches, existingPredictions: [], destBolaoId: 'dest', userId: 'u1' }
    );

    expect(mockedGet).toHaveBeenCalledWith('src', 'u1');
    expect(out).toEqual([
      { match_id: 1, predicted_home_score: 3, predicted_away_score: 0 },
      { match_id: 2, predicted_home_score: 1, predicted_away_score: 2 },
    ]);
  });

  it('mode=pendentes filtra matches já palpitados no destino', async () => {
    const matches = [fakeMatch({ id: 1 }), fakeMatch({ id: 2 })];
    const existing = [fakePred(1, 0, 0)]; // já palpitado no destino
    mockedGet.mockResolvedValue([fakePred(1, 3, 0), fakePred(2, 2, 1)]);

    const out = await resolveQuickPickPayload(
      { kind: 'copy', sourceBolaoId: 'src', sourceBolaoName: 'Source', mode: 'pendentes' },
      { matches, existingPredictions: existing, destBolaoId: 'dest', userId: 'u1' }
    );

    // Só match 2 deveria entrar — match 1 já tem palpite no destino
    expect(out).toEqual([{ match_id: 2, predicted_home_score: 2, predicted_away_score: 1 }]);
  });

  it('pula matches finalizados', async () => {
    const matches = [
      fakeMatch({ id: 1, is_finished: true }),
      fakeMatch({ id: 2 }),
    ];
    mockedGet.mockResolvedValue([fakePred(1, 3, 0), fakePred(2, 1, 0)]);

    const out = await resolveQuickPickPayload(
      { kind: 'copy', sourceBolaoId: 'src', sourceBolaoName: 'Source', mode: 'substituir' },
      { matches, existingPredictions: [], destBolaoId: 'dest', userId: 'u1' }
    );

    expect(out).toHaveLength(1);
    expect(out[0].match_id).toBe(2);
  });

  it('pula matches TBD', async () => {
    const matches = [
      fakeMatch({ id: 1, home_team_code: 'TBD' }),
      fakeMatch({ id: 2 }),
    ];
    mockedGet.mockResolvedValue([fakePred(1, 3, 0), fakePred(2, 1, 0)]);

    const out = await resolveQuickPickPayload(
      { kind: 'copy', sourceBolaoId: 'src', sourceBolaoName: 'Source', mode: 'substituir' },
      { matches, existingPredictions: [], destBolaoId: 'dest', userId: 'u1' }
    );

    expect(out).toHaveLength(1);
    expect(out[0].match_id).toBe(2);
  });

  it('pula matches que não têm palpite na fonte', async () => {
    const matches = [fakeMatch({ id: 1 }), fakeMatch({ id: 2 })];
    // Fonte só tem palpite pro match 1
    mockedGet.mockResolvedValue([fakePred(1, 3, 0)]);

    const out = await resolveQuickPickPayload(
      { kind: 'copy', sourceBolaoId: 'src', sourceBolaoName: 'Source', mode: 'substituir' },
      { matches, existingPredictions: [], destBolaoId: 'dest', userId: 'u1' }
    );

    expect(out).toHaveLength(1);
    expect(out[0].match_id).toBe(1);
  });

  it('retorna [] sem userId (não chama o service)', async () => {
    const matches = [fakeMatch({ id: 1 })];
    const out = await resolveQuickPickPayload(
      { kind: 'copy', sourceBolaoId: 'src', sourceBolaoName: 'Source', mode: 'substituir' },
      { matches, existingPredictions: [], destBolaoId: 'dest', userId: undefined }
    );
    expect(out).toEqual([]);
    expect(mockedGet).not.toHaveBeenCalled();
  });
});
