import { describe, expect, it } from 'vitest';
import {
  linhaDoTempo,
  mensagemDoErro,
  soFeedbacks,
  type AnotacaoDoBanco,
  type EventoDeEtapa,
} from './crm-linha-do-tempo';

const anotacao = (over: Partial<AnotacaoDoBanco> = {}): AnotacaoDoBanco => ({
  id: 'a1',
  tipo: 'anotacao',
  texto: 'ligou hoje',
  criada_em: '2026-09-10T12:00:00Z',
  criada_por: 's1',
  ...over,
});

const evento = (over: Partial<EventoDeEtapa> = {}): EventoDeEtapa => ({
  id: 'e1',
  de: 'novo',
  para: 'contatado',
  em: '2026-09-09T12:00:00Z',
  por: 's1',
  ...over,
});

describe('linhaDoTempo', () => {
  it('junta anotações e mudanças de etapa numa lista só', () => {
    // As duas dividem a mesma lista de propósito: a mudança de etapa quase
    // sempre é consequência do que foi anotado logo antes, e separá-las obriga
    // o sócio a remontar a conversa na cabeça.
    const itens = linhaDoTempo([anotacao()], [evento()]);
    expect(itens).toHaveLength(2);
    expect(itens.map((i) => i.natureza)).toEqual(['anotacao', 'etapa']);
  });

  it('ordena do mais recente para o mais antigo', () => {
    const itens = linhaDoTempo(
      [anotacao({ id: 'velha', criada_em: '2026-09-01T12:00:00Z' })],
      [evento({ id: 'novo', em: '2026-09-20T12:00:00Z' })],
    );
    expect(itens.map((i) => i.id)).toEqual(['novo', 'velha']);
  });

  it('carimbos empatados desempatam pelo identificador', () => {
    // Sem desempate a lista troca de ordem entre dois carregamentos, e uma
    // linha do tempo que se reordena sozinha não é linha do tempo.
    const mesmo = '2026-09-10T12:00:00Z';
    const itens = linhaDoTempo(
      [anotacao({ id: 'b', criada_em: mesmo })],
      [evento({ id: 'a', em: mesmo })],
    );
    expect(itens.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('lista vazia é lista vazia, não erro', () => {
    expect(linhaDoTempo([], [])).toEqual([]);
  });

  it('a anotação carrega o tipo e o texto', () => {
    const [item] = linhaDoTempo([anotacao({ tipo: 'objecao', texto: 'achou caro' })], []);
    expect(item).toMatchObject({ natureza: 'anotacao', tipo: 'objecao', texto: 'achou caro' });
  });

  it('o evento carrega de onde para onde', () => {
    const [item] = linhaDoTempo([], [evento({ de: 'proposta', para: 'assinou' })]);
    expect(item).toMatchObject({ natureza: 'etapa', de: 'proposta', para: 'assinou' });
  });
});

describe('soFeedbacks', () => {
  it('deixa passar só o que é feedback', () => {
    const itens = linhaDoTempo(
      [
        anotacao({ id: 'f', tipo: 'feedback' }),
        anotacao({ id: 'n', tipo: 'anotacao' }),
        anotacao({ id: 'o', tipo: 'objecao' }),
      ],
      [evento()],
    );
    expect(soFeedbacks(itens).map((i) => i.id)).toEqual(['f']);
  });

  it('sem feedback nenhum, devolve lista vazia', () => {
    expect(soFeedbacks(linhaDoTempo([anotacao()], [evento()]))).toEqual([]);
  });
});

describe('mensagemDoErro', () => {
  it('perder a marca de sócio não se resolve tentando de novo', () => {
    // O banco levanta duas exceções diferentes. Mandar "tente de novo" para
    // esta é conselho errado: dá para tentar a noite inteira que não grava.
    expect(mensagemDoErro({ message: 'apenas socios' })).toMatch(
      /não está mais marcada como sócio/i,
    );
  });

  it('anotação vazia é dita com clareza', () => {
    expect(mensagemDoErro({ message: 'anotacao vazia' })).toMatch(/vazia/i);
  });

  it('qualquer outra falha cai no genérico', () => {
    expect(mensagemDoErro({ message: 'connection reset' })).toMatch(/tente de novo/i);
    expect(mensagemDoErro(null)).toMatch(/tente de novo/i);
  });
});

describe('tipo desconhecido no banco', () => {
  it('não vira rótulo indefinido na tela', () => {
    const [item] = linhaDoTempo([anotacao({ tipo: 'inventado' })], []);
    expect(item).toMatchObject({ natureza: 'anotacao', tipo: 'anotacao' });
  });
});
