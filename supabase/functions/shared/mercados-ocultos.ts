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

/**
 * ⚠️ Sem consumidor de produção deste lado desde a #439 — quem decide envio é o
 * `filtrarPelaVitrine`, que sabe de data. Continua exportado porque é METADE do
 * par de predicados que a guarda de paridade compara com o painel, onde ele
 * segue em uso para decidir sobre o presente.
 */
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
// Cópias de `src/utils/futebol-datas.ts`. Não dá para importar, e o motivo é o
// DEPLOY: cada edge function é empacotada sozinha, a partir de
// `supabase/functions`, então um import que alcance `src/` não sobe. É o mesmo
// motivo pelo qual o `corte-de-valor.ts` ao lado não importa nada — e,
// provavelmente, por que esta regra nunca tinha sido espelhada para cá.
//
// (Não é restrição do vitest: o tsconfig liga `allowImportingTsExtensions`, e a
// guarda de paridade importa este arquivo sem problema. Uma versão anterior
// deste comentário dizia isso, e ensinava errado.)
//
// Mudou uma cópia, muda a outra; a guarda compara comportamento, caso a caso.
// ---------------------------------------------------------------------------

const SAO_PAULO_TZ = "America/Sao_Paulo";

function parseUtc(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  // O separador com ESPAÇO é o formato do `timestamp without time zone` cru, e
  // aparece nos dois lados da fronteira. Sem aceitá-lo, esta função devolve nulo
  // e `mercadoOcultoNaData` cai no ramo do kickoff ilegível — que, com período
  // fechado, NÃO esconde: o vazamento da #439 voltaria calado. Os outros três
  // leitores de kickoff destas funções já normalizavam.
  const iso = raw.includes("T")
    ? raw
    : raw.includes(" ")
    ? raw.replace(" ", "T")
    : `${raw}T00:00:00`;
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
 * Os mercados fora da vitrine AGORA — só os nomes.
 *
 * Espelho do `ocultosAgora` do painel, que documenta esta passagem como
 * obrigatória para todo consumidor de "está oculto hoje", com aviso explícito
 * contra o `.map` direto na vitrine.
 *
 * Aqui quem consome é a TELEMETRIA do ensaio. Sem isto, o evento que existe
 * para denunciar vitrine desatualizada passaria a listar para sempre, como
 * oculto, o mercado que voltou à prateleira — justamente no dia em que alguém
 * confere o religar, que foi como a #439 apareceu.
 */
export function ocultosAgora(vitrine: readonly MercadoOculto[]): string[] {
  return vitrine.filter((m) => m.ocultoAte == null).map((m) => m.market);
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
 * O que vale quando a vitrine do banco não pode ser lida. Cópia do
 * `VITRINE_FALLBACK` do painel, onde está o comentário inteiro — inclusive a
 * regra de ACRESCENTAR o mercado aqui, na mesma mudança, ao escondê-lo.
 *
 * Vazia desde 16/09, quando o handicap voltou à vitrine (#433).
 *
 * ⚠️ Pesa mais deste lado desde a #441: aqui o escuro cai DIRETO nesta lista,
 * sem degrau intermediário. Vazia, a mensagem sai com todos os mercados — que é
 * o certo hoje, porque nenhum está escondido, e seria o vazamento de novo no dia
 * em que um estiver e alguém esquecer desta linha.
 */
export const VITRINE_FALLBACK: readonly string[] = [];

/**
 * Lê a vitrine COM O PERÍODO, e NUNCA lança.
 *
 * Configuração indisponível não pode derrubar o envio do dia. Mas cair para
 * lista vazia mandaria na DM exatamente o que o produto tirou da prateleira —
 * então o escuro cai para o `VITRINE_FALLBACK`, e a mensagem sai SEM o mercado
 * escondido em vez de sair errada ou não sair.
 *
 * UM degrau só, e é aqui que este carregador diverge do painel de propósito.
 *
 * O painel degrada para a RPC antiga, que devolve só os NOMES dos mercados
 * ocultos agora. Do lado da mensagem esse degrau é pior do que inútil: com o
 * mercado religado, a lista de nomes vem VAZIA, nada é escondido, e isso é
 * exatamente o estado que vazou em 16/09. Seria reproduzir o defeito no escuro.
 *
 * O painel pode se dar a esse luxo porque tela errada se corrige na próxima
 * renderização; DM enviada não volta. Então aqui o escuro FECHA: sem o período,
 * vale o `VITRINE_FALLBACK`, que esconde de hoje em diante sem tocar no passado.
 *
 * Devolve a origem para o chamador registrar o estado degradado: silêncio aqui é
 * como uma vitrine desatualizada sobreviveria sem ninguém notar.
 */
export async function carregarVitrine(
  supabase: ClienteRpc,
): Promise<{ mercados: MercadoOculto[]; origem: "banco" | "fallback" }> {
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
    return escuro();
  }
}
