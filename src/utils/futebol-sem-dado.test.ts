import { describe, it, expect } from 'vitest';
import { avisoSemDado } from './futebol-sem-dado';

// A regra de produto está na ADR 0003 e é curta: dado faltante DIAGNOSTICA, NÃO
// PENALIZA. O score não muda. O aviso fala da NOSSA confiança, não da qualidade
// da aposta — e é por isso que ele não pode parecer uma penalidade.

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
    const a = avisoSemDado(1);
    expect(a?.curto).toBe('Não deu para checar 1 coisa');
    expect(a?.longo).toContain('1 coisa');
  });

  it('fala no plural quando falta mais de uma', () => {
    const a = avisoSemDado(3);
    expect(a?.curto).toBe('Não deu para checar 3 coisas');
  });

  it('o texto longo explica que a nota está incompleta, não contrária', () => {
    const a = avisoSemDado(6);
    expect(a?.longo).toMatch(/menos informação/i);
    expect(a?.longo).not.toMatch(/pior|ruim|fraca/i);
  });

  // Estes dois são a regra de produto virada em teste. Se alguém "melhorar" o
  // texto e colocar um desconto do lado, o aviso passa a dizer o contrário do
  // que existe para dizer — e o teste quebra antes de chegar na tela.
  it('nunca carrega desconto de pontos', () => {
    for (const n of [1, 2, 5, 9]) {
      const a = avisoSemDado(n)!;
      const texto = `${a.curto} ${a.longo}`;
      expect(texto).not.toMatch(/[−-]\s*\d/); // −30, -12
      expect(texto).not.toMatch(/\(\s*\d/); // (30
      expect(texto.toLowerCase()).not.toContain('ponto');
      expect(texto.toLowerCase()).not.toContain('penalidade');
    }
  });

  it('nunca usa jargão de premissa nem palavra difícil', () => {
    const a = avisoSemDado(4)!;
    const texto = `${a.curto} ${a.longo}`.toLowerCase();
    for (const jargao of ['premissa', 'insumo', 'score', 'edge', 'nula']) {
      expect(texto).not.toContain(jargao);
    }
  });
});
