import { describe, expect, it } from 'vitest';
import {
  celulaDe,
  FAIXAS_DO_SCORE,
  faixaDeOdd,
  faixaDoScore,
  liquidarTudo,
  PESO_MEDIDO,
  ehSimulacao,
  naEscalaAntiga,
  faixaDaLinha,
  FAIXA_ESCALA_ANTIGA,
  quebrar,
  quebrarNaOrdem,
  totalDoPeriodo,
  type LinhaPublicada,
} from './placar-agregacao';

// ============================================================================
// A aritmética do placar
// ============================================================================
// Toda conta que o placar da metodologia mostra sai daqui, sem tela e sem rede.
// O que estes testes protegem são as três regras que um painel de ROI erra
// calado:
//
//   · pendente não entra em conta nenhuma, e precisa ser contada à parte;
//   · anulada conta no denominador do ROI e não no da taxa de acerto;
//   · grupo de uma aposta tem erro-padrão zero, e zero aqui não é precisão.
//
// A paridade com `scripts/futebol-roi.mjs` tem arquivo próprio: este cuida do
// comportamento, aquele cuida de a tela e o terminal não discordarem.
// ============================================================================

/** Uma linha publicada, com o mínimo para a conta e o resto no padrão. */
const linha = (p: Partial<LinhaPublicada> = {}): LinhaPublicada => ({
  opportunity_key: Math.random().toString(36).slice(2),
  fixture_id: 1,
  competition: 'Brasileirão',
  home_team_name: 'Casa',
  away_team_name: 'Fora',
  kickoff_utc: '2026-09-10T23:00:00',
  status_short: 'FT',
  goals_home: 2,
  goals_away: 0,
  detectada_em: '2026-09-10T03:00:00',
  market: 'match_winner',
  outcome: 'Home',
  line_value: null,
  best_odd: 2,
  edge: 1,
  score: 65,
  faixa: 'Alta',
  score_versao: 'contexto_v1',
  pts_premissas: 20,
  penalidades: 0,
  premissas_sem_dado: 0,
  modelo_api_concorda: true,
  linha_sharp_confirma: false,
  pen_odd_outlier: false,
  pen_poucas_casas: false,
  pen_odd_longshot: false,
  pen_odd_juice: false,
    premissas_acesas: [],
  ...p,
});

/** Green na odd pedida: mandante vence, aposta no mandante. */
const green = (odd: number, p: Partial<LinhaPublicada> = {}) =>
  linha({ best_odd: odd, goals_home: 2, goals_away: 0, ...p });

/** Red: mandante vence, aposta no visitante. */
const red = (odd: number, p: Partial<LinhaPublicada> = {}) =>
  linha({ best_odd: odd, outcome: 'Away', goals_home: 2, goals_away: 0, ...p });

/** Anulada: handicap zero com empate — o saldo dá exatamente a linha. */
const anulada = (odd: number, p: Partial<LinhaPublicada> = {}) =>
  linha({
    market: 'asian_handicap',
    outcome: 'Home',
    line_value: 0,
    best_odd: odd,
    goals_home: 1,
    goals_away: 1,
    ...p,
  });

describe('liquidarTudo', () => {
  it('não liquida jogo que ainda não terminou, mesmo com placar na mão', () => {
    // O placar de um jogo em andamento já vem preenchido, e liquidar por ele
    // daria green no intervalo. O portão é o estado do jogo, não o placar.
    const { liquidadas, pendentes } = liquidarTudo([
      linha({ status_short: '2H', goals_home: 1, goals_away: 0 }),
    ]);
    expect(liquidadas).toHaveLength(0);
    expect(pendentes).toHaveLength(1);
  });

  it('liquida jogo encerrado, na prorrogação e nos pênaltis também', () => {
    const { liquidadas } = liquidarTudo([
      linha({ status_short: 'FT' }),
      linha({ status_short: 'AET' }),
      linha({ status_short: 'PEN' }),
    ]);
    expect(liquidadas).toHaveLength(3);
  });

  it('não liquida jogo encerrado sem placar', () => {
    const { liquidadas, pendentes } = liquidarTudo([
      linha({ status_short: 'FT', goals_home: null, goals_away: null }),
    ]);
    expect(liquidadas).toHaveLength(0);
    expect(pendentes).toHaveLength(1);
  });

  it('não liquida mercado que a regra não conhece', () => {
    // Mercado novo que chega do mart antes de a regra aprender a liquidá-lo
    // aparece como pendente, e não como red silencioso.
    const { liquidadas, pendentes } = liquidarTudo([linha({ market: 'corners' })]);
    expect(liquidadas).toHaveLength(0);
    expect(pendentes).toHaveLength(1);
  });
});

describe('celulaDe', () => {
  it('de lista vazia, devolve zero e taxa nenhuma', () => {
    // Taxa de acerto de zero aposta não é 0%, é ausência de resposta. Zero
    // faria a tela afirmar que a metodologia errou tudo.
    const c = celulaDe('Gols', []);
    expect(c).toMatchObject({ chave: 'Gols', n: 0, acertos: 0, anuladas: 0, roi: 0, ep: 0 });
    expect(c.taxa).toBeNull();
  });

  it('de uma aposta só, o erro-padrão é zero — e zero aqui não é precisão', () => {
    const { liquidadas } = liquidarTudo([green(2)]);
    const c = celulaDe('Resultado', liquidadas);
    expect(c.n).toBe(1);
    expect(c.roi).toBeCloseTo(1);
    expect(c.taxa).toBeCloseTo(1);
    expect(c.ep).toBe(0);
  });

  it('mede os cinco vereditos no mesmo grupo', () => {
    // Meio green paga metade do lucro; meio red custa meia unidade. As duas
    // metades existem por causa do quarto de gol do handicap asiático.
    const { liquidadas } = liquidarTudo([
      green(2), // +1
      red(2), // -1
      anulada(2), // 0
      linha({ market: 'asian_handicap', outcome: 'Home', line_value: -1.75, best_odd: 2 }), // meio green
      linha({ market: 'asian_handicap', outcome: 'Home', line_value: -2.25, best_odd: 2 }), // meio red
    ]);
    const c = celulaDe('Handicap', liquidadas);
    expect(c.n).toBe(5);
    // +1 -1 +0 +0,5 -0,5 = 0
    expect(c.roi).toBeCloseTo(0);
    // Acertos: green e meio green. Denominador: 4, sem a anulada.
    expect(c.acertos).toBe(2);
    expect(c.anuladas).toBe(1);
    expect(c.taxa).toBeCloseTo(0.5);
  });

  it('a anulada fica no denominador do ROI e sai do da taxa', () => {
    // É a diferença que faz os dois números terem denominadores diferentes, e
    // a tela mostra os dois lados justamente por isso.
    const { liquidadas } = liquidarTudo([green(2), anulada(2)]);
    const c = celulaDe('Handicap', liquidadas);
    expect(c.n).toBe(2);
    expect(c.roi).toBeCloseTo(0.5); // (+1 + 0) / 2
    expect(c.taxa).toBeCloseTo(1); // 1 acerto / 1 decidida
  });

  it('de só anuladas, não tem taxa de acerto', () => {
    const { liquidadas } = liquidarTudo([anulada(2), anulada(2)]);
    const c = celulaDe('Handicap', liquidadas);
    expect(c.n).toBe(2);
    expect(c.roi).toBeCloseTo(0);
    expect(c.taxa).toBeNull();
  });
});

describe('quebrar', () => {
  it('agrupa pela chave e ordena pelo tamanho da base', () => {
    // A ordem é o tamanho da base, e não o ROI: a primeira linha da tabela é a
    // que a amostra sustenta, não a que soa melhor.
    const { liquidadas } = liquidarTudo([
      green(2, { market: 'match_winner' }),
      red(2, { market: 'match_winner' }),
      green(2, { market: 'goals_over_under', outcome: 'Over', line_value: 1.5 }),
    ]);
    const celulas = quebrar(liquidadas, (l) => l.market);
    expect(celulas.map((c) => c.chave)).toEqual(['match_winner', 'goals_over_under']);
    expect(celulas.map((c) => c.n)).toEqual([2, 1]);
  });

  it('não inventa linha para grupo sem aposta liquidada', () => {
    const { liquidadas } = liquidarTudo([linha({ status_short: '2H' })]);
    expect(quebrar(liquidadas, (l) => l.market)).toEqual([]);
  });

  it('desempata pelo nome, para a tabela não dançar entre recargas', () => {
    const { liquidadas } = liquidarTudo([
      green(2, { competition: 'Série B' }),
      green(2, { competition: 'Brasileirão' }),
    ]);
    expect(quebrar(liquidadas, (l) => l.competition).map((c) => c.chave)).toEqual([
      'Brasileirão',
      'Série B',
    ]);
  });
});

describe('totalDoPeriodo', () => {
  it('conta a pendente à parte, e fora de toda conta', () => {
    const publicadas = [green(2), red(2), linha({ status_short: 'NS', goals_home: null, goals_away: null })];
    const t = totalDoPeriodo(publicadas);
    expect(t.publicadas).toBe(3);
    expect(t.n).toBe(2);
    expect(t.pendentes).toBe(1);
    expect(t.roi).toBeCloseTo(0);
  });

  it('de período sem nada, não afirma nada', () => {
    const t = totalDoPeriodo([]);
    expect(t).toMatchObject({ publicadas: 0, n: 0, pendentes: 0, roi: 0 });
    expect(t.taxa).toBeNull();
  });
});

describe('as faixas', () => {
  it('o Score muda de faixa exatamente nos limites', () => {
    // Fronteira dos dois lados: a nota 30 é Média, e 29 ainda é Baixa. Um `<=`
    // no lugar errado move uma faixa inteira de lugar sem quebrar nada.
    expect(faixaDoScore(0)).toBe('Baixa (<30)');
    expect(faixaDoScore(29)).toBe('Baixa (<30)');
    expect(faixaDoScore(30)).toBe('Média (30–59)');
    expect(faixaDoScore(59)).toBe('Média (30–59)');
    expect(faixaDoScore(60)).toBe('Alta (60–79)');
    expect(faixaDoScore(79)).toBe('Alta (60–79)');
    expect(faixaDoScore(80)).toBe('Alta (80+)');
    expect(faixaDoScore(100)).toBe('Alta (80+)');
  });

  it('a odd muda de faixa exatamente nos limites', () => {
    expect(faixaDeOdd(1.25)).toBe('1.25–1.59');
    expect(faixaDeOdd(1.59)).toBe('1.25–1.59');
    expect(faixaDeOdd(1.6)).toBe('1.60–1.99');
    expect(faixaDeOdd(1.99)).toBe('1.60–1.99');
    expect(faixaDeOdd(2.0)).toBe('2.00–2.59');
    expect(faixaDeOdd(2.59)).toBe('2.00–2.59');
    expect(faixaDeOdd(2.6)).toBe('2.60–4.00');
    expect(faixaDeOdd(4)).toBe('2.60–4.00');
  });
});

describe('quebrarNaOrdem', () => {
  it('mantém a ordem da escala, e não a da base', () => {
    // A pergunta da tabela de faixas é se o resultado sobe ao subir o degrau.
    // Ordenada pela base, a resposta desaparece.
    const { liquidadas } = liquidarTudo([
      green(2, { score: 85 }),
      green(2, { score: 20 }),
      green(2, { score: 20 }),
      green(2, { score: 20 }),
    ]);
    const celulas = quebrarNaOrdem(
      liquidadas,
      (l) => faixaDoScore(l.score),
      FAIXAS_DO_SCORE,
    );
    expect(celulas.map((c) => c.chave)).toEqual(['Baixa (<30)', 'Alta (80+)']);
  });

  it('não cria linha para faixa sem aposta liquidada', () => {
    const { liquidadas } = liquidarTudo([green(2, { score: 65 })]);
    const celulas = quebrarNaOrdem(liquidadas, (l) => faixaDoScore(l.score), FAIXAS_DO_SCORE);
    expect(celulas).toHaveLength(1);
    expect(celulas[0].chave).toBe('Alta (60–79)');
  });
});

describe('o peso por faixa de Score', () => {
  const MEIO = { 'Baixa (<30)': 0, 'Média (30–59)': 0.5, 'Alta (60–79)': 1, 'Alta (80+)': 1 };

  it('peso zero não é aposta de zero: a linha sai da conta e é contada à parte', () => {
    const { liquidadas, foraDaSimulacao } = liquidarTudo([green(2, { score: 20 })], MEIO);
    expect(liquidadas).toHaveLength(0);
    expect(foraDaSimulacao).toHaveLength(1);
  });

  it('meia unidade paga metade e pesa metade no denominador', () => {
    // Uma aposta de meia unidade com green de odd 2: lucro 1 por unidade, meia
    // unidade apostada. ROI = 0,5/0,5 = 1 — o mesmo ROI, com metade do risco.
    const { liquidadas } = liquidarTudo([green(2, { score: 40 })], MEIO);
    const c = celulaDe('Gols', liquidadas);
    expect(c.n).toBe(1);
    expect(c.unidades).toBeCloseTo(0.5);
    expect(c.roi).toBeCloseTo(1);
  });

  it('e o ROI muda quando os pesos mudam o mix', () => {
    // Green de meia unidade na Média, red de uma unidade na Alta:
    // lucro = 0,5·1 + 1·(−1) = −0,5 sobre 1,5 unidades = −33,3%.
    const { liquidadas } = liquidarTudo(
      [green(2, { score: 40 }), red(2, { score: 65 })],
      MEIO,
    );
    const c = celulaDe('tudo', liquidadas);
    expect(c.unidades).toBeCloseTo(1.5);
    expect(c.roi).toBeCloseTo(-1 / 3, 5);
  });

  it('no modo medido, unidades e apostas são o mesmo número', () => {
    const { liquidadas } = liquidarTudo([green(2), red(2)]);
    const c = celulaDe('tudo', liquidadas);
    expect(c.n).toBe(2);
    expect(c.unidades).toBe(2);
    expect(c.roi).toBeCloseTo(0);
  });

  it('o total conta as três coisas: liquidadas, pendentes e fora da simulação', () => {
    const t = totalDoPeriodo(
      [green(2, { score: 20 }), green(2, { score: 65 }), linha({ status_short: 'NS' })],
      MEIO,
    );
    expect(t.publicadas).toBe(3);
    expect(t.n).toBe(1);
    expect(t.pendentes).toBe(1);
    expect(t.foraDaSimulacao).toBe(1);
  });
});

describe('a régua velha do Score', () => {
  // A virada do denominador entrou às 14h35 UTC de 04/09. Linha nascida antes
  // tem nota em outra escala — e a primeira versão desta tela JOGAVA FORA todas
  // elas, em nome da série comparável. No período padrão isso era 930 de 1.919
  // apostas liquidadas, quase metade da amostra, e 121 das 174 de nota alta.
  const velha = { detectada_em: '2026-09-04T03:00:00' };
  const nova = { detectada_em: '2026-09-04T18:00:00' };

  it('reconhece de que lado da virada a linha nasceu', () => {
    expect(naEscalaAntiga(linha(velha))).toBe(true);
    expect(naEscalaAntiga(linha(nova))).toBe(false);
  });

  it('a linha velha tem faixa própria, e não entra na faixa da nota', () => {
    expect(faixaDaLinha(linha({ ...velha, score: 85 }))).toBe(FAIXA_ESCALA_ANTIGA);
    expect(faixaDaLinha(linha({ ...nova, score: 85 }))).toBe('Alta (80+)');
  });

  it('e ela CONTA: some da tabela de faixa, não da amostra', () => {
    // O ROI por mercado, por campeonato e por premissa não dependem da escala da
    // nota. Descartar a linha inteira por causa da faixa era jogar fora medição
    // boa.
    const { liquidadas } = liquidarTudo([green(2, { ...velha, score: 85 }), green(2, nova)]);
    expect(liquidadas).toHaveLength(2);
    expect(celulaDe('tudo', liquidadas).n).toBe(2);
  });

  it('o peso da régua velha é próprio, e nasce em uma unidade', () => {
    // Simular "não apostar na Baixa" não pode decidir calado o que fazer com uma
    // nota que não é comparável com a Baixa.
    expect(PESO_MEDIDO[FAIXA_ESCALA_ANTIGA]).toBe(1);
    const { liquidadas } = liquidarTudo([green(2, { ...velha, score: 20 })], {
      ...PESO_MEDIDO,
      'Baixa (<30)': 0,
    });
    expect(liquidadas).toHaveLength(1);
  });
});
