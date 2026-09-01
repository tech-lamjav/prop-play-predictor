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
 * Lê a vitrine, e NUNCA lança.
 *
 * Configuração indisponível não pode derrubar o envio do dia — nem quando a RPC
 * ainda não existe, que é o estado entre o deploy do código e a aplicação da
 * migration. Sem a lista o comportamento é o de antes, nada escondido: é
 * degradação, não regressão.
 */
export async function carregarMercadosOcultos(supabase: ClienteRpc): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc("get_futebol_mercados_ocultos");
    if (error) return [];
    return Array.isArray(data) ? (data as string[]) : [];
  } catch (_) {
    return [];
  }
}
