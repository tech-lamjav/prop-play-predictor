import { parseUtc } from '@/utils/futebol-datas';
import type { LinhaPublicada } from './placar-agregacao';

// ============================================================================
// placar-vitrine.ts — o mercado que saiu da tela do assinante
// ============================================================================
// Um mercado pode sair da VITRINE sem sair do BOARD: o backend continua
// publicando e medindo, e só o que o assinante vê muda. Hoje é o caso do
// handicap, fora da vitrine desde 01/09/2026.
//
// O placar conta o mercado oculto POR PADRÃO, ao contrário de
// `scripts/futebol-roi.mjs`, que o exclui por padrão. Não é divergência de
// conta, é divergência de pergunta: o script responde "como foi o produto que o
// assinante usou", e o placar responde "como está a metodologia" — e decidir se
// o handicap volta é exatamente uma das decisões que o placar sustenta.
//
// O recorte "só a vitrine" responde a pergunta do script, e é onde a DATA
// importa: a linha publicada ANTES de o mercado ser escondido esteve na tela e
// foi vista. Excluir o mercado inteiro apagaria também o que o assinante viu.
// ============================================================================

/** Um mercado fora da vitrine, com a data em que saiu. */
export type MercadoOculto = { market: string; oculto_desde: string };

/**
 * A linha esteve na vitrine?
 *
 * Vale pela DETECÇÃO, e não pelo jogo: o que decide é quando ela foi publicada,
 * porque é aí que ela apareceu (ou não) na tela do assinante.
 *
 * ⚠️ A comparação é entre INSTANTES, e não entre dias de Brasília. O corte é um
 * instante — o `oculto_desde` da vitrine —, e arredondar os dois para o dia BRT
 * move o corte um dia para trás quando ele cai à meia-noite em UTC, que é
 * justamente como ele foi gravado.
 */
export function esteveNaVitrine(
  linha: LinhaPublicada,
  ocultos: readonly MercadoOculto[],
): boolean {
  const oculto = ocultos.find((o) => o.market === linha.market);
  if (!oculto) return true;

  const corte = parseUtc(oculto.oculto_desde);
  const publicada = parseUtc(linha.detectada_em);
  if (!corte || !publicada) return true;

  return publicada.getTime() < corte.getTime();
}

/** Só o que o assinante viu. O resto é board, e continua medido em outra leitura. */
export function soAVitrine(
  linhas: readonly LinhaPublicada[],
  ocultos: readonly MercadoOculto[],
): LinhaPublicada[] {
  return linhas.filter((l) => esteveNaVitrine(l, ocultos));
}

/**
 * O selo do mercado na tabela, quando ele está fora da vitrine hoje.
 *
 * `null` quando o mercado está na tela: selo em toda linha não marca nada.
 */
export function seloDeOculto(market: string, ocultos: readonly MercadoOculto[]): string | null {
  return ocultos.some((o) => o.market === market) ? 'fora da vitrine' : null;
}
