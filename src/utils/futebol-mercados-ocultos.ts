// ============================================================
// futebol-mercados-ocultos.ts — o mercado sai da vitrine, não do board
// ============================================================
// O backend continua publicando, gravando no funil e no histórico. O que esta
// regra faz é decidir o que o ASSINANTE vê. Isso é de propósito: um mercado
// retirado do board pararia de ser medido, e é justamente a medição que decide
// quando ele volta.
//
// Primeiro caso: `asian_handicap`. Os números que motivaram estão na migration
// 116 e em nenhum outro lugar — repeti-los aqui é como eles divergem, e já
// divergiram uma vez dentro deste mesmo PR.
//
// A lista NÃO mora aqui. Ela vem do banco (`get_futebol_mercados_ocultos`), para
// que devolver um mercado à tela seja um UPDATE e não um release. Este módulo é
// só a regra, pura, para poder ser testada sem rede.
// ============================================================

/**
 * O que vale quando a lista do banco não pode ser lida.
 *
 * NÃO é a fonte da verdade — o banco é. Isto é só o que fazer no escuro, e a
 * única janela realista de escuro é entre o deploy deste código e a aplicação
 * da migration 116: depois dela, é uma RPC minúscula no mesmo banco que acabou
 * de servir o board.
 *
 * Nessa janela, esconder o Handicap já é o comportamento decidido — o SQL é que
 * não subiu ainda. Cair para lista vazia mostraria na tela e mandaria na DM
 * exatamente o que o produto tirou da prateleira.
 *
 * ⚠️ Quando um mercado voltar à vitrine pelo UPDATE, TIRE-O DAQUI TAMBÉM. Se
 * ficar, uma falha de leitura o esconde de novo — o banco vence sempre que
 * responde, mas o escuro passaria a mentir. A guarda de paridade obriga as duas
 * cópias (esta e a de `supabase/functions/shared/`) a andarem juntas.
 */
export const VITRINE_FALLBACK: readonly string[] = ['asian_handicap'];

/** O mercado está fora da vitrine? */
export function mercadoEstaOculto(
  market: string,
  ocultos: readonly string[],
): boolean {
  return ocultos.includes(market);
}

/**
 * Tira do conjunto as linhas dos mercados ocultos.
 *
 * Genérica em cima de `market` de propósito: board, detalhe do jogo e a fila do
 * Telegram carregam formas diferentes, e a regra é a mesma nos três. Aplicar no
 * ponto em que os dados entram no app é o que faz lista, contador e resumo
 * concordarem sem que cada tela precise lembrar do filtro.
 */
export function filtrarMercadosOcultos<T extends { market: string }>(
  linhas: readonly T[],
  ocultos: readonly string[],
): T[] {
  if (!ocultos.length) return [...linhas];
  return linhas.filter((linha) => !mercadoEstaOculto(linha.market, ocultos));
}

/**
 * A mesma regra sobre o CATÁLOGO de mercados, que chaveia por `slug`.
 *
 * Existe separada porque o detalhe do jogo não monta a prateleira a partir do
 * board: ele itera o catálogo dos cinco mercados e busca preço para cada um.
 * Filtrar só as linhas do board deixaria o mercado escondido como chip, com
 * barra de Score e mapa de premissas, e agora sem odd — pior do que não ter
 * escondido. Foi o que o review da #324 pegou.
 */
export function filtrarCatalogoDeMercados<T extends { slug: string }>(
  mercados: readonly T[],
  ocultos: readonly string[],
): T[] {
  if (!ocultos.length) return [...mercados];
  return mercados.filter((mercado) => !mercadoEstaOculto(mercado.slug, ocultos));
}
