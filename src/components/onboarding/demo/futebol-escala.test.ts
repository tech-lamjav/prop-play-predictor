import { describe, expect, it } from 'vitest';
import { demoFutebolBoard, demoFixtureValueRows } from './futebol';
import { versaoDaJanela, opcoesDeFaixa, fronteirasDoScore } from '@/utils/futebol-score';

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
// verdadeiros NAS DUAS escalas. A demonstração deriva a faixa da nota e da
// escala justamente por isso: rótulo cravado é insustentável, porque uma nota
// 35 é Média numa e Baixa na outra.
describe('os pares nota e faixa são coerentes nas duas escalas', () => {
  const esperada = (score: number, escala: 'legacy' | 'contexto_v1') => {
    const { media, alta } = fronteirasDoScore(escala);
    return score >= alta ? 'Alta' : score >= media ? 'Média' : 'Baixa';
  };

  for (const escala of ['legacy', 'contexto_v1'] as const) {
    it(`board, em ${escala}`, () => {
      for (const l of demoFutebolBoard(escala)) {
        expect(`${l.score} → ${l.faixa}`).toBe(`${l.score} → ${esperada(l.score, escala)}`);
      }
    });

    it(`saídas do jogo, em ${escala}`, () => {
      for (const l of demoFixtureValueRows(escala)) {
        expect(`${l.score} → ${l.faixa}`).toBe(`${l.score} → ${esperada(l.score, escala)}`);
      }
    });
  }

  // Sem uma nota no intervalo onde as escalas DISCORDAM, os testes acima
  // passariam com a fábrica ignorando o argumento. Esta guarda existe para o dia
  // em que alguém ajustar as notas de exemplo sem perceber que apagou a prova.
  it('existe nota no intervalo em que as duas escalas discordam', () => {
    const { media: mediaNova } = fronteirasDoScore('contexto_v1');
    const { media: mediaVelha } = fronteirasDoScore('legacy');
    const naFaixaDeDiscordancia = demoFutebolBoard('legacy').filter(
      (l) => l.score >= mediaNova && l.score < mediaVelha,
    );
    expect(naFaixaDeDiscordancia.length).toBeGreaterThan(0);
  });

  it('e ela é rotulada diferente em cada escala', () => {
    const nova = demoFutebolBoard('contexto_v1').find((l) => l.score === 35);
    const velha = demoFutebolBoard('legacy').find((l) => l.score === 35);
    expect(nova?.faixa).toBe('Média');
    expect(velha?.faixa).toBe('Baixa');
  });
});
