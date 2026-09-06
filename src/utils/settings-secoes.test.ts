import { describe, expect, it } from 'vitest';
import { SECOES, secaoAtiva } from './settings-secoes';

describe('as seções das configurações', () => {
  it('são quatro, e cada uma tem rótulo e resumo', () => {
    expect(SECOES).toHaveLength(4);
    for (const s of SECOES) {
      expect(s.rotulo.length).toBeGreaterThan(0);
      expect(s.resumo.length).toBeGreaterThan(0);
    }
  });

  it('não repetem id, que é o que vai na URL', () => {
    expect(new Set(SECOES.map((s) => s.id)).size).toBe(SECOES.length);
  });
});

describe('qual seção está aberta', () => {
  it('sem parâmetro, abre o perfil', () => {
    expect(secaoAtiva(null)).toBe('perfil');
    expect(secaoAtiva(undefined)).toBe('perfil');
  });

  it('um id conhecido abre aquela seção', () => {
    // É o que faz "vá em Configurações, aba Alertas" virar um link em vez de
    // uma instrução — e o que segura a seção aberta ao recarregar a página.
    expect(secaoAtiva('alertas')).toBe('alertas');
    expect(secaoAtiva('assinatura')).toBe('assinatura');
  });

  it('id desconhecido cai no perfil em vez de deixar a tela vazia', () => {
    // Link velho, erro de digitação, seção renomeada: em todos, mostrar a
    // primeira seção é melhor que uma tela em branco sem explicação.
    expect(secaoAtiva('inexistente')).toBe('perfil');
    expect(secaoAtiva('')).toBe('perfil');
  });
});
