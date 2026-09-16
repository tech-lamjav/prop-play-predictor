/**
 * O corte de valor, do lado das notificações.
 *
 * Irmão do `mercados-ocultos.ts` ao lado: aquele tira o mercado inteiro da DM,
 * este tira a linha que paga pior que a referência sharp além do limiar do
 * mercado. Os números que motivaram estão na migration 144, e só lá.
 *
 * ⚠️ O limiar mora no BANCO pelo mesmo motivo da vitrine: o painel roda no
 * browser e isto roda em Deno, sem módulo comum. Corte só num dos lados é o
 * vazamento que esta regra existe para impedir — a linha some da tela e chega
 * no celular.
 *
 * Esta é a única cópia deste lado da fronteira: as duas funções de notificação
 * importam daqui.
 */

/**
 * Mesmo predicado do painel (`src/utils/futebol-corte-de-valor.ts`), onde está
 * o comentário inteiro — inclusive por que linha sem vantagem gravada NÃO passa.
 *
 * A guarda `src/utils/futebol-corte-de-valor-paridade.test.ts` compara as duas
 * cópias caso a caso e quebra o PR quando elas se afastam.
 */
export function passaNoCorteDeValor(
  market: string,
  edge: number | null | undefined,
  limiares: readonly { market: string; limiar: number }[],
): boolean {
  const entrada = limiares.find((l) => l.market === market);
  if (!entrada) return true;
  return typeof edge === "number" && Number.isFinite(edge) && edge > entrada.limiar;
}

export function filtrarCorteDeValor<T extends { market: string; edge?: number | null }>(
  linhas: readonly T[],
  limiares: readonly { market: string; limiar: number }[],
): T[] {
  if (!limiares.length) return [...linhas];
  return linhas.filter((linha) => passaNoCorteDeValor(linha.market, linha.edge, limiares));
}

/**
 * O que vale quando o limiar do banco não pode ser lido. Cópia do
 * `CORTE_FALLBACK` do painel — a guarda de paridade obriga as duas a andarem
 * juntas, e é lá que está o aviso de mudar aqui quando o limiar mudar no banco.
 */
export const CORTE_FALLBACK: readonly { market: string; limiar: number }[] = [
  { market: "asian_handicap", limiar: -0.02 },
];

// deno-lint-ignore no-explicit-any
type ClienteRpc = { rpc: (nome: string, ...args: any[]) => PromiseLike<any> };

/**
 * Lê o corte, e NUNCA lança.
 *
 * Configuração indisponível não pode derrubar o envio do dia. Mas cair para
 * lista vazia mandaria na DM a linha que o produto tirou — então o escuro cai
 * para o `CORTE_FALLBACK`, e a mensagem sai com o corte aplicado.
 *
 * Uma linha ilegível (limiar que não vira número) derruba a leitura inteira para
 * o fallback, em vez de ser ignorada: ignorar deixaria aquele mercado sem corte.
 *
 * Devolve a origem para o chamador poder registrar o estado degradado.
 */
export async function carregarLimiaresDeValor(
  supabase: ClienteRpc,
): Promise<{ limiares: { market: string; limiar: number }[]; origem: "banco" | "fallback" }> {
  const escuro = () => ({
    limiares: CORTE_FALLBACK.map((l) => ({ ...l })),
    origem: "fallback" as const,
  });
  try {
    const { data, error } = await supabase.rpc("get_futebol_limiar_valor");
    if (error || !Array.isArray(data)) return escuro();
    const limiares: { market: string; limiar: number }[] = [];
    for (const linha of data) {
      const limiar = Number(linha?.limiar);
      if (typeof linha?.market !== "string" || !Number.isFinite(limiar)) return escuro();
      limiares.push({ market: linha.market, limiar });
    }
    return { limiares, origem: "banco" };
  } catch (_) {
    return escuro();
  }
}
