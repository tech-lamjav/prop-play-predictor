import { mercadoOcultoNaData, type MercadoOculto } from '@/utils/futebol-mercados-ocultos';
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
// ⚠️ A REGRA não mora aqui. Ela mora em `futebol-mercados-ocultos.ts`, que é a
// casa dela desde a issue #324 e já trata o caso que este arquivo tinha errado:
// vitrine sem data, que acontece quando a leitura falha e o fallback entra. Este
// módulo só escolhe o EIXO — a detecção — e conta quantas linhas saíram.
// ============================================================================

export type { MercadoOculto };

/**
 * A linha esteve na vitrine?
 *
 * Vale pela DETECÇÃO, e não pelo apito: o que decide é quando ela foi publicada,
 * porque é aí que ela apareceu (ou não) na tela do assinante. É a diferença que
 * importa numa linha publicada em 31/08, para um jogo de 02/09, com o mercado
 * saindo da vitrine em 01/09 — ela esteve na tela.
 */
export function esteveNaVitrine(
  linha: LinhaPublicada,
  ocultos: readonly MercadoOculto[],
  agoraMs: number = Date.now(),
): boolean {
  return !mercadoOcultoNaData(linha.market, linha.detectada_em, ocultos, agoraMs);
}

/** Só o que o assinante viu. O resto é board, e continua medido em outra leitura. */
export function soAVitrine(
  linhas: readonly LinhaPublicada[],
  ocultos: readonly MercadoOculto[],
  agoraMs: number = Date.now(),
): LinhaPublicada[] {
  return linhas.filter((l) => esteveNaVitrine(l, ocultos, agoraMs));
}

/**
 * O selo do mercado na tabela, quando ele está fora da vitrine hoje.
 *
 * `null` quando o mercado está na tela: selo em toda linha não marca nada.
 */
export function seloDeOculto(market: string, ocultos: readonly MercadoOculto[]): string | null {
  return ocultos.some((o) => o.market === market) ? 'fora da vitrine' : null;
}
