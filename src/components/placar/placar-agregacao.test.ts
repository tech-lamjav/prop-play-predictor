import { describe, expect, it } from 'vitest';
import {
  celulaDe,
  liquidarTudo,
  quebrar,
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
