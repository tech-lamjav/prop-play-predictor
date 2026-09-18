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
 * Como cada premissa lê os insumos dela em português.
 *
 * ⚠️ Isto é APRESENTAÇÃO, não critério. O corte continua sendo do modelo; aqui
 * só se decide como o número medido vira frase. Por isso não é a "terceira
 * cópia de vocabulário" que o cabeçalho deste arquivo teme: nada aqui decide se
 * a premissa acende.
 *
 * `s_` é o time da saída e `o_` o adversário. Uma forma só devolve frase quando
 * TODOS os insumos que ela usa vieram; faltando qualquer um, cai no par cru, que
 * é honesto e não inventa o que não veio.
 *
 * Premissa sem forma aqui também cai no par cru — é o que mantém a rota
 * agnóstica para as outras seis do 1X2 e para as que o mart publicar depois.
 */
const FORMAS: Record<string, (v: Record<string, number>) => string | null> = {
  // O modelo compara pontos POR JOGO; a frase antiga mostrava o total da
  // temporada ("76 pontos"), que é outra grandeza. Era um número verdadeiro que
  // não é o insumo — o que o glossário chama de ilustrar sem explicar.
  'match_winner:superioridade_tabela': (v) =>
    v.s_rank == null || v.o_rank == null || v.s_ppg == null || v.o_ppg == null
      ? null
      : `${numero(v.s_rank)}º com ${numero(v.s_ppg)} pontos por jogo, contra ` +
        `${numero(v.o_rank)}º e ${numero(v.o_ppg)} do adversário`,

  'match_winner:h2h_favoravel': (v) =>
    v.s_wins == null || v.h2h_total == null
      ? null
      : `${numero(v.s_wins)} ${v.s_wins === 1 ? 'vitória' : 'vitórias'} em ` +
        `${numero(v.h2h_total)} ${v.h2h_total === 1 ? 'confronto' : 'confrontos'}`,
};

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

  const porNome: Record<string, number> = {};
  for (const i of achados) porNome[i.insumo] = i.valor as number;

  const forma = FORMAS[`${mercado}:${slug}`];
  return forma?.(porNome) ?? achados.map((i) => `${i.insumo} ${numero(i.valor as number)}`).join(' · ');
}
