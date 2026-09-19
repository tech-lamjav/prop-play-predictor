import { describe, expect, it } from 'vitest';
import { mergeBoardAndHistory } from './futebol-history';
import type { LimiarDeValor } from './futebol-corte-de-valor';

// ============================================================================
// O histórico julga pela vantagem de PUBLICAÇÃO (issue #420, migration 146)
// ============================================================================
// Regra do PM: o que apareceu para o assinante continua aparecendo, e o que
// nunca apareceu some.
//
// O board é reconstruído o tempo todo, então a vantagem muda entre a publicação
// e o apito. Julgando pela do apito, o histórico escondia linha que a pessoa viu
// — e discordava do placar dos sócios, que julga pela de nascimento.
// ============================================================================

const VIGENTE: LimiarDeValor[] = [
  { market: 'asian_handicap', limiar: -0.02, vigenteDesde: '2026-09-15T00:00:00Z' },
];
const AGORA = Date.parse('2026-09-20T15:00:00Z');

const linha = (
  fixture: number,
  edge: number,
  edgePublicacao: number | null | undefined,
  kickoff = '2026-09-17T18:00:00',
) =>
  ({
    fixture_id: fixture,
    home_team_name: 'Casa',
    away_team_name: 'Fora',
    kickoff_utc: kickoff,
    status_short: 'FT',
    market: 'asian_handicap',
    outcome: 'Home',
    line_value: -0.5,
    edge,
    edge_publicacao: edgePublicacao,
    best_odd: 1.9,
    score: 50,
    faixa: 'Média',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

describe('o histórico e a vantagem que o assinante viu', () => {
  it('a linha publicada com vantagem boa FICA, mesmo piorando até o apito', () => {
    // O caso que motivou: −1% na tela, −2,5% no apito. Pela régua do apito ela
    // sumia; pela da publicação ela fica, porque apareceu.
    const fundido = mergeBoardAndHistory([], [linha(1, -0.025, -0.01)], AGORA, [], VIGENTE);
    expect(fundido.map((r) => r.fixture_id)).toEqual([1]);
  });

  it('a linha cortada na publicação SOME, mesmo melhorando até o apito', () => {
    // O espelho do caso acima: nunca esteve na tela, então não volta pelo
    // histórico só porque o preço melhorou depois.
    const fundido = mergeBoardAndHistory([], [linha(2, -0.01, -0.025)], AGORA, [], VIGENTE);
    expect(fundido).toEqual([]);
  });

  it('sem a COLUNA, cai para a vantagem do apito', () => {
    // Histórico anterior à migration 146, ou front novo contra banco velho: a
    // coluna não vem, o valor chega `undefined`, e a régua antiga volta a
    // valer. Degradação, não regressão.
    expect(mergeBoardAndHistory([], [linha(3, -0.025, undefined)], AGORA, [], VIGENTE)).toEqual([]);
    expect(mergeBoardAndHistory([], [linha(6, -0.01, undefined)], AGORA, [], VIGENTE).map((r) => r.fixture_id))
      .toEqual([6]);
  });

  it('⚠️ mas a vantagem NULA some, porque nula quer dizer que nunca apareceu', () => {
    // MUDOU NA MIGRATION 161, e esta asserção era o contrário até ela.
    //
    // Antes, nulo só podia ser banco velho, e os dois casos caíam no apito.
    // Agora o banco devolve nulo DE PROPÓSITO para a linha que nunca teve uma
    // versão visível — mercado fora da vitrine naquele instante, ou vantagem
    // abaixo do limiar a vida inteira. Cair no apito aqui devolveria à tela
    // exatamente a linha que ninguém chegou a ver, que é o defeito que a 119
    // fechou no grão do mercado e a 161 fecha no grão da linha.
    expect(mergeBoardAndHistory([], [linha(4, -0.01, null)], AGORA, [], VIGENTE)).toEqual([]);
  });

  it('antes da vigência do limiar, nada é cortado por vantagem nenhuma', () => {
    const antes = linha(5, -0.05, -0.05, '2026-09-10T18:00:00');
    expect(mergeBoardAndHistory([], [antes], AGORA, [], VIGENTE).map((r) => r.fixture_id)).toEqual([5]);
  });

  it('sem limiar configurado a fusão é a de antes', () => {
    expect(mergeBoardAndHistory([], [linha(6, -0.05, -0.05)], AGORA, [])).toHaveLength(1);
  });
});
