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
 * Um mercado fora da vitrine, com o PERÍODO em que ficou fora.
 *
 * Espelho de `MercadoOculto` do painel, onde está o comentário inteiro. Em uma
 * frase: sem o começo não dá para separar a linha que esteve na tela da que
 * nunca esteve, e sem o fim religar o mercado o libera para o passado também.
 */
export interface MercadoOculto {
  market: string;
  /** ISO em UTC, ou `null` quando a data não pôde ser lida. */
  ocultoDesde: string | null;
  /** ISO em UTC de quando o mercado VOLTOU, ou `null` enquanto ele está fora. */
  ocultoAte?: string | null;
}

// ---------------------------------------------------------------------------
// Datas, inlineadas de propósito
// ---------------------------------------------------------------------------
// Cópias de `src/utils/futebol-datas.ts`. Não dá para importar: o painel roda no
// browser e isto roda em Deno, e este arquivo ainda é lido pelo vitest da guarda
// de paridade — um import com extensão `.ts` de módulo Deno quebraria lá.
//
// É o mesmo motivo pelo qual o `corte-de-valor.ts` ao lado não tem import
// nenhum. Mudou uma, muda a outra; a guarda compara comportamento.
// ---------------------------------------------------------------------------

const SAO_PAULO_TZ = "America/Sao_Paulo";

function parseUtc(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const iso = raw.includes("T") ? raw : `${raw}T00:00:00`;
  const d = new Date(/[Z]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? null : d;
}

function brtDateStr(d: Date): string {
  // en-CA porque formata como YYYY-MM-DD, que é ordenável como string.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function brtDayOf(kickoffUtc: string | null | undefined): string | null {
  const d = parseUtc(kickoffUtc);
  return d ? brtDateStr(d) : null;
}

/**
 * Esta linha está fora da vitrine, considerando QUANDO ela é?
 *
 * Espelho de `mercadoOcultoNaData` do painel, onde está o comentário inteiro.
 * A guarda de paridade compara as duas caso a caso.
 *
 * É esta regra que faltava deste lado (#439): a DM lia só os NOMES dos mercados
 * ocultos agora, então no dia em que o handicap voltou com data de corte a lista
 * esvaziou e a mensagem passou a tratá-lo como liberado para todos os jogos,
 * inclusive os que o painel esconde. Três alertas saíram para 26 pessoas.
 */
export function mercadoOcultoNaData(
  market: string,
  kickoffUtc: string | null,
  vitrine: readonly MercadoOculto[],
  agoraMs: number,
): boolean {
  const entrada = vitrine.find((m) => m.market === market);
  if (!entrada) return false;
  const fechado = entrada.ocultoAte != null;
  if (!kickoffUtc) return !fechado;
  if (entrada.ocultoDesde == null) {
    const dia = brtDayOf(kickoffUtc);
    return dia == null || dia >= brtDateStr(new Date(agoraMs));
  }
  const kickoff = parseUtc(kickoffUtc)?.getTime();
  if (kickoff == null) return !fechado;
  if (kickoff < Date.parse(entrada.ocultoDesde)) return false;
  // O instante da volta já está na tela: a fronteira fecha do lado de dentro.
  return !fechado || kickoff < Date.parse(entrada.ocultoAte as string);
}

/**
 * Tira da fila de mensagem as linhas escondidas NA DATA DELAS.
 *
 * Substitui o `filtrarMercadosOcultos` nos dois pontos de envio. Aquele decide
 * por nome, e nome não sabe de data: era ele que, com a lista vazia, liberava o
 * mercado religado para os jogos anteriores ao corte.
 */
export function filtrarPelaVitrine<
  T extends { market: string; kickoff_utc: string | null },
>(
  linhas: readonly T[],
  vitrine: readonly MercadoOculto[],
  agoraMs: number,
): T[] {
  if (!vitrine.length) return [...linhas];
  return linhas.filter(
    (linha) => !mercadoOcultoNaData(linha.market, linha.kickoff_utc, vitrine, agoraMs),
  );
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
 * Lê a vitrine COM O PERÍODO, e NUNCA lança.
 *
 * Configuração indisponível não pode derrubar o envio do dia. Mas cair para
 * lista vazia mandaria na DM exatamente o que o produto tirou da prateleira —
 * então o escuro cai para o `VITRINE_FALLBACK`, e a mensagem sai SEM o mercado
 * escondido em vez de sair errada ou não sair.
 *
 * Degrada em DOIS degraus, na mesma ordem do painel (`getVitrine` do service):
 *
 *   1. `get_futebol_vitrine`, que dá o período desde a migration 145;
 *   2. a RPC antiga, que dá só os nomes — é o caso de uma função publicada
 *      antes da 145. Sem data, a regra vale para o presente e não toca no
 *      passado, que é o comportamento anterior: degradação, não regressão;
 *   3. sem nem isso, o fallback compilado.
 *
 * Devolve a origem para o chamador registrar o estado degradado: silêncio aqui é
 * como uma vitrine desatualizada sobreviveria sem ninguém notar. `sem-data` é
 * origem própria justamente porque nesse degrau o corte por período não existe.
 */
export async function carregarVitrine(
  supabase: ClienteRpc,
): Promise<{ mercados: MercadoOculto[]; origem: "banco" | "sem-data" | "fallback" }> {
  const escuro = () => ({
    mercados: VITRINE_FALLBACK.map((market) => ({
      market,
      ocultoDesde: null,
      ocultoAte: null,
    })),
    origem: "fallback" as const,
  });
  try {
    const { data, error } = await supabase.rpc("get_futebol_vitrine");
    if (error || !Array.isArray(data)) throw error ?? new Error("vitrine ilegível");
    const mercados: MercadoOculto[] = [];
    for (const linha of data) {
      if (typeof linha?.market !== "string") throw new Error("vitrine ilegível");
      mercados.push({
        market: linha.market,
        ocultoDesde: linha.oculto_desde ?? null,
        ocultoAte: linha.oculto_ate ?? null,
      });
    }
    return { mercados, origem: "banco" };
  } catch (_) {
    try {
      const { data, error } = await supabase.rpc("get_futebol_mercados_ocultos");
      if (error || !Array.isArray(data)) return escuro();
      return {
        mercados: (data as string[]).map((market) => ({
          market,
          ocultoDesde: null,
          ocultoAte: null,
        })),
        origem: "sem-data",
      };
    } catch (_) {
      return escuro();
    }
  }
}
