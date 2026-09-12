import { describe, expect, it } from 'vitest';
import type { Celula } from './placar-agregacao';
import { comparar, erroDaDiferenca } from './placar-comparacao';

const celula = (p: Partial<Celula> & { chave: string }): Celula => ({
  n: 10,
  unidades: 10,
  acertos: 5,
  anuladas: 0,
  taxa: 0.5,
  roi: 0,
  ep: 0.05,
  ...p,
});

describe('o erro da diferença', () => {
  it('soma em quadratura, e não direto', () => {
    // Somar direto daria 0,10 e esconderia diferença real; em quadratura dá
    // 0,0707, que é o erro de verdade de duas amostras independentes.
    const e = erroDaDiferenca(celula({ chave: 'a', ep: 0.05 }), celula({ chave: 'a', ep: 0.05 }));
    expect(e).toBeCloseTo(0.0707, 4);
  });
});

describe('comparar', () => {
  it('casa os grupos pelo nome e calcula a diferença de ROI', () => {
    const r = comparar(
      [celula({ chave: 'Gols', roi: 0.1, ep: 0.01 })],
      [celula({ chave: 'Gols', roi: -0.05, ep: 0.01 })],
    );
    expect(r).toHaveLength(1);
    expect(r[0].diferencaRoi).toBeCloseTo(0.15);
  });

  it('marca como ruído a diferença que não passa do próprio erro', () => {
    // Dois pontos de diferença com erro de cinco de cada lado: a leitura
    // honesta é "não deu para dizer".
    const r = comparar(
      [celula({ chave: 'Gols', roi: 0.01, ep: 0.05 })],
      [celula({ chave: 'Gols', roi: -0.01, ep: 0.05 })],
    );
    expect(r[0].dentroDoRuido).toBe(true);
  });

  it('e não marca a diferença que passa', () => {
    const r = comparar(
      [celula({ chave: 'Gols', roi: 0.2, ep: 0.02 })],
      [celula({ chave: 'Gols', roi: -0.2, ep: 0.02 })],
    );
    expect(r[0].dentroDoRuido).toBe(false);
  });

  it('grupo que existe num lado só não tem diferença nenhuma', () => {
    // Comparar contra o vazio dá a diferença inteira, que leria como melhora
    // total quando é só ausência de amostra.
    const r = comparar([celula({ chave: 'Gols', roi: 0.2 })], []);
    expect(r[0].b).toBeNull();
    expect(r[0].diferencaRoi).toBeNull();
    expect(r[0].dentroDoRuido).toBe(true);
  });

  it('grupo que só existe no período de comparação também aparece', () => {
    // Mercado que a gente parou de publicar não pode desaparecer da comparação:
    // ter parado é parte do que mudou.
    const r = comparar([], [celula({ chave: 'Handicap', roi: -0.3 })]);
    expect(r).toHaveLength(1);
    expect(r[0].a).toBeNull();
  });

  it('respeita a ordem da escala quando ela é dada', () => {
    const r = comparar(
      [celula({ chave: 'Alta', n: 50 })],
      [celula({ chave: 'Baixa', n: 3 })],
      ['Baixa', 'Média', 'Alta'],
    );
    expect(r.map((c) => c.chave)).toEqual(['Baixa', 'Alta']);
  });

  it('sem ordem, segue o período principal e põe o resto no fim', () => {
    const r = comparar(
      [celula({ chave: 'Gols' }), celula({ chave: 'Resultado' })],
      [celula({ chave: 'Handicap' }), celula({ chave: 'Gols' })],
    );
    expect(r.map((c) => c.chave)).toEqual(['Gols', 'Resultado', 'Handicap']);
  });
});

describe('a base de uma aposta só', () => {
  it('nunca afirma a diferença, mesmo com erro-padrão zero dos dois lados', () => {
    // O erro-padrão de uma aposta é zero por falta de variância, não por
    // precisão. Sem a trava, um green contra um red virava conclusão em
    // negrito — a leitura mais frágil que a tabela consegue produzir.
    const r = comparar(
      [celula({ chave: 'Gols', n: 1, roi: 1, ep: 0 })],
      [celula({ chave: 'Gols', n: 1, roi: -1, ep: 0 })],
    );
    expect(r[0].diferencaRoi).toBeCloseTo(2);
    expect(r[0].dentroDoRuido).toBe(true);
  });

  it('e basta um dos lados ser curto para não afirmar', () => {
    const r = comparar(
      [celula({ chave: 'Gols', n: 40, roi: 0.2, ep: 0.01 })],
      [celula({ chave: 'Gols', n: 1, roi: -1, ep: 0 })],
    );
    expect(r[0].dentroDoRuido).toBe(true);
  });
});
