import { describe, expect, it } from 'vitest';
import {
  ehMercadoDoGrafico,
  ESCOLHA_PADRAO,
  graficoDaEstatistica,
  MERCADOS_NO_GRAFICO,
  type EscolhaDaEstatistica,
  type MercadoDoGrafico,
} from './futebol-estatisticas-da-partida';
import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';

// ============================================================================
// O gráfico da aba de Estatísticas
// ============================================================================
// Cada barra é o número daquele jogo, e a LINHA é uma referência: mexer nela
// repinta as barras e não toca nos valores. Não há aposta aqui — não se liquida
// nada, não há lado escolhido, não há preço. É cruzamento dos nossos dados com
// um limiar, e é isso que mantém a tela em ESTATÍSTICA DA PARTIDA em vez de
// virar retrovisor de aposta.
//
// Quem manda na métrica é o MERCADO: gols mede o total do jogo, handicap mede o
// saldo do time, ambos marcam é binário, e resultado não tem quantidade.
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
  gols_pro: 2,
  gols_contra: 1,
  total_gols: 3,
  ambos_marcaram: true,
  sem_sofrer: false,
  sem_marcar: false,
  xg: 1.4,
  xg_contra: 0.9,
  resultado: 'V',
  ...over,
});

/** Quatro jogos do mandante com totais 1, 2, 3 e 4 gols. */
const QUATRO: FutebolFixtureHistorico[] = [1, 2, 3, 4].map((n) =>
  jogo({
    side: 'home',
    past_fixture_id: n,
    ordem: n,
    gols_pro: n,
    gols_contra: 0,
    total_gols: n,
    ambos_marcaram: false,
    sem_sofrer: true,
    resultado: 'V',
  }),
);

const DO_VISITANTE: FutebolFixtureHistorico[] = [1, 2].map((n) =>
  jogo({
    side: 'away',
    team_id: 9,
    team_name: 'Palmeiras',
    past_fixture_id: 20 + n,
    ordem: n,
    em_casa: false,
    gols_pro: 0,
    gols_contra: 1,
    total_gols: 1,
    ambos_marcaram: false,
    sem_marcar: true,
    resultado: 'D',
  }),
);

const escolha = (over: Partial<EscolhaDaEstatistica> = {}): EscolhaDaEstatistica => ({
  ...ESCOLHA_PADRAO,
  ...over,
});

describe('o mercado manda na métrica', () => {
  it('gols mede o total do jogo', () => {
    const { series } = graficoDaEstatistica(escolha({ mercado: 'goals_over_under' }), QUATRO);

    expect(series[0].jogos.map((j) => j.valor)).toEqual([1, 2, 3, 4]);
  });

  it('handicap mede o saldo do time, que pode ser negativo', () => {
    const doisJogos = [
      jogo({ side: 'home', past_fixture_id: 1, ordem: 1, gols_pro: 3, gols_contra: 1 }),
      jogo({ side: 'home', past_fixture_id: 2, ordem: 2, gols_pro: 0, gols_contra: 2 }),
    ];

    const { series } = graficoDaEstatistica(escolha({ mercado: 'asian_handicap' }), doisJogos);

    expect(series[0].jogos.map((j) => j.valor)).toEqual([2, -2]);
  });

  it('ambos marcam é binário, e não tem linha', () => {
    const doisJogos = [
      jogo({ side: 'home', past_fixture_id: 1, ordem: 1, ambos_marcaram: true }),
      jogo({ side: 'home', past_fixture_id: 2, ordem: 2, ambos_marcaram: false }),
    ];

    const g = graficoDaEstatistica(escolha({ mercado: 'btts' }), doisJogos);

    expect(g.series[0].jogos.map((j) => j.valor)).toEqual([1, 0]);
    expect(g.temLinha).toBe(false);
  });

  it('os binários mostram o jogo, sem linha', () => {
    // Entre vencer e empatar não há meio-termo para arrastar, então não há
    // régua — e sem régua não há contagem de "quantos passaram".
    for (const mercado of ['match_winner', 'double_chance', 'btts'] as MercadoDoGrafico[]) {
      const g = graficoDaEstatistica(escolha({ mercado, quem: 'mandante' }), QUATRO);
      expect(g.temLinha, mercado).toBe(false);
      expect(g.contagem, mercado).toBeNull();
    }
  });

  it('TODO mercado desenha os dois times', () => {
    // A tela não oferece mais escolher um time: os dois estão sempre lá. Num
    // confronto, ver um de cada vez obriga a lembrar do outro para comparar —
    // trabalho que a escala compartilhada faz de graça.
    for (const slug of Object.keys(MERCADOS_NO_GRAFICO) as MercadoDoGrafico[]) {
      const g = graficoDaEstatistica(escolha({ mercado: slug, quem: 'ambos' }), [...QUATRO, ...DO_VISITANTE]);
      expect(g.series.map((s) => s.teamName), slug).toEqual(['Flamengo', 'Palmeiras']);
    }
  });

  it('NENHUM mercado fica sem desenho', () => {
    // A guarda que faltava quando três dos cinco mercados ficaram sem nada na
    // tela. Ela não exige BARRA — exige série: o binário desenha quadro, e isso
    // também é desenho.
    for (const slug of Object.keys(MERCADOS_NO_GRAFICO) as MercadoDoGrafico[]) {
      const g = graficoDaEstatistica(escolha({ mercado: slug, quem: 'mandante' }), QUATRO);
      expect(g.series.length, `${slug} não desenhou nada`).toBeGreaterThan(0);
      expect(g.series[0].jogos.length, `${slug} sem jogo nenhum`).toBeGreaterThan(0);
    }
  });

  it('todo mercado do catálogo tem métrica declarada', () => {
    // O tipo já obriga o catálogo a ser exaustivo; o que este teste guarda é a
    // LISTA — que os cinco slugs continuam sendo estes, e que ninguém removeu um
    // do tipo achando que ninguém usava.
    const slugs: MercadoDoGrafico[] = ['goals_over_under', 'asian_handicap', 'btts', 'match_winner', 'double_chance'];
    expect(Object.keys(MERCADOS_NO_GRAFICO).sort()).toEqual([...slugs].sort());
    for (const slug of slugs) {
      expect(MERCADOS_NO_GRAFICO[slug].metrica, `${slug} sem métrica`).toBeDefined();
    }
  });

  it('slug de fora só é aceito se for um dos cinco', () => {
    // Com `string` solto, um slug de link velho caía calado no mercado padrão.
    expect(ehMercadoDoGrafico('goals_over_under')).toBe(true);
    expect(ehMercadoDoGrafico('mercado_que_nao_existe')).toBe(false);
    expect(ehMercadoDoGrafico(null)).toBe(false);
    expect(ehMercadoDoGrafico(undefined)).toBe(false);
  });
});

describe('a linha é referência, e repinta as barras', () => {
  it('acima da linha fica a favor, na linha e abaixo não', () => {
    // Comparação estrita, a mesma do resto do código: 2 não passa de 2.
    const { series } = graficoDaEstatistica(
      escolha({ mercado: 'goals_over_under', linha: 2 }),
      QUATRO,
    );

    expect(series[0].jogos.map((j) => j.favorece)).toEqual([false, false, true, true]);
  });

  it('mexer na linha muda SÓ a cor, nunca os valores', () => {
    const baixa = graficoDaEstatistica(escolha({ mercado: 'goals_over_under', linha: 1.5 }), QUATRO);
    const alta = graficoDaEstatistica(escolha({ mercado: 'goals_over_under', linha: 3.5 }), QUATRO);

    expect(baixa.series[0].jogos.map((j) => j.valor)).toEqual(alta.series[0].jogos.map((j) => j.valor));
    expect(baixa.series[0].jogos.map((j) => j.favorece)).toEqual([false, true, true, true]);
    expect(alta.series[0].jogos.map((j) => j.favorece)).toEqual([false, false, false, true]);
  });

  it('a contagem diz quantos passaram, e de quantos', () => {
    // O número sempre nomeia a própria base. Existe uma premissa que conta os
    // ÚLTIMOS CINCO contra a linha, com janela travada pelo modelo; dois números
    // da mesma forma só não se contradizem porque cada um declara a sua janela.
    const { contagem } = graficoDaEstatistica(
      escolha({ mercado: 'goals_over_under', linha: 2.5 }),
      QUATRO,
    );

    expect(contagem).toEqual({ acima: 2, de: 4 });
  });

  it('sem linha não há contagem', () => {
    const { contagem } = graficoDaEstatistica(
      escolha({ mercado: 'goals_over_under', linha: null }),
      QUATRO,
    );

    expect(contagem).toBeNull();
  });

  it('a contagem soma os dois times quando os dois estão no gráfico', () => {
    const { contagem } = graficoDaEstatistica(
      escolha({ mercado: 'goals_over_under', linha: 1.5, quem: 'ambos' }),
      [...QUATRO, ...DO_VISITANTE],
    );

    // Do mandante passam 2, 3 e 4; do visitante, nenhum (os dois jogos têm 1).
    expect(contagem).toEqual({ acima: 3, de: 6 });
  });
});

describe('quem entra no gráfico', () => {
  it('os dois times, um de cada lado', () => {
    const { series } = graficoDaEstatistica(escolha({ quem: 'ambos' }), [...QUATRO, ...DO_VISITANTE]);

    expect(series.map((s) => s.teamName)).toEqual(['Flamengo', 'Palmeiras']);
  });

  it('só o mandante', () => {
    const { series } = graficoDaEstatistica(escolha({ quem: 'mandante' }), [...QUATRO, ...DO_VISITANTE]);

    expect(series.map((s) => s.teamName)).toEqual(['Flamengo']);
  });

  it('só o visitante', () => {
    const { series } = graficoDaEstatistica(escolha({ quem: 'visitante' }), [...QUATRO, ...DO_VISITANTE]);

    expect(series.map((s) => s.teamName)).toEqual(['Palmeiras']);
  });
});

describe('a janela e o mando', () => {
  it('a janela recorta os jogos mais recentes', () => {
    const { series } = graficoDaEstatistica(escolha({ janela: 2 }), QUATRO);

    expect(series[0].jogos.map((j) => j.ordem)).toEqual([3, 4]);
  });

  it('o mando recorta DENTRO da janela, nunca antes dela', () => {
    // Dos quatro jogos, os dois mais antigos em casa e os dois recentes fora.
    // Na janela de dois sobra nenhum em casa; invertida a ordem, sobrariam dois.
    const metadeFora = QUATRO.map((j) => ({ ...j, em_casa: j.ordem <= 2 }));

    const { series } = graficoDaEstatistica(
      escolha({ janela: 2, mando: 'proprio' }),
      metadeFora,
    );

    expect(series).toEqual([]);
  });
});

describe('o que a tela diz sobre o gráfico', () => {
  it('a explicação fala da linha como referência, não como aposta', () => {
    const { series } = graficoDaEstatistica(
      escolha({ mercado: 'goals_over_under', linha: 2.5 }),
      QUATRO,
    );

    expect(series[0].comoLer).toMatch(/referência|referencia/i);
    expect(series[0].comoLer).not.toMatch(/aposta|premissa|odd/i);
  });

  it('não devolve nada quando o histórico ainda não chegou', () => {
    expect(graficoDaEstatistica(escolha(), undefined).series).toEqual([]);
    expect(graficoDaEstatistica(escolha(), []).series).toEqual([]);
  });
});
