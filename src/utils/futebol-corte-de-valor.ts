// ============================================================
// futebol-corte-de-valor.ts — a linha que paga abaixo do justo sai da vitrine
// ============================================================
// Irmão de `futebol-mercados-ocultos.ts`, com uma diferença de grão: aquele
// tira o MERCADO inteiro da tela, este tira a LINHA — a que paga pior que a
// referência sharp além do limiar do mercado.
//
// O backend continua publicando e gravando. Esta regra decide só o que o
// assinante vê, pelo mesmo motivo da vitrine: parar de publicar pararia de
// medir, e é a medição que diz se o corte está certo.
//
// Primeiro caso: `asian_handicap`, limiar −2%. Os números que motivaram estão
// na migration 137 e só lá.
//
// O limiar NÃO mora aqui. Ele vem do banco (`get_futebol_limiar_valor`), para
// que mudar o corte seja um UPDATE e não um release, e para que o painel e a DM
// leiam a MESMA fonte. Este módulo é só a regra, pura, para ser testada sem rede.
// ============================================================

import { brtDateStr, brtDayOf, parseUtc } from '@/utils/futebol-datas';

/**
 * O corte de um mercado, com a data em que passou a valer.
 *
 * A data faz aqui o que `ocultoDesde` faz na vitrine: separa a linha que ESTEVE
 * na tela da que nunca esteve. Sem ela o histórico devolveria amanhã a linha
 * cortada hoje, que foi o defeito que a migration 119 corrigiu para o mercado
 * escondido.
 */
export interface LimiarDeValor {
  market: string;
  /** Fração, na escala do `edge` do board: −0,02 é −2%. */
  limiar: number;
  /** ISO em UTC, ou `null` quando veio do fallback e não há data. */
  vigenteDesde: string | null;
}

/**
 * O que vale quando o corte do banco não pode ser lido.
 *
 * NÃO é a fonte da verdade — o banco é. Isto é o que fazer no escuro, e o escuro
 * FECHA: cair para lista vazia mostraria na tela e mandaria na DM exatamente a
 * linha que o produto decidiu tirar.
 *
 * ⚠️ Se o limiar mudar ou sair do banco, MUDE AQUI TAMBÉM. Se ficar diferente,
 * uma falha de leitura aplica o corte velho. A guarda de paridade obriga esta
 * cópia e a de `supabase/functions/shared/corte-de-valor.ts` a andarem juntas.
 */
export const CORTE_FALLBACK: readonly { market: string; limiar: number }[] = [
  { market: 'asian_handicap', limiar: -0.02 },
];

/**
 * A linha passa no corte de valor do seu mercado?
 *
 * Mercado sem limiar sempre passa. Mercado com limiar exige vantagem gravada E
 * acima dele — o limiar em si já corta.
 *
 * ⚠️ Linha SEM vantagem gravada NÃO passa, e isso é o contrário do
 * `passaNoFiltroDeValor` do painel. Lá é um filtro de conveniência, e esconder
 * por um campo nunca gravado apagaria registro. Aqui é porta de publicação: não
 * saber o preço de um mercado onde o preço decide não é motivo para mostrar.
 */
export function passaNoCorteDeValor(
  market: string,
  edge: number | null | undefined,
  limiares: readonly { market: string; limiar: number }[],
): boolean {
  const entrada = limiares.find((l) => l.market === market);
  if (!entrada) return true;
  return typeof edge === 'number' && Number.isFinite(edge) && edge > entrada.limiar;
}

/**
 * Tira do conjunto as linhas que não passam no corte.
 *
 * Genérica em cima de `market` e `edge` pelo mesmo motivo do
 * `filtrarMercadosOcultos`: board, detalhe do jogo e fila do Telegram carregam
 * formas diferentes, e a regra é a mesma nos três.
 */
export function filtrarCorteDeValor<T extends { market: string; edge?: number | null }>(
  linhas: readonly T[],
  limiares: readonly { market: string; limiar: number }[],
): T[] {
  if (!limiares.length) return [...linhas];
  return linhas.filter((linha) => passaNoCorteDeValor(linha.market, linha.edge, limiares));
}

/**
 * Esta linha está cortada, considerando QUANDO ela é?
 *
 * Para o histórico e o placar, que mostram o passado. Mesma forma do
 * `mercadoOcultoNaData`: a linha que não passa no corte some a partir da data em
 * que o corte passou a valer, e fica antes dela, porque ali ela foi publicada,
 * vista e possivelmente apostada.
 *
 * Sem data de vigência (o fallback) vale "de hoje em diante, sem tocar no
 * passado", que é o único recorte que não inventa nem apaga nada. Data da linha
 * ilegível corta: entre mostrar uma linha que o produto tirou e omitir uma cuja
 * data o front não soube ler, a segunda erra menos.
 */
export function cortadaNaData(
  market: string,
  edge: number | null | undefined,
  dataUtc: string | null,
  limiares: readonly LimiarDeValor[],
  agoraMs: number,
): boolean {
  const entrada = limiares.find((l) => l.market === market);
  if (!entrada) return false;
  if (passaNoCorteDeValor(market, edge, [entrada])) return false;
  if (!dataUtc) return true;
  const desde = entrada.vigenteDesde == null ? NaN : Date.parse(entrada.vigenteDesde);
  if (Number.isNaN(desde)) {
    const dia = brtDayOf(dataUtc);
    return dia == null || dia >= brtDateStr(new Date(agoraMs));
  }
  const quando = parseUtc(dataUtc)?.getTime();
  if (quando == null) return true;
  return quando >= desde;
}
