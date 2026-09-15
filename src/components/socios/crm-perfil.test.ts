import { describe, expect, it } from 'vitest';
import {
  comOTotal,
  ehPerfil,
  emPorcento,
  MINIMO_PARA_PERFIL,
  montarPerfil,
  principal,
  roiDe,
  type PerfilDoBanco,
} from './crm-perfil';

const linha = (over: Partial<PerfilDoBanco> = {}): PerfilDoBanco => ({
  total: 10,
  liquidadas: 8,
  primeira: '2026-01-10T12:00:00Z',
  ultima: '2026-09-01T12:00:00Z',
  apostado: '800.00',
  lucro: '-64.00',
  por_esporte: null,
  por_mercado: null,
  por_faixa_de_odd: null,
  ...over,
});

describe('roiDe', () => {
  it('é o lucro sobre o apostado, em porcentagem', () => {
    expect(roiDe(80, 800)).toBeCloseTo(10);
    expect(roiDe(-64, 800)).toBeCloseTo(-8);
  });

  it('sem nada apostado é nulo, e NÃO zero', () => {
    // ⚠️ Zero por cento é uma afirmação: "apostou e empatou". Quem só tem
    // aposta em aberto não afirmou nada ainda, e perto de 72% das apostas da
    // base ficam em aberto para sempre — então este é o caso comum.
    expect(roiDe(0, 0)).toBeNull();
    expect(roiDe(50, 0)).toBeNull();
  });
});

describe('montarPerfil', () => {
  it('os números do banco viram números', () => {
    // `numeric` chega como texto no PostgREST, e somar texto concatena.
    const p = montarPerfil(linha());
    expect(p.apostado).toBe(800);
    expect(p.lucro).toBe(-64);
    expect(p.roi).toBeCloseTo(-8);
  });

  it('recorte vazio vira lista vazia, e não quebra', () => {
    const p = montarPerfil(linha());
    expect(p.porEsporte).toEqual([]);
    expect(p.porMercado).toEqual([]);
    expect(p.porFaixaDeOdd).toEqual([]);
  });

  it('cada recorte ganha o próprio ROI', () => {
    const p = montarPerfil(
      linha({
        por_mercado: [{ nome: 'Over/Under', n: 6, apostado: '300.00', lucro: '30.00' }],
      }),
    );
    expect(p.porMercado[0].roi).toBeCloseTo(10);
  });

  it('mercado e esporte vêm do maior para o menor, por QUANTIDADE', () => {
    // ⚠️ A ordem sai daqui, e não do SQL. A função do banco ordena os esportes
    // por `x->>'lucro'`, que compara número como TEXTO: "9" vem depois de
    // "100", e um prejuízo de "-50" vai para o topo.
    const p = montarPerfil(
      linha({
        por_esporte: [
          { nome: 'Basquete', n: 2, apostado: '100', lucro: '100' },
          { nome: 'Futebol', n: 9, apostado: '900', lucro: '-50' },
        ],
      }),
    );
    expect(p.porEsporte.map((r) => r.nome)).toEqual(['Futebol', 'Basquete']);
  });

  it('empate de quantidade desempata pelo nome, e não pela sorte', () => {
    const p = montarPerfil(
      linha({
        por_mercado: [
          { nome: 'Resultado', n: 3, apostado: '100', lucro: '0' },
          { nome: 'Ambas marcam', n: 3, apostado: '100', lucro: '0' },
        ],
      }),
    );
    expect(p.porMercado.map((r) => r.nome)).toEqual(['Ambas marcam', 'Resultado']);
  });

  it('as faixas de odd saem na sequência delas, e não na da quantidade', () => {
    // Fora de ordem elas deixam de ser uma distribuição: ninguém lê "3.00 a
    // 4.99, até 1.50, 2.00 a 2.99" como um perfil de risco.
    //
    // ⚠️ As quantidades CRESCEM ao longo da sequência de propósito. A primeira
    // versão deste teste tinha a faixa mais usada também sendo a primeira da
    // sequência, então ordenar por quantidade dava o mesmo resultado e o teste
    // ficava verde com a ordenação errada.
    const p = montarPerfil(
      linha({
        por_faixa_de_odd: [
          { nome: '3.00 a 4.99', n: 9, apostado: '90', lucro: '0', ordem: 4 },
          { nome: 'até 1.50', n: 1, apostado: '10', lucro: '0', ordem: 1 },
          { nome: '2.00 a 2.99', n: 5, apostado: '50', lucro: '0', ordem: 3 },
        ],
      }),
    );
    expect(p.porFaixaDeOdd.map((r) => r.nome)).toEqual([
      'até 1.50',
      '2.00 a 2.99',
      '3.00 a 4.99',
    ]);
  });

  it('faixa com nome desconhecido vai para o fim, e não para o topo', () => {
    // Se o SQL mudar os nomes um dia, a tela fica estranha no rodapé em vez de
    // afirmar que a pessoa aposta em odd baixa.
    const p = montarPerfil(
      linha({
        por_faixa_de_odd: [
          { nome: 'coisa nova', n: 1, apostado: '10', lucro: '0' },
          { nome: 'até 1.50', n: 2, apostado: '20', lucro: '0' },
        ],
      }),
    );
    expect(p.porFaixaDeOdd.map((r) => r.nome)).toEqual(['até 1.50', 'coisa nova']);
  });
});

describe('principal', () => {
  it('é o recorte com mais apostas', () => {
    const p = montarPerfil(
      linha({
        por_mercado: [
          { nome: 'Resultado', n: 2, apostado: '100', lucro: '500' },
          { nome: 'Over/Under', n: 8, apostado: '400', lucro: '-10' },
        ],
      }),
    );
    // Por quantidade, e não por lucro: a pergunta é como a pessoa aposta, e
    // quem responde isso é onde ela vai mais vezes. O maior lucro costuma ser
    // uma aposta grande que deu certo.
    expect(principal(p.porMercado)?.nome).toBe('Over/Under');
  });

  it('sem recorte nenhum, é nulo', () => {
    expect(principal([])).toBeNull();
  });
});

describe('ehPerfil', () => {
  it('poucas apostas não descrevem ninguém', () => {
    // "Aposta mais em Over/Under" com N de 3 é uma frase que mente, e o sócio a
    // levaria para a conversa.
    expect(ehPerfil({ nome: 'x', n: MINIMO_PARA_PERFIL - 1, apostado: 0, lucro: 0, roi: null })).toBe(
      false,
    );
    expect(ehPerfil({ nome: 'x', n: MINIMO_PARA_PERFIL, apostado: 0, lucro: 0, roi: null })).toBe(
      true,
    );
  });

  it('sem recorte, não é perfil', () => {
    expect(ehPerfil(null)).toBe(false);
  });
});

describe('como os números aparecem', () => {
  it('o ROI leva o sinal, porque menos e mais mudam a conversa', () => {
    expect(emPorcento(12.34)).toBe('+12,3%');
    expect(emPorcento(-8)).toBe('-8,0%');
  });

  it('o N nunca aparece sozinho', () => {
    // "2" não diz nada; "2 de 3" se explica sem ninguém precisar perguntar.
    expect(comOTotal(2, 3)).toBe('2 de 3');
  });
});
