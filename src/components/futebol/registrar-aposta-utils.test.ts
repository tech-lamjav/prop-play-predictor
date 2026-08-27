import { describe, expect, it } from 'vitest';
import { atalhosDaUnidade } from './registrar-aposta-utils';

describe('atalhosDaUnidade', () => {
  it('oferece uma unidade e meia unidade a partir da configuração do Betinho', () => {
    expect(atalhosDaUnidade(80)).toEqual([
      { unidades: 1, valor: 80 },
      { unidades: 0.5, valor: 40 },
    ]);
  });

  it('não inventa atalhos sem uma unidade válida', () => {
    expect(atalhosDaUnidade(null)).toEqual([]);
    expect(atalhosDaUnidade(0)).toEqual([]);
  });
});
