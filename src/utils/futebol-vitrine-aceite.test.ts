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

describe('o histórico não reabre o mercado escondido', () => {
  // O corte real da #324: o Handicap saiu da vitrine em 01/09.
  const VITRINE = [{ market: 'asian_handicap', ocultoDesde: '2026-09-01T00:00:00Z' }];

  // 2026-09-01 12:00 BRT. O jogo das 10h já começou: nesse caso a linha do
  // HISTÓRICO vence o desempate, e era por aí que o mercado voltava.
  const agora = Date.parse('2026-09-01T15:00:00Z');
  const jogoDeHoje = '2026-09-01T13:00:00';
  const jogoAntesDoCorte = '2026-08-31T13:00:00';

  it('esconde o mercado quando quem vence o desempate é o histórico', () => {
    const hist = [linhaDoBoard('asian_handicap', jogoDeHoje)];
    expect(mergeBoardAndHistory([], hist, agora, VITRINE)).toHaveLength(0);
  });

  it('mantém o que é anterior ao corte, que é registro do que foi visto', () => {
    const hist = [linhaDoBoard('asian_handicap', jogoAntesDoCorte)];
    const saida = mergeBoardAndHistory([], hist, agora, VITRINE);
    expect(saida).toHaveLength(1);
    expect(saida[0].market).toBe('asian_handicap');
  });

  // ── O defeito que esta mudança conserta ───────────────────────────────────
  // A régua antiga cortava por "hoje", então a linha de um dia JÁ PASSADO
  // sempre entrava. Efeito na tela: o jogo de hoje não mostrava Handicap e o
  // MESMO jogo mostrava amanhã, quando a linha passava a vir do histórico. Em
  // produção eram 31 linhas que nunca estiveram em tela nenhuma.
  it('esconde o dia passado que já é posterior ao corte', () => {
    const depois = Date.parse('2026-09-05T15:00:00Z');
    const hist = [linhaDoBoard('asian_handicap', '2026-09-03T13:00:00')];
    expect(mergeBoardAndHistory([], hist, depois, VITRINE)).toHaveLength(0);
  });

  it('a mesma linha de hoje continua escondida amanhã', () => {
    const hist = [linhaDoBoard('asian_handicap', jogoDeHoje)];
    const hoje = mergeBoardAndHistory([], hist, agora, VITRINE);
    const amanha = mergeBoardAndHistory([], hist, agora + 86_400_000, VITRINE);
    expect(amanha).toEqual(hoje);
    expect(amanha).toHaveLength(0);
  });

  it('não mexe nos outros mercados de hoje', () => {
    const hist = [linhaDoBoard('goals_over_under', jogoDeHoje)];
    const saida = mergeBoardAndHistory([], hist, agora, VITRINE);
    expect(saida.map((r) => r.market)).toEqual(['goals_over_under']);
  });

  it('sem vitrine configurada, nada muda', () => {
    const hist = [linhaDoBoard('asian_handicap', jogoDeHoje)];
    expect(mergeBoardAndHistory([], hist, agora, [])).toHaveLength(1);
  });

  // ── O escuro ──────────────────────────────────────────────────────────────
  // Vitrine sem data é o front publicado antes da migration 119. Ali vale a
  // régua antiga — esconde de hoje em diante, não toca no passado —, que é
  // degradação e não regressão.
  describe('vitrine sem data', () => {
    const SEM_DATA = [{ market: 'asian_handicap', ocultoDesde: null }];

    it('ainda esconde o de hoje', () => {
      const hist = [linhaDoBoard('asian_handicap', jogoDeHoje)];
      expect(mergeBoardAndHistory([], hist, agora, SEM_DATA)).toHaveLength(0);
    });

    it('não apaga o passado, que ela não sabe classificar', () => {
      const hist = [linhaDoBoard('asian_handicap', jogoAntesDoCorte)];
      expect(mergeBoardAndHistory([], hist, agora, SEM_DATA)).toHaveLength(1);
    });
  });
});
