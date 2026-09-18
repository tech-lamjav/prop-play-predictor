/**
 * O valor que o modelo comparou, publicado pelo mart (#464, absorvendo a #406).
 *
 * É a evidência mais próxima do critério que existe: não é uma reconstrução
 * nossa da janela, é o número que a premissa de fato comparou. Por isso ele
 * entra logo depois da prestação de contas na porta única, e antes das duas
 * rotas que recalculam.
 *
 * ── Agnóstico de nome, de propósito ─────────────────────────────────────────
 *
 * O vocabulário de insumo (`s_rank`, `o_rank`, `h2h_total`, …) vive no catálogo
 * do dbt, não aqui. Decorar uma frase por nome deste lado criaria uma terceira
 * cópia de vocabulário para divergir sozinha — que é a classe de problema que a
 * #464 está consertando. Então a frase mostra o par nome e valor como veio.
 *
 * Quando o critério de cada premissa for transcrito (hoje só o mercado de Gols
 * tem), a prestação de contas assume na frente desta rota e a frase crua some
 * sozinha, sem ninguém precisar apagar nada.
 */

/** Uma linha de `futebol.fact_insumos_medidos`, só com o que esta escolha usa. */
export interface InsumoMedido {
  outcome: string;
  market: string;
  premissa: string;
  insumo: string;
  valor: number | null;
}

/** `1.485` vira `1,49`; inteiro fica inteiro. */
function numero(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',');
}

/**
 * Os insumos que uma premissa comparou, na saída daquele lado.
 *
 * O casamento de lado é por `lower(outcome)`: o mercado de Resultado grava a
 * saída capitalizada, e comparar com a caixa errada devolve vazio sem erro —
 * foi assim que a primeira medição desta issue saiu zerada.
 */
export function insumosDaPremissa(
  mercado: string,
  slug: string,
  lado: 'home' | 'away' | null,
  insumos: InsumoMedido[] | undefined,
): InsumoMedido[] {
  if (!insumos?.length || !lado) return [];
  return insumos.filter(
    (i) =>
      i.market === mercado &&
      i.premissa === slug &&
      i.outcome?.toLowerCase() === lado &&
      i.valor != null,
  );
}

/**
 * A frase da evidência a partir do valor medido, ou `null` quando não há.
 *
 * Ausência é normal, não erro: o funil é append-only e linha gravada antes do
 * deploy não tem valor medido. Quem chama cai na rota seguinte.
 */
export function fraseDoInsumoMedido(
  mercado: string,
  slug: string,
  lado: 'home' | 'away' | null,
  insumos: InsumoMedido[] | undefined,
): string | null {
  const achados = insumosDaPremissa(mercado, slug, lado, insumos);
  if (!achados.length) return null;
  return achados.map((i) => `${i.insumo} ${numero(i.valor as number)}`).join(' · ');
}
