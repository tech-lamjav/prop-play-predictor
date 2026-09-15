import { describe, expect, it } from 'vitest';
import { liquidarTudo, type LinhaPublicada } from './placar-agregacao';
import { porLadoDoMercado } from './placar-por-premissa';

// ============================================================================
// O ROI por premissa
// ============================================================================
// O que estes testes protegem é o erro que quase foi para a tela: medir a
// premissa contra o mercado inteiro em vez de contra o próprio lado. Em Gols
// isso fazia "defesas vazáveis" parecer render 47 pontos a mais do que quando
// apagada, quando 40 daqueles pontos eram só a diferença entre apostar em Over
// e apostar em Under.
// ============================================================================

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
  market: 'goals_over_under',
  outcome: 'Over',
  line_value: 1.5,
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

/** Over 1,5 com 2 a 0: bateu. Under 1,5 com 2 a 0: não bateu. */
const over = (p: Partial<LinhaPublicada> = {}) => linha({ outcome: 'Over', ...p });
const under = (p: Partial<LinhaPublicada> = {}) => linha({ outcome: 'Under', ...p });

const medir = (publicadas: LinhaPublicada[]) => porLadoDoMercado(liquidarTudo(publicadas).liquidadas);

describe('o lado é a unidade', () => {
  it('Over e Under de Gols são dois lados, e não um mercado', () => {
    const lados = medir([over(), under()]);
    expect(lados.map((l) => l.rotulo).sort()).toEqual([
      'Gols (mais ou menos) · Mais gols',
      'Gols (mais ou menos) · Menos gols',
    ]);
  });

  it('cada lado tem o próprio ROI no cabeçalho', () => {
    // Over bate (odd 2, lucro +1) e Under não (lucro -1). É a diferença que
    // contaminava a leitura por premissa.
    const lados = medir([over(), under()]);
    const doOver = lados.find((l) => l.lado === 'over');
    const doUnder = lados.find((l) => l.lado === 'under');
    expect(doOver?.total.roi).toBeCloseTo(1);
    expect(doUnder?.total.roi).toBeCloseTo(-1);
  });

  it('a premissa só é medida dentro do lado dela', () => {
    // "ritmo alto" é premissa de Over. Ela não aparece na lista do Under, nem
    // as 158 apostas de Under entram no denominador dela.
    const lados = medir([over({ premissas_acesas: ['ritmo_alto'] }), under()]);
    const doOver = lados.find((l) => l.lado === 'over');
    const doUnder = lados.find((l) => l.lado === 'under');
    expect(doOver?.premissas.map((p) => p.slug)).toContain('ritmo_alto');
    expect(doUnder?.premissas.map((p) => p.slug)).not.toContain('ritmo_alto');
  });

  it('o handicap separa favorito de azarão', () => {
    const lados = medir([
      linha({ market: 'asian_handicap', outcome: 'Home', line_value: -1.5 }),
      linha({ market: 'asian_handicap', outcome: 'Home', line_value: 0.5 }),
    ]);
    expect(lados.map((l) => l.lado).sort()).toEqual(['azarao', 'favorito']);
  });

  it('mercado de um lado só não ganha sufixo de lado', () => {
    const lados = medir([linha({ market: 'match_winner', outcome: 'Home', line_value: null })]);
    expect(lados[0].rotulo).toBe('Resultado');
    expect(lados[0].lado).toBeNull();
  });
});

describe('acesa contra apagada', () => {
  const comRitmo = () => over({ premissas_acesas: ['ritmo_alto'] });
  const semRitmo = () => over({ premissas_acesas: [] });
  /** Over 1,5 num 0 a 0: não bateu. */
  const semRitmoRed = () =>
    over({ premissas_acesas: [], goals_home: 0, goals_away: 0 });

  it('mede as duas pontas e a diferença entre elas', () => {
    const lados = medir([comRitmo(), comRitmo(), semRitmoRed(), semRitmoRed()]);
    const ritmo = lados[0].premissas.find((p) => p.slug === 'ritmo_alto');
    expect(ritmo?.acesa.n).toBe(2);
    expect(ritmo?.apagada.n).toBe(2);
    expect(ritmo?.acesa.roi).toBeCloseTo(1);
    expect(ritmo?.apagada.roi).toBeCloseTo(-1);
    expect(ritmo?.diferenca).toBeCloseTo(2);
  });

  it('não afirma diferença quando uma das pontas tem base curta', () => {
    const lados = medir([comRitmo(), semRitmoRed(), semRitmoRed()]);
    const ritmo = lados[0].premissas.find((p) => p.slug === 'ritmo_alto');
    expect(ritmo?.acesa.n).toBe(1);
    expect(ritmo?.dentroDoRuido).toBe(true);
  });

  it('sem a outra ponta, não existe diferença', () => {
    // Todas as linhas com a premissa acesa: não há contra o que comparar.
    const lados = medir([comRitmo(), comRitmo()]);
    const ritmo = lados[0].premissas.find((p) => p.slug === 'ritmo_alto');
    expect(ritmo?.apagada.n).toBe(0);
    expect(ritmo?.diferenca).toBeNull();
    expect(ritmo?.dentroDoRuido).toBe(true);
  });

  it('a premissa que nunca acendeu aparece, com zero', () => {
    // "Nunca acendeu" é informação sobre o catálogo: é candidata a sair dele.
    // Se ela desaparecesse da tabela, ninguém notaria que ela existe.
    const lados = medir([semRitmo()]);
    const nunca = lados[0].premissas.find((p) => p.slug === 'ambos_vazam');
    expect(nunca).toBeDefined();
    expect(nunca?.acesa.n).toBe(0);
  });

  it('e a que mais separa vem primeiro, com a que nunca acendeu no fim', () => {
    const lados = medir([
      over({ premissas_acesas: ['ritmo_alto'] }),
      over({ premissas_acesas: ['ritmo_alto'] }),
      over({ premissas_acesas: [], goals_home: 0, goals_away: 0 }),
      over({ premissas_acesas: [], goals_home: 0, goals_away: 0 }),
    ]);
    const slugs = lados[0].premissas.map((p) => p.slug);
    expect(slugs[0]).toBe('ritmo_alto');
    expect(lados[0].premissas[slugs.length - 1].acesa.n).toBe(0);
  });

  it('linha sem premissa casada conta como nenhuma acesa, e não sai da conta', () => {
    const lados = medir([over({ premissas_acesas: null }), over({ premissas_acesas: null })]);
    expect(lados[0].total.n).toBe(2);
    expect(lados[0].premissas.every((p) => p.acesa.n === 0)).toBe(true);
  });
});
