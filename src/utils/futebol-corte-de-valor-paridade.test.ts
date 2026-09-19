import { describe, expect, it } from 'vitest';
import * as painel from './futebol-corte-de-valor';
import * as notificacao from '../../supabase/functions/shared/corte-de-valor';

// ============================================================================
// A guarda que impede as duas cópias do corte de valor de divergirem
// ============================================================================
// Mesma fronteira e mesmo risco da vitrine (`futebol-mercados-ocultos-paridade`):
// o painel roda no browser e as DMs rodam em Deno, então a regra existe duas
// vezes. Se uma cópia mudar e a outra não, a linha some da tela e continua
// chegando no celular — e ninguém vê, porque tela e DM são lidas por pessoas
// diferentes em momentos diferentes.
//
// Compara COMPORTAMENTO, caso a caso, e não texto.
// ============================================================================

const CORTE = [{ market: 'asian_handicap', limiar: -0.02 }];

const PREDICADO: [string, number | null | undefined, { market: string; limiar: number }[]][] = [
  ['goals_over_under', -0.3, CORTE],
  ['asian_handicap', -0.019, CORTE],
  ['asian_handicap', -0.02, CORTE],
  ['asian_handicap', -0.074, CORTE],
  ['asian_handicap', 0.04, CORTE],
  ['asian_handicap', null, CORTE],
  ['asian_handicap', undefined, CORTE],
  ['asian_handicap', Number.NaN, CORTE],
  ['asian_handicap', -0.5, []],
  ['btts', -0.05, [...CORTE, { market: 'btts', limiar: -0.04 }]],
  ['btts', -0.03, [...CORTE, { market: 'btts', limiar: -0.04 }]],
];

describe('as duas cópias do corte concordam', () => {
  it.each(PREDICADO)('passaNoCorteDeValor · %s %s', (market, edge, limiares) => {
    expect(notificacao.passaNoCorteDeValor(market, edge, limiares)).toBe(
      painel.passaNoCorteDeValor(market, edge, limiares),
    );
  });

  it('filtrarCorteDeValor devolve as mesmas linhas', () => {
    const linhas = PREDICADO.map(([market, edge], i) => ({ market, edge, fixture_id: i }));
    expect(notificacao.filtrarCorteDeValor(linhas, CORTE)).toEqual(painel.filtrarCorteDeValor(linhas, CORTE));
    expect(notificacao.filtrarCorteDeValor(linhas, [])).toEqual(painel.filtrarCorteDeValor(linhas, []));
  });
});

// ============================================================================
// ⚠️ A guarda era CEGA para a coluna de publicação
// ============================================================================
// Até aqui, toda linha montada por este arquivo tinha só `market` e `edge`.
// `edge_publicacao` estava SEMPRE ausente, então as duas cópias concordavam à
// toa — e concordariam mesmo se uma delas mudasse de regra.
//
// Foi exatamente o que aconteceu na migration 161: o painel passou a tratar
// `edge_publicacao` nula como "esta linha nunca esteve na tela", a cópia das
// notificações ficou no contrato antigo, e este arquivo passou verde. O
// vazamento que ele existe para impedir é esse mesmo: a linha some da tela e
// chega no celular.
//
// Os casos abaixo exercitam os três estados da coluna, que é o que faltava.
// ============================================================================

type LinhaComPublicacao = { market: string; edge?: number | null; edge_publicacao?: number | null };

const COM_PUBLICACAO: [string, LinhaComPublicacao][] = [
  [
    'nunca apareceu: publicação NULA, apito bom',
    { market: 'asian_handicap', edge: 0.05, edge_publicacao: null },
  ],
  [
    'apareceu bem: publicação boa, apito ruim',
    { market: 'asian_handicap', edge: -0.05, edge_publicacao: -0.01 },
  ],
  [
    'apareceu mal: publicação ruim, apito bom',
    { market: 'asian_handicap', edge: 0.05, edge_publicacao: -0.05 },
  ],
  [
    'banco velho: coluna AUSENTE, cai no apito',
    { market: 'asian_handicap', edge: -0.05 },
  ],
  [
    'coluna presente e indefinida: mesma coisa que ausente',
    { market: 'asian_handicap', edge: -0.05, edge_publicacao: undefined },
  ],
  [
    'mercado sem limiar passa em qualquer combinação',
    { market: 'goals_over_under', edge: -0.3, edge_publicacao: null },
  ],
];

describe('as duas cópias concordam sobre a vantagem de PUBLICAÇÃO', () => {
  it.each(COM_PUBLICACAO)('filtrarCorteDeValor · %s', (_nome, linha) => {
    expect(notificacao.filtrarCorteDeValor([linha], CORTE)).toEqual(
      painel.filtrarCorteDeValor([linha], CORTE),
    );
  });

  it('e concordam com as seis de uma vez, que é como a fila chega', () => {
    const linhas = COM_PUBLICACAO.map(([, linha], i) => ({ ...linha, fixture_id: i }));
    expect(notificacao.filtrarCorteDeValor(linhas, CORTE)).toEqual(
      painel.filtrarCorteDeValor(linhas, CORTE),
    );
  });
});

describe('o fallback do corte é o mesmo dos dois lados', () => {
  it('CORTE_FALLBACK bate', () => {
    expect([...notificacao.CORTE_FALLBACK]).toEqual([...painel.CORTE_FALLBACK]);
  });

  it('o fallback corta alguma coisa — lista vazia derrotaria o propósito', () => {
    expect(painel.CORTE_FALLBACK.length).toBeGreaterThan(0);
  });
});
