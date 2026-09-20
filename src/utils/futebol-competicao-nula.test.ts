import { describe, expect, it } from 'vitest';
import { sortCompetitions } from './futebol-competitions';

// ============================================================================
// A liga nula que apagava a tela
// ============================================================================
// A guarda `futebol_acesso_do_chamador` devolve a linha do board com as colunas
// nulas para quem não tem acesso — e a `competition` vai no pacote, junto com o
// `market`. Conferido chamando a RPC como anônimo em 19/09/2026: 416 linhas de
// 416 com `competition: null`.
//
// O tipo `FutebolValueBoardRow` declara `competition: string` e MENTE: ele
// descreve a linha aberta. A tela de Oportunidades juntava essas ligas num Set
// para montar o filtro, e o `null` chegava aqui e estourava no
// `a.localeCompare(b)`, dentro do `sort`.
//
// Erro em render desmonta a árvore: o que seria uma liga faltando no filtro
// virou /futebol/oportunidades em branco para todo visitante deslogado.
//
// A origem está corrigida na página. Isto prende a rede.
// ============================================================================

describe('sortCompetitions com liga nula', () => {
  it('ignora nulos em vez de derrubar a ordenação', () => {
    expect(() => sortCompetitions([null, 'brasileirao', undefined])).not.toThrow();
    expect(sortCompetitions([null, 'brasileirao', undefined])).toEqual(['brasileirao']);
  });

  // O caso real: TODAS as linhas chegam nulas para quem não tem acesso.
  it('uma lista inteiramente nula vira lista vazia', () => {
    expect(sortCompetitions([null, null, null])).toEqual([]);
  });

  it('não inventa nada quando não há nada', () => {
    expect(sortCompetitions([])).toEqual([]);
  });
});

describe('sortCompetitions continua ordenando como antes', () => {
  // A ordem canônica vem de ALL_COMPETITIONS; quem está fora dela vai para o
  // fim, em ordem alfabética. Nulo entrando não pode ter mexido nisso.
  it('respeita a ordem canônica e joga o desconhecido para o fim', () => {
    const ordenado = sortCompetitions(['zzz_desconhecida', 'brasileirao', 'aaa_desconhecida']);
    expect(ordenado[0]).toBe('brasileirao');
    expect(ordenado.slice(1)).toEqual(['aaa_desconhecida', 'zzz_desconhecida']);
  });

  it('não altera o array recebido', () => {
    const entrada = ['premier_league', 'brasileirao'];
    const copia = [...entrada];
    sortCompetitions(entrada);
    expect(entrada).toEqual(copia);
  });
});
