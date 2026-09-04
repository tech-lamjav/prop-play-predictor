import { describe, expect, it } from 'vitest';
import { FILTRO_DE_VALOR_PADRAO, passaNoFiltroDeValor } from './futebol-score';

// ============================================================================
// O filtro de VALOR do painel de oportunidades
// ============================================================================
// Ele nasce da virada de 03/09: a porta de preço saiu do gate e o board passou
// a publicar linha com vantagem negativa — medido em produção no mesmo dia, 71
// das ~900 linhas pagavam acima do justo. Sem filtro, quem procura preço bom
// varre a lista inteira lendo a última coluna.
//
// As três faixas são um intervalo CONTÍNUO e cobrem a reta toda: qualquer
// vantagem cai em exatamente uma delas. É isso que o último teste prova, e é
// por isso que a seleção é única em vez de múltipla.
// ============================================================================

describe('passaNoFiltroDeValor', () => {
  it('"todos" não esconde nada, nem a linha sem vantagem guardada', () => {
    expect(passaNoFiltroDeValor('todos', 0.05)).toBe(true);
    expect(passaNoFiltroDeValor('todos', -0.05)).toBe(true);
    expect(passaNoFiltroDeValor('todos', null)).toBe(true);
  });

  it('"acima do justo" exige vantagem ESTRITAMENTE positiva', () => {
    expect(passaNoFiltroDeValor('positivo', 0.001)).toBe(true);
    // Zero é preço justo, não vantagem: quem filtra por vantagem não a quer.
    expect(passaNoFiltroDeValor('positivo', 0)).toBe(false);
    expect(passaNoFiltroDeValor('positivo', -0.001)).toBe(false);
  });

  it('"até 2% abaixo" cerca a mediana do board, e inclui o zero', () => {
    expect(passaNoFiltroDeValor('perto', 0)).toBe(true);
    expect(passaNoFiltroDeValor('perto', -0.019)).toBe(true);
    expect(passaNoFiltroDeValor('perto', -0.02)).toBe(false);
    expect(passaNoFiltroDeValor('perto', 0.01)).toBe(false);
  });

  it('"mais de 2% abaixo" pega a cauda, com a fronteira nela', () => {
    expect(passaNoFiltroDeValor('abaixo', -0.02)).toBe(true);
    expect(passaNoFiltroDeValor('abaixo', -0.074)).toBe(true);
    expect(passaNoFiltroDeValor('abaixo', -0.019)).toBe(false);
  });

  it('a linha SEM vantagem guardada passa em qualquer faixa', () => {
    // É a oportunidade registrada de antes da migration 091: ela existiu no
    // dia, e escondê-la por um campo que nunca foi gravado apagaria o registro.
    // Mesma regra do filtro de faixas, pelo mesmo motivo.
    for (const filtro of ['positivo', 'perto', 'abaixo'] as const) {
      expect(passaNoFiltroDeValor(filtro, null)).toBe(true);
      expect(passaNoFiltroDeValor(filtro, undefined)).toBe(true);
    }
  });

  it('as três faixas particionam a reta: toda vantagem cai em uma só', () => {
    const valores = [0.09, 0.02, 0.0001, 0, -0.0001, -0.02, -0.0199, -0.05, -0.2];
    for (const v of valores) {
      const dentro = (['positivo', 'perto', 'abaixo'] as const).filter((f) => passaNoFiltroDeValor(f, v));
      expect(dentro).toHaveLength(1);
    }
  });

  it('o padrão é não filtrar', () => {
    expect(FILTRO_DE_VALOR_PADRAO).toBe('todos');
  });
});
