import { describe, expect, it } from 'vitest';
import { storyDaPremissa, evidenciaDoHistorico, SPECS, EH_BINARIA } from './futebol-historico';
import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';

// ============================================================================
// O gráfico mede a janela da premissa (issue #350, spec #349)
// ============================================================================
// O gráfico anunciava "Flamengo em casa, 11 jogos" embaixo de um critério que
// mede outra coisa. O modelo olha os últimos 10 jogos do time em QUALQUER
// competição, point-in-time, e a tela media a temporada de uma competição só —
// então o gráfico desmentia o número que ele deveria explicar.
//
// A consulta parou de filtrar por competição e temporada (migration 117). Estes
// testes fixam a metade que mora no front: o recorte que sobrou.
//
// ⚠️ O primeiro conserto passou do ponto e tirou o MANDO das dez premissas de
// gols. O modelo o mantém em três: `gf_comb` e `ga_comb` somam o mandante em
// casa com o visitante fora. As outras sete saem de totais (percentual,
// contagem) ou do spine de xG, e essas não olham mando nenhum. Cada premissa
// declara o seu, e é isso que os dois primeiros blocos guardam.
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

/** Três em casa e três fora, com gols sofridos e marcados distintos por mando. */
const SEIS_JOGOS: FutebolFixtureHistorico[] = [
  jogo({ past_fixture_id: 1, ordem: 1, em_casa: true, gols_contra: 0, gols_pro: 2 }),
  jogo({ past_fixture_id: 2, ordem: 2, em_casa: false, gols_contra: 3, gols_pro: 0 }),
  jogo({ past_fixture_id: 3, ordem: 3, em_casa: true, gols_contra: 0, gols_pro: 2 }),
  jogo({ past_fixture_id: 4, ordem: 4, em_casa: false, gols_contra: 3, gols_pro: 0 }),
  jogo({ past_fixture_id: 5, ordem: 5, em_casa: true, gols_contra: 0, gols_pro: 2 }),
  jogo({ past_fixture_id: 6, ordem: 6, em_casa: false, gols_contra: 3, gols_pro: 0 }),
];

describe('as três premissas de média combinada recortam por mando', () => {
  // `ga_comb` é `goals_against_avg_home` do mandante mais `goals_against_avg_away`
  // do visitante. Com os seis jogos acima, a média em casa é 0 e a dos seis é 1,5:
  // o número separa os dois casos sem ambiguidade.
  it.each([
    ['defesas_firmes', 0],
    ['defesas_vazaveis', 0],
  ])('%s usa só os jogos em casa do mandante', (slug, esperada) => {
    const story = storyDaPremissa(slug, SEIS_JOGOS, 'home', 3.25);
    expect(story?.series[0].media).toBe(esperada);
  });

  it('ataque_combinado idem, do outro lado da métrica', () => {
    const story = storyDaPremissa('ataque_combinado', SEIS_JOGOS, 'home', 3.25);
    expect(story?.series[0].media).toBe(2);
  });

  it('o rótulo nomeia o mando e conta os jogos', () => {
    const story = storyDaPremissa('defesas_firmes', SEIS_JOGOS, 'home', 3.25);
    // Título só: qual recorte e sobre quantos jogos. O subtítulo saiu porque
    // dizia a janela (10), que é a mesma em toda a tela e não muda nada aqui.
    expect(story?.series[0].titulo).toBe('Flamengo em casa, 3 jogos');
    expect(story?.series[0].sub).toBe('');
  });
});

describe('as outras sete premissas de gols não olham mando', () => {
  // Percentual e contagem saem de `clean_sheet_total / played_total` e de
  // `last5_totals`; o xG sai do spine. Nenhum deles recorta casa/fora.
  it.each(['ataques_fracos', 'clean_sheets_altos', 'ambos_vazam', 'xg_combinado_alto', 'xg_baixo_combinado'])(
    '%s vê os seis jogos',
    (slug) => {
      const story = storyDaPremissa(slug, SEIS_JOGOS, 'home', 3.25);
      expect(story?.series[0].titulo).toBe('Flamengo, últimos 6 jogos');
      expect(story?.series[0].jogos).toHaveLength(6);
    },
  );
});

describe('a janela é de jogos, e o mando recorta dentro dela', () => {
  // A ordem é a do modelo: o `pit` pega as dez partidas mais recentes e só então
  // conta as de casa. Invertida, "os últimos N" viraria "os últimos N em casa".
  //
  // Doze jogos alternando mando: os últimos 10 são as ordens 3 a 12, das quais 5
  // em casa. Filtrando mando primeiro, entrariam os 6 jogos em casa.
  const DOZE: FutebolFixtureHistorico[] = Array.from({ length: 12 }, (_, i) =>
    jogo({ past_fixture_id: i + 1, ordem: i + 1, em_casa: i % 2 === 0, gols_contra: 1 }),
  );

  it('recorta os 10 mais recentes antes de aplicar o mando', () => {
    const story = storyDaPremissa('defesas_firmes', DOZE, 'home', 3.25);

    expect(story?.series[0].jogos).toHaveLength(5);
    expect(story?.series[0].titulo).toBe('Flamengo em casa, 5 jogos');
    // E são os DE DENTRO da janela: a ordem 1 ficou de fora.
    expect(story?.series[0].jogos.map((j) => j.ordem)).toEqual([3, 5, 7, 9, 11]);
  });
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
    expect(story?.series[0].titulo).toBe('Flamengo em casa, 3 jogos');
    // E o recorte é real: só os três jogos em casa entram, não os seis.
    expect(story?.series[0].jogos).toHaveLength(3);
  });
});

describe('base de jogos', () => {
  it('histórico mais curto que o teto ainda rende gráfico', () => {
    // Dois jogos, um em casa e um fora: `defesas_firmes` deriva do único de casa
    // e declara a base, em vez de sumir.
    const story = storyDaPremissa('defesas_firmes', SEIS_JOGOS.slice(0, 2), 'home', 3.25);
    expect(story?.series[0].jogos).toHaveLength(1);
    expect(story?.series[0].titulo).toBe('Flamengo em casa, 1 jogo');
  });

  it('janela sem nenhum jogo do mando não vira gráfico daquele lado', () => {
    // Um time que só jogou fora não tem média em casa. Melhor não desenhar do que
    // desenhar zero, que seria "não sofre gol nenhum".
    const soFora = SEIS_JOGOS.filter((r) => !r.em_casa);
    expect(storyDaPremissa('defesas_firmes', soFora, 'home', 3.25)).toBeNull();
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
    // mando o card diria 2,0 + 1,0 = 3,0, e o gráfico continuaria em 2,0.
    expect(somaDoGrafico).toBe(2);
    expect(ev?.texto).toContain('2,0');
  });
});

describe('toda premissa declara a janela do modelo', () => {
  // ==========================================================================
  // O guarda que impede a tela de desenhar outra amostra que a do Score
  // ==========================================================================
  // Havia um padrão implícito: premissa que não declarasse via só a competição
  // do confronto, e o histórico inteiro. Ele reproduzia o modelo de ANTES da
  // analytics-engineering#91 (ADR 0010), fechada em 25/08/2026, que passou os
  // defaults para `todas` as competições e os `ultimos_10` jogos.
  //
  // O modelo mudou embaixo das especificações e nada quebrou, porque nada
  // obrigava as duas pontas a concordarem. Medido no Goiás × Fortaleza de
  // 05/09: o critério acendeu com 1,5 contra 1,0, a frase da tela dizia 1,2
  // contra 1,2 e o gráfico desenhava 1,3 contra 1,1 — três leituras do mesmo
  // número, e a que decide não aparecia em lugar nenhum.
  //
  // Não existe mais padrão implícito: cada premissa DECLARA os dois eixos. É o
  // que este teste cobra, e é o que faz a próxima mudança do modelo virar uma
  // edição visível em vez de uma divergência muda.
  // ==========================================================================

  const RECORTE_ESPECIAL: Record<string, number> = {
    // Contam quantos dos ÚLTIMOS CINCO ficaram de um lado da linha.
    historico_over: 5,
    historico_under: 5,
    // Saem do `n_wins_last5` do modelo, que é de cinco por construção.
    forma: 5,
    invicto_recente: 5,
  };

  for (const [slug, series] of Object.entries(SPECS)) {
    it(`${slug} declara competição e recorte`, () => {
      for (const spec of series) {
        expect(spec.competicoes, `${slug} não declara competição`).toBe('qualquer');
        expect(spec.ultimos, `${slug} não declara recorte`).toBe(RECORTE_ESPECIAL[slug] ?? 10);
      }
    });
  }

  it('a frase e o gráfico leem a MESMA especificação', () => {
    // Três jogos, dois de outra competição. Com o recorte declarado, os dois
    // lados enxergam os três — e o que importa é enxergarem o mesmo.
    // Os DOIS lados: `superioridade_xg` compara o time com o adversário, e sem
    // as linhas do visitante a frase não é gerada.
    const misturado: FutebolFixtureHistorico[] = [
      jogo({ past_fixture_id: 1, ordem: 1, mesma_competicao: true, xg: 1 }),
      jogo({ past_fixture_id: 2, ordem: 2, mesma_competicao: false, xg: 3 }),
      jogo({ past_fixture_id: 3, ordem: 3, mesma_competicao: false, xg: 3 }),
      jogo({ side: 'away', past_fixture_id: 4, ordem: 1, mesma_competicao: true, em_casa: false, xg: 1 }),
      jogo({ side: 'away', past_fixture_id: 5, ordem: 2, mesma_competicao: false, em_casa: false, xg: 1 }),
    ];
    // `superioridade_xg` porque ela tem gráfico E frase — a maioria das
    // premissas só tem um dos dois, e só onde há os dois é que a divergência
    // aparecia na tela.
    const story = storyDaPremissa('superioridade_xg', misturado, 'home', null);
    const ev = evidenciaDoHistorico('superioridade_xg', misturado, 'home', null);

    expect(story?.series[0].jogos).toHaveLength(3);
    expect(ev?.texto).toBeTruthy();
    // A média do gráfico é o número que a frase repete.
    const media = story!.series[0].media!;
    expect(ev!.texto).toContain(media.toFixed(1).replace('.', ','));
  });
});

describe('a frase nunca sai de um recorte diferente do gráfico', () => {
  // ==========================================================================
  // A auditoria de 05/09: 12 premissas mostravam temporada acima do gráfico
  // ==========================================================================
  // Das 48 premissas, só 10 têm o critério transcrito, e as dez são do mercado
  // de Gols. Nas outras a frase saía do perfil de temporada — 25 jogos, foto de
  // 31/08 — enquanto o gráfico logo abaixo desenhava os últimos dez. No Goiás ×
  // Fortaleza isso dava 1,20 contra 0,90 de gols sofridos, no mesmo card.
  //
  // A ordem das fontes inverteu: histórico antes do perfil. Este teste guarda a
  // consequência — toda premissa COM gráfico tem frase, e a frase repete um
  // número do gráfico.
  // ==========================================================================

  const doisLados: FutebolFixtureHistorico[] = [
    jogo({ past_fixture_id: 1, ordem: 1, gols_pro: 2, gols_contra: 1, xg: 2, total_gols: 3 }),
    jogo({ past_fixture_id: 2, ordem: 2, gols_pro: 0, gols_contra: 1, xg: 0, total_gols: 1 }),
    jogo({ side: 'away', past_fixture_id: 3, ordem: 1, em_casa: false, gols_pro: 1, gols_contra: 1, xg: 1, total_gols: 2 }),
    jogo({ side: 'away', past_fixture_id: 4, ordem: 2, em_casa: false, gols_pro: 1, gols_contra: 1, xg: 1, total_gols: 2 }),
  ];

  const COM_GRAFICO_E_SEM_CRITERIO = [
    'mando', 'mando_forte', 'defesa_forte', 'defesa_fora_solida',
    'ambos_marcam', 'ataque_dos_dois', 'adversario_limitado', 'adversario_fragil_fora',
  ];

  for (const slug of COM_GRAFICO_E_SEM_CRITERIO) {
    it(`${slug} tem frase vinda do gráfico`, () => {
      const story = storyDaPremissa(slug, doisLados, 'home', 2.5);
      const ev = evidenciaDoHistorico(slug, doisLados, 'home', 2.5);
      // Se há gráfico, há frase — e é da mesma amostra.
      if (!story) return;
      expect(ev?.texto, `${slug} ficou sem frase e cairia no perfil de temporada`).toBeTruthy();
      // Premissa de resultado não tem média — a barra é V/E/D. Nela a frase
      // repete a CONTAGEM de jogos; nas demais, a média.
      const alguma = story.series.some((s) => {
        if (s.metrica === 'resultado') return ev!.texto.includes(String(s.jogos.length));
        if (s.media == null) return false;
        const n = EH_BINARIA(s.metrica)
          ? `${Math.round(s.media * 100)}%`
          : s.media.toFixed(1).replace('.', ',');
        return ev!.texto.includes(n);
      });
      expect(alguma, `${slug}: "${ev?.texto}" não repete nenhum número do gráfico`).toBe(true);
    });
  }
});
