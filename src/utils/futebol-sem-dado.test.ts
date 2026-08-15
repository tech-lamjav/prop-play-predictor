import { describe, it, expect } from 'vitest';
import { avisoSemDado } from './futebol-sem-dado';

// A regra de produto está na ADR 0003 e é curta: dado faltante DIAGNOSTICA, NÃO
// PENALIZA. O score não muda. O aviso fala da NOSSA confiança, não da qualidade
// da aposta, e é por isso que ele não pode parecer uma penalidade.

describe('avisoSemDado', () => {
  it('não avisa quando não faltou nada', () => {
    expect(avisoSemDado(0)).toBeNull();
  });

  it('não avisa quando o contador não veio', () => {
    expect(avisoSemDado(null)).toBeNull();
    expect(avisoSemDado(undefined)).toBeNull();
  });

  it('não avisa com valor negativo, que não deveria existir', () => {
    expect(avisoSemDado(-1)).toBeNull();
  });

  it('fala no singular quando falta uma só', () => {
    expect(avisoSemDado(1)).toContain('1 premissa ');
  });

  it('fala no plural quando falta mais de uma', () => {
    expect(avisoSemDado(3)).toContain('3 premissas');
  });

  it('explica que a nota está incompleta, não contrária', () => {
    const a = avisoSemDado(6)!;
    expect(a).toMatch(/menos informação/i);
    expect(a).not.toMatch(/pior|ruim|fraca/i);
  });

  // Este é a regra de produto virada em teste. Se alguém "melhorar" o texto e
  // colocar um desconto do lado, o aviso passa a dizer o contrário do que
  // existe para dizer, e o teste quebra antes de chegar na tela.
  it('nunca carrega desconto de pontos', () => {
    for (const n of [1, 2, 5, 9]) {
      const texto = avisoSemDado(n)!;
      expect(texto).not.toMatch(/[−-]\s*\d/); // −30, -12
      expect(texto).not.toMatch(/\(\s*\d/); // (30
      expect(texto.toLowerCase()).not.toContain('ponto');
      expect(texto.toLowerCase()).not.toContain('penalidade');
    }
  });

  // "premissa" NÃO está nesta lista, e isso é decisão, não esquecimento: a
  // própria folha de mercado diz "3 premissas a favor" logo acima deste aviso.
  // A palavra é vocabulário da tela, então usá-la aqui deixa o texto mais
  // concreto, não mais técnico. O que continua proibido é o vocabulário do
  // motor, que o assinante nunca viu.
  it('nunca usa palavra de bastidor', () => {
    const texto = avisoSemDado(4)!.toLowerCase();
    for (const jargao of ['insumo', 'score', 'edge', 'nula', 'null']) {
      expect(texto).not.toContain(jargao);
    }
  });

  // "checar" saiu a pedido do Victor: palavra feia para o público. "conferir"
  // faz o mesmo trabalho e soa como gente falando.
  it('não usa "checar"', () => {
    expect(avisoSemDado(2)!.toLowerCase()).not.toContain('checar');
  });
});
