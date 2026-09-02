/**
 * A vitrine do produto, do lado das notificações.
 *
 * Um mercado pode sair da VITRINE sem sair do BOARD: o backend segue publicando
 * e gravando no funil e no histórico, e o que muda é só o que o assinante vê.
 * Parar de publicar pararia de medir, e é a medição que decide quando o mercado
 * volta. Os números que motivaram estão na migration 116, e só lá. Ver `prop-play-predictor#324`.
 *
 * ⚠️ A lista mora no BANCO, não em constante, e é isto que impede o vazamento
 * mais provável: o painel esconder o mercado e a DM continuar mandando. O painel
 * roda no browser e isto roda em Deno, então não há módulo compartilhado entre
 * os dois — só o banco é fonte comum. É o mesmo argumento do `faixa.ts` ao lado,
 * com uma diferença: ali a cópia é inevitável, aqui ela seria um bug.
 *
 * Esta é a única cópia deste lado da fronteira: as duas funções de notificação
 * importam daqui.
 */

/**
 * Mesmo predicado do painel (`src/utils/futebol-mercados-ocultos.ts`).
 *
 * A guarda `src/utils/futebol-mercados-ocultos-paridade.test.ts` compara as duas
 * cópias caso a caso e quebra o PR quando elas se afastam — mesmo padrão da
 * guarda de copy das premissas, que nasceu de 27 divergências que ninguém viu.
 */
export function mercadoEstaOculto(
  market: string,
  ocultos: readonly string[],
): boolean {
  return ocultos.includes(market);
}

export function filtrarMercadosOcultos<T extends { market: string }>(
  linhas: readonly T[],
  ocultos: readonly string[],
): T[] {
  if (!ocultos.length) return [...linhas];
  return linhas.filter((linha) => !mercadoEstaOculto(linha.market, ocultos));
}

/**
 * O cliente Supabase, no mínimo que esta função usa.
 *
 * `PromiseLike` e não `Promise` porque o `rpc()` do supabase-js devolve um
 * builder que é thenable, não uma Promise — tipar como Promise faz o
 * `deno check` recusar a chamada real.
 */
// deno-lint-ignore no-explicit-any
type ClienteRpc = { rpc: (nome: string, ...args: any[]) => PromiseLike<any> };

/**
 * O que vale quando a lista do banco não pode ser lida. Cópia do
 * `VITRINE_FALLBACK` do painel — a guarda de paridade obriga as duas a andarem
 * juntas, e é lá que está o comentário inteiro, inclusive o aviso de tirar o
 * mercado daqui quando ele voltar à vitrine.
 */
export const VITRINE_FALLBACK: readonly string[] = ["asian_handicap"];

/**
 * Lê a vitrine, e NUNCA lança.
 *
 * Configuração indisponível não pode derrubar o envio do dia. Mas cair para
 * lista vazia mandaria na DM exatamente o que o produto tirou da prateleira —
 * então o escuro cai para o `VITRINE_FALLBACK`, e a mensagem sai SEM o mercado
 * escondido em vez de sair errada ou não sair.
 *
 * Devolve a origem para o chamador poder registrar o estado degradado: silêncio
 * aqui é como uma vitrine desatualizada sobreviveria sem ninguém notar.
 */
export async function carregarMercadosOcultos(
  supabase: ClienteRpc,
): Promise<{ mercados: string[]; origem: "banco" | "fallback" }> {
  try {
    const { data, error } = await supabase.rpc("get_futebol_mercados_ocultos");
    if (error || !Array.isArray(data)) {
      return { mercados: [...VITRINE_FALLBACK], origem: "fallback" };
    }
    return { mercados: data as string[], origem: "banco" };
  } catch (_) {
    return { mercados: [...VITRINE_FALLBACK], origem: "fallback" };
  }
}
