import type { Celula } from './placar-agregacao';

// ============================================================================
// placar-comparacao.ts — dois períodos lado a lado
// ============================================================================
// A pergunta é sempre a mesma: a mudança que a gente fez melhorou ou piorou? E o
// jeito de errar essa pergunta também é sempre o mesmo — ler uma diferença de
// dez pontos entre duas amostras pequenas como se fosse resultado.
//
// Por isso a diferença nasce com veredito. Se ela não passa do erro da própria
// diferença, a tela diz DENTRO DO RUÍDO em vez de mostrar um número que convida
// à conclusão. Não é excesso de zelo: com uma semana de amostra por lado, quase
// toda diferença cabe aí.
// ============================================================================

export type Comparacao = {
  chave: string;
  /** A célula do período principal. `null` quando o grupo não existe nele. */
  a: Celula | null;
  /** A célula do período de comparação. */
  b: Celula | null;
  /** ROI de A menos ROI de B, quando os dois lados existem. */
  diferencaRoi: number | null;
  /** O erro-padrão da diferença, quando os dois lados existem. */
  erroDaDiferenca: number | null;
  /**
   * A diferença não passa do próprio erro.
   *
   * `true` também quando falta um dos lados: sem os dois não existe diferença
   * para sustentar nada.
   */
  dentroDoRuido: boolean;
};

/**
 * O erro-padrão da diferença entre dois grupos independentes.
 *
 * Raiz da soma dos quadrados: dois períodos diferentes são amostras distintas,
 * então os erros se somam em quadratura. Somar os erros direto (ep(a) + ep(b))
 * exageraria a barra e esconderia diferença real.
 */
export function erroDaDiferenca(a: Celula, b: Celula): number {
  return Math.sqrt(a.ep ** 2 + b.ep ** 2);
}

/**
 * Junta as duas tabelas pelo nome do grupo.
 *
 * `ordem` força a sequência da escala quando a quebra é ordinal (faixa de Score,
 * faixa de odd). Sem ela, a ordem é a do período principal, com o que só existe
 * no de comparação no fim — porque a leitura é "o que mudou naquilo que eu
 * tenho hoje".
 */
export function comparar(
  a: readonly Celula[],
  b: readonly Celula[],
  ordem?: readonly string[],
): Comparacao[] {
  const deA = new Map(a.map((c) => [c.chave, c]));
  const deB = new Map(b.map((c) => [c.chave, c]));

  const chaves = ordem
    ? ordem.filter((k) => deA.has(k) || deB.has(k))
    : [...a.map((c) => c.chave), ...b.map((c) => c.chave).filter((k) => !deA.has(k))];

  return chaves.map((chave) => {
    const ca = deA.get(chave) ?? null;
    const cb = deB.get(chave) ?? null;

    if (!ca || !cb) {
      return { chave, a: ca, b: cb, diferencaRoi: null, erroDaDiferenca: null, dentroDoRuido: true };
    }

    const diferencaRoi = ca.roi - cb.roi;
    const erro = erroDaDiferenca(ca, cb);

    return {
      chave,
      a: ca,
      b: cb,
      diferencaRoi,
      erroDaDiferenca: erro,
      dentroDoRuido: Math.abs(diferencaRoi) <= erro,
    };
  });
}
