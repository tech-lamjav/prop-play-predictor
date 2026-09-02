import { describe, expect, it } from 'vitest';
import {
  demoFutebolBoard,
  demoFixtureValueRows,
} from './futebol';
import { faixaTone } from '@/utils/futebol-score';

// ============================================================================
// A demonstração ensina a metodologia vigente (issue #308, spec #301)
// ============================================================================
// O tour e a landing são a primeira leitura que alguém faz do produto. Se os
// números ali seguem a régua aposentada, a pessoa aprende a régua errada — e
// ninguém percebe, porque dado de demonstração não quebra teste de tela.
// ============================================================================

describe('dados de demonstração do futebol', () => {
  it('o board de exemplo continua mostrando as três faixas', () => {
    // A mistura é o ponto da demonstração: sem ela, o filtro de faixa e a
    // legenda não têm o que ensinar.
    const faixas = new Set(demoFutebolBoard('contexto_v1').map((l) => faixaTone(l.faixa)));
    expect([...faixas].sort()).toEqual(['alta', 'baixa', 'media']);
  });

  it('nenhuma linha de exemplo carrega componente de preço no Score', () => {
    // Os campos continuam no tipo durante a janela de compatibilidade, mas a
    // demonstração não pode sugerir que preço soma na nota.
    for (const linha of demoFutebolBoard('contexto_v1')) {
      expect(linha.pts_valor, `${linha.market} ${linha.outcome}`).toBe(0);
      expect(linha.pts_corroboracao, `${linha.market} ${linha.outcome}`).toBe(0);
    }
  });
});
