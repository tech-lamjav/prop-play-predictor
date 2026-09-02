import { describe, expect, it } from 'vitest';
import { demoFutebolBoard, demoFixtureValueRows } from './futebol';
import { versaoDaJanela, opcoesDeFaixa } from '@/utils/futebol-score';

// ============================================================================
// A demonstração herda a escala do produto (#333)
// ============================================================================
// Ela cravava `contexto_v1`. Como a legenda deriva a escala das linhas que estão
// na tela, e no tour as linhas são as da demonstração, o onboarding anunciava as
// fronteiras novas enquanto o board real, ainda em `legacy`, anunciava as
// antigas. O assinante aprendia uma régua e encontrava outra.
//
// Cravar `legacy` "consertaria" hoje e teria de ser desfeito no dia da virada.
// Herdar fica certo dos dois lados sem ninguém tocar de novo.
// ============================================================================

describe('a escala da demonstração', () => {
  it('segue a que o produto está usando: legacy', () => {
    expect(versaoDaJanela(demoFutebolBoard('legacy'))).toBe('legacy');
  });

  it('segue a que o produto está usando: contexto_v1', () => {
    expect(versaoDaJanela(demoFutebolBoard('contexto_v1'))).toBe('contexto_v1');
  });

  // Quando o produto não declara escala — board vazio, por exemplo —, a
  // demonstração não inventa uma. A legenda já sabe não cravar número nesse
  // caso, e é a mesma regra.
  it('não crava escala quando o produto não declarou', () => {
    expect(versaoDaJanela(demoFutebolBoard('indefinida'))).toBe('indefinida');
  });

  it('vale também para as linhas do detalhe do jogo', () => {
    expect(versaoDaJanela(demoFixtureValueRows('legacy'))).toBe('legacy');
    expect(versaoDaJanela(demoFixtureValueRows('contexto_v1'))).toBe('contexto_v1');
  });
});

describe('a legenda do tour concorda com a do produto', () => {
  it('em legacy, anuncia os cortes antigos', () => {
    const selos = opcoesDeFaixa(versaoDaJanela(demoFutebolBoard('legacy'))).map((o) => o.selo);
    expect(selos).toEqual(['60+', '40+', '<40']);
  });

  it('em contexto_v1, anuncia os cortes novos', () => {
    const selos = opcoesDeFaixa(versaoDaJanela(demoFutebolBoard('contexto_v1'))).map((o) => o.selo);
    expect(selos).toEqual(['60+', '30+', '<30']);
  });
});

// O tour ensina a classificação, então os pares nota/faixa precisam ser
// verdadeiros NAS DUAS escalas — senão a demonstração rotula errado assim que a
// escala vira, e ninguém percebe porque é dado de mentira.
describe('os pares nota e faixa são coerentes nas duas escalas', () => {
  const fronteiras = {
    legacy: { media: 40, alta: 60 },
    contexto_v1: { media: 30, alta: 60 },
  } as const;

  for (const escala of ['legacy', 'contexto_v1'] as const) {
    it(`em ${escala}`, () => {
      const { media, alta } = fronteiras[escala];
      for (const linha of demoFutebolBoard(escala)) {
        const esperada = linha.score >= alta ? 'Alta' : linha.score >= media ? 'Média' : 'Baixa';
        expect(`${linha.score} → ${linha.faixa}`).toBe(`${linha.score} → ${esperada}`);
      }
    });
  }
});
