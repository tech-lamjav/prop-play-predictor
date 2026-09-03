import { describe, expect, it } from 'vitest';
import { storyDaPremissa, evidenciaDoHistorico } from './futebol-historico';
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
  mesma_competicao: true,
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
    // O rótulo traz a contagem junto: com a janela explícita, ele deixa de ser
    // genérico e passa a declarar quantos jogos entraram.
    expect(story?.series[0].titulo).toBe('Flamengo, últimos 6 jogos');
    expect(story?.series[0].titulo).not.toContain('em casa');
  });

  it.each(['ataque_combinado', 'ataques_fracos', 'xg_combinado_alto', 'xg_baixo_combinado'])(
    '%s também deixou de recortar por mando',
    (slug) => {
      const story = storyDaPremissa(slug, SEIS_JOGOS, 'home', 3.25);
      expect(story?.series[0].titulo).toBe('Flamengo, últimos 6 jogos');
    },
  );
});

describe('o mando sobrevive onde o critério de fato olha o mando', () => {
  it('defesa jogando fora continua recortando', () => {
    // Handicap e resultado têm premissas em que o mando é parte do critério —
    // "defesa sólida jogando fora" é sobre jogar fora. Ali o recorte fica.
    //
    // Afirma o título esperado, e não só a ausência do outro: `not.toContain`
    // passaria com título vazio, que é o modo mais comum de um teste destes
    // deixar de provar o que promete.
    const story = storyDaPremissa('defesa_fora_solida', SEIS_JOGOS, 'home', null);
    expect(story?.series[0].titulo).toBe('Flamengo em casa');
    // E o recorte é real: só os três jogos em casa entram, não os seis.
    expect(story?.series[0].jogos).toHaveLength(3);
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

describe('o número da evidência usa a mesma janela do gráfico', () => {
  // A #350 consertou o gráfico e deixou o NÚMERO do xG recortando por mando. Card
  // e barras mostravam médias diferentes da mesma coisa, lado a lado — o defeito
  // da spec reaparecendo dentro da mesma caixa. Este teste é a guarda contra as
  // duas metades voltarem a divergir.
  const XG_POR_MANDO: FutebolFixtureHistorico[] = [
    jogo({ side: 'home', past_fixture_id: 1, ordem: 1, em_casa: true, xg: 2.0 }),
    jogo({ side: 'home', past_fixture_id: 2, ordem: 2, em_casa: false, xg: 0.0 }),
    jogo({ side: 'away', team_id: 2, team_name: 'Mirassol', past_fixture_id: 3, ordem: 1, em_casa: false, xg: 1.0 }),
    jogo({ side: 'away', team_id: 2, team_name: 'Mirassol', past_fixture_id: 4, ordem: 2, em_casa: true, xg: 1.0 }),
  ];

  it('a média do card bate com a do gráfico', () => {
    const story = storyDaPremissa('xg_baixo_combinado', XG_POR_MANDO, 'home', 3.25);
    const daSerie = (story?.series ?? []).map((s) => s.media ?? 0);
    const somaDoGrafico = daSerie.reduce((a, b) => a + b, 0);

    const ev = evidenciaDoHistorico('xg_baixo_combinado', XG_POR_MANDO, 'home', 3.25);

    // Os dois times somam 1,0 + 1,0 = 2,0 na janela inteira. Com o recorte de
    // mando antigo o card diria 2,0 + 1,0 = 3,0, e o gráfico continuaria em 2,0.
    expect(somaDoGrafico).toBe(2);
    expect(ev?.texto).toContain('2,0');
  });
});

describe('a janela larga vale só para quem a declarou', () => {
  // A #350 ampliou a janela na CONSULTA, e isso valia para todos os consumidores:
  // as premissas de resultado e handicap passaram a desenhar jogos de outros
  // campeonatos enquanto a frase acima delas continuava saindo do perfil de uma
  // competição só. O gráfico e o texto discordavam em mercados que a issue nem
  // tocava. A janela passou a ser declarada por premissa, com o padrão
  // conservador.
  const MISTURADO: FutebolFixtureHistorico[] = [
    jogo({ past_fixture_id: 1, ordem: 1, mesma_competicao: true, em_casa: true, gols_contra: 1 }),
    jogo({ past_fixture_id: 2, ordem: 2, mesma_competicao: false, em_casa: true, gols_contra: 1 }),
    jogo({ past_fixture_id: 3, ordem: 3, mesma_competicao: false, em_casa: true, gols_contra: 1 }),
  ];

  it('premissa de gols vê os três jogos', () => {
    const story = storyDaPremissa('defesas_firmes', MISTURADO, 'home', 2.5);
    expect(story?.series[0].jogos).toHaveLength(3);
  });

  it('premissa que não declarou vê só a competição do confronto', () => {
    const story = storyDaPremissa('defesa_fora_solida', MISTURADO, 'home', null);
    expect(story?.series[0].jogos).toHaveLength(1);
  });
});
