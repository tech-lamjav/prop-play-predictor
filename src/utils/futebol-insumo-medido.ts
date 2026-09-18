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

import type { Evidencia } from '@/utils/futebol-evidencias';

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
/** Os nomes dos dois times, para a barra. Nome não é medição: não muda com a janela. */
export interface NomesDoConfronto {
  time?: string | null;
  adversario?: string | null;
}

const FORMAS: Record<string, (v: Record<string, number>, n: NomesDoConfronto) => Evidencia | null> = {
  // O modelo compara pontos POR JOGO; a frase antiga mostrava o total da
  // temporada ("76 pontos"), que é outra grandeza. Era um número verdadeiro que
  // não é o insumo — o que o glossário chama de ilustrar sem explicar.
  //
  // A barra compara a mesma grandeza da frase, com a posição no rótulo. Mais
  // pontos por jogo é o lado bom da aposta, daí o destaque à esquerda.
  'match_winner:superioridade_tabela': (v, n) => {
    if (v.s_rank == null || v.o_rank == null || v.s_ppg == null || v.o_ppg == null) return null;
    return {
      texto:
        `${numero(v.s_rank)}º com ${numero(v.s_ppg)} pontos por jogo, contra ` +
        `${numero(v.o_rank)}º e ${numero(v.o_ppg)} do adversário`,
      comparacao: {
        esqLabel: `${n.time ?? 'O time'}, ${numero(v.s_rank)}º`,
        esqValor: v.s_ppg,
        dirLabel: `${n.adversario ?? 'Adversário'}, ${numero(v.o_rank)}º`,
        dirValor: v.o_ppg,
        destaque: 'esq',
      },
    };
  },

  // Sem barra, de propósito. O mart dá vitórias e TOTAL; entre as duas existem
  // os empates, e daqui não dá para separar empate de derrota. A barra só
  // conseguiria desenhar "vitórias contra o resto", que é outra afirmação —
  // melhor frase sozinha do que barra dizendo o que o dado não diz.
  'match_winner:h2h_favoravel': (v) => {
    if (v.s_wins == null || v.h2h_total == null) return null;
    return {
      texto:
        `${numero(v.s_wins)} ${v.s_wins === 1 ? 'vitória' : 'vitórias'} em ` +
        `${numero(v.h2h_total)} ${v.h2h_total === 1 ? 'confronto' : 'confrontos'}`,
    };
  },
};

/**
 * A evidência a partir do valor medido, ou `null` quando não há como formar uma.
 *
 * ⚠️ Premissa sem forma conhecida devolve `null` DE PROPÓSITO, e não o par cru.
 * Imprimir `s_form_pts 11` seria pôr identificador de coluna do dbt na cara do
 * assinante — e, pior, faria a premissa falar por uma janela enquanto o gráfico
 * logo abaixo dela desenha outra. Devolvendo nulo, ela cai na rota do histórico,
 * que calcula a frase da MESMA série que o gráfico desenha, e as duas não têm
 * como discordar.
 *
 * Ausência de insumo também é normal, não erro: o funil é append-only e linha
 * gravada antes do deploy não tem valor medido.
 */
export function evidenciaDoInsumoMedido(
  mercado: string,
  slug: string,
  lado: 'home' | 'away' | null,
  insumos: InsumoMedido[] | undefined,
  nomes: NomesDoConfronto = {},
): Evidencia | null {
  const achados = insumosDaPremissa(mercado, slug, lado, insumos);
  if (!achados.length) return null;

  const porNome: Record<string, number> = {};
  for (const i of achados) porNome[i.insumo] = i.valor as number;

  return FORMAS[`${mercado}:${slug}`]?.(porNome, nomes) ?? null;
}
