import { describe, expect, it } from 'vitest';
import { nomeDoDiaDaSemana, nomeDoMes } from './nomes-de-data';

// ============================================================================
// Os nomes saem do Intl, e o português continua idêntico às tabelas antigas
// ============================================================================
// As tabelas à mão estavam escritas em português e apareciam na tela em
// espanhol: a home da NBA dizia "Terça, 6 de outubro". O critério da migração
// inteira é que em português nada muda — então o teste compara com as tabelas
// que existiam, letra por letra.
// ============================================================================

const DIAS_ANTIGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES_ANTIGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS_ANTIGOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

describe('em português, idêntico às tabelas antigas', () => {
  it('os dias da semana', () => {
    expect(DIAS_ANTIGOS.map((_, i) => nomeDoDiaDaSemana(i, 'long', 'pt-BR'))).toEqual(DIAS_ANTIGOS);
  });

  it('os meses por extenso', () => {
    expect(MESES_ANTIGOS.map((_, i) => nomeDoMes(i, 'long', 'pt-BR'))).toEqual(MESES_ANTIGOS);
  });

  it('os meses curtos, sem o ponto', () => {
    expect(MESES_CURTOS_ANTIGOS.map((_, i) => nomeDoMes(i, 'short', 'pt-BR'))).toEqual(MESES_CURTOS_ANTIGOS);
  });
});

describe('em espanhol', () => {
  it('a data que aparecia em português na home da NBA', () => {
    // 6 de outubro de 2026 é uma terça.
    expect(nomeDoDiaDaSemana(2, 'long', 'es-419')).toBe('Martes');
    expect(nomeDoMes(9, 'long', 'es-419')).toBe('octubre');
    expect(nomeDoMes(9, 'short', 'es-419')).toBe('oct');
  });

  it('nenhum nome sai em português', () => {
    const tudo = [
      ...Array.from({ length: 7 }, (_, i) => nomeDoDiaDaSemana(i, 'long', 'es-419')),
      ...Array.from({ length: 12 }, (_, i) => nomeDoMes(i, 'long', 'es-419')),
    ].join(' ');
    expect(tudo).not.toMatch(/terça|quarta|quinta|sexta|outubro|fevereiro|março|ç/i);
  });
});
