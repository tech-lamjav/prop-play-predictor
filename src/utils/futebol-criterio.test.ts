import { describe, expect, it } from 'vitest';
import {
  divergenciaDaPrestacao,
  distanciaAteOCorte,
  divergenciasDaSaida,
  fraseDaPrestacao,
  prestacaoDaPremissa,
  temCriterio,
} from './futebol-criterio';
import { storyDaPremissa } from './futebol-historico';
import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';
import CASOS_CAPTURADOS from './__fixtures__/futebol-criterios-casos.json';

// ============================================================================
// A premissa presta contas do modelo (issue #353, spec #349)
// ============================================================================
// O card dizia "2,4 gols sofridos por jogo" com o subtítulo dizendo 2,3, e
// explicava com "fica abaixo da linha de 3,25" — quando o corte é 3,25 − 0,3 =
// 2,95. Havia uma faixa inteira, de 2,95 a 3,25, em que a tela afirmava que o
// número sustentava a premissa e o modelo dizia que não.
//
// O que se testa aqui é o CRITÉRIO transcrito: insumo, corte, sentido e base.
// ============================================================================

const jogo = (over: Partial<FutebolFixtureHistorico> = {}): FutebolFixtureHistorico => ({
  side: 'home',
  team_id: 1,
  team_name: 'Casa',
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
  xg: 1.0,
  xg_contra: 1.0,
  resultado: 'E',
  ...over,
});

/**
 * Um histórico em que cada time sofre exatamente `gaCasa`/`gaFora` por jogo no
 * mando que a premissa mede, para o insumo sair no número pedido.
 */
const historicoCom = (gaCasa: number, gaFora: number): FutebolFixtureHistorico[] => [
  ...[1, 2, 3].map((i) =>
    jogo({ side: 'home', team_id: 1, team_name: 'Casa', ordem: i, past_fixture_id: i, em_casa: true, gols_contra: gaCasa }),
  ),
  ...[1, 2, 3].map((i) =>
    jogo({ side: 'away', team_id: 2, team_name: 'Fora', ordem: i, past_fixture_id: 10 + i, em_casa: false, gols_contra: gaFora }),
  ),
];

const prestacao = (hist: FutebolFixtureHistorico[] | undefined, linha: number | null) =>
  prestacaoDaPremissa('goals_over_under', 'defesas_firmes', hist, 'home', linha);

describe('o corte é a linha com a margem, e não a linha', () => {
  // `ga_comb <= line_value - 0.3`, transcrito de int_futebol_premissas_ou.
  it.each([
    // insumo, linha, corte, cruzou — o caso do meio é a faixa do defeito
    [2.0, 3.25, 2.95, true],
    [3.1, 3.25, 2.95, false],
    [4.0, 3.25, 2.95, false],
  ])('insumo %s na linha %s: corte %s, cruzou=%s', (insumo, linha, corte, cruzou) => {
    const p = prestacao(historicoCom(insumo / 2, insumo / 2), linha)!;

    expect(p.insumo).toBe(insumo);
    expect(p.corte).toBe(corte);
    expect(p.cruzou).toBe(cruzou);
  });

  it('o valor exatamente no corte ACENDE', () => {
    // O modelo usa `<=`. Errar isto por um passo é errar a premissa inteira numa
    // faixa estreita, que é o tipo de defeito que ninguém vê na tela.
    const p = prestacao(historicoCom(1.475, 1.475), 3.25)!;

    expect(p.insumo).toBe(p.corte);
    expect(p.cruzou).toBe(true);
  });

  it('o valor na faixa entre o corte e a linha não atinge o corte', () => {
    const p = prestacao(historicoCom(1.55, 1.55), 3.25)!;

    // Fica abaixo da LINHA...
    expect(p.insumo).toBeLessThan(p.linha);
    // ...e mesmo assim não acende, porque o corte é mais exigente. É esta frase
    // que a tela precisa saber dizer.
    expect(p.cruzou).toBe(false);
    expect(p.margem).toBe(-0.3);
  });
});

describe('o insumo é a soma das duas parcelas, cada uma no seu mando', () => {
  it('mandante em casa mais visitante fora', () => {
    const p = prestacao(historicoCom(1.0, 2.0), 3.25)!;

    expect(p.parcelas.map((x) => [x.teamName, x.valor])).toEqual([
      ['Casa', 1],
      ['Fora', 2],
    ]);
    expect(p.insumo).toBe(3);
  });

  it('a soma não estoura o ponto flutuante', () => {
    // 1,45 + 1,5 dá 2,9500000000000004 sem arredondar, e a comparação contra o
    // corte 2,95 devolveria FALSE. O defeito só aparece em alguns números.
    const p = prestacao(historicoCom(1.45, 1.5), 3.25)!;

    expect(p.insumo).toBe(2.95);
    expect(p.cruzou).toBe(true);
  });
});

describe('a base de jogos é declarada, sempre', () => {
  it('diz quantos jogos entraram e quantos a janela tinha', () => {
    const p = prestacao(historicoCom(1, 1), 3.25)!;

    expect(p.parcelas).toEqual([
      { teamId: 1, teamName: 'Casa', valor: 1, cruzou: null, jogos: 3, daJanela: 3 },
      { teamId: 2, teamName: 'Fora', valor: 1, cruzou: null, jogos: 3, daJanela: 3 },
    ]);
    // `cruzou: null` na família de soma, e não `false`: ali o corte é do TOTAL, e
    // afirmar que um time sozinho "não cruzou" seria compará-lo contra um limiar
    // que não é dele.
  });

  it('histórico mais curto que o teto deriva mesmo assim', () => {
    const curto = [
      jogo({ side: 'home', team_id: 1, team_name: 'Casa', ordem: 1, em_casa: true, gols_contra: 1 }),
      jogo({ side: 'away', team_id: 2, team_name: 'Fora', ordem: 1, past_fixture_id: 2, em_casa: false, gols_contra: 1 }),
    ];
    const p = prestacao(curto, 3.25)!;

    expect(p.insumo).toBe(2);
    expect(p.parcelas.map((b) => b.jogos)).toEqual([1, 1]);
  });

  it('o recorte de mando aparece na base', () => {
    // Cinco jogos do mandante, dois em casa: a base diz "2 de 5", e não "5".
    const misto = [
      ...[1, 2, 3, 4, 5].map((i) =>
        jogo({ side: 'home', team_id: 1, team_name: 'Casa', ordem: i, past_fixture_id: i, em_casa: i <= 2, gols_contra: 1 }),
      ),
      jogo({ side: 'away', team_id: 2, team_name: 'Fora', ordem: 1, past_fixture_id: 20, em_casa: false, gols_contra: 1 }),
    ];
    const p = prestacao(misto, 3.25)!;

    expect(p.parcelas[0]).toMatchObject({ teamName: 'Casa', jogos: 2, daJanela: 5 });
  });
});

describe('sem dado é ausência, e nunca zero', () => {
  it('histórico vazio não presta contas', () => {
    expect(prestacao([], 3.25)).toBeNull();
    expect(prestacao(undefined, 3.25)).toBeNull();
  });

  it('um lado sem jogos derruba a prestação inteira', () => {
    // O insumo é a SOMA dos dois. Somar um lado só daria um número que o modelo
    // nunca comparou — e ele seria BAIXO, ou seja, acenderia a premissa mais
    // forte possível a partir da ausência.
    const soCasa = [jogo({ side: 'home', em_casa: true, gols_contra: 3 })];

    expect(prestacao(soCasa, 3.25)).toBeNull();
  });

  it('saída sem linha não presta contas', () => {
    // O corte é derivado da linha. Sem ela não existe corte, e inventar um seria
    // afirmar um veredito que o modelo não emitiu.
    expect(prestacao(historicoCom(1, 1), null)).toBeNull();
  });

  it('premissa sem critério transcrito não presta contas', () => {
    expect(prestacaoDaPremissa('goals_over_under', 'ritmo_alto', historicoCom(1, 1), 'home', 3.25)).toBeNull();
    expect(temCriterio('goals_over_under', 'ritmo_alto')).toBe(false);
    expect(temCriterio('goals_over_under', 'defesas_firmes')).toBe(true);
  });

  it('o mesmo slug em outro mercado não herda o critério', () => {
    // `defesas_vazaveis` existe em gols (média contra a linha) e em ambos marcam
    // (percentual de clean sheet). Um mapa por slug serviria o critério errado.
    expect(temCriterio('btts', 'defesas_vazaveis')).toBe(false);
  });
});

describe('a guarda de divergência acusa quando a nossa conta discorda do mart', () => {
  it('concordar não produz divergência', () => {
    const p = prestacao(historicoCom(1, 1), 3.25)!;

    expect(p.cruzou).toBe(true);
    expect(divergenciaDaPrestacao(p, true)).toBeNull();
  });

  it('discordar produz divergência com os dois lados e o número', () => {
    const p = prestacao(historicoCom(1, 1), 3.25)!;

    expect(divergenciaDaPrestacao(p, false)).toEqual({
      mercado: 'goals_over_under',
      slug: 'defesas_firmes',
      linha: 3.25,
      insumo: 2,
      corte: 2.95,
      nossa: true,
      doMart: false,
    });
  });

  it('premissa sem prestação não é acusada de divergir', () => {
    // "Não sabemos" não é discordar. Acusar aqui encheria o evento de ruído em
    // todo jogo sem histórico.
    const fora = divergenciasDaSaida('goals_over_under', [], [], 'home', 3.25, ['defesas_firmes']);

    expect(fora).toEqual([]);
  });

  it('a varredura da saída devolve só quem divergiu', () => {
    const hist = historicoCom(1, 1);
    // A nossa conta acende `defesas_firmes`, e o mart não a mandou.
    const fora = divergenciasDaSaida('goals_over_under', ['clean_sheets_altos'], hist, 'home', 3.25, [
      'defesas_firmes',
      'ritmo_alto',
    ]);

    expect(fora.map((d) => d.slug)).toEqual(['defesas_firmes']);
  });
});


// ============================================================================
// Casos capturados, replayados contra a derivação
// ============================================================================
// 22 linhas reais com o histórico da janela da premissa e o booleano que o mart
// publicou, capturados em 03/09/2026:
//
//   · `producao` — 12 linhas do mart de produção, com os DEZ vereditos de cada
//     uma. O histórico veio de uma consulta com o corpo da migration 117, que
//     ainda não estava aplicada lá.
//   · `staging` — 10 linhas do mart de staging, só `defesas_firmes`, capturadas
//     pela RPC 117. Duas delas estão na FAIXA entre o corte e a linha — Lecce x
//     Juventus com 2,50 numa linha 2,5, e Parma x AS Roma com 3,25 numa linha
//     3,5 —, que é o caso em que a tela antiga afirmava o contrário do modelo.
//
// ⚠️ Um caso de staging divergiu na captura e ficou de FORA, e o motivo importa:
// o mart de staging pode ser mais velho que o `fact_fixtures` dele, e aí a janela
// que a tela mede inclui partidas que o mart não viu. Não é defeito da derivação
// — contra produção, os 120 pares (12 linhas × 10 premissas) reproduzem. É por isso
// que a guarda em execução existe: um evento por divergência, para separar "a
// derivação envelheceu" de "o mart está atrás".
//
// Se este bloco reprovar, a derivação parou de reproduzir o modelo. O conserto é
// na derivação — ou, se o modelo mudou, é recapturar e dizer o que mudou. Nunca
// afrouxar a asserção.
// ============================================================================

interface CasoCapturado {
  origem: 'producao' | 'staging';
  fixture_id: number;
  confronto: string;
  linha: number;
  /** Os vereditos que o mart publicou, por slug. Só os que a captura trouxe. */
  veredito: Partial<Record<string, boolean>>;
  jogos: FutebolFixtureHistorico[];
}

const CASOS = CASOS_CAPTURADOS as unknown as CasoCapturado[];

/** Cada par (caso, premissa) que o mart declarou, achatado para o `it.each`. */
const PARES = CASOS.flatMap((caso) =>
  Object.entries(caso.veredito).map(([slug, doMart]) => ({ caso, slug, doMart: doMart! })),
);

describe('a derivação reproduz o veredito do mart', () => {
  it('as dez premissas de gols têm caso dos DOIS lados', () => {
    // Um bloco que só visse `false` nas cinco passaria com a derivação invertida.
    for (const slug of [
      'defesas_firmes',
      'defesas_vazaveis',
      'ataque_combinado',
      'xg_combinado_alto',
      'xg_baixo_combinado',
      'clean_sheets_altos',
      'ambos_vazam',
      'ataques_fracos',
      'historico_over',
      'historico_under',
    ]) {
      const meus = PARES.filter((x) => x.slug === slug);
      expect(meus.filter((x) => x.doMart).length, `${slug} aceso`).toBeGreaterThan(0);
      expect(meus.filter((x) => !x.doMart).length, `${slug} apagado`).toBeGreaterThan(0);
    }
  });

  it.each(
    PARES.map((x) => [`${x.slug} · ${x.caso.confronto} · linha ${x.caso.linha} (${x.caso.origem})`, x] as const),
  )('%s', (_nome, { caso, slug, doMart }) => {
    const p = prestacaoDaPremissa('goals_over_under', slug, caso.jogos, 'home', caso.linha);

    expect(p).not.toBeNull();
    expect(p!.cruzou).toBe(doMart);
    expect(divergenciaDaPrestacao(p!, doMart)).toBeNull();
  });

  it('os casos na faixa entre o corte e a linha não acendem', () => {
    const naFaixa = PARES.filter(({ caso, slug }) => {
      const p = prestacaoDaPremissa('goals_over_under', slug, caso.jogos, 'home', caso.linha);
      return p != null && p.sentido === 'abaixo' && p.insumo > p.corte && p.insumo <= p.linha;
    });

    expect(naFaixa.length).toBeGreaterThanOrEqual(2);
    for (const x of naFaixa) expect(x.doMart).toBe(false);
  });
});

describe('as margens das cinco são as do modelo', () => {
  // Uma tabela em vez de cinco testes: a margem é a única coisa que muda entre
  // elas, e vê-las lado a lado é o que faz a de margem ZERO saltar aos olhos.
  const hist = (valor: number, campo: 'gols_contra' | 'gols_pro' | 'xg'): FutebolFixtureHistorico[] => [
    ...[1, 2].map((i) =>
      jogo({ side: 'home', team_id: 1, team_name: 'Casa', ordem: i, past_fixture_id: i, em_casa: true, [campo]: valor }),
    ),
    ...[1, 2].map((i) =>
      jogo({ side: 'away', team_id: 2, team_name: 'Fora', ordem: i, past_fixture_id: 10 + i, em_casa: false, [campo]: valor }),
    ),
  ];

  it.each([
    ['defesas_firmes', 'gols_contra' as const, -0.3, 'abaixo' as const],
    ['defesas_vazaveis', 'gols_contra' as const, 0, 'acima' as const],
    ['ataque_combinado', 'gols_pro' as const, 0.5, 'acima' as const],
    ['xg_combinado_alto', 'xg' as const, 0.3, 'acima' as const],
    ['xg_baixo_combinado', 'xg' as const, -0.3, 'abaixo' as const],
  ])('%s: margem %s, acende %s do corte', (slug, campo, margem, sentido) => {
    const p = prestacaoDaPremissa('goals_over_under', slug, hist(1, campo), 'home', 2.5)!;

    expect(p.margem).toBe(margem);
    expect(p.sentido).toBe(sentido);
    expect(p.corte).toBe(2.5 + margem);
  });

  it('a que não tem margem compara contra a linha crua', () => {
    // `ga_comb >= line_value`. É a única das cinco em que "fica acima da linha" é
    // uma frase verdadeira, e a tela precisa poder dizer isso sem ressalva.
    const p = prestacaoDaPremissa('goals_over_under', 'defesas_vazaveis', hist(1.25, 'gols_contra'), 'home', 2.5)!;

    expect(p.corte).toBe(p.linha);
    expect(p.insumo).toBe(2.5);
    expect(p.cruzou).toBe(true);
  });

  it('o sentido de cada uma é o seu: as mesmas médias dão vereditos opostos', () => {
    // 1 + 1 = 2,0 numa linha 2,5. Para o Under isso é defesa firme (2,0 <= 2,2);
    // para o Over, não é defesa vazável (2,0 < 2,5). Uma derivação que ignorasse
    // o sentido acenderia ou apagaria as duas juntas.
    const h = hist(1, 'gols_contra');

    expect(prestacaoDaPremissa('goals_over_under', 'defesas_firmes', h, 'home', 2.5)!.cruzou).toBe(true);
    expect(prestacaoDaPremissa('goals_over_under', 'defesas_vazaveis', h, 'home', 2.5)!.cruzou).toBe(false);
  });

  it('o xG não recorta por mando, e as médias de gol recortam', () => {
    // `xg_comb` sai do spine, sem recorte; `ga_comb` soma o mandante em casa com
    // o visitante fora. Um histórico com mandos misturados separa os dois casos.
    const misto: FutebolFixtureHistorico[] = [
      jogo({ side: 'home', team_id: 1, team_name: 'Casa', ordem: 1, past_fixture_id: 1, em_casa: true, gols_contra: 2, xg: 2 }),
      jogo({ side: 'home', team_id: 1, team_name: 'Casa', ordem: 2, past_fixture_id: 2, em_casa: false, gols_contra: 0, xg: 0 }),
      jogo({ side: 'away', team_id: 2, team_name: 'Fora', ordem: 1, past_fixture_id: 11, em_casa: false, gols_contra: 1, xg: 1 }),
      jogo({ side: 'away', team_id: 2, team_name: 'Fora', ordem: 2, past_fixture_id: 12, em_casa: true, gols_contra: 1, xg: 1 }),
    ];

    // Gols sofridos: só o jogo em casa do mandante (2) e o de fora do visitante (1).
    expect(prestacaoDaPremissa('goals_over_under', 'defesas_firmes', misto, 'home', 3.25)!.insumo).toBe(3);
    // xG: os dois jogos de cada, ou seja 1,0 + 1,0.
    expect(prestacaoDaPremissa('goals_over_under', 'xg_baixo_combinado', misto, 'home', 3.25)!.insumo).toBe(2);
  });
});

// ============================================================================
// A família de percentual por time (issue #355, spec #349)
// ============================================================================
// É a família que produziu o defeito mais visível da spec: "os dois passam
// muitos jogos sem sofrer gol" ilustrado com "2,4 gols sofridos por jogo,
// somando os dois". O critério não soma nada — ele olha o percentual de cada
// time separadamente contra um corte fixo.
// ============================================================================

/**
 * Um histórico em que cada time tem exatamente `k` de `n` jogos com a condição.
 *
 * Os jogos com a condição ficam no FIM, porque a janela é dos últimos 10: pô-los
 * no começo faria um histórico de 20 jogos entregar 0%, e o teste mediria a
 * janela em vez do critério.
 */
const comFrequencia = (
  campo: 'sem_sofrer' | 'sem_marcar',
  casa: [number, number],
  fora: [number, number],
): FutebolFixtureHistorico[] => [
  ...Array.from({ length: casa[1] }, (_, i) =>
    jogo({ side: 'home', team_id: 1, team_name: 'Casa', ordem: i + 1, past_fixture_id: i + 1, [campo]: i >= casa[1] - casa[0] }),
  ),
  ...Array.from({ length: fora[1] }, (_, i) =>
    jogo({ side: 'away', team_id: 2, team_name: 'Fora', ordem: i + 1, past_fixture_id: 100 + i, [campo]: i >= fora[1] - fora[0] }),
  ),
];

describe('o percentual é por time, e não uma soma', () => {
  it('cada time tem o seu número e o seu veredito', () => {
    // 5 de 10 (50%) e 3 de 10 (30%), contra o corte de 40%.
    const p = prestacaoDaPremissa(
      'goals_over_under',
      'clean_sheets_altos',
      comFrequencia('sem_sofrer', [5, 10], [3, 10]),
      'home',
      2.5,
    )!;

    expect(p.forma).toBe('percentual_por_time');
    expect(p.escala).toBe('percentual');
    expect(p.parcelas.map((x) => [x.teamName, x.valor, x.cruzou])).toEqual([
      ['Casa', 50, true],
      ['Fora', 30, false],
    ]);
  });

  it('não existe insumo único: somar percentuais de times diferentes não significa nada', () => {
    const p = prestacaoDaPremissa(
      'goals_over_under',
      'clean_sheets_altos',
      comFrequencia('sem_sofrer', [5, 10], [5, 10]),
      'home',
      2.5,
    )!;

    // Nulo, e não a soma nem a média: qualquer número aqui seria a tela
    // publicando uma conta que o modelo não faz.
    expect(p.insumo).toBeNull();
  });

  it('o corte é fixo, e não muda com a linha', () => {
    const hist = comFrequencia('sem_sofrer', [5, 10], [5, 10]);

    for (const linha of [1.5, 2.5, 3.5, 4.5]) {
      const p = prestacaoDaPremissa('goals_over_under', 'clean_sheets_altos', hist, 'home', linha)!;
      expect(p.corte).toBe(40);
      expect(p.linha).toBeNull();
      expect(p.margem).toBeNull();
    }
  });
});

describe('o E e o OU decidem coisas diferentes com os mesmos números', () => {
  it.each([
    // casa, fora, clean_sheets (E, >=40), ataques_fracos (OU, >=35)
    [[5, 10] as [number, number], [5, 10] as [number, number], true, true],
    [[5, 10] as [number, number], [2, 10] as [number, number], false, true],
    [[2, 10] as [number, number], [2, 10] as [number, number], false, false],
  ])('casa %s e fora %s: E=%s, OU=%s', (casa, fora, comE, comOu) => {
    const e = prestacaoDaPremissa(
      'goals_over_under',
      'clean_sheets_altos',
      comFrequencia('sem_sofrer', casa, fora),
      'home',
      2.5,
    )!;
    const ou = prestacaoDaPremissa(
      'goals_over_under',
      'ataques_fracos',
      comFrequencia('sem_marcar', casa, fora),
      'home',
      2.5,
    )!;

    expect(e.combinacao).toBe('e');
    expect(e.cruzou).toBe(comE);
    expect(ou.combinacao).toBe('ou');
    expect(ou.cruzou).toBe(comOu);
  });

  it('no OU, um time sozinho acima do corte acende — e o card sabe qual', () => {
    const p = prestacaoDaPremissa(
      'goals_over_under',
      'ataques_fracos',
      comFrequencia('sem_marcar', [4, 10], [1, 10]),
      'home',
      2.5,
    )!;

    expect(p.cruzou).toBe(true);
    expect(p.parcelas.filter((x) => x.cruzou).map((x) => x.teamName)).toEqual(['Casa']);
  });

  it('no E, um time abaixo derruba — e o card sabe qual', () => {
    const p = prestacaoDaPremissa(
      'goals_over_under',
      'clean_sheets_altos',
      comFrequencia('sem_sofrer', [6, 10], [1, 10]),
      'home',
      2.5,
    )!;

    expect(p.cruzou).toBe(false);
    expect(p.parcelas.filter((x) => !x.cruzou).map((x) => x.teamName)).toEqual(['Fora']);
  });
});

describe('a comparação estrita de ambos_vazam', () => {
  // `home_cs_pct < 35`, e não `<=`. É a única do mercado de gols com comparação
  // estrita, e errar por um passo erra a premissa numa faixa estreita.
  //
  // ⚠️ Exatamente 35% é INALCANÇÁVEL na janela de 10 jogos: o percentual é k/n com
  // n <= 10, e 0,35 exige n = 20. Por isso o teste cerca o corte pelos dois
  // valores vizinhos que existem de verdade, em vez de forjar um 35% que a
  // produção nunca produz.
  it('37,5% não acende, e 33,3% acende', () => {
    const acima = prestacaoDaPremissa(
      'goals_over_under',
      'ambos_vazam',
      comFrequencia('sem_sofrer', [3, 8], [3, 8]),
      'home',
      2.5,
    )!;
    const abaixo = prestacaoDaPremissa(
      'goals_over_under',
      'ambos_vazam',
      comFrequencia('sem_sofrer', [1, 3], [1, 3]),
      'home',
      2.5,
    )!;

    expect(acima.parcelas.map((x) => x.valor)).toEqual([37.5, 37.5]);
    expect(acima.cruzou).toBe(false);
    expect(abaixo.parcelas.map((x) => x.valor)).toEqual([33.33, 33.33]);
    expect(abaixo.cruzou).toBe(true);
  });

  it('a inclusiva do clean sheets acende NO corte', () => {
    // O contraste é o ponto. Aqui 40% exato acende, porque a comparação é `>=`.
    const p = prestacaoDaPremissa(
      'goals_over_under',
      'clean_sheets_altos',
      comFrequencia('sem_sofrer', [4, 10], [4, 10]),
      'home',
      2.5,
    )!;

    expect(p.parcelas.map((x) => x.valor)).toEqual([40, 40]);
    expect(p.cruzou).toBe(true);
  });

  it('e o sentido de ambos_vazam é o oposto do de clean sheets', () => {
    // Os mesmos 40% em cada time: clean sheets acende (>= 40), ambos vazam não
    // (< 35). Uma derivação que ignorasse o sentido acenderia as duas juntas.
    const hist = comFrequencia('sem_sofrer', [4, 10], [4, 10]);

    expect(prestacaoDaPremissa('goals_over_under', 'clean_sheets_altos', hist, 'home', 2.5)!.cruzou).toBe(true);
    expect(prestacaoDaPremissa('goals_over_under', 'ambos_vazam', hist, 'home', 2.5)!.cruzou).toBe(false);
  });
});

describe('as premissas de percentual param de mostrar média de gols', () => {
  it('a frase da lista traz percentual por time, e não uma média somada', () => {
    const p = prestacaoDaPremissa(
      'goals_over_under',
      'clean_sheets_altos',
      comFrequencia('sem_sofrer', [5, 10], [3, 10]),
      'home',
      2.5,
    )!;
    const frase = fraseDaPrestacao(p);

    expect(frase).toContain('Casa 50%');
    expect(frase).toContain('Fora 30%');
    expect(frase).toContain('os dois precisam de');
    // O defeito da spec era exatamente isto aparecer aqui.
    expect(frase).not.toMatch(/gols? sofrid/);
  });

  it('e o OU se anuncia como OU', () => {
    const p = prestacaoDaPremissa(
      'goals_over_under',
      'ataques_fracos',
      comFrequencia('sem_marcar', [5, 10], [1, 10]),
      'home',
      2.5,
    )!;

    expect(fraseDaPrestacao(p)).toContain('basta um com');
  });
});

// ============================================================================
// A família de contagem de jogos (issue #356, spec #349)
// ============================================================================
// O critério conta quantos dos ÚLTIMOS CINCO jogos de cada time ficaram de um
// lado da linha, e exige um mínimo em cada. A tela mostrava a média de gols por
// jogo — que é outra pergunta, e uma média pode estar de um lado da linha
// enquanto a contagem diz o contrário.
// ============================================================================

/** Um histórico com os totais de gols dados, na ordem em que aconteceram. */
const comTotais = (casa: number[], fora: number[]): FutebolFixtureHistorico[] => [
  ...casa.map((t, i) =>
    jogo({ side: 'home', team_id: 1, team_name: 'Casa', ordem: i + 1, past_fixture_id: i + 1, total_gols: t }),
  ),
  ...fora.map((t, i) =>
    jogo({ side: 'away', team_id: 2, team_name: 'Fora', ordem: i + 1, past_fixture_id: 100 + i, total_gols: t }),
  ),
];

const contagem = (slug: string, casa: number[], fora: number[], linha: number) =>
  prestacaoDaPremissa('goals_over_under', slug, comTotais(casa, fora), 'home', linha);

describe('a contagem é por time, contra a linha escolhida', () => {
  it('conta os jogos de cada lado, sem soma e sem média', () => {
    // Casa: 4 dos 5 passaram de 2,5. Fora: 2 dos 5.
    const p = contagem('historico_over', [3, 3, 3, 3, 1], [3, 3, 1, 1, 1], 2.5)!;

    expect(p.forma).toBe('contagem_por_time');
    expect(p.escala).toBe('contagem');
    expect(p.insumo).toBeNull();
    expect(p.parcelas.map((x) => [x.teamName, x.valor, x.cruzou])).toEqual([
      ['Casa', 4, true],
      ['Fora', 2, false],
    ]);
    expect(p.cruzou).toBe(false);
  });

  it('a janela é de CINCO jogos, e não os dez do resto do mercado', () => {
    // Dez jogos, os cinco mais antigos com muitos gols e os cinco recentes sem.
    // Contando dez, seriam 5 acima; contando cinco, zero.
    const p = contagem('historico_over', [5, 5, 5, 5, 5, 0, 0, 0, 0, 0], [5, 5, 5, 5, 5, 0, 0, 0, 0, 0], 2.5)!;

    expect(p.parcelas.map((x) => x.valor)).toEqual([0, 0]);
    expect(p.parcelas.map((x) => x.jogos)).toEqual([5, 5]);
  });

  it('a contagem muda quando o assinante troca de linha', () => {
    const casa = [2, 2, 3, 3, 4];
    const fora = [2, 2, 3, 3, 4];

    expect(contagem('historico_over', casa, fora, 1.5)!.parcelas.map((x) => x.valor)).toEqual([5, 5]);
    expect(contagem('historico_over', casa, fora, 2.5)!.parcelas.map((x) => x.valor)).toEqual([3, 3]);
    expect(contagem('historico_over', casa, fora, 3.5)!.parcelas.map((x) => x.valor)).toEqual([1, 1]);
    // O corte, em compensação, é fixo: são sempre 3 jogos.
    expect(contagem('historico_over', casa, fora, 3.5)!.corte).toBe(3);
  });

  it('a linha inteira não conta o jogo que a empata para lado nenhum', () => {
    // O modelo compara `> line_value` e `< line_value`, os dois estritos. Numa
    // linha de 3,0 o jogo de 3 gols não é over nem under.
    const totais = [3, 3, 3, 4, 2];

    expect(contagem('historico_over', totais, totais, 3)!.parcelas.map((x) => x.valor)).toEqual([1, 1]);
    expect(contagem('historico_under', totais, totais, 3)!.parcelas.map((x) => x.valor)).toEqual([1, 1]);
  });

  it.each([
    // casa, fora, quantos cruzam o mínimo de 3, e o veredito do `E`
    [[3, 3, 3, 1, 1], [3, 3, 3, 1, 1], 2, true],
    [[3, 3, 3, 1, 1], [3, 3, 1, 1, 1], 1, false],
    [[3, 1, 1, 1, 1], [3, 3, 1, 1, 1], 0, false],
  ])('casa %s e fora %s: %s times acima do mínimo, acende=%s', (casa, fora, quantos, acende) => {
    const p = contagem('historico_over', casa, fora, 2.5)!;

    expect(p.combinacao).toBe('e');
    expect(p.parcelas.filter((x) => x.cruzou)).toHaveLength(quantos);
    expect(p.cruzou).toBe(acende);
  });

  it('quando um só falha, o card sabe qual foi', () => {
    const p = contagem('historico_over', [3, 3, 3, 1, 1], [3, 3, 1, 1, 1], 2.5)!;

    expect(p.parcelas.filter((x) => !x.cruzou).map((x) => x.teamName)).toEqual(['Fora']);
  });
});

describe('a média e a contagem podem apontar para lados diferentes', () => {
  it('média acima da linha com a contagem abaixo', () => {
    // Cinco jogos: 0, 0, 0, 0, 15. A média é 3,0 — acima de 2,5. A contagem de
    // jogos acima de 2,5 é UM. Quem lesse a média concluiria o contrário.
    const totais = [0, 0, 0, 0, 15];
    const p = contagem('historico_over', totais, totais, 2.5)!;
    const media = totais.reduce((a, b) => a + b, 0) / totais.length;

    expect(media).toBeGreaterThan(2.5);
    expect(p.parcelas.map((x) => x.valor)).toEqual([1, 1]);
    expect(p.cruzou).toBe(false);
  });

  it('e a média some do gráfico destas duas', () => {
    // O gráfico continua sendo o do total de gols com a linha tracejada, que é o
    // que deixa contar as barras. O que sai é a linha da MÉDIA: ela não é o
    // insumo, e desenhá-la ali oferece o número errado com destaque.
    const story = storyDaPremissa('historico_over', comTotais([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]), 'home', 2.5)!;

    expect(story.series.every((s) => s.mostraMedia)).toBe(false);
    // Já nas de média ela fica.
    const daMedia = storyDaPremissa('defesas_firmes', historicoCom(1, 1), 'home', 2.5)!;
    expect(daMedia.series.every((s) => s.mostraMedia)).toBe(true);
  });
});

describe('quanto faltou para o corte', () => {
  // A premissa some da lista ao arrastar a régua, e o assinante não tinha como
  // saber se ela passou longe ou por cinco centésimos. Foi exatamente o caso que
  // o Victor viu: insumo 2,0, corte 1,95 numa linha 2,25 e 2,2 numa 2,5.
  it('diz por quanto, e com a precisão que separa os dois casos', () => {
    const p = prestacao(historicoCom(1, 1), 2.25)!;

    expect(p.insumo).toBe(2);
    expect(p.corte).toBe(1.95);
    expect(p.cruzou).toBe(false);
    // 0,05 e não "0,1": arredondar dobraria justamente o número que existe para
    // mostrar que faltou pouco.
    expect(distanciaAteOCorte(p)).toBe(', por 0,05');
  });

  it('a mesma média acende cinco centésimos adiante', () => {
    const p = prestacao(historicoCom(1, 1), 2.5)!;

    expect(p.corte).toBe(2.2);
    expect(p.cruzou).toBe(true);
    // Quem cruzou não tem distância a declarar.
    expect(distanciaAteOCorte(p)).toBe('');
  });

  it('percentual e contagem não declaram distância', () => {
    // Ali a comparação é parcela a parcela, e "faltou tanto" seria de qual dos
    // dois times — a pergunta não tem resposta única.
    const pct = prestacaoDaPremissa(
      'goals_over_under',
      'clean_sheets_altos',
      comFrequencia('sem_sofrer', [2, 10], [2, 10]),
      'home',
      2.5,
    )!;

    expect(pct.cruzou).toBe(false);
    expect(distanciaAteOCorte(pct)).toBe('');
  });
});
