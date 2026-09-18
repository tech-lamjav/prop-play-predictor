import { describe, expect, it } from 'vitest';
/**
 * O script de medição, em .mjs.
 *
 * ⚠️ O import chega SEM TIPO, pelo mesmo motivo do `futebol-roi-script.test.ts`:
 * `allowJs` só existe no tsconfig da raiz, que não compila nada. O compilador
 * não confere nada aqui, então o que vale é a verificação em EXECUÇÃO.
 *
 * O script também não pode ter shebang, e a guarda de execução direta no fim
 * dele não é enfeite: sem ela, este import dispararia uma consulta à PRODUÇÃO.
 */
import { corteQueMelhorExplica, discordancia } from '../../scripts/futebol-evidencia-ancorada.mjs';

// ============================================================================
// O corte inferido, que é o ponto frágil da medição da #464
// ============================================================================
// O corte destas premissas não existe no repositório — vive no dbt. A medição
// contorna isso inferindo o limiar que melhor reproduz o booleano do mart.
//
// Uma inferência errada não quebra nada: ela devolve um número plausível e
// errado, e a #464 usa esse número para decidir se pode ser mergeada. É por
// isso que ela é testada aqui, com separação conhecida e resposta conhecida.
// ============================================================================

/** Amostra separável: `valor >= corteReal` decide o booleano do mart. */
const amostraSeparavel = (n: number, corteReal: number) =>
  Array.from({ length: n }, (_, i) => {
    const valor = i % 10;
    return { valor, mart: valor >= corteReal };
  });

const valorDe = (l: { valor: number | null }) => l.valor;

describe('o corte inferido', () => {
  it('acha o limiar exato quando a amostra separa', () => {
    expect(corteQueMelhorExplica(amostraSeparavel(400, 5), valorDe)).toBe(5);
  });

  it('acha outro limiar quando a separação é outra', () => {
    expect(corteQueMelhorExplica(amostraSeparavel(400, 8), valorDe)).toBe(8);
  });

  it('desiste com amostra curta em vez de inventar corte', () => {
    // Um corte tirado de poucas linhas é ruído com cara de resultado, e ele
    // decidiria se a #464 pode ser mergeada.
    expect(corteQueMelhorExplica(amostraSeparavel(150, 5), valorDe)).toBeNull();
  });

  it('linha sem valor não conta para o tamanho da amostra', () => {
    const semValor = Array.from({ length: 400 }, () => ({ valor: null, mart: true }));

    expect(corteQueMelhorExplica(semValor, valorDe)).toBeNull();
  });

  it('sobrevive a ruído: a maioria manda', () => {
    const amostra = amostraSeparavel(400, 5);
    // Vira o rótulo de 1 em cada 20: o limiar certo continua sendo o que mais
    // acerta, e é isso que a varredura tem de encontrar.
    for (let i = 0; i < amostra.length; i += 20) amostra[i].mart = !amostra[i].mart;

    expect(corteQueMelhorExplica(amostra, valorDe)).toBe(5);
  });
});

describe('a discordância contra o mart', () => {
  it('é zero quando o número reproduz o booleano', () => {
    const r = discordancia(amostraSeparavel(100, 5), valorDe, 5);

    expect(r.n).toBe(100);
    expect(r.erros).toBe(0);
    expect(r.taxa).toBe(0);
  });

  it('conta como erro o que o corte classifica ao contrário', () => {
    // Com corte 7 numa amostra separada em 5, os valores 5 e 6 viram erro:
    // dois de cada dez.
    const r = discordancia(amostraSeparavel(100, 5), valorDe, 7);

    expect(r.erros).toBe(20);
    expect(r.taxa).toBeCloseTo(0.2, 5);
  });

  it('pula linha sem valor em vez de contá-la como acerto', () => {
    const amostra = [
      ...amostraSeparavel(20, 5),
      ...Array.from({ length: 80 }, () => ({ valor: null, mart: true })),
    ];
    const r = discordancia(amostra, valorDe, 5);

    // Contar as 80 sem valor como acerto diluiria a taxa por quatro — que é
    // exatamente como uma rota furada pareceria boa.
    expect(r.n).toBe(20);
  });

  it('sem nenhuma linha com valor, não inventa taxa', () => {
    const r = discordancia([], valorDe, 5);

    expect(r.n).toBe(0);
    expect(r.taxa).toBeNull();
  });
});
