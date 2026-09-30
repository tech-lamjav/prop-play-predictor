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
// na migration 144 e só lá.
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
 * ⚠️ Linha SEM vantagem gravada NÃO passa. Aqui é porta de PUBLICAÇÃO: não saber
 * o preço de um mercado onde o preço decide não é motivo para mostrar.
 *
 * O painel já teve um filtro de valor que fazia o contrário — deixava passar a
 * linha sem vantagem gravada, porque lá era conveniência e esconder por um campo
 * nunca gravado apagaria registro. Esse filtro saiu com o valor da tela (#520).
 * Este corte não: ele é invisível, decide o que nasce, e é o que separou ROI
 * +7,9 de ROI −17,4 na medição de setembro.
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
 * A vantagem com que esta linha APARECEU para o assinante.
 *
 * Desde a migration 161, `edge_publicacao` é a vantagem da primeira versão
 * VISÍVEL da oportunidade — e vem NULA quando nunca houve nenhuma. Nulo ali é
 * resposta, não campo em branco: quer dizer "esta linha não chegou a aparecer
 * para ninguém", e é o que a tira da tela.
 *
 * ⚠️ NULO e AUSENTE são coisas diferentes, e é por isso que esta função existe.
 * O `edge_publicacao ?? edge` de antes lia o nulo como ausência e caía na
 * vantagem do APITO, que pode ser ótima — e aí a linha que nunca esteve na
 * vitrine voltava à tela como oportunidade. Ausente é outra coisa: é front novo
 * contra banco anterior à 146, e ali a queda para `edge` continua certa, porque
 * o banco velho não sabe responder a pergunta.
 *
 * ⚠️ A distinção é pelo VALOR, e não pela presença da chave. `'edge_publicacao'
 * in linha` parece dizer a mesma coisa e não diz: qualquer objeto montado com a
 * propriedade escrita — um teste, um `map` que copia campos — tem a chave
 * presente com valor indefinido, e seria classificado como "nunca apareceu". O
 * que chega do banco é JSON: coluna que não veio simplesmente não está no
 * objeto e dá `undefined`; NULL do SQL chega como `null`.
 *
 * Mora aqui, e não nos dois chamadores, porque a mesma expressão escrita em
 * dois arquivos já foi a forma deste defeito duas vezes nesta área.
 */
export function vantagemDePublicacao(linha: {
  edge?: number | null;
  edge_publicacao?: number | null;
}): number | null | undefined {
  return linha.edge_publicacao === undefined ? linha.edge : linha.edge_publicacao;
}

/**
 * Tira do conjunto as linhas que não passam no corte.
 *
 * Genérica em cima de `market` e `edge` pelo mesmo motivo do
 * `filtrarMercadosOcultos`: board, detalhe do jogo e fila do Telegram carregam
 * formas diferentes, e a regra é a mesma nos três.
 */
export function filtrarCorteDeValor<
  T extends { market: string; edge?: number | null; edge_publicacao?: number | null },
>(
  linhas: readonly T[],
  limiares: readonly { market: string; limiar: number }[],
): T[] {
  return separaNoCorteDeValor(linhas, limiares).passam;
}

/**
 * O mesmo corte, devolvendo OS DOIS LADOS.
 *
 * Existe porque sumir com a linha não basta no detalhe do jogo (#432). Lá a
 * tela só conhece dois estados — tem linha de valor, não tem — e a cortada
 * chegava igualzinha à de um jogo que nunca teve preço coletado. Nesse estado a
 * folha troca o Score pela contagem de premissas, no mesmo lugar, tamanho e
 * cor: o número escondido saía e outro entrava no lugar dele.
 *
 * Quem recebe as cortadas não renderiza NADA delas. É a existência que informa,
 * não o conteúdo — e por isso o serviço as reduz à saída (mercado, lado e
 * linha) antes de entregar à tela, sem Score e sem vantagem. O que não chega
 * não é exibido por engano.
 */
export function separaNoCorteDeValor<
  T extends { market: string; edge?: number | null; edge_publicacao?: number | null },
>(
  linhas: readonly T[],
  limiares: readonly { market: string; limiar: number }[],
): { passam: T[]; cortadas: T[] } {
  if (!limiares.length) return { passam: [...linhas], cortadas: [] };
  const passam: T[] = [];
  const cortadas: T[] = [];
  for (const linha of linhas) {
    // Pela vantagem de PUBLICAÇÃO: depois do apito, board e detalhe do jogo
    // devolvem a foto do apito, e cortar por ela esconde linha que apareceu na
    // tela. Ver `vantagemDePublicacao` para o que nulo e ausente significam.
    const passa = passaNoCorteDeValor(linha.market, vantagemDePublicacao(linha), limiares);
    (passa ? passam : cortadas).push(linha);
  }
  return { passam, cortadas };
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
