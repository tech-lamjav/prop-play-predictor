import { describe, expect, it } from 'vitest';
import { mergeBoardAndHistory } from './futebol-history';
import { resumoDosMercados } from './futebol-leitura';
import { filtrarCatalogoDeMercados } from './futebol-mercados-ocultos';
import { MERCADOS } from './futebol-premissas';

// ============================================================================
// O aceite da #324, no nível do comportamento
// ============================================================================
// O primeiro teste que eu escrevi cobria só o predicado puro sobre arrays
// literais, e o code review mostrou por que isso não bastava: o predicado
// passava e o mercado continuava na tela, porque a prateleira do detalhe sai do
// CATÁLOGO e a lista de hoje pode vir do HISTÓRICO. Estes casos travam os dois
// caminhos que o review encontrou.
// ============================================================================

const OCULTOS = ['asian_handicap'];

const linhaDoBoard = (market: string, kickoff: string) => ({
  fixture_id: 1,
  home_team_id: 1,
  away_team_id: 2,
  home_team_name: 'Casa',
  away_team_name: 'Fora',
  competition: 'brasileirao',
  kickoff_utc: kickoff,
  status_short: 'NS',
  market,
  outcome: 'Home',
  line_value: -0.5,
  edge: 0.03,
  best_odd: 1.9,
  best_book: 'X',
  avg_odd: 1.85,
  n_casas: 8,
  janela_usada: 't1h',
  prob_justa_fechamento: 0.55,
  pts_premissas: 30,
  penalidades: 0,
  score: 50,
  faixa: 'Média',
  evidencias: [],
  premissas_sem_dado: 0,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;

describe('a prateleira do detalhe respeita a vitrine', () => {
  it('o catálogo perde o mercado escondido', () => {
    const visiveis = filtrarCatalogoDeMercados(MERCADOS, OCULTOS);
    expect(visiveis.map((m) => m.slug)).not.toContain('asian_handicap');
    expect(visiveis).toHaveLength(MERCADOS.length - 1);
  });

  it('resumoDosMercados não devolve o mercado escondido', () => {
    // Uma linha de premissas por mercado, com a primeira premissa acesa — o
    // bastante para o mercado aparecer na prateleira se nada o esconder.
    const premissas = MERCADOS.map((m) => ({
      market: m.slug,
      outcome: 'Home',
      line_value: null,
      pts_premissas: 10,
      penalidades_pts: 0,
      acesas: m.premissas.length ? [m.premissas[0].slug] : [],
      apagadas: [],
      penalidades: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any;

    const comVitrine = resumoDosMercados(premissas, [], null, OCULTOS).map((r) => r.mercado.slug);
    const semVitrine = resumoDosMercados(premissas, [], null, []).map((r) => r.mercado.slug);

    expect(semVitrine).toContain('asian_handicap');
    expect(comVitrine).not.toContain('asian_handicap');
    expect(comVitrine).toHaveLength(semVitrine.length - 1);
  });
});

describe('a lista de hoje não reabre o mercado pelo histórico', () => {
  // 2026-09-01 12:00 BRT. O jogo das 10h já começou: nesse caso a linha do
  // HISTÓRICO vence o desempate, e era por aí que o mercado voltava.
  const agora = Date.parse('2026-09-01T15:00:00Z');
  const jogoDeHoje = '2026-09-01T13:00:00';
  const jogoDeOntem = '2026-08-31T13:00:00';

  it('esconde o mercado quando quem vence o desempate é o histórico', () => {
    const hist = [linhaDoBoard('asian_handicap', jogoDeHoje)];
    const saida = mergeBoardAndHistory([], hist, agora, OCULTOS);
    expect(saida).toHaveLength(0);
  });

  it('mantém o mercado no dia passado, que é registro do que foi visto', () => {
    const hist = [linhaDoBoard('asian_handicap', jogoDeOntem)];
    const saida = mergeBoardAndHistory([], hist, agora, OCULTOS);
    expect(saida).toHaveLength(1);
    expect(saida[0].market).toBe('asian_handicap');
  });

  it('não mexe nos outros mercados de hoje', () => {
    const hist = [linhaDoBoard('goals_over_under', jogoDeHoje)];
    const saida = mergeBoardAndHistory([], hist, agora, OCULTOS);
    expect(saida.map((r) => r.market)).toEqual(['goals_over_under']);
  });

  it('sem vitrine configurada, nada muda', () => {
    const hist = [linhaDoBoard('asian_handicap', jogoDeHoje)];
    expect(mergeBoardAndHistory([], hist, agora, [])).toHaveLength(1);
  });
});
