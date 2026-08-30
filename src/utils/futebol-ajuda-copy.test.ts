import { describe, expect, it } from 'vitest';
import { textoDoScore } from './futebol-ajuda-copy';

describe('textoDoScore', () => {
  it('na escala nova, diz que o Score não olha o preço', () => {
    const texto = textoDoScore('contexto_v1');

    expect(texto).toMatch(/não olha o preço/i);
    expect(texto).not.toMatch(/odd paga acima/i);
  });

  it('na escala antiga, continua dizendo que o preço entra na conta', () => {
    // A virada é coordenada com o mart (spec #301). Explicar a metodologia nova
    // antes da hora descreveria um número que a tela ainda não está mostrando.
    expect(textoDoScore('legacy')).toMatch(/odd paga acima/i);
  });

  it('sem versão declarada, mantém a explicação da escala em vigor hoje', () => {
    expect(textoDoScore(undefined)).toBe(textoDoScore('legacy'));
  });

  it('nunca promete chance de acerto', () => {
    // O erro de leitura mais caro da tela: tratar Score como probabilidade.
    for (const t of [textoDoScore('legacy'), textoDoScore('contexto_v1')]) {
      expect(t).toMatch(/não é chance de acerto/i);
    }
  });
});
