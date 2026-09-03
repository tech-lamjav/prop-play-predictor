import { describe, expect, it } from 'vitest';
import { storyDaPremissa } from './futebol-historico';
import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';

// ============================================================================
// O gráfico mede a janela da premissa (issue #350, spec #349)
// ============================================================================
// O gráfico anunciava "Flamengo em casa, 11 jogos" embaixo de um critério que
// não olha mando nenhum. O modelo mede os últimos jogos do time em QUALQUER
// competição, e a tela media a temporada de uma competição só, com recorte de
// mando — então o gráfico desmentia o número que ele deveria explicar.
//
// A consulta parou de filtrar por competição e temporada (migration 117), e as
// premissas de gols pararam de recortar por mando. Estes testes fixam a segunda
// metade: o recorte que sobrou no front.
// ============================================================================

const jogo = (over: Partial<FutebolFixtureHistorico> = {}): FutebolFixtureHistorico => ({
  side: 'home',
  team_id: 1,
  team_name: 'Flamengo',
  past_fixture_id: 1,
  data: '2026-08-01',
  ordem: 1,
  em_casa: true,
  adversario: 'Adversário',
  adversario_id: 2,
  gols_pro: 1,
  gols_contra: 1,
  total_gols: 2,
  ambos_marcaram: true,
  sem_sofrer: false,
  sem_marcar: false,
  xg: 1.2,
  xg_contra: 1.0,
  resultado: 'E',
  ...over,
});

/** Três em casa e três fora, com gols sofridos distintos por mando. */
const SEIS_JOGOS: FutebolFixtureHistorico[] = [
  jogo({ past_fixture_id: 1, ordem: 1, em_casa: true, gols_contra: 0 }),
  jogo({ past_fixture_id: 2, ordem: 2, em_casa: false, gols_contra: 3 }),
  jogo({ past_fixture_id: 3, ordem: 3, em_casa: true, gols_contra: 0 }),
  jogo({ past_fixture_id: 4, ordem: 4, em_casa: false, gols_contra: 3 }),
  jogo({ past_fixture_id: 5, ordem: 5, em_casa: true, gols_contra: 0 }),
  jogo({ past_fixture_id: 6, ordem: 6, em_casa: false, gols_contra: 3 }),
];

describe('as premissas de gols medem todos os jogos, sem recorte de mando', () => {
  // Se o recorte de mando voltasse, a média de "defesas firmes" seria 0 (só os
  // três em casa) em vez de 1,5 (os seis). O número escolhido separa os dois
  // casos sem ambiguidade.
  it.each([
    ['defesas_firmes', 1.5],
    ['defesas_vazaveis', 1.5],
  ])('%s usa os seis jogos, e não só os de casa', (slug, esperada) => {
    const story = storyDaPremissa(slug, SEIS_JOGOS, 'home', 3.25);
    expect(story?.series[0].media).toBe(esperada);
  });

  it('o rótulo nomeia a janela, e não o mando', () => {
    const story = storyDaPremissa('defesas_firmes', SEIS_JOGOS, 'home', 3.25);
    expect(story?.series[0].titulo).toContain('últimos jogos');
    expect(story?.series[0].titulo).not.toContain('em casa');
  });

  it.each(['ataque_combinado', 'ataques_fracos', 'xg_combinado_alto', 'xg_baixo_combinado'])(
    '%s também deixou de recortar por mando',
    (slug) => {
      const story = storyDaPremissa(slug, SEIS_JOGOS, 'home', 3.25);
      expect(story?.series[0].titulo).toContain('últimos jogos');
    },
  );
});

describe('o mando sobrevive onde o critério de fato olha o mando', () => {
  it('defesa jogando fora continua recortando', () => {
    // Handicap e resultado têm premissas em que o mando é parte do critério —
    // "defesa sólida jogando fora" é sobre jogar fora. Ali o recorte fica.
    const story = storyDaPremissa('defesa_fora_solida', SEIS_JOGOS, 'home', null);
    expect(story?.series[0].titulo).not.toContain('últimos jogos');
  });
});

describe('base de jogos', () => {
  it('histórico mais curto que o teto ainda rende gráfico', () => {
    const story = storyDaPremissa('defesas_firmes', SEIS_JOGOS.slice(0, 2), 'home', 3.25);
    expect(story?.series[0].jogos).toHaveLength(2);
  });

  it('histórico vazio não vira gráfico', () => {
    expect(storyDaPremissa('defesas_firmes', [], 'home', 3.25)).toBeNull();
    expect(storyDaPremissa('defesas_firmes', undefined, 'home', 3.25)).toBeNull();
  });
});
