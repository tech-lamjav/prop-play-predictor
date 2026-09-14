import { describe, expect, it } from 'vitest';
import { emN, epPct, roiPct, taxaPct } from './placar-formato';

describe('taxaPct', () => {
  it('mostra a taxa em porcentagem, com vírgula', () => {
    expect(taxaPct(0.4285)).toBe('42,9%');
  });

  it('sem taxa, mostra travessão — e não 0%', () => {
    // 0% afirmaria que a metodologia errou tudo. Ausência de resposta não é
    // resposta ruim.
    expect(taxaPct(null)).toBe('—');
  });

  it('zero de verdade continua sendo zero', () => {
    expect(taxaPct(0)).toBe('0,0%');
  });
});

describe('roiPct', () => {
  it('põe sinal no positivo, para ele saltar numa coluna de negativos', () => {
    expect(roiPct(0.021)).toBe('+2,1%');
  });

  it('usa o menos tipográfico no negativo', () => {
    // O hífen de teclado fica pequeno e some ao lado do dígito; este é o sinal
    // de menos de verdade.
    expect(roiPct(-0.355)).toBe('−35,5%');
  });

  it('zero não ganha sinal', () => {
    expect(roiPct(0)).toBe('0,0%');
  });
});

describe('epPct', () => {
  it('é em pontos percentuais, sem sinal', () => {
    expect(epPct(0.165)).toBe('16,5');
  });
});

describe('emN', () => {
  it('acompanha o número como denominador', () => {
    expect(emN(37)).toBe('em 37');
  });
});
