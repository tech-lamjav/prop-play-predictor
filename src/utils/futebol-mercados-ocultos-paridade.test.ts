import { describe, expect, it } from 'vitest';
import * as painel from './futebol-mercados-ocultos';
import * as notificacao from '../../supabase/functions/shared/mercados-ocultos';

// ============================================================================
// A guarda que impede as duas cópias da vitrine de divergirem (#324)
// ============================================================================
// A regra "este mercado sai da tela" existe DUAS vezes, e tem de existir: o
// painel roda no browser e as DMs rodam em Deno, que não alcança o `src/`. É a
// mesma fronteira do `shared/faixa.ts`.
//
// A diferença é que ali a cópia é inevitável e inofensiva, e aqui ela seria um
// bug com cara de nada: o painel esconde o mercado, a DM continua mandando, e o
// assinante recebe no celular o que sumiu da tela. Ninguém veria, porque tela e
// DM são lidas por pessoas diferentes em momentos diferentes — que é exatamente
// como as 27 divergências de copy sobreviveram até a guarda da issue #272.
//
// Esta guarda compara COMPORTAMENTO, caso a caso, e não texto. Se alguém mexer
// numa cópia e esquecer a outra, o PR quebra aqui.
// ============================================================================

const CASOS: { nome: string; linhas: { market: string }[]; ocultos: string[] }[] = [
  { nome: 'lista vazia', linhas: [{ market: 'goals_over_under' }], ocultos: [] },
  {
    nome: 'esconde um',
    linhas: [{ market: 'goals_over_under' }, { market: 'asian_handicap' }],
    ocultos: ['asian_handicap'],
  },
  {
    nome: 'esconde vários',
    linhas: [{ market: 'btts' }, { market: 'asian_handicap' }, { market: 'double_chance' }],
    ocultos: ['asian_handicap', 'btts'],
  },
  {
    nome: 'esconde tudo',
    linhas: [{ market: 'asian_handicap' }, { market: 'asian_handicap' }],
    ocultos: ['asian_handicap'],
  },
  { nome: 'sem linhas', linhas: [], ocultos: ['asian_handicap'] },
  {
    nome: 'mercado oculto que não aparece nas linhas',
    linhas: [{ market: 'match_winner' }],
    ocultos: ['btts'],
  },
];

describe('as duas cópias da vitrine concordam', () => {
  it.each(CASOS)('filtrarMercadosOcultos · $nome', ({ linhas, ocultos }) => {
    expect(notificacao.filtrarMercadosOcultos(linhas, ocultos)).toEqual(
      painel.filtrarMercadosOcultos(linhas, ocultos),
    );
  });

  it.each([
    ['asian_handicap', ['asian_handicap']],
    ['goals_over_under', ['asian_handicap']],
    ['asian_handicap', []],
    ['btts', ['asian_handicap', 'btts']],
  ] as const)('mercadoEstaOculto · %s', (market, ocultos) => {
    expect(notificacao.mercadoEstaOculto(market, [...ocultos])).toBe(
      painel.mercadoEstaOculto(market, [...ocultos]),
    );
  });

  // Os dois conjuntos de exports NÃO são iguais, e não deveriam ser: a leitura
  // da RPC mora no `carregarMercadosOcultos` do lado Deno e no service do lado
  // do painel, e o `filtrarCatalogoDeMercados` só existe no painel, porque só
  // ele monta prateleira a partir do catálogo. O que tem de existir dos dois
  // lados é o PAR DE PREDICADOS — é ele que decide o que o assinante vê.
  it('os dois predicados existem dos dois lados', () => {
    for (const nome of ['mercadoEstaOculto', 'filtrarMercadosOcultos'] as const) {
      expect(typeof painel[nome]).toBe('function');
      expect(typeof notificacao[nome]).toBe('function');
    }
  });
});

describe('o fallback da vitrine é o mesmo dos dois lados', () => {
  // Se as duas listas se afastarem, o painel e a DM discordam exatamente na
  // janela em que ninguém está olhando: a de antes da migration. É a mesma
  // classe de defeito das 27 divergências de copy da issue #272.
  it('VITRINE_FALLBACK bate', () => {
    expect([...notificacao.VITRINE_FALLBACK]).toEqual([...painel.VITRINE_FALLBACK]);
  });

  it('o fallback esconde alguma coisa — lista vazia derrotaria o propósito', () => {
    expect(painel.VITRINE_FALLBACK.length).toBeGreaterThan(0);
  });
});
