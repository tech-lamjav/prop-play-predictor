import { describe, expect, it } from 'vitest';
import { storyDaPremissa } from './futebol-historico';
import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';

// ============================================================================
// A métrica binária desenha quadro, e a cor segue a PREMISSA
// ============================================================================
// Visto na tela do Czechia × England, na premissa "Os dois costumam marcar":
// três dos quatro jogos do Czechia não desenhavam nada, o único visível era o
// ruim, e embaixo do título vinha "não, não, não".
//
// Eram três defeitos empilhados, e todos saem da mesma escolha de desenhar
// barra para um dado que não tem quantidade:
//
//   · o rótulo respondia a pergunta INVERTIDA. `sem_marcar` mede passar em
//     branco, então o jogo BOM recebia "não".
//   · o jogo bom era barra de altura zero, invisível.
//   · a barra alta era a ruim, e altura lê como "mais".
//
// O quadro não tem nenhum dos três: cada jogo ocupa o mesmo espaço, traz o
// placar em vez de um sim/não, e quem diz se foi bom é a cor.
//
// ⚠️ E a COR não pode sair do fato cru. A mesma métrica atende premissas de
// direções opostas — `ambos_marcam` quer poucos jogos em branco e
// `ataque_trava` quer muitos —, então "verde quando passou em branco" acertaria
// uma e mentiria na outra.
// ============================================================================

const jogo = (over: Partial<FutebolFixtureHistorico> = {}): FutebolFixtureHistorico => ({
  side: 'home',
  team_id: 1,
  team_name: 'Czechia',
  past_fixture_id: 1,
  data: '2026-08-01',
  ordem: 1,
  mesma_competicao: true,
  em_casa: true,
  adversario: 'Adversário',
  adversario_id: 9,
  gols_pro: 1,
  gols_contra: 1,
  total_gols: 2,
  ambos_marcaram: true,
  sem_sofrer: false,
  sem_marcar: false,
  xg: 1,
  xg_contra: 1,
  resultado: 'E',
  ...over,
});

/** Três jogos em que o time marcou e um em que passou em branco. */
const umEmBranco: FutebolFixtureHistorico[] = [
  jogo({ ordem: 1, past_fixture_id: 1, gols_pro: 2, sem_marcar: false }),
  jogo({ ordem: 2, past_fixture_id: 2, gols_pro: 1, sem_marcar: false }),
  jogo({ ordem: 3, past_fixture_id: 3, gols_pro: 0, sem_marcar: true }),
  jogo({ ordem: 4, past_fixture_id: 4, gols_pro: 3, sem_marcar: false }),
  // O visitante precisa existir: as duas premissas abaixo desenham `quem: 'ambos'`.
  jogo({ side: 'away', team_id: 2, team_name: 'England', em_casa: false, ordem: 1, past_fixture_id: 5, gols_pro: 2 }),
];

const doTime = (mercado: string, slug: string) =>
  storyDaPremissa(mercado, slug, umEmBranco, null, null)!.series.find((s) => s.teamId === 1)!;

describe('a cor do jogo segue o lado que a premissa quer', () => {
  it('na `ambos_marcam`, o jogo em branco é o contra e os outros três são a favor', () => {
    // O defeito do print: era o jogo em branco que aparecia, e sozinho.
    const s = doTime('btts', 'ambos_marcam');
    expect(s.jogos.map((j) => j.favorece)).toEqual([true, true, false, true]);
  });

  it('na `ataque_trava`, a mesma métrica inverte, porque a premissa inverte', () => {
    // Mesmo `sem_marcar`, mesmos quatro jogos, `direcao: 'maior'`. Se a cor
    // saísse do fato cru em vez da direção, estes dois testes dariam igual.
    const s = doTime('btts', 'ataque_trava');
    expect(s.jogos.map((j) => j.favorece)).toEqual([false, false, true, false]);
  });
});

describe('unanimidade não pode zerar o lado bom', () => {
  // Com todos os jogos do mesmo lado a média encosta no valor, e a comparação
  // `valor < média` sai falsa em TODOS — nenhum jogo a favor de uma premissa
  // que eles sustentam por unanimidade. Foi por isso que o `favorece` das
  // binárias passou a sair do fato e não da média.
  const nenhumEmBranco: FutebolFixtureHistorico[] = [
    jogo({ ordem: 1, past_fixture_id: 1, gols_pro: 2, sem_marcar: false }),
    jogo({ ordem: 2, past_fixture_id: 2, gols_pro: 1, sem_marcar: false }),
    jogo({ side: 'away', team_id: 2, team_name: 'England', em_casa: false, ordem: 1, past_fixture_id: 3, gols_pro: 2 }),
  ];

  it('nove de nove sem passar em branco são nove jogos a favor', () => {
    const s = storyDaPremissa('btts', 'ambos_marcam', nenhumEmBranco, null, null)!
      .series.find((x) => x.teamId === 1)!;
    expect(s.media).toBe(0);
    expect(s.jogos.every((j) => j.favorece)).toBe(true);
  });
});

describe('a legenda da binária não promete cor que ela não controla', () => {
  it('fala do lado que a premissa quer, e não de ter marcado', () => {
    // "Verde quando marcou" acertaria a `ambos_marcam` e mentiria na
    // `ataque_trava`, que lê a MESMA métrica com a direção trocada.
    const texto = storyDaPremissa('btts', 'ambos_marcam', umEmBranco, null, null)!.comoLer;
    expect(texto).toContain('Cada quadro é um jogo');
    expect(texto).toContain('o lado que a premissa quer');
    expect(texto).not.toContain('barra');
  });
});
