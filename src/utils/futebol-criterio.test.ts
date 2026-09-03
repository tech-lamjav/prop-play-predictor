import { describe, expect, it } from 'vitest';
import {
  divergenciaDaPrestacao,
  divergenciasDaSaida,
  prestacaoDaPremissa,
  temCriterio,
} from './futebol-criterio';
import type { FutebolFixtureHistorico } from '@/services/futebol-data.service';
import CASOS_DE_PRODUCAO from './__fixtures__/futebol-defesas-firmes-producao.json';

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

    expect(p.parcelas).toEqual([
      { teamName: 'Casa', valor: 1 },
      { teamName: 'Fora', valor: 2 },
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

    expect(p.base).toEqual([
      { teamId: 1, teamName: 'Casa', jogos: 3, daJanela: 3 },
      { teamId: 2, teamName: 'Fora', jogos: 3, daJanela: 3 },
    ]);
  });

  it('histórico mais curto que o teto deriva mesmo assim', () => {
    const curto = [
      jogo({ side: 'home', team_id: 1, team_name: 'Casa', ordem: 1, em_casa: true, gols_contra: 1 }),
      jogo({ side: 'away', team_id: 2, team_name: 'Fora', ordem: 1, past_fixture_id: 2, em_casa: false, gols_contra: 1 }),
    ];
    const p = prestacao(curto, 3.25)!;

    expect(p.insumo).toBe(2);
    expect(p.base.map((b) => b.jogos)).toEqual([1, 1]);
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

    expect(p.base[0]).toEqual({ teamId: 1, teamName: 'Casa', jogos: 2, daJanela: 5 });
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
// Casos capturados de produção
// ============================================================================
// Dez linhas reais do mart de dev (int_futebol_premissas_ou) com o histórico que
// a RPC 117 devolve para elas, capturados em 03/09/2026. Duas delas estão na
// FAIXA entre o corte e a linha — Lecce x Juventus com 2,50 numa linha 2,5, e
// Parma x AS Roma com 3,25 numa linha 3,5 —, que é exatamente o caso em que a
// tela antiga afirmava o contrário do modelo.
//
// Se este bloco reprovar, a derivação parou de reproduzir o modelo. O conserto é
// na derivação — ou, se o modelo mudou, é recapturar os casos e dizer o que
// mudou. Nunca afrouxar a asserção.
// ============================================================================

interface CasoDeProducao {
  fixture_id: number;
  confronto: string;
  linha: number;
  defesas_firmes: boolean;
  jogos: FutebolFixtureHistorico[];
}

const CASOS = CASOS_DE_PRODUCAO as unknown as CasoDeProducao[];

describe('a derivação reproduz o veredito do mart', () => {
  it('há casos dos dois lados, para o teste não passar por um só', () => {
    expect(CASOS.filter((c) => c.defesas_firmes).length).toBeGreaterThan(0);
    expect(CASOS.filter((c) => !c.defesas_firmes).length).toBeGreaterThan(0);
  });

  it.each(CASOS.map((c) => [`${c.confronto} · linha ${c.linha}`, c] as const))(
    '%s',
    (_nome, caso) => {
      const p = prestacaoDaPremissa('goals_over_under', 'defesas_firmes', caso.jogos, 'home', caso.linha);

      expect(p).not.toBeNull();
      expect(p!.cruzou).toBe(caso.defesas_firmes);
      expect(divergenciaDaPrestacao(p!, caso.defesas_firmes)).toBeNull();
    },
  );

  it('os dois casos da faixa não acendem, apesar de ficarem abaixo da linha', () => {
    const naFaixa = CASOS.filter((c) => {
      const p = prestacaoDaPremissa('goals_over_under', 'defesas_firmes', c.jogos, 'home', c.linha);
      return p != null && p.insumo > p.corte && p.insumo <= p.linha;
    });

    expect(naFaixa.length).toBeGreaterThanOrEqual(2);
    for (const c of naFaixa) expect(c.defesas_firmes).toBe(false);
  });
});
